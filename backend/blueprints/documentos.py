"""Rutas de documentos (presupuestos y facturas). Todas requieren sesión."""

from flask import Blueprint, jsonify, request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from auth import requiere_auth
from models import Documento, LineaDocumento, db
from validacion import (
    ErrorValidacion,
    MAX_INTENTOS_GUARDADO,
    PATRON_NUMERO_AUTO,
    PREFIJOS_NUMERO,
    calcular_totales,
    cuerpo_json,
    generar_siguiente_numero,
    guardar_cliente,
    leer_cliente,
    leer_descripcion_trabajo,
    leer_fecha,
    leer_tipo,
    numero_disponible,
    validar_items,
)

bp_documentos = Blueprint('documentos', __name__)


@bp_documentos.route('/api/documentos/proximo-numero', methods=['GET'])
@requiere_auth
def proximo_numero():
    tipo = str(request.args.get('tipo', 'presupuesto')).strip().lower()
    if tipo not in PREFIJOS_NUMERO:
        raise ErrorValidacion("El tipo debe ser 'presupuesto' o 'factura'.")
    return jsonify({'numero': generar_siguiente_numero(tipo)}), 200


@bp_documentos.route('/api/documentos', methods=['POST'])
@requiere_auth
def guardar_documento():
    data = cuerpo_json()

    tipo = leer_tipo(data)
    fecha = leer_fecha(data)
    datos_cliente = leer_cliente(data)
    descripcion_trabajo = leer_descripcion_trabajo(data) or None
    lineas = validar_items(data)
    subtotal, total_iva, total_general = calcular_totales(lineas)

    # Reintenta ante una colisión de número (dos peticiones a la vez)
    for intento in range(MAX_INTENTOS_GUARDADO):
        try:
            cliente = guardar_cliente(datos_cliente)
            documento = Documento(
                tipo=tipo,
                numero=generar_siguiente_numero(tipo),
                fecha=fecha,
                cliente_id=cliente.id,
                descripcion_trabajo=descripcion_trabajo,
                subtotal=subtotal,
                total_iva=total_iva,
                total_general=total_general,
            )
            db.session.add(documento)
            db.session.flush()

            for linea in lineas:
                db.session.add(LineaDocumento(
                    documento_id=documento.id,
                    descripcion=linea['descripcion'],
                    cantidad=linea['cantidad'],
                    precio_unitario=linea['precio_unitario'],
                    iva=linea['iva'],
                ))

            db.session.commit()
            return jsonify(documento.to_dict()), 201
        except IntegrityError:
            db.session.rollback()
            if intento == MAX_INTENTOS_GUARDADO - 1:
                raise ErrorValidacion('No se pudo asignar el número de documento. Inténtalo de nuevo.', 409)

    raise ErrorValidacion('No se pudo guardar el documento.', 500)


@bp_documentos.route('/api/documentos', methods=['GET'])
@requiere_auth
def obtener_documentos():
    documentos = db.session.execute(
        select(Documento)
        .options(selectinload(Documento.cliente), selectinload(Documento.lineas))
        .order_by(Documento.id.desc())
    ).scalars().all()
    return jsonify([documento.to_dict() for documento in documentos]), 200


@bp_documentos.route('/api/documentos/<int:id>', methods=['GET'])
@requiere_auth
def obtener_documento(id):
    documento = db.session.get(Documento, id)
    if not documento:
        return jsonify({'error': 'Documento no encontrado'}), 404
    return jsonify(documento.to_dict()), 200


@bp_documentos.route('/api/documentos/<int:id>', methods=['PUT'])
@requiere_auth
def actualizar_documento(id):
    documento = db.session.get(Documento, id)
    if not documento:
        return jsonify({'error': 'Documento no encontrado'}), 404

    data = cuerpo_json()

    tipo = leer_tipo(data, por_defecto=documento.tipo)
    fecha = leer_fecha(data, por_defecto=documento.fecha)

    # Número: se respeta el actual, se valida el enviado y se regenera si
    # cambió el tipo y el anterior era automático (PRE-... -> FAC-...)
    numero = str(data.get('numero') or data.get('numeroDoc') or documento.numero).strip()
    if not numero:
        numero = documento.numero
    elif numero != documento.numero and not numero_disponible(numero, documento.id):
        raise ErrorValidacion(f'Ya existe otro documento con el número {numero}.', 409)
    if tipo != documento.tipo and numero == documento.numero and PATRON_NUMERO_AUTO.match(numero):
        numero = generar_siguiente_numero(tipo)

    documento.tipo = tipo
    documento.numero = numero
    documento.fecha = fecha

    # Descripción del trabajo: solo se toca si viene la clave en la petición
    # (una cadena vacía la borra)
    if 'descripcion_trabajo' in data:
        documento.descripcion_trabajo = leer_descripcion_trabajo(data) or None

    datos_cliente = leer_cliente(data, obligatorio=False)
    if datos_cliente:
        cliente = guardar_cliente(datos_cliente)
        documento.cliente_id = cliente.id

    # Solo se reemplazan las líneas si vienen en la petición
    if 'items' in data:
        lineas = validar_items(data)
        subtotal, total_iva, total_general = calcular_totales(lineas)
        documento.subtotal = subtotal
        documento.total_iva = total_iva
        documento.total_general = total_general

        LineaDocumento.query.filter_by(documento_id=documento.id).delete()
        for linea in lineas:
            db.session.add(LineaDocumento(
                documento_id=documento.id,
                descripcion=linea['descripcion'],
                cantidad=linea['cantidad'],
                precio_unitario=linea['precio_unitario'],
                iva=linea['iva'],
            ))

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ErrorValidacion('El número de documento ya está en uso.', 409)

    db.session.refresh(documento)
    return jsonify(documento.to_dict()), 200


@bp_documentos.route('/api/documentos/<int:id>', methods=['DELETE'])
@requiere_auth
def eliminar_documento(id):
    documento = db.session.get(Documento, id)
    if not documento:
        return jsonify({'error': 'Documento no encontrado'}), 404

    try:
        db.session.delete(documento)  # borra en cascada sus líneas
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise ErrorValidacion('No se puede eliminar el documento.', 409)

    return jsonify({'message': 'Documento eliminado correctamente'}), 200
