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
# Descripción breve del trabajo escrita por el cliente (opcional)
MAX_DESCRIPCION_TRABAJO = 500
# Condiciones del presupuesto editables por documento (opcional)
MAX_CONDICIONES = 2000
# Unidad de medida de una línea (columna UD. del PDF, opcional)
MAX_UD = 20
# Forma de pago: concepto del tramo y su texto explicativo
MAX_CONCEPTO_PAGO = 60
MAX_DESCRIPCION_PAGO = 400
# Tolerancia al sumar porcentajes por redondeos (ej: 33.33 x 3)
TOLERANCIA_PORCENTAJE = 0.01


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


def leer_descripcion_trabajo(data):
    """Descripción breve del trabajo, opcional.

    Devuelve None si la clave no viene (en PUT el valor se conserva) y la
    cadena limpia si viene: una cadena vacía significa borrar el campo.
    """
    if 'descripcion_trabajo' not in data:
        return None
    valor = data.get('descripcion_trabajo')
    if valor is None:
        return None
    texto = str(valor).strip()
    if len(texto) > MAX_DESCRIPCION_TRABAJO:
        raise ErrorValidacion(
            f'La descripción del trabajo no puede superar los {MAX_DESCRIPCION_TRABAJO} caracteres.'
        )
    return texto


def leer_condiciones(data):
    """Condiciones del presupuesto, opcionales.

    Devuelve None si la clave no viene (en PUT el valor se conserva) y la
    cadena limpia si viene: una cadena vacía significa borrar el campo.
    """
    if 'condiciones' not in data:
        return None
    valor = data.get('condiciones')
    if valor is None:
        return None
    texto = str(valor).strip()
    if len(texto) > MAX_CONDICIONES:
        raise ErrorValidacion(
            f'Las condiciones no pueden superar los {MAX_CONDICIONES} caracteres.'
        )
    return texto


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

        ud = str(item.get('ud') or '').strip()
        if len(ud) > MAX_UD:
            raise ErrorValidacion(
                f'La línea {posicion}: la unidad (UD.) no puede superar los {MAX_UD} caracteres.'
            )

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
            'ud': ud or None,
            'cantidad': cantidad,
            'precio_unitario': precio,
            'iva': iva,
            'subtotal': subtotal,
            'importe_iva': dinero(subtotal * iva / 100),
        })
    return lineas


def validar_formas_pago(data):
    """Calendario de pagos (opcional): lista de concepto + porcentaje.

    Devuelve None si la clave no viene (en PUT se conserva) o una lista ya
    validada: los porcentajes deben sumar 100. Una lista vacía borra el
    calendario del documento.
    """
    if 'formas_pago' not in data:
        return None
    formas = data.get('formas_pago')
    if formas is None:
        return []
    if not isinstance(formas, list):
        raise ErrorValidacion('Las formas de pago no son válidas.')

    resultado = []
    for posicion, forma in enumerate(formas, start=1):
        if not isinstance(forma, dict):
            raise ErrorValidacion(f'La forma de pago {posicion} no es válida.')

        concepto = str(forma.get('concepto') or '').strip()
        if not concepto:
            raise ErrorValidacion(f'La forma de pago {posicion} necesita un concepto.')
        if len(concepto) > MAX_CONCEPTO_PAGO:
            raise ErrorValidacion(
                f'El concepto de la forma de pago {posicion} no puede superar '
                f'los {MAX_CONCEPTO_PAGO} caracteres.'
            )

        try:
            porcentaje = float(forma.get('porcentaje'))
        except (TypeError, ValueError):
            raise ErrorValidacion(f'La forma de pago {posicion} tiene un porcentaje no válido.')
        if not 0 < porcentaje <= 100:
            raise ErrorValidacion(
                f'La forma de pago {posicion} necesita un porcentaje entre 0 y 100.'
            )

        descripcion = str(forma.get('descripcion') or '').strip()
        if len(descripcion) > MAX_DESCRIPCION_PAGO:
            raise ErrorValidacion(
                f'La descripción de la forma de pago {posicion} no puede superar '
                f'los {MAX_DESCRIPCION_PAGO} caracteres.'
            )

        resultado.append({
            'concepto': concepto,
            'porcentaje': dinero(porcentaje),
            'descripcion': descripcion or None,
        })

    if resultado:
        total = sum(forma['porcentaje'] for forma in resultado)
        if abs(total - 100) > TOLERANCIA_PORCENTAJE:
            raise ErrorValidacion(
                f'Los porcentajes de pago deben sumar 100 %. Suma actual: {dinero(total)} %.'
            )
    return resultado


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
