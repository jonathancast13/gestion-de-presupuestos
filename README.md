# Gestión de Presupuestos

Generador de presupuestos y facturas con historial, PDF y envío por WhatsApp.

- **Backend:** Flask + SQLite ( SQLAlchemy ), con migraciones (Flask-Migrate) y tests (pytest).
- **Frontend:** Next.js (App Router) + Tailwind CSS + `@react-pdf/renderer`.

---

## Requisitos

- Python 3.10 o superior
- Node.js 20 o superior

---

## 1. Backend (puerto 5000)

```bash
cd backend
pip install -r requirements.txt      # dependencias de ejecución
pip install -r requirements-dev.txt  # solo para ejecutar los tests
cp .env.example .env                 # opcional: copia la configuración local
python app.py
```

La base de datos SQLite se crea automáticamente en `backend/instance/database.sqlite`.

### Configuración (`backend/.env`)

| Variable       | Por defecto                                    | Descripción                                        |
| -------------- | ---------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URI` | `sqlite:///database.sqlite`                    | Cualquier URI soportada por SQLAlchemy             |
| `DEBUG`        | `false`                                        | `true` activa el debugger de Flask (solo en local) |
| `PORT`         | `5000`                                         | Puerto de desarrollo                               |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000`   | Orígenes permitidos, separados por comas            |

### Tests

```bash
cd backend
python -m pytest        # usan una base de datos temporal, nunca la real
```

### Migraciones de base de datos

El esquema inicial lo crea `db.create_all()` al arrancar y la revisión base
`66c9c10228a1` queda aplicada. Cuando cambies `models.py`:

```bash
python -m flask --app app db migrate -m "descripción del cambio"
python -m flask --app app db upgrade
```

### API

| Método | Ruta                              | Descripción                                          |
| ------ | --------------------------------- | ---------------------------------------------------- |
| GET    | `/api/documentos`                 | Listado (más reciente primero)                       |
| GET    | `/api/documentos/<id>`            | Detalle de un documento                              |
| GET    | `/api/documentos/proximo-numero`  | Sugerencia de número, ej. `?tipo=presupuesto`        |
| POST   | `/api/documentos`                 | Crear (el **backend asigna el número** `PRE-2026-001`) |
| PUT    | `/api/documentos/<id>`            | Actualizar (sin `items` no borra las líneas)         |
| DELETE | `/api/documentos/<id>`            | Eliminar                                              |

Errores: `400` validación, `404` no encontrado, `409` conflicto (número duplicado).

---

## 2. Frontend (puerto 3000)

```bash
cd frontend
npm install
cp .env.example .env.local   # opcional
npm run dev
```

### Configuración (`frontend/.env.local`)

| Variable                     | Por defecto                | Descripción                              |
| ---------------------------- | -------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_BACKEND_URL`    | `http://localhost:5000`    | URL del backend Flask                    |
| `NEXT_PUBLIC_COMPANY_NAME`   | `Tu Empresa de Reformas`   | Nombre de la empresa en los PDF          |
| `NEXT_PUBLIC_COMPANY_NIF`    | `B-12345678`               | NIF de la empresa en los PDF             |
| `NEXT_PUBLIC_COMPANY_PHONE`  | `+34 600 000 000`          | Teléfono de la empresa en los PDF        |
| `NEXT_PUBLIC_COMPANY_ADDRESS`| —                          | Dirección de la empresa en los PDF       |

### Comprobaciones

```bash
cd frontend
npm run lint   # ESLint
npm run build  # build de producción
```

---

## Notas sobre los datos

- `backend/instance/*.sqlite` y los `.env*` locales **no se versionan** (ver `.gitignore`).
- El número de documento es único y lo genera el backend por tipo y año
  (`PRE-2026-001`, `FAC-2026-002`, ...).
- Los clientes se deduplican por NIF (o por nombre si no hay NIF): editar un
  cliente actualiza sus datos en todos sus documentos.
