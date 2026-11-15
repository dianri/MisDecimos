# 🎟️ MisDecimos

**MisDecimos** es una plataforma Web PWA (Progressive Web App) diseñada para la gestión segura, custodia compartida y reparto transparente de participaciones de décimos de Lotería Nacional (Navidad, El Niño y sorteos semanales) entre amigos, familiares y peñas.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18+, Vite 6, TypeScript, Tailwind CSS, Lucide React, `vite-plugin-pwa`.
- **Backend:** Supabase Cloud (`xmdghpyfrblmtjtevtru`):
  - Base de datos PostgreSQL con políticas Row-Level Security (RLS) estrictas.
  - Funciones transaccionales RPC en PL/pgSQL (`SECURITY DEFINER`).
  - Triggers y suscripciones Realtime.
  - Web Push nativo mediante suscripciones VAPID y Edge Functions.
- **Fuentes de Datos de Lotería:** API pública de resultados (El País / SELAE) y fallback `loteriasapi.com`.

---

## 📦 Estructura del Proyecto

```text
├── .agent/
│   └── workflows/              # Workflows de inicio y finalización de tareas
├── docs/
│   ├── ARCHITECTURE.md         # Modelo ER, catálogo de RPCs y diseño Web Push
│   ├── BUSINESS_RULES.md       # Reglas de negocio inmutables
│   └── STATUS.md               # Panel vivo del estado del proyecto
├── src/
│   ├── components/             # Componentes de UI y utilidades comunes
│   │   └── common/
│   │       └── VersionBadge.tsx# Badge de versión anti-caché y control de SW
│   ├── lib/
│   │   └── supabase.ts         # Cliente Supabase singleton
│   ├── types/
│   │   └── database.types.ts   # Tipos generados de Supabase
│   ├── App.tsx                 # Entrada principal de la aplicación
│   └── main.tsx                # Bootstrap de React
├── supabase/
│   └── migrations/             # Migraciones SQL secuenciales
├── AGENTS.md                   # Normas obligatorias de gobernanza y Git Flow
├── CHANGELOG.md                # Registro de cambios (Keep a Changelog)
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

---

## ⚙️ Variables de Entorno

Crear un archivo `.env` en la raíz (puedes copiar de `.env.example`):

```bash
VITE_SUPABASE_URL=https://xmdghpyfrblmtjtevtru.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key-de-supabase>
```

---

## 🚀 Scripts Disponibles

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Verificación de tipos TypeScript
npm run typecheck

# Compilar para producción (incluye PWA)
npm run build

# Previsualizar build de producción
npm run preview
```

---

## 🛡️ Gobernanza y Flujo de Trabajo

Este proyecto implementa **Git Flow estricto** y reglas de gobernanza multi-agente detalladas en [AGENTS.md](AGENTS.md). Toda modificación debe partir de `develop` en ramas `feature/<nombre>` o `fix/<nombre>`.
