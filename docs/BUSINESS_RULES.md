# BUSINESS_RULES.md — Especificación de Reglas de Negocio de MisDecimos

Este documento contiene las reglas de negocio canónicas de **MisDecimos**. Ningún desarrollo en frontend o backend puede contradecir lo aquí estipulado.

---

## 1. Estados del Décimo y Ciclo de Vida

Un décimo (`public.tickets`) atraviesa los siguientes estados:

1. **`PENDIENTE`:**
   - Estado inicial al registrar el décimo.
   - **Permisos de gestión y eliminación:** El propietario puede cancelar invitaciones no reclamadas o borrar el décimo si **ningún** participante tercero tiene una participación en estado `ACEPTADA`. Si existen participaciones aceptadas por otros usuarios, el décimo queda bloqueado contra edición de metadatos o eliminación directa.
2. **`VALIDADO`:**
   - Se alcanza tras ejecutarse la comprobación oficial del sorteo frente a las fuentes de datos.
   - **Independencia de gestión de cuotas no reclamadas:** La validación del sorteo **no bloquea** la gestión de invitaciones pendientes (`status = 'PENDIENTE'`). El propietario puede cancelarlas individualmente o en bloque y recuperar su cuota al 100%, así como añadir nuevas participaciones mientras conserve porcentaje disponible.
   - Asimismo, el propietario puede eliminar el décimo en estado `VALIDADO` siempre que no existan cuotas de terceros con `status = 'ACEPTADA'`.
   - Si el décimo no resulta premiado (`prize_amount_cents = 0`), permanece en este estado para archivo histórico.
3. **`ARCHIVADO`:**
   - La acción de archivar no borra ni modifica globalmente el décimo; se gestiona de forma individual por usuario mediante la tabla de relación `public.ticket_archive_hides`.
   - Cada usuario puede archivar u ocultar décimos de su vista principal sin afectar la visibilidad de los demás cotitulares.
4. **`LIQUIDADO`:**
   - Estado final alcanzado únicamente en décimos con premio (`prize_amount_cents > 0`) cuando **todos los participantes con porcentaje activo (`ACEPTADA`) han confirmado haber recibido su cobro**.

---

## 2. Reparto de Participaciones y Fuente de Verdad Transaccional

1. **Titularidad Inicial:**
   - Todo décimo se crea con un único registro en `public.ownership_shares` asignado al propietario (`role = 'PROPIETARIO'`) con el **100.00%** y estado `ACEPTADA`.
2. **Creación de Participaciones Manuales:**
   - El propietario puede ceder un porcentaje arbitrario `P` ($0 < P \le \text{porcentaje disponible del propietario}$).
   - El porcentaje `P` se descuenta de forma atómica del registro del propietario en `ownership_shares` y se crea un registro en `public.pending_invites` en estado `PENDIENTE` con:
     - Un token criptográfico único (`invite_token` UUID).
     - Un código corto numérico de **6 dígitos** (`short_code`), de fácil dictado o introducción manual.
3. **Reparto a Partes Iguales (Stepper 2 a 10 partes):**
   - El propietario selecciona el número de partes $N$ ($2 \le N \le 10$) y si él participa o no en el reparto.
   - Si existen invitaciones previas en estado `PENDIENTE`, la función transaccional las cancela de inmediato, reintegrando sus porcentajes al propietario para obtener el total disponible $Z$.
   - **Fórmula de redondeo anti-pérdidas de céntimos:**
     $$\text{base} = \text{round}\left(\frac{Z}{N}, 2\right)$$
     $$\text{owner\_pct} = Z - \left[\text{base} \times (N - 1)\right]$$
     El propietario absorbe cualquier milésima de céntimo producida por el redondeo para asegurar que la suma exacta de los porcentajes sea siempre idéntica a $Z$ (sin discrepancias de 0.01%).
   - Se actualiza la cuota del propietario a `owner_pct` y se generan $(N - 1)$ invitaciones pendientes con cuota `base`%. Si el propietario decide no participar, su cuota queda en 0.00% y se crean $N$ invitaciones pendientes.

---

## 3. Cancelación y Rechazo de Invitaciones Pendientes (Cero Porcentaje Huérfano y Privacidad Estricta)

- **Privacidad Estricta de Invitaciones Pendientes (Cero Fuga de Códigos y PINs):**
  - Las invitaciones en estado `PENDIENTE` (`public.pending_invites`), sus códigos PIN de 6 dígitos (`short_code`), enlaces y códigos QR son **estrictamente confidenciales y de uso exclusivo del propietario del décimo**.
  - **Aislamiento en Base de Datos (RLS):** La política `SELECT` de `public.pending_invites` restringe la lectura únicamente al propietario del décimo (`created_by = auth.uid() OR is_ticket_owner(ticket_id)`) y al participante que ya la haya aceptado formalmente (`accepted_by_user_id = auth.uid()`). Ningún otro participante del décimo (`ownership_shares`) puede consultar ni listar invitaciones en estado `PENDIENTE` ni obtener códigos PIN o tokens por API.
  - **Aislamiento en Interfaz:** En `TicketDetailPage.tsx` y `OwnershipBreakdownCard.tsx`, las tarjetas amarillas de invitaciones pendientes, los botones para ver QR/compartir y las acciones de cancelación se renderizan únicamente cuando `isOwner === true`. Para cotitulares terceros, cualquier cuota pendiente o no asignada se refleja exclusivamente en el gráfico Donut y su leyenda como porcentaje agregado neutro (*"Sin asignar / Pendiente (X%)"*).
- **Cancelación por el Propietario (Individual o Masiva):** El propietario puede cancelar cualquier invitación en estado `PENDIENTE` en cualquier momento antes de su aceptación, tanto individualmente como en bloque mediante `cancel_all_pending_invites`, sin importar si el décimo se encuentra en estado `PENDIENTE`, `VALIDADO` o `ARCHIVADO` (salvo que ya esté `LIQUIDADO`). La función RPC marca la invitación como `CANCELADA` y **suma inmediatamente el porcentaje cancelado a la participación del propietario**.
- **Rechazo por el Invitado:** Si el destinatario decide rechazar la invitación, esta pasa al estado `RECHAZADA` y **su porcentaje se restituye automáticamente al propietario**.
- **Invariante:** Bajo ninguna circunstancia puede existir porcentaje huérfano ni la suma total de participaciones activas + invitaciones pendientes puede ser distinta del 100.00%.

---

## 4. Solicitud y Respuesta de Renuncia (Participaciones `ACEPTADA`)

- Una vez que un participante ha aceptado una participación (`status = 'ACEPTADA'`), su derecho es inmutable de forma unilateral.
- Ni el propietario ni un administrador pueden revocar o rebajar dicha cuota arbitrariamente.
- **Flujo de Renuncia Bilateral (Iniciado por el Propietario):**
  1. El propietario pulsa *"Solicitar renuncia"*, ejecutando la RPC `request_share_waiver(share_id)`.
  2. El sistema marca `waiver_requested = true, waiver_requested_at = now()` y emite una notificación de alta prioridad al participante.
  3. El participante dispone de dos opciones exclusivas:
     - **Aceptar renuncia:** El porcentaje del participante pasa a 0.00%, su estado cambia a `RENUNCIADA`, `waiver_requested = false` y el porcentaje cedido se acredita de inmediato a la cuota del propietario.
     - **Rechazar renuncia:** Se cancela la petición (`waiver_requested = false`) y la participación se mantiene íntegra y vigente.
- **Renuncia Voluntaria del Participante (`renounce_own_participation`):**
  - Cualquier cotitular con cuota aceptada (`status = 'ACEPTADA'`, `role = 'PARTICIPANTE'`) puede renunciar de forma directa y voluntaria a su participación sin requerir solicitud previa del propietario.
  - **Condiciones:** El décimo no debe encontrarse en estado `LIQUIDADO` ni en estado `VALIDADO` con premio pendiente de cobro (`prize_amount_cents > 0`).
  - **Efectos Atómicos:** El porcentaje íntegro del participante se reintegra de inmediato a la cuota del propietario (`role = 'PROPIETARIO'`), la participación pasa al estado `RENUNCIADA` con 0,00%, se limpia cualquier solicitud de renuncia pendiente y se inserta un evento inmutable en `public.audit_events` (`RENUNCIA_VOLUNTARIA_PARTICIPANTE`), notificando al custodio mediante alerta interna y Web Push nativo.
- **Salida Automática y Redirección tras Renunciar:**
  - Al confirmarse cualquier renuncia (voluntaria o aceptando la solicitud del custodio), el participante es redirigido de forma automática e inmediata a la pestaña **Participaciones** (`/?tab=participaciones`) con `replace: true`, eliminando `/billete/:id` del historial del navegador.
  - Se muestra un toast informativo: *"Has renunciado a la participación. El décimo se ha retirado de tus participaciones."*
  - Si el usuario pulsa Atrás en Android o en el navegador, no podrá volver al décimo renunciado.
- **Protección de Acceso a Décimos con Participación Renunciada:**
  - Si un usuario no propietario intenta acceder directamente a `/billetes/:id` de un billete cuya cuota fue renunciada (o no activa), la ficha bloquea la carga, muestra el toast *"Ya no tienes acceso a este décimo porque renunciaste a tu participación."* y redirige de inmediato a `/?tab=participaciones` (`replace: true`).
  - Al confirmarse la renuncia (en la ficha o desde la bandeja de alertas), todas las notificaciones pendientes vinculadas a dicho billete para ese usuario se marcan atómicamente como leídas en Supabase (`is_read = true`).
  - En la bandeja de Alertas (`AlertsPage.tsx`), las alertas asociadas a décimos con participación renunciada inhabilitan el acceso a la ficha, sustituyen el enlace *"Ver billete"* por la insignia `Participación renunciada · Sin acceso` y al pulsarse muestran el aviso informativo sin transferir navegación.

---

## 5. Confirmación de Cobro de Premios y Liquidación Automática

- **Flujo Bilateral de Solicitud y Confirmación de Cobro:**
  1. **Solicitud iniciada por el Custodio (`request_prize_payout_confirmation`):**
     - En décimos con premio (`prize_amount_cents > 0`), el custodio propietario dispone del menú contextual de tres puntos (`MoreVertical`) en cada tarjeta de cotitular con cuota aceptada que figure como `PENDIENTE DE COBRO`.
     - Al pulsar *"Solicitar confirmación de cobro"* (o *"Reenviar solicitud de cobro"* si ya se envió), la RPC transaccional registra `prize_payout_requested_at = now()`, emite el evento inmutable `SOLICITUD_CONFIRMACION_COBRO` en `audit_events` y despacha una notificación en `public.notifications` con deep link al décimo, activando el envío Web Push nativo a Android.
     - La tarjeta del cotitular refleja un banner informativo en ámbar suave: *"Solicitud de confirmación de cobro enviada. Esperando respuesta del participante."*
  2. **Confirmación con un toque por el Cotitular (`confirm_prize_payout_received` / `confirm_prize_received`):**
     - El participante visualiza de forma destacada en su propia tarjeta de cotitular (y en la tarjeta superior de premio) el botón interactivo *"Confirmar cobro recibido (X,XX €)"*.
     - Al ser presionado, la RPC valida la identidad del participante y marca `prize_paid_confirmed = true, prize_paid_confirmed_at = now()`, registrando el evento de auditoría `COBRO_PREMIO_CONFIRMADO` y notificando de inmediato al custodio.
  3. **Cierre y Liquidación Automática:**
     - Si tras dicha confirmación **todas** las cuotas activas (`ACEPTADA`) del décimo tienen `prize_paid_confirmed = true`, el estado del décimo cambia automáticamente a `LIQUIDADO` y se emite el evento `DECIMO_LIQUIDADO`.
  4. **Restablecimiento Limpio en Simulaciones:**
     - Al restablecer una simulación con `reset_ticket_prize_simulation`, se purgan automáticamente `prize_paid_confirmed`, `prize_paid_confirmed_at`, `prize_payout_requested_at` y `prize_payout_requested_by`, devolviendo el décimo a su estado inicial íntegro.

---

## 6. Sorteos Admitidos, Captura GS1-128 y Boleto Realista

- **Sorteos Exclusivos Admitidos:** La plataforma opera exclusivamente con los dos grandes sorteos extraordinarios de Lotería Nacional:
  1. **Lotería de Navidad (`NAVIDAD`):** Sorteo celebrado el 22 de diciembre, precio oficial 20,00 € por décimo.
  2. **Sorteo de El Niño (`EL_NINO`):** Sorteo celebrado el 6 de enero, precio oficial 20,00 € por décimo.
  *(Quedan expresamente excluidos los sorteos ordinarios de jueves y sábados para focalizar la experiencia en custodia compartida de sorteos extraordinarios).*
- **Captura y Prueba Gráfica en Certificación Legal:**
  - El alta de décimos en el listado se realiza mediante **Código de Barras GS1-128 / Code-128** o **Entrada Manual Asistida** (sin subida libre de fotos en el alta).
  - No obstante, dentro de la pestaña **Certificación Legal**, el depositario **sí** puede capturar o adjuntar la **fotografía del anverso del décimo** como prueba gráfica vinculada mediante huella criptográfica `SHA-256` (almacenada en el bucket privado `ticket-certifications` y compartida entre **Certificado Digital** y **Firma Manuscrita**, ocultando los botones de captura en cuanto ya existe una imagen asociada).
- **Renderizado del Boleto Realista y Sello Digital (`<RealisticTicketCard />`):** La interfaz web utiliza el motor vectorial hiperrealista nativo (con orla guilloché, capilla artística con **`SELLO DIGITAL`** interactivo —`SIN FIRMAR` o `FIRMADO` como acceso directo a `Certificación Legal`—, tipografía matricial y código GS1-128), asegurando renderizado instantáneo y fallback anti-imagen rota sin errores 404. El disparador oculto de 5 pulsaciones del modo simulación de premios (solo propietario) reside en el recuadro **`NÚMERO / SERIE / FRACCIÓN`**.

---

## 7. Verificación Oficial de Premios

- Las comprobaciones de premios se ejecutan primariamente contra los endpoints oficiales de alta disponibilidad de El País / SELAE:
  - Lotería de Navidad: `https://api.elpais.com/ws/LoteriaNavidadPremiados?n=XXXXX`
  - Sorteo de El Niño: `https://api.elpais.com/ws/LoteriaNinoPremiados?n=XXXXX`
- Como respaldo ante cualquier contingencia, se utiliza el servicio `loteriasapi.com` ejecutado a través de Supabase Edge Functions con la API Key protegida en Supabase Secrets.
- **Bloqueo de Comprobación Previa al Sorteo (Anti-Falsos Negativos):**
  - Ningún décimo puede comprobarse antes de la fecha y hora oficial de inicio del sorteo en hora peninsular española (`Europe/Madrid` CET):
    - **Lotería de Navidad (`NAVIDAD`):** 22 de diciembre a las 09:00 CET.
    - **Sorteo de El Niño (`EL_NINO`):** 6 de enero a las 12:00 CET.
  - La ausencia de resultados en la API antes de la fecha oficial **jamás** se interpreta como *"Sin premio (0,00 €)"* ni modifica el estado del billete a `VALIDADO`.
  - Los décimos permanecen en estado `PENDIENTE` con todas las acciones de gestión, reparto y cancelación de cuotas activas.
  - La Edge Function `check-prizes` valida en servidor la hora oficial y rechaza cualquier consulta prematura con el código `DRAW_NOT_HELD_YET` sin persistir mutaciones en base de datos.
  - Si la API indica que el sorteo se encuentra en curso (`error: 1` o `status: 0`), se responde con `DRAW_IN_PROGRESS` sin registrar el décimo como no premiado.

---

## 8. Visibilidad y Cómputo de Participaciones Renunciadas

- Si un participante renuncia a una participación (`ownership_shares.status = 'RENUNCIADA'` y `percentage = 0`), ese décimo:
  1. **Deja de computar como billete activo** en la tarjeta superior **"BILLETES ACTIVOS"** (`totalActivosCount`) para dicho usuario en `TicketsPage`.
  2. **Queda excluido del total métrico "TOTAL PREMIOS"** (`totalPremiosGanados`) del usuario.
  3. **Desaparece de la pestaña "Participaciones"** del usuario y de la pestaña **"Archivados"** del usuario.
  4. **Trazabilidad intacta:** Permanece inmutable en el registro de auditoría (`audit_events`) y visible en el panel del custodio propietario del décimo con 0,00 € y mención expresa de renuncia formal.

---

## 9. Certificación Legal, Custodia y Firma de Participaciones

1. **Dos Niveles de Garantía Legal:**
   - **Certificado Digital (Validez jurídica plena):** Permite al depositario certificar la custodia (`CUSTODY_CERTIFIED`) y a los partícipes firmar su participación (`PARTICIPATION_SIGNED`) mediante **AutoFirma** (escritorio y Android/iOS a través del relay HTTPS `autofirma-relay`) o mediante certificado **`.p12 / .pfx`** procesado en memoria en cliente (`node-forge`), generando un código de verificación único (`MD-AAAA-XXXX-XXXX`).
   - **Firma Manuscrita (Acuerdo privado simple):** Permite al depositario (`HANDWRITTEN_CUSTODY_SIGNED`) y a los partícipes (`HANDWRITTEN_PARTICIPATION_SIGNED`) suscribir un acuerdo privado mediante lienzo táctil en pantalla (`SignaturePadCanvas`) con nombre completo y DNI/NIE validado (sin campo de teléfono).
2. **Precedencia Absoluta de Identidad del Certificado Digital:**
   - Si el depositario o un partícipe en su `participation_id` activo dispone de firma con **Certificado Digital**, su identidad verificada (`Nombre completo` y `NIF/DNI/NIE` extraídos del certificado X.509) prevalece automáticamente sobre cualquier dato previo de Firma Manuscrita, bloqueando (`readOnly`/`disabled`) los campos de identidad en el formulario manuscrito, en la UI de firmas registradas y en el Documento Legal PDF.
3. **Aislamiento Estricto por `participation_id` Activo:**
   - La comprobación de firma digital o manuscrita de un partícipe se evalúa exclusivamente por el `id` de su participación vigente (`ACEPTADA` / `PENDIENTE`), sin heredar jamás firmas de participaciones históricas ya renunciadas o canceladas aunque pertenezcan al mismo usuario y décimo.
4. **Blindaje de Renuncias de Igual Nivel:**
   - Toda participación firmada con **Certificado Digital** (`PARTICIPATION_SIGNED`) exige obligatoriamente firma electrónica de renuncia (`PARTICIPATION_RENOUNCED`) desde **Certificación Legal**, **Reparto**, **Notificaciones** y a nivel de base de datos mediante el trigger `BEFORE UPDATE` (`trg_guard_signed_participation_renounce`) sobre `public.ownership_shares`.
5. **Documento Legal PDF Unificado (`generateLegalCustodyPdf`):**
   - Se exporta desde un único botón **`Descargar Documento Legal (PDF)`**, válido tanto si existe Certificado Digital como si únicamente existen Firmas Manuscritas.
   - Incluye: **Sección 1** (datos del décimo, fotografía del anverso y `SHA-256`), **Sección 2** (certificación digital del depositario o aviso de acuerdo privado manuscrito), **Sección 3** (cuadro con participaciones `ACTIVA`, invitaciones `SIN RECLAMAR` y `RENUNCIADA` a 0%, priorizando la identidad del certificado digital) y **Sección 4** (anexo cronológico inmutable en español con `PARTICIPATION_ACCEPTED`, firmas y renuncias, huellas `SHA-256` e imágenes PNG de las firmas manuscritas incrustadas inline en orden temporal).

---

## 10. Motor Histórico Oficial (2020–2025) y Reglas de Escrutinio SELAE

- **Base de Datos Histórica Integrada:**
  - Cubre todos los sorteos oficiales de Lotería de Navidad (22 de diciembre) y El Niño (6 de enero) de los años 2020, 2021, 2022, 2023, 2024 y 2025.
- **Reglas Oficiales de Escrutinio Matemático:**
  1. **Lotería de Navidad (`NAVIDAD`):**
     - **Premios Mayores:** 1.º premio / El Gordo (400.000 €/décimo), 2.º premio (125.000 €), 3.º premio (50.000 €), 4.º premios (20.000 € c/u), 5.º premios (6.000 € c/u).
     - **Aproximaciones (±1):** Anterior y posterior al 1.º premio (2.000 €); anterior y posterior al 2.º premio (1.250 €).
     - **Centenas (Primeros 3 dígitos):** Centena del 1.º, 2.º, 3.º y 4.º premios (100 € por décimo). Pueden acumular con terminaciones de premios distintos.
     - **Dos Últimas Cifras:** Coincidencia con las 2 últimas cifras del 1.º, 2.º o 3.º premio (100 € por décimo). La coincidencia con las 2 últimas cifras del Gordo subsume el reintegro de 20 € (no suma 120 €).
     - **Reintegro:** Coincidencia de la última cifra con el Gordo (20 € por décimo), aplicable si no ha ganado ya la terminación de 2 cifras del Gordo.
  2. **Sorteo de El Niño (`EL_NINO`):**
     - **Premios Mayores:** 1.º premio (200.000 €/décimo), 2.º premio (75.000 €), 3.º premio (25.000 €).
     - **Aproximaciones (±1):** Anterior y posterior al 1.º premio (1.200 €); anterior y posterior al 2.º premio (610 €).
     - **Extracciones y Terminaciones Especiales:**
       - Extracciones de 4 cifras (350 €/décimo).
       - Extracciones de 3 cifras y centenas (100 €/décimo).
       - Extracciones de 2 cifras (40 €/décimo).
       - Reintegros especiales (3 reintegros oficiales: última cifra del 1.º premio + 2 números adicionales, 20 €/décimo).
     - **Regla de No-Solapamiento de Terminaciones:** Los premios mayores tienen prioridad absoluta sobre terminaciones. Las extracciones de 4, 3, 2 cifras y reintegros se evalúan por sufijo de mayor a menor sin acumulación sobre el mismo sufijo.
- **Persistencia Transaccional y Confirmación 0 €:**
  - Para billetes históricos no premiados (0 €), el sistema registra el billete como `VALIDADO` con fuente `historico_oficial` y muestra confirmación nítida sin banners de error.
