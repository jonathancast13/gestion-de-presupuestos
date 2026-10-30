"""Tests de autenticación: login, protección de rutas y rate limiting."""

import time

import jwt

from app import app as aplicacion


def login(client, **campos):
    cuerpo = {'usuario': 'admin', 'contrasena': 'admin123'}
    cuerpo.update(campos)
    return client.post('/api/auth/login', json=cuerpo)


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

def test_login_correcto_devuelve_token(client_sin_auth):
    r = login(client_sin_auth)
    assert r.status_code == 200, r.get_json()
    datos = r.get_json()
    assert datos['usuario'] == 'admin'
    assert datos['expira_en_minutos'] == 720
    # El token debe decodificarse con la clave del servidor
    with aplicacion.app_context():
        clave = aplicacion.config['SECRET_KEY']
    payload = jwt.decode(datos['token'], clave, algorithms=['HS256'])
    assert payload['sub'] == 'admin'


def test_login_contrasena_incorrecta(client_sin_auth):
    r = login(client_sin_auth, contrasena='no-es-la-clave')
    assert r.status_code == 401
    assert r.get_json()['error'] == 'Usuario o contraseña incorrectos.'


def test_login_usuario_incorrecto(client_sin_auth):
    r = login(client_sin_auth, usuario='intruso')
    assert r.status_code == 401
    # Mismo mensaje que una contraseña errónea: no revela si el usuario existe
    assert r.get_json()['error'] == 'Usuario o contraseña incorrectos.'


def test_login_sin_cuerpo_json(client_sin_auth):
    r = client_sin_auth.post('/api/auth/login', data='no soy json', content_type='text/plain')
    assert r.status_code == 401


def test_login_limpia_el_contador_de_intentos(client_sin_auth):
    login(client_sin_auth, contrasena='mala1')
    login(client_sin_auth, contrasena='mala2')
    assert login(client_sin_auth).status_code == 200
    # Un acierto resetea la ventana: siguen permitiéndose fallos
    assert login(client_sin_auth, contrasena='mala3').status_code == 401


def test_rate_limit_tras_intentos_fallidos(client_sin_auth):
    for _ in range(5):
        assert login(client_sin_auth, contrasena='mala').status_code == 401
    r = login(client_sin_auth, contrasena='mala')
    assert r.status_code == 429
    # Incluso con la contraseña correcta se bloquea dentro de la ventana
    assert login(client_sin_auth).status_code == 429


# ---------------------------------------------------------------------------
# Protección de rutas
# ---------------------------------------------------------------------------

def test_rutas_documentos_sin_token(client_sin_auth):
    assert client_sin_auth.get('/api/documentos').status_code == 401
    assert client_sin_auth.get('/api/documentos/proximo-numero').status_code == 401
    assert client_sin_auth.post('/api/documentos', json={}).status_code == 401
    assert client_sin_auth.get('/api/documentos/1').status_code == 401
    assert client_sin_auth.put('/api/documentos/1', json={}).status_code == 401
    assert client_sin_auth.delete('/api/documentos/1').status_code == 401


def test_respuesta_401_incluye_www_authenticate(client_sin_auth):
    r = client_sin_auth.get('/api/documentos')
    assert r.status_code == 401
    assert r.headers.get('WWW-Authenticate') == 'Bearer'


def test_cabecera_malformada_rechazada(client_sin_auth):
    for cabecera in ('Basico abc123', 'Bearer', 'Bearer   ', 'abc123'):
        r = client_sin_auth.get('/api/documentos', headers={'Authorization': cabecera})
        assert r.status_code == 401, cabecera


def test_token_invalido_rechazado(client_sin_auth):
    r = client_sin_auth.get('/api/documentos', headers={'Authorization': 'Bearer token-falso'})
    assert r.status_code == 401
    assert 'Token no válido' in r.get_json()['error']


def test_token_de_otra_clave_rechazado(client_sin_auth):
    with aplicacion.app_context():
        token = jwt.encode({'sub': 'admin', 'exp': 9999999999}, 'otra-clave_que_no_es_la_correcta', algorithm='HS256')
    r = client_sin_auth.get('/api/documentos', headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 401


def test_token_expirado_rechazado(client_sin_auth):
    with aplicacion.app_context():
        clave = aplicacion.config['SECRET_KEY']
    ahora = int(time.time())
    token = jwt.encode({'sub': 'admin', 'iat': ahora - 7200, 'exp': ahora - 60}, clave, algorithm='HS256')
    r = client_sin_auth.get('/api/documentos', headers={'Authorization': f'Bearer {token}'})
    assert r.status_code == 401
    assert 'caducado' in r.get_json()['error']


# ---------------------------------------------------------------------------
# /api/auth/me
# ---------------------------------------------------------------------------

def test_me_sin_token(client_sin_auth):
    assert client_sin_auth.get('/api/auth/me').status_code == 401


def test_me_devuelve_el_usuario(client):
    r = client.get('/api/auth/me')
    assert r.status_code == 200
    assert r.get_json() == {'usuario': 'admin'}


def test_token_de_los_fixtures_permite_acceder(client):
    # El fixture `client` ya trae el token: comprueba que las rutas siguen vivas
    assert client.get('/api/documentos').status_code == 200
