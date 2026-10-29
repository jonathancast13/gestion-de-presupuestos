import os
import pathlib
import tempfile

# La base de datos de pruebas se crea ANTES de importar app, para que
# nunca se toque la base de datos real de desarrollo.
_dir_temporal = pathlib.Path(tempfile.mkdtemp(prefix='presupuestos_test_'))
os.environ['DATABASE_URI'] = f"sqlite:///{(_dir_temporal / 'test.sqlite').as_posix()}"
os.environ['DEBUG'] = 'false'

import pytest  # noqa: E402

from app import app as aplicacion  # noqa: E402
from models import db  # noqa: E402


@pytest.fixture()
def client():
    aplicacion.config['TESTING'] = True
    with aplicacion.app_context():
        db.session.remove()
        db.drop_all()
        db.create_all()
    yield aplicacion.test_client()
    with aplicacion.app_context():
        db.session.remove()
