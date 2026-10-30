"""Manejadores de error globales: nunca filtramos detalles internos al cliente."""

from flask import jsonify
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from models import db
from validacion import ErrorValidacion


def registrar_manejadores_errores(app):

    @app.errorhandler(ErrorValidacion)
    def _manejar_validacion(error):
        return jsonify({'error': error.mensaje}), error.estado

    @app.errorhandler(IntegrityError)
    def _manejar_integridad(error):
        db.session.rollback()
        app.logger.warning('Violación de integridad: %s', error)
        return jsonify({'error': 'La operación entra en conflicto con datos existentes (¿número de documento duplicado?).'}), 409

    @app.errorhandler(Exception)
    def _manejar_error_inesperado(error):
        if isinstance(error, HTTPException):
            return error
        db.session.rollback()
        app.logger.exception('Error inesperado al procesar la petición')
        return jsonify({'error': 'Error interno del servidor.'}), 500
