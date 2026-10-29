import os
import re
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from werkzeug.exceptions import HTTPException

from models import Cliente, Documento, LineaDocumento, db

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

app = Flask(__name__)

# Configuración usando variables de entorno con valores por defecto de respaldo
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URI', 'sqlite:///database.sqlite')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Orígenes permitidos para el frontend (separados por comas)
_origenes = [o.strip() for o in os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',') if o.strip()]
CORS(app, origins=_origenes)

db.init_app(app)
Migrate(app, db)

with app.app_context():
    db.create_all()


# ---------------------------------------------------------------------------
# Constantes y utilidades
# ---------------------------------------------------------------------------

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


def _cuerpo_json():
    data = request.get_json(silent=True)
    if data is None or not isinstance(data, dict):
        raise ErrorValidacion('El cuerpo de la petición debe ser un JSON válido.')
    return data


def _leer_tipo(data, por_defecto='presupuesto'):
    valor = data.get('tipo') or data.get('tipoDoc') or por_defecto
    tipo = str(valor).strip().lower()
    if tipo not in PREFIJOS_NUMERO:
        raise ErrorValidacion("El tipo de documento debe ser 'presupuesto' o 'factura'.")
    return tipo


def _leer_fecha(data, por_defecto=None):
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


def _leer_cliente(data, obligatorio=True):
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


def _validar_items(data):
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


def _calcular_totales(lineas):
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


def _guardar_cliente(datos):
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


def _numero_disponible(numero, documento_id=None):
    consulta = select(Documento.id).where(Documento.numero == numero)
    if documento_id is not None:
        consulta = consulta.where(Documento.id != documento_id)
    return db.session.execute(consulta).first() is None


# ---------------------------------------------------------------------------
# Manejadores de error: nunca filtramos detalles internos al cliente
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------

@app.route('/api/documentos/proximo-numero', methods=['GET'])
def proximo_numero():
    tipo = str(request.args.get('tipo', 'presupuesto')).strip().lower()
    if tipo not in PREFIJOS_NUMERO:
        raise ErrorValidacion("El tipo debe ser 'presupuesto' o 'factura'.")
    return jsonify({'numero': generar_siguiente_numero(tipo)}), 200


@app.route('/api/documentos', methods=['POST'])
def guardar_documento():
    data = _cuerpo_json()

    tipo = _leer_tipo(data)
    fecha = _leer_fecha(data)
    datos_cliente = _leer_cliente(data)
    lineas = _validar_items(data)
    subtotal, total_iva, total_general = _calcular_totales(lineas)

    # Reintenta ante una colisión de número (dos peticiones a la vez)
    for intento in range(MAX_INTENTOS_GUARDADO):
        try:
            cliente = _guardar_cliente(datos_cliente)
            documento = Documento(
                tipo=tipo,
                numero=generar_siguiente_numero(tipo),
                fecha=fecha,
                cliente_id=cliente.id,
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


@app.route('/api/documentos', methods=['GET'])
def obtener_documentos():
    documentos = db.session.execute(
        select(Documento)
        .options(selectinload(Documento.cliente), selectinload(Documento.lineas))
        .order_by(Documento.id.desc())
    ).scalars().all()
    return jsonify([documento.to_dict() for documento in documentos]), 200


@app.route('/api/documentos/<int:id>', methods=['GET'])
def obtener_documento(id):
    documento = db.session.get(Documento, id)
    if not documento:
        return jsonify({'error': 'Documento no encontrado'}), 404
    return jsonify(documento.to_dict()), 200


@app.route('/api/documentos/<int:id>', methods=['PUT'])
def actualizar_documento(id):
    documento = db.session.get(Documento, id)
    if not documento:
        return jsonify({'error': 'Documento no encontrado'}), 404

    data = _cuerpo_json()

    tipo = _leer_tipo(data, por_defecto=documento.tipo)
    fecha = _leer_fecha(data, por_defecto=documento.fecha)

    # Número: se respeta el actual, se valida el enviado y se regenera si
    # cambió el tipo y el anterior era automático (PRE-... -> FAC-...)
    numero = str(data.get('numero') or data.get('numeroDoc') or documento.numero).strip()
    if not numero:
        numero = documento.numero
    elif numero != documento.numero and not _numero_disponible(numero, documento.id):
        raise ErrorValidacion(f'Ya existe otro documento con el número {numero}.', 409)
    if tipo != documento.tipo and numero == documento.numero and PATRON_NUMERO_AUTO.match(numero):
        numero = generar_siguiente_numero(tipo)

    documento.tipo = tipo
    documento.numero = numero
    documento.fecha = fecha

    datos_cliente = _leer_cliente(data, obligatorio=False)
    if datos_cliente:
        cliente = _guardar_cliente(datos_cliente)
        documento.cliente_id = cliente.id

    # Solo se reemplazan las líneas si vienen en la petición
    if 'items' in data:
        lineas = _validar_items(data)
        subtotal, total_iva, total_general = _calcular_totales(lineas)
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


@app.route('/api/documentos/<int:id>', methods=['DELETE'])
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


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    # DEBUG por defecto desactivado: el debugger de Werkzeug no debe exponerse
    debug_mode = os.getenv('DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, port=port)
