# Gestión de Presupuestos

Generador de presupuestos y facturas con historial, PDF corporativo, envío por
WhatsApp y **acceso protegido por login (JWT)**.

- **Backend:** Flask + SQLite (SQLAlchemy), migraciones (Flask-Migrate) y tests (pytest).
- **Frontend:** Next.js (App Router) + Tailwind CSS + `@react-pdf/renderer`, **responsive
  móvil** y **PWA instalable** (manifest + iconos).
- **PDF corporativo:** logo, colores de marca, marca de agua y paginación.

---

## Requisitos

- Python 3.10 o superior
- Node.js 20 o superior
- (Opcional) Docker, para levantar todo con `docker compose up`

---

## Arranque rápido

```bash
# Terminal 1 — backend (puerto 5000)
cd backend
pip install -r requirements.txt
cp .env.example .env      # y rellena SECRET_KEY / ADMIN_PASSWORD_HASH (ver abajo)
python app.py

# Terminal 2 — frontend (puerto 3000)
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Abre <http://localhost:3000> e inicia sesión con el usuario y la contraseña
configurados en `backend/.env` (en local puedes usar `admin` / `admin123` si has
creado el `.env` con el hash de esa contraseña).

> **Aviso de puertos:** si el 3000 está ocupado (por ejemplo por otro servidor
> de este proyecto), `next dev` arranca solo en el **3001** y el login fallará
> con *"No se pudo conectar con el servidor de Python"* porque ese origen no
> está en `CORS_ORIGINS`. Solución: libera el 3000 o añade
> `http://localhost:3001` a `CORS_ORIGINS` en `backend/.env`.

---

## 1. Backend (puerto 5000)

```bash
cd backend
pip install -r requirements.txt      # dependencias de ejecución
pip install -r requirements-dev.txt  # solo para ejecutar los tests
cp .env.example .env                 # copia la configuración local
python app.py
```

La base de datos SQLite se crea automáticamente en `backend/instance/database.sqlite`.

### Configuración (`backend/.env`)

| Variable              | Por defecto                                  | Descripción                                                       |
| --------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URI`        | `sqlite:///database.sqlite`                  | Cualquier URI soportada por SQLAlchemy                            |
| `DEBUG`               | `false`                                      | `true` activa el debugger de Flask (solo en local)                |
| `PORT`                | `5000`                                       | Puerto de desarrollo                                              |
| `CORS_ORIGINS`        | `http://localhost:3000,http://127.0.0.1:3000`| Orígenes permitidos, separados por comas                           |
| `SECRET_KEY`          | — (clave efímera si falta)                   | Clave con la que se **firman los JWT**. Obligatoria en producción |
| `ADMIN_USER`          | `admin`                                      | Usuario del login                                                 |
| `ADMIN_PASSWORD_HASH` | — (el login devolverá 500 si falta)          | Hash Werkzeug de la contraseña (**nunca la contraseña en claro**)  |
| `JWT_EXPIRA_MINUTOS`  | `720`                                        | Caducidad del token (12 h por defecto)                            |
| `LOGIN_MAX_INTENTOS`  | `5`                                          | Intentos fallidos de login por minuto e IP (después `429`)        |

Genera los valores sensibles con:

```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32))"
python -c "from werkzeug.security import generate_password_hash; print('ADMIN_PASSWORD_HASH=' + generate_password_hash('tu_password'))"
```

### Tests

```bash
cd backend
python -m pytest        # 42 tests; usan una base de datos temporal, nunca la real
```

### Migraciones de base de datos

El esquema inicial lo crea `db.create_all()` al arrancar y la revisión base
`66c9c10228a1` queda aplicada. Cuando cambies `models.py`:

```bash
python -m flask --app app db migrate -m "descripción del cambio"
python -m flask --app app db upgrade
```

### API

Todas las rutas de documentos exigen la cabecera `Authorization: Bearer <token>`.

| Método | Ruta                             | Auth | Descripción                                          |
| ------ | -------------------------------- | ---- | ---------------------------------------------------- |
| POST   | `/api/auth/login`                | No   | `{"usuario","contrasena"}` → `{"token","usuario"}`   |
| GET    | `/api/auth/me`                   | Sí   | Comprueba que el token sigue válido                  |
| GET    | `/api/documentos`                | Sí   | Listado (más reciente primero)                       |
| GET    | `/api/documentos/<id>`           | Sí   | Detalle de un documento                              |
| GET    | `/api/documentos/proximo-numero` | Sí   | Sugerencia de número, ej. `?tipo=presupuesto`        |
| POST   | `/api/documentos`                | Sí   | Crear (el **backend asigna el número** `PRE-2026-001`) |
| PUT    | `/api/documentos/<id>`           | Sí   | Actualizar (sin `items` no borra las líneas)         |
| DELETE | `/api/documentos/<id>`           | Sí   | Eliminar                                              |

Errores: `400` validación, `401` sin sesión o token inválido, `404` no encontrado,
`409` conflicto (número duplicado), `429` demasiados intentos de login.

El backend está organizado en módulos: `validacion.py` (payloads y cálculos),
`auth.py` (JWT y decorador `@requiere_auth`), `errores.py` (manejadores globales)
y `blueprints/` (`auth.py`, `documentos.py`).

---

## 2. Frontend (puerto 3000)

```bash
cd frontend
npm install
cp .env.example .env.local   # opcional
npm run dev
```

### Configuración (`frontend/.env.local`)

| Variable                  | Por defecto             | Descripción                                |
| ------------------------- | ----------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:5000` | URL del backend Flask                       |

> Los datos de la empresa (nombre, NIF, teléfono, dirección, colores y logo)
> se configuran en **`frontend/lib/empresa.ts`**, no en `.env`.

### Sesión

- El login guarda el token JWT en `localStorage` y `AuthGuard` protege todas las
  rutas: sin token válido (o con él caducado) se redirige a `/login?next=...`.
- Si el backend devuelve `401` en cualquier petición, la sesión se cierra
  automáticamente y se muestra el aviso en el login.

### Móvil y PWA

- Diseño mobile-first: tarjetas en móvil, tabla en `sm:`; inputs de 16 px
  (sin zoom automático en iOS), botones de toque ≥ 44 px y safe-areas.
- PWA básica: `app/manifest.ts` + iconos (`app/icon.png`, `app/apple-icon.png`,
  `public/icons/*`). El *service worker* queda fuera de alcance.
- Los iconos y el logo se generan desde el original con
  `python scripts/preparar_logo.py` (usa Pillow).

### PDF corporativo

`app/components/DocumentoPDF.tsx` dibuja la cabecera con logo y datos de la
empresa, tabla con cabecera oscura, caja de totales, pie con numeración de
página y **marca de agua con solo el logo**. Los colores viven en `lib/empresa.ts`.

### Comprobaciones

```bash
cd frontend
npm run lint   # ESLint
npm test       # Vitest (25 tests: lib/auth, lib/api, lib/dinero)
npm run build  # build de producción
```

---

## 3. Docker (desarrollo con recarga)

```bash
docker compose up
```

- Frontend: <http://localhost:3000> · Backend: <http://localhost:5000>
- Monta el código en vivo (hot reload) y la SQLite en `backend/instance/`.
- Las credenciales se leen de `backend/.env` si existe (`env_file` opcional).

---

## Acceso desde el móvil (LAN)

`next dev` escucha en `0.0.0.0`, así que desde un teléfono puedes abrir
`http://<IP-de-la-máquina>:3000` (p. ej. `http://192.168.1.13:3000`), pero:

1. **`NEXT_PUBLIC_BACKEND_URL`** debe apuntar a la IP de la máquina, no a
   `localhost` (el navegador del móvil debe alcanzar el Flask):
   `NEXT_PUBLIC_BACKEND_URL=http://<IP>:5000`
2. **`CORS_ORIGINS`** del backend debe incluir el origen del móvil:
   `CORS_ORIGINS=http://<IP>:3000,...`
3. Los navegadores **solo permiten `localStorage`/PWA en contextos seguros**:
   para usarla desde otro dispositivo conviene servir ambas URLs por **HTTPS**
   (p. ej. con un túnel como Caddy/ngrok o `npx local-ssl-proxy`).

---

## Notas sobre los datos

- `backend/instance/*.sqlite` y los `.env*` locales **no se versionan** (ver `.gitignore`).
- El número de documento es único y lo genera el backend por tipo y año
  (`PRE-2026-001`, `FAC-2026-002`, ...).
- Los clientes se deduplican por NIF (o por nombre si no hay NIF): editar un
  cliente actualiza sus datos en todos sus documentos.
- El NIF de la empresa está pendiente: mientras esté vacío en `lib/empresa.ts`,
  el PDF omite esa línea.
