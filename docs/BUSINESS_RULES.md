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

## 3. Cancelación y Rechazo de Invitaciones Pendientes (Cero Porcentaje Huérfano)

- **Cancelación por el Propietario (Individual o Masiva):** El propietario puede cancelar cualquier invitación en estado `PENDIENTE` en cualquier momento antes de su aceptación, tanto individualmente como en bloque mediante `cancel_all_pending_invites`, sin importar si el décimo se encuentra en estado `PENDIENTE`, `VALIDADO` o `ARCHIVADO` (salvo que ya esté `LIQUIDADO`). La función RPC marca la invitación como `CANCELADA` y **suma inmediatamente el porcentaje cancelado a la participación del propietario**.
- **Rechazo por el Invitado:** Si el destinatario decide rechazar la invitación, esta pasa al estado `RECHAZADA` y **su porcentaje se restituye automáticamente al propietario**.
- **Invariante:** Bajo ninguna circunstancia puede existir porcentaje huérfano ni la suma total de participaciones activas + invitaciones pendientes puede ser distinta del 100.00%.

---

## 4. Solicitud y Respuesta de Renuncia (Participaciones `ACEPTADA`)

- Una vez que un participante ha aceptado una participación (`status = 'ACEPTADA'`), su derecho es inmutable de forma unilateral.
- Ni el propietario ni un administrador pueden revocar o rebajar dicha cuota arbitrariamente.
- **Flujo de Renuncia:**
  1. El propietario pulsa *"Solicitar renuncia"*, ejecutando la RPC `request_share_waiver(share_id)`.
  2. El sistema marca `waiver_requested = true, waiver_requested_at = now()` y emite una notificación de alta prioridad al participante.
  3. El participante dispone de dos opciones exclusivas:
     - **Aceptar renuncia:** El porcentaje del participante pasa a 0.00%, su estado cambia a `RENUNCIADA`, `waiver_requested = false` y el porcentaje cedido se acredita de inmediato a la cuota del propietario.
     - **Rechazar renuncia:** Se cancela la petición (`waiver_requested = false`) y la participación se mantiene íntegra y vigente.

---

## 5. Confirmación de Cobro de Premios y Liquidación Automática

- Cuando un décimo resulta premiado (`prize_amount_cents > 0`), se habilita en la interfaz de cada participante con cuota activa el botón interactivo *"He recibido mi premio"*.
- Al ser presionado, la RPC `confirm_prize_received(ticket_id)` valida la identidad del participante y marca `prize_paid_confirmed = true, prize_paid_confirmed_at = now()`, registrando el evento de auditoría `COBRO_PREMIO_CONFIRMADO`.
- **Cierre y Liquidación Automática:** Si tras dicha confirmación **todas** las cuotas activas (`ACEPTADA`) del décimo tienen `prize_paid_confirmed = true`, el estado del décimo cambia automáticamente a `LIQUIDADO` y se emite el evento `DECIMO_LIQUIDADO`.

---

## 6. Sorteos Admitidos, Captura GS1-128 y Boleto Realista

- **Sorteos Exclusivos Admitidos:** La plataforma opera exclusivamente con los dos grandes sorteos extraordinarios de Lotería Nacional:
  1. **Lotería de Navidad (`NAVIDAD`):** Sorteo celebrado el 22 de diciembre, precio oficial 20,00 € por décimo.
  2. **Sorteo de El Niño (`EL_NINO`):** Sorteo celebrado el 6 de enero, precio oficial 20,00 € por décimo.
  *(Quedan expresamente excluidos los sorteos ordinarios de jueves y sábados para focalizar la experiencia en custodia compartida de sorteos extraordinarios).*
- Para evitar costes y riesgos de almacenamiento de imágenes pesadas y problemas de privacidad, **no se permite la subida libre de fotos arbitrarias de boletos al storage**.
- Los décimos se registran mediante:
  1. **Lectura de Código de Barras GS1-128 / Code-128:** Decodifica número (5 dígitos), serie, fracción y asigna automáticamente el sorteo (`NAVIDAD` o `EL_NINO` según fecha).
  2. **Entrada Manual Asistida:** En caso de desgaste del código de barras, con selector exclusivo de 2 botones (**Navidad** y **El Niño**).
- **Renderizado del Boleto Realista:** La interfaz web utiliza el motor vectorial hiperrealista nativo (con orla guilloché, capilla artística con sello digital `MisDecimos`, tipografía matricial y código GS1-128), asegurando renderizado instantáneo y fallback anti-imagen rota sin errores 404.

---

## 7. Verificación Oficial de Premios

- Las comprobaciones de premios se ejecutan primariamente contra los endpoints oficiales de alta disponibilidad de El País / SELAE:
  - Lotería de Navidad: `https://api.elpais.com/ws/LoteriaNavidadPremiados?n=XXXXX`
  - Sorteo de El Niño: `https://api.elpais.com/ws/LoteriaNinoPremiados?n=XXXXX`
- Como respaldo ante cualquier contingencia, se utiliza el servicio `loteriasapi.com` ejecutado a través de Supabase Edge Functions con la API Key protegida en Supabase Secrets.
