"""Rutas de autenticación: login (público) y consulta de sesión."""

import time

from flask import Blueprint, current_app, g, jsonify, request
from werkzeug.security import check_password_hash

from auth import generar_token, requiere_auth

bp_auth = Blueprint('auth', __name__)

# Ventana de rate limiting en memoria: ip -> marcas de tiempo de intentos fallidos
_VENTANA_SEGUNDOS = 60
_INTENTOS_FALLIDOS: dict[str, list[float]] = {}


def _ip_cliente() -> str:
    return request.remote_addr or 'desconocida'


def _intentos_recientes(ip: str) -> list[float]:
    ahora = time.time()
    recientes = [marca for marca in _INTENTOS_FALLIDOS.get(ip, []) if ahora - marca < _VENTANA_SEGUNDOS]
    _INTENTOS_FALLIDOS[ip] = recientes
    return recientes


def _registrar_fallo(ip: str) -> None:
    _INTENTOS_FALLIDOS.setdefault(ip, []).append(time.time())


@bp_auth.route('/api/auth/login', methods=['POST'])
def login():
    """Valida usuario/contraseña y devuelve un JWT. Es la única ruta pública."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}

    usuario = str(data.get('usuario') or '').strip()
    contrasena = str(data.get('contrasena') or '')

    ip = _ip_cliente()
    max_intentos = int(current_app.config.get('LOGIN_MAX_INTENTOS', 5))
    if len(_intentos_recientes(ip)) >= max_intentos:
        return jsonify({'error': 'Demasiados intentos fallidos. Espera un minuto y vuelve a probar.'}), 429

    hash_guardado = current_app.config.get('ADMIN_PASSWORD_HASH') or ''
    if not hash_guardado:
        # Fallo de configuración, no del usuario: lo dejamos claro en el log
        current_app.logger.error(
            'Login solicitado sin ADMIN_PASSWORD_HASH configurada. '
            'Genera una con: python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash(\'tu_password\'))"'
        )
        return jsonify({'error': 'El servidor no tiene una contraseña configurada (ADMIN_PASSWORD_HASH).'}), 500

    es_valido = usuario == current_app.config.get('ADMIN_USER', 'admin') and bool(
        check_password_hash(hash_guardado, contrasena)
    )
    if not es_valido:
        _registrar_fallo(ip)
        return jsonify({'error': 'Usuario o contraseña incorrectos.'}), 401

    _INTENTOS_FALLIDOS.pop(ip, None)  # un acierto limpia los fallos previos
    minutos = int(current_app.config.get('JWT_EXPIRA_MINUTOS', 720))
    return jsonify({
        'token': generar_token(usuario),
        'usuario': usuario,
        'expira_en_minutos': minutos,
    }), 200


@bp_auth.route('/api/auth/me', methods=['GET'])
@requiere_auth
def me():
    """Comprueba que el token guardado sigue siendo válido."""
    return jsonify({'usuario': g.usuario}), 200
