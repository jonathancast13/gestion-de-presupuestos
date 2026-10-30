import os
import pathlib
import tempfile

# La base de datos de pruebas se crea ANTES de importar app, para que
# nunca se toque la base de datos real de desarrollo.
_dir_temporal = pathlib.Path(tempfile.mkdtemp(prefix='presupuestos_test_'))
os.environ['DATABASE_URI'] = f"sqlite:///{(_dir_temporal / 'test.sqlite').as_posix()}"
os.environ['DEBUG'] = 'false'

# Configuración de autenticación para los tests (gana a cualquier .env local).
# hash con pbkdf2 rápido: los tests no necesitan fortaleza, solo velocidad.
from werkzeug.security import generate_password_hash  # noqa: E402

os.environ['SECRET_KEY'] = 'clave_secreta_solo_para_tests_0123456789abcdef'
os.environ['ADMIN_USER'] = 'admin'
os.environ['ADMIN_PASSWORD_HASH'] = generate_password_hash('admin123')
os.environ['LOGIN_MAX_INTENTOS'] = '5'

import pytest  # noqa: E402

from app import app as aplicacion  # noqa: E402
from auth import generar_token  # noqa: E402
from blueprints import auth as modulo_auth  # noqa: E402
from models import db  # noqa: E402


@pytest.fixture(autouse=True)
def _limpiar_rate_limit():
    """El limitador de intentos vive en memoria: cada test empieza de cero."""
    modulo_auth._INTENTOS_FALLIDOS.clear()
    yield
    modulo_auth._INTENTOS_FALLIDOS.clear()


def _preparar_bd():
    aplicacion.config['TESTING'] = True
    with aplicacion.app_context():
        db.session.remove()
        db.drop_all()
        db.create_all()


def _cliente_con_token():
    cliente = aplicacion.test_client()
    with aplicacion.app_context():
        token = generar_token('admin')
    cliente.environ_base['HTTP_AUTHORIZATION'] = f'Bearer {token}'
    return cliente


@pytest.fixture()
def client():
    """Cliente YA autenticado: así la mayoría de tests no cambian."""
    _preparar_bd()
    cliente = _cliente_con_token()
    yield cliente
    with aplicacion.app_context():
        db.session.remove()


@pytest.fixture()
def client_sin_auth():
    """Cliente sin cabecera de autenticación (para probar los 401)."""
    _preparar_bd()
    cliente = aplicacion.test_client()
    yield cliente
    with aplicacion.app_context():
        db.session.remove()
