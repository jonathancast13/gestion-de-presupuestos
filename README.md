# Gestión de Presupuestos

Aplicación web para gestionar **presupuestos y facturas**: crea documentos con
numeración automática, consúltalos desde el histórico y genera un **PDF
corporativo** listo para enviar al cliente por WhatsApp. Pensada para usarse
tanto en escritorio como en el móvil, con acceso protegido por login.

---

## Qué es

Sustituye la preparación manual de presupuestos sobre plantillas de ofimática,
eliminando los errores habituales de cálculo, la numeración duplicada y los
documentos que se pierden entre carpetas.

- **Numeración automática e irrepetible** por tipo y año (`PRE-2026-001`,
  `FAC-2026-002`, ...), asignada por el servidor.
- **Cálculo automático** de subtotales, IVA, totales y formas de pago.
- **Clientes deduplicados** por NIF: al editar uno, se actualiza en todos sus
  documentos.
- **Histórico consultable** con edición y borrado de cualquier documento.
- **PDF corporativo** con la identidad visual de la empresa y envío directo por
  WhatsApp.
- **Acceso protegido** con login (JWT) y límite de intentos fallidos.
- **Diseño responsive** e instalable como aplicación (PWA).

---

## Objetivos alcanzados

| Objetivo | Estado |
| -------- | ------ |
| Acceso protegido con login (JWT) y control de intentos fallidos | ✅ |
| CRUD completo de documentos (presupuestos y facturas) | ✅ |
| Numeración automática única por tipo y año | ✅ |
| Gestión de clientes con deduplicación por NIF | ✅ |
| PDF corporativo fiel a la plantilla de la empresa | ✅ |
| Formas de pago opcionales (adelanto, reparto a medida, vencimientos) | ✅ |
| Descripción del trabajo y condiciones del presupuesto | ✅ |
| Envío por WhatsApp | ✅ |
| Diseño responsive mobile-first | ✅ |
| PWA instalable (manifest + iconos) | ✅ |
| Tests automatizados en backend y frontend | ✅ |
| Despliegue en producción (Render + Vercel) | ✅ |

---

## Arquitectura

- **Frontend en Vercel**: aplicación Next.js servida por CDN con HTTPS.
- **Backend en Render**: API Flask detrás de gunicorn, con health check público.
- **Base de datos PostgreSQL** gestionada, con copias de seguridad automáticas.
- El PDF se genera **en el navegador**, así que el backend solo expone una API
  JSON ligera.

---

## Tecnologías

### Backend

| Tecnología | Uso |
| ---------- | --- |
| Flask 3 | Framework web y API REST |
| SQLAlchemy / Flask-SQLAlchemy | ORM y modelos |
| Flask-Migrate (Alembic) | Migraciones de esquema |
| PostgreSQL + psycopg | Base de datos en producción |
| SQLite | Base de datos local de desarrollo |
| PyJWT · Flask-CORS | Sesión y orígenes permitidos |
| gunicorn | Servidor WSGI en producción |
| pytest | Tests (74 pruebas) |

### Frontend

| Tecnología | Uso |
| ---------- | --- |
| Next.js 16 (App Router, Turbopack) | Aplicación y compilación |
| React 19 | Interfaz de usuario |
| Tailwind CSS 4 | Estilos y diseño responsive |
| @react-pdf/renderer | Generación del PDF en el navegador |
| lucide-react | Iconografía |
| Vitest + Testing Library | Tests (50 pruebas) |
| ESLint | Análisis estático |

---

## Puesta en marcha

Requisitos: **Python 3.10+** y **Node.js 20+** (opcional: Docker).

```bash
# Terminal 1 — backend (puerto 5000)
cd backend
pip install -r requirements.txt
cp .env.example .env
python app.py

# Terminal 2 — frontend (puerto 3000)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Abre <http://localhost:3000> e inicia sesión con el acceso configurado en
`backend/.env`. También puede levantarse todo con `docker compose up`.

> El acceso y la configuración de cada entorno se definen mediante **variables
> de entorno**; el repositorio no contiene credenciales, solo plantillas de
> ejemplo (`.env.example`).

---

## Tests

```bash
# Backend — 74 pruebas
cd backend
python -m pytest

# Frontend — 50 pruebas + análisis y build
cd frontend
npm run lint
npm test
npm run build
```

---

## Estructura

```
├── backend/                  # API Flask
│   ├── app.py                # Configuración y arranque
│   ├── models.py             # Modelos SQLAlchemy
│   ├── blueprints/           # Rutas (auth y documentos)
│   ├── migrations/           # Migraciones de esquema
│   └── tests/                # pytest
├── frontend/                 # Aplicación Next.js
│   ├── app/                  # Páginas y componentes (incluye el PDF)
│   └── lib/                  # API, sesión, dinero y datos de empresa
├── scripts/                  # Utilidades (generación del logo)
├── docker-compose.yml        # Entorno de desarrollo con recarga
└── README.md
```
