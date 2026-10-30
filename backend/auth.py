"""Autenticación JWT: emisión de tokens y decorador de protección de rutas.

El cliente envía el token en cada petición:
    Authorization: Bearer <token>
"""

import time
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request


def generar_token(usuario):
    """Firma un JWT con el usuario como sujeto y caducidad configurable."""
    ahora = int(time.time())
    minutos = int(current_app.config.get('JWT_EXPIRA_MINUTOS', 720))
    payload = {
        'sub': usuario,
        'iat': ahora,
        'exp': ahora + minutos * 60,
    }
    return jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')


def _respuesta_no_autenticado(mensaje):
    return jsonify({'error': mensaje}), 401, {'WWW-Authenticate': 'Bearer'}


def requiere_auth(vista):
    """Exige un JWT válido en la cabecera Authorization para ejecutar la vista."""

    @wraps(vista)
    def decorada(*args, **kwargs):
        cabecera = request.headers.get('Authorization', '').split()
        if len(cabecera) != 2 or cabecera[0].lower() != 'bearer':
            return _respuesta_no_autenticado('Falta la cabecera de autenticación.')
        try:
            datos = jwt.decode(
                cabecera[1],
                current_app.config['SECRET_KEY'],
                algorithms=['HS256'],
            )
        except jwt.ExpiredSignatureError:
            return _respuesta_no_autenticado('Tu sesión ha caducado, inicia de nuevo.')
        except jwt.InvalidTokenError:
            return _respuesta_no_autenticado('Token no válido, inicia de nuevo.')

        g.usuario = datos.get('sub')
        return vista(*args, **kwargs)

    return decorada
