"""Aplicación Flask: configuración, composición y arranque.

La lógica de negocio vive en validacion.py, la autenticación en auth.py y
las rutas en blueprints/.
"""

import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

from models import db

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

app = Flask(__name__)

# Configuración usando variables de entorno con valores por defecto de respaldo
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///database.sqlite')
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

with app.app_context():
    db.create_all()
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
