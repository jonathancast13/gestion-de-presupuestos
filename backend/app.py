"""Aplicación Flask: configuración, composición y arranque.

La lógica de negocio vive en validacion.py, la autenticación en auth.py y
las rutas en blueprints/.
"""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from flask_migrate import Migrate

from models import db

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

app = Flask(__name__)


def _database_uri() -> str:
    """URI de la base de datos.

    Render inyecta `DATABASE_URL` con el esquema antiguo `postgres://`, que
    SQLAlchemy 2 ya no admite; se convierte a `postgresql://`. Si defines
    `DATABASE_URI` a mano, tiene prioridad (así se puede usar SQLite en local).
    """
    uri = os.getenv('DATABASE_URI') or os.getenv('DATABASE_URL') or 'sqlite:///database.sqlite'
    if uri.startswith('postgres://'):
        uri = 'postgresql://' + uri[len('postgres://'):]
    return uri


# Configuración usando variables de entorno con valores por defecto de respaldo
app.config['SQLALCHEMY_DATABASE_URI'] = _database_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- Autenticación (JWT) -----------------------------------------------------
# SECRET_KEY firma los tokens; sin ella se genera una clave efímera de
# desarrollo (los tokens caducarían al reiniciar el servidor).
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or os.urandom(32).hex()
app.config['JWT_EXPIRA_MINUTOS'] = int(os.getenv('JWT_EXPIRA_MINUTOS', '720'))
app.config['ADMIN_USER'] = os.getenv('ADMIN_USER', 'admin')
app.config['ADMIN_PASSWORD_HASH'] = os.getenv('ADMIN_PASSWORD_HASH', '')
app.config['LOGIN_MAX_INTENTOS'] = int(os.getenv('LOGIN_MAX_INTENTOS', '5'))

if not os.getenv('SECRET_KEY'):
    app.logger.warning(
        'SECRET_KEY no está definida en .env: se usa una clave efímera solo válida '
        'hasta el próximo reinicio. Configúrala para producción.'
    )
if not app.config['ADMIN_PASSWORD_HASH']:
    app.logger.warning(
        'ADMIN_PASSWORD_HASH no está definida: el login devolverá error hasta que '
        'generes el hash (ver .env.example).'
    )

# Orígenes permitidos para el frontend (separados por comas)
_origenes = [o.strip() for o in os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',') if o.strip()]
CORS(app, origins=_origenes, allow_headers=['Content-Type', 'Authorization'])

db.init_app(app)
Migrate(app, db)

from errores import registrar_manejadores_errores  # noqa: E402
from blueprints.auth import bp_auth  # noqa: E402
from blueprints.documentos import bp_documentos  # noqa: E402

registrar_manejadores_errores(app)
app.register_blueprint(bp_auth)
app.register_blueprint(bp_documentos)


@app.route('/api/salud', methods=['GET'])
def salud():
    """Health check público para el uptime monitor de Render (no requiere token)."""
    return jsonify({'estado': 'ok'}), 200

with app.app_context():
    db.create_all()
    # Si create_all() acaba de crear el esquema desde cero (BD nueva, p. ej. el
    # PostgreSQL recién creado en Render), sellamos la revisión actual de Alembic:
    # así `flask db upgrade` en el arranque no intenta repetir columnas ya
    # existentes y las migraciones futuras parten del punto correcto.
    from sqlalchemy import inspect as _inspect

    if not _inspect(db.engine).has_table('alembic_version'):
        from flask_migrate import stamp as _stamp

        _stamp(revision='head')
    # Los backrefs (p.ej. Documento.cliente) solo existen tras configurar los
    # mappers: sin esto, el primer GET /api/documentos de un proceso recién
    # arrancado fallaría con AttributeError.
    from sqlalchemy.orm import configure_mappers
    configure_mappers()


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    # DEBUG por defecto desactivado: el debugger de Werkzeug no debe exponerse
    debug_mode = os.getenv('DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, port=port)
