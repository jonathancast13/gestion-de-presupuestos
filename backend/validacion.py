"""Constantes, validación de entradas y operaciones auxiliares de documentos.

Toda la lógica de lectura/validación de payloads vive aquí para que los
blueprints solo se encarguen de enrutar y responder.
"""

import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from flask import request
from sqlalchemy import select

from models import Cliente, Documento, db

PREFIJOS_NUMERO = {'presupuesto': 'PRE', 'factura': 'FAC'}
IVA_VALIDOS = (0, 4, 10, 21)
FORMATO_FECHA = '%Y-%m-%d'
# Números generados automáticamente, ej: PRE-2026-001
PATRON_NUMERO_AUTO = re.compile(r'^(PRE|FAC)-\d{4}-\d{3,}$')
MAX_INTENTOS_GUARDADO = 3


class ErrorValidacion(Exception):
    """Error controlado con un mensaje apto para mostrar al cliente."""

    def __init__(self, mensaje, estado=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.estado = estado


def dinero(valor):
    """Redondea a 2 decimales con criterio contable (half up)."""
    return float(Decimal(str(valor)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def cuerpo_json():
    data = request.get_json(silent=True)
    if data is None or not isinstance(data, dict):
        raise ErrorValidacion('El cuerpo de la petición debe ser un JSON válido.')
    return data


def leer_tipo(data, por_defecto='presupuesto'):
    valor = data.get('tipo') or data.get('tipoDoc') or por_defecto
    tipo = str(valor).strip().lower()
    if tipo not in PREFIJOS_NUMERO:
        raise ErrorValidacion("El tipo de documento debe ser 'presupuesto' o 'factura'.")
    return tipo


def leer_fecha(data, por_defecto=None):
    valor = data.get('fecha')
    if valor in (None, ''):
        if por_defecto:
            return por_defecto
        raise ErrorValidacion('La fecha es obligatoria.')
    fecha = str(valor).strip()
    try:
        date.strptime(fecha, FORMATO_FECHA)
    except ValueError:
        raise ErrorValidacion('La fecha debe tener formato AAAA-MM-DD.')
    return fecha


def leer_cliente(data, obligatorio=True):
    cliente_data = data.get('cliente')
    if cliente_data is None and not obligatorio:
        return None
    if not isinstance(cliente_data, dict):
        raise ErrorValidacion('Los datos del cliente no son válidos.')

    cliente = {
        'id': None,
        'nombre': str(cliente_data.get('nombre') or '').strip(),
        'nif': str(cliente_data.get('nif') or '').strip(),
        'telefono': str(cliente_data.get('telefono') or '').strip(),
        'direccion': str(cliente_data.get('direccion') or '').strip(),
    }

    id_enviado = cliente_data.get('id')
    if id_enviado not in (None, ''):
        try:
            cliente['id'] = int(id_enviado)
        except (TypeError, ValueError):
            raise ErrorValidacion('El identificador del cliente no es válido.')

    if not cliente['nombre']:
        raise ErrorValidacion('El nombre del cliente es obligatorio.')
    return cliente


def validar_items(data):
    items = data.get('items')
    if not isinstance(items, list) or not items:
        raise ErrorValidacion('El documento debe incluir al menos una línea.')

    lineas = []
    for posicion, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ErrorValidacion(f'La línea {posicion} no es válida.')

        descripcion = str(item.get('descripcion') or '').strip()
        if not descripcion:
            raise ErrorValidacion(f'La línea {posicion} necesita una descripción.')

        try:
            cantidad = float(item.get('cantidad'))
            precio = float(item.get('precioUnitario', item.get('precio_unitario')))
            iva = float(item.get('iva', 21))
        except (TypeError, ValueError):
            raise ErrorValidacion(f'La línea {posicion} tiene valores numéricos no válidos.')

        if cantidad <= 0:
            raise ErrorValidacion(f'La línea {posicion} necesita una cantidad mayor que 0.')
        if precio < 0:
            raise ErrorValidacion(f'La línea {posicion} no puede tener un precio negativo.')
        if iva not in IVA_VALIDOS:
            raise ErrorValidacion(f'La línea {posicion} tiene un IVA no válido. Usa 0, 4, 10 o 21.')

        subtotal = dinero(cantidad * precio)
        lineas.append({
            'descripcion': descripcion,
            'cantidad': cantidad,
            'precio_unitario': precio,
            'iva': iva,
            'subtotal': subtotal,
            'importe_iva': dinero(subtotal * iva / 100),
        })
    return lineas


def calcular_totales(lineas):
    subtotal = dinero(sum(linea['subtotal'] for linea in lineas))
    total_iva = dinero(sum(linea['importe_iva'] for linea in lineas))
    return subtotal, total_iva, dinero(subtotal + total_iva)


def generar_siguiente_numero(tipo):
    """Devuelve el siguiente número por tipo y año, ej: PRE-2026-001."""
    prefijo = PREFIJOS_NUMERO[tipo]
    anio = date.today().year
    patron = f'{prefijo}-{anio}-%'

    consultados = db.session.execute(
        select(Documento.numero).where(Documento.numero.like(patron))
    ).scalars().all()

    secuencias = []
    for numero in consultados:
        try:
            secuencias.append(int(numero.rsplit('-', 1)[1]))
        except (ValueError, IndexError):
            continue

    return f'{prefijo}-{anio}-{max(secuencias, default=0) + 1:03d}'


def guardar_cliente(datos):
    """Crea o actualiza el cliente sin duplicarlo.

    Busca por id (al editar), después por NIF y, si no hay NIF, por nombre.
    Solo sobrescribe los campos que vienen informados.
    """
    cliente = None

    if datos['id']:
        cliente = db.session.get(Cliente, datos['id'])
    if cliente is None and datos['nif']:
        cliente = Cliente.query.filter_by(nif=datos['nif']).first()
    if cliente is None and not datos['nif'] and datos['nombre']:
        cliente = Cliente.query.filter_by(nombre=datos['nombre']).first()

    if cliente is None:
        cliente = Cliente(
            nombre=datos['nombre'],
            nif=datos['nif'],
            telefono=datos['telefono'],
            direccion=datos['direccion'],
        )
        db.session.add(cliente)
    else:
        for campo in ('nombre', 'nif', 'telefono', 'direccion'):
            if datos[campo]:
                setattr(cliente, campo, datos[campo])

    db.session.flush()
    return cliente


def numero_disponible(numero, documento_id=None):
    consulta = select(Documento.id).where(Documento.numero == numero)
    if documento_id is not None:
        consulta = consulta.where(Documento.id != documento_id)
    return db.session.execute(consulta).first() is None
