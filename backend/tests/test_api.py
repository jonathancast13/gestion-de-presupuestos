from datetime import date

AÑO = date.today().year


def payload(**campos):
    """Cuerpo de petición válido por defecto, sobrescribible por campo."""
    base = {
        'tipo': 'presupuesto',
        'fecha': '2026-05-01',
        'cliente': {
            'nombre': 'Ana Pérez',
            'nif': '12345678Z',
            'telefono': '600000000',
            'direccion': 'Calle Mayor 1',
        },
        'items': [
            {'descripcion': 'Demolición de tabique', 'cantidad': 1, 'precioUnitario': 100, 'iva': 21},
        ],
    }
    base.update(campos)
    return base


def crear(client, **campos):
    respuesta = client.post('/api/documentos', json=payload(**campos))
    assert respuesta.status_code == 201, respuesta.get_json()
    return respuesta.get_json()


# ---------------------------------------------------------------------------
# Numeración automática
# ---------------------------------------------------------------------------

def test_crear_documento_asigna_numero_automatico(client):
    datos = crear(client)
    assert datos['numero'] == f'PRE-{AÑO}-001'
    assert datos['id'] > 0
    assert datos['subtotal'] == 100.0
    assert datos['total_iva'] == 21.0
    assert datos['total_general'] == 121.0
    assert len(datos['lineas']) == 1


def test_numeracion_incremental(client):
    numeros = [crear(client)['numero'] for _ in range(3)]
    assert numeros == [f'PRE-{AÑO}-001', f'PRE-{AÑO}-002', f'PRE-{AÑO}-003']


def test_factura_usa_prefijo_fac(client):
    datos = crear(client, tipo='factura')
    assert datos['numero'] == f'FAC-{AÑO}-001'


def test_post_ignora_el_numero_enviado(client):
    datos = crear(client, numero='PRE-1999-099')
    assert datos['numero'] == f'PRE-{AÑO}-001'


def test_proximo_numero(client):
    r = client.get('/api/documentos/proximo-numero?tipo=presupuesto')
    assert r.status_code == 200
    assert r.get_json()['numero'] == f'PRE-{AÑO}-001'

    crear(client)
    r = client.get('/api/documentos/proximo-numero?tipo=presupuesto')
    assert r.get_json()['numero'] == f'PRE-{AÑO}-002'

    assert client.get('/api/documentos/proximo-numero?tipo=inexistente').status_code == 400


# ---------------------------------------------------------------------------
# Cálculo de totales
# ---------------------------------------------------------------------------

def test_totales_con_iva_mixto(client):
    items = [
        {'descripcion': 'Obra', 'cantidad': 1, 'precioUnitario': 100, 'iva': 21},
        {'descripcion': 'Materiales', 'cantidad': 2, 'precioUnitario': 50, 'iva': 10},
    ]
    datos = crear(client, items=items)
    assert datos['subtotal'] == 200.0
    assert datos['total_iva'] == 31.0
    assert datos['total_general'] == 231.0


def test_redondeo_a_dos_decimales_por_linea(client):
    items = [{'descripcion': 'Trabajo por horas', 'cantidad': 3, 'precioUnitario': 33.33, 'iva': 21}]
    datos = crear(client, items=items)
    assert datos['subtotal'] == 99.99
    assert datos['total_iva'] == 21.0
    assert datos['total_general'] == 120.99


# ---------------------------------------------------------------------------
# Clientes sin duplicados
# ---------------------------------------------------------------------------

def test_cliente_existente_se_actualiza(client):
    crear(client, cliente={'nombre': 'Ana', 'nif': '123Z', 'telefono': '111', 'direccion': ''})
    crear(client, cliente={'nombre': 'Ana María', 'nif': '123Z', 'telefono': '222', 'direccion': ''})

    documentos = client.get('/api/documentos').get_json()
    assert len(documentos) == 2
    assert len({d['cliente']['id'] for d in documentos}) == 1
    assert documentos[0]['cliente']['nombre'] == 'Ana María'
    assert documentos[0]['cliente']['telefono'] == '222'


def test_clientes_sin_nif_no_se_duplican(client):
    cliente = {'nombre': 'Reformas del Norte SL', 'nif': '', 'telefono': '', 'direccion': ''}
    crear(client, cliente=dict(cliente))
    crear(client, cliente=dict(cliente))

    documentos = client.get('/api/documentos').get_json()
    assert len(documentos) == 2
    assert len({d['cliente']['id'] for d in documentos}) == 1


def test_se_puede_crear_cliente_sin_nif(client):
    datos = crear(client, cliente={'nombre': 'Sin NIF', 'nif': '', 'telefono': '', 'direccion': ''})
    assert datos['cliente']['nombre'] == 'Sin NIF'


# ---------------------------------------------------------------------------
# Validaciones
# ---------------------------------------------------------------------------

def test_items_vacios_rechazados(client):
    r = client.post('/api/documentos', json=payload(items=[]))
    assert r.status_code == 400
    assert 'al menos una línea' in r.get_json()['error']


def test_linea_sin_descripcion_rechazada(client):
    items = [{'descripcion': '   ', 'cantidad': 1, 'precioUnitario': 10, 'iva': 21}]
    r = client.post('/api/documentos', json=payload(items=items))
    assert r.status_code == 400
    assert 'descripción' in r.get_json()['error']


def test_iva_invalido_rechazado(client):
    items = [{'descripcion': 'Obra', 'cantidad': 1, 'precioUnitario': 10, 'iva': 15}]
    r = client.post('/api/documentos', json=payload(items=items))
    assert r.status_code == 400
    assert 'IVA' in r.get_json()['error']


def test_cantidad_cero_rechazada(client):
    items = [{'descripcion': 'Obra', 'cantidad': 0, 'precioUnitario': 10, 'iva': 21}]
    r = client.post('/api/documentos', json=payload(items=items))
    assert r.status_code == 400


def test_precio_negativo_rechazado(client):
    items = [{'descripcion': 'Obra', 'cantidad': 1, 'precioUnitario': -5, 'iva': 21}]
    r = client.post('/api/documentos', json=payload(items=items))
    assert r.status_code == 400


def test_fecha_invalida_rechazada(client):
    r = client.post('/api/documentos', json=payload(fecha='31/12/2026'))
    assert r.status_code == 400
    assert 'AAAA-MM-DD' in r.get_json()['error']


def test_nombre_de_cliente_obligatorio(client):
    r = client.post('/api/documentos', json=payload(cliente={'nombre': '', 'nif': '', 'telefono': '', 'direccion': ''}))
    assert r.status_code == 400
    assert 'nombre del cliente' in r.get_json()['error']


def test_tipo_invalido_rechazado(client):
    r = client.post('/api/documentos', json=payload(tipo='albarán'))
    assert r.status_code == 400


def test_cuerpo_vacio_o_no_json_rechazado(client):
    assert client.post('/api/documentos', json={}).status_code == 400
    r = client.post('/api/documentos', data='no es json', content_type='text/plain')
    assert r.status_code == 400
    assert 'JSON' in r.get_json()['error']


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def test_obtener_documento_por_id(client):
    creado = crear(client)
    r = client.get(f"/api/documentos/{creado['id']}")
    assert r.status_code == 200
    datos = r.get_json()
    assert datos['cliente']['nombre'] == 'Ana Pérez'
    assert datos['lineas'][0]['descripcion'] == 'Demolición de tabique'


def test_listado_mas_reciente_primero(client):
    primero = crear(client)
    segundo = crear(client)
    listado = client.get('/api/documentos').get_json()
    assert [d['id'] for d in listado] == [segundo['id'], primero['id']]


def test_documentos_inexistentes_devuelven_404(client):
    assert client.get('/api/documentos/999').status_code == 404
    assert client.put('/api/documentos/999', json={}).status_code == 404
    assert client.delete('/api/documentos/999').status_code == 404


# ---------------------------------------------------------------------------
# Descripción del trabajo (opcional)
# ---------------------------------------------------------------------------

def test_crear_sin_descripcion_trabajo_devuelve_null(client):
    datos = crear(client)
    assert datos['descripcion_trabajo'] is None


def test_crear_con_descripcion_trabajo(client):
    datos = crear(client, descripcion_trabajo='  Reforma completa del baño  ')
    assert datos['descripcion_trabajo'] == 'Reforma completa del baño'


def test_descripcion_vacia_en_post_se_guarda_como_null(client):
    datos = crear(client, descripcion_trabajo='   ')
    assert datos['descripcion_trabajo'] is None


def test_descripcion_demasiado_larga_rechazada(client):
    r = client.post('/api/documentos', json=payload(descripcion_trabajo='x' * 501))
    assert r.status_code == 400
    assert '500' in r.get_json()['error']


def test_actualizar_descripcion_trabajo(client):
    creado = crear(client)
    r = client.put(f"/api/documentos/{creado['id']}", json={'descripcion_trabajo': 'Nueva descripción'})
    assert r.status_code == 200
    assert r.get_json()['descripcion_trabajo'] == 'Nueva descripción'


def test_actualizar_sin_clave_conserva_la_descripcion(client):
    creado = crear(client, descripcion_trabajo='Texto original')
    r = client.put(f"/api/documentos/{creado['id']}", json={'fecha': '2026-08-01'})
    assert r.status_code == 200
    assert r.get_json()['descripcion_trabajo'] == 'Texto original'


def test_descripcion_vacia_en_put_la_borra(client):
    creado = crear(client, descripcion_trabajo='Texto a borrar')
    r = client.put(f"/api/documentos/{creado['id']}", json={'descripcion_trabajo': ''})
    assert r.status_code == 200
    assert r.get_json()['descripcion_trabajo'] is None


# ---------------------------------------------------------------------------
# Edición
# ---------------------------------------------------------------------------

def test_actualizar_documento(client):
    creado = crear(client)
    cambios = {
        'tipo': 'factura',
        'fecha': '2026-06-15',
        'numero': creado['numero'],
        'cliente': {'id': creado['cliente']['id'], 'nombre': 'Ana María Pérez',
                    'nif': '12345678Z', 'telefono': '611111111', 'direccion': 'Calle Nueva 2'},
        'items': [{'descripcion': 'Pintura completa', 'cantidad': 2, 'precioUnitario': 75, 'iva': 21}],
    }
    r = client.put(f"/api/documentos/{creado['id']}", json=cambios)
    assert r.status_code == 200, r.get_json()
    datos = r.get_json()

    # Al cambiar de tipo, el número automático se reasigna con el prefijo nuevo
    assert datos['numero'] == f'FAC-{AÑO}-001'
    assert datos['fecha'] == '2026-06-15'
    assert datos['cliente']['nombre'] == 'Ana María Pérez'
    assert datos['cliente']['telefono'] == '611111111'
    assert len(datos['lineas']) == 1
    assert datos['lineas'][0]['descripcion'] == 'Pintura completa'
    assert datos['subtotal'] == 150.0
    assert datos['total_iva'] == 31.5
    assert datos['total_general'] == 181.5


def test_actualizar_sin_items_no_borra_las_lineas(client):
    creado = crear(client)
    r = client.put(f"/api/documentos/{creado['id']}", json={'fecha': '2026-07-01'})
    assert r.status_code == 200
    datos = r.get_json()
    assert len(datos['lineas']) == 1
    assert datos['total_general'] == 121.0
    assert datos['fecha'] == '2026-07-01'


def test_actualizar_numero_duplicado_rechazado(client):
    primero = crear(client)
    segundo = crear(client)
    r = client.put(f"/api/documentos/{segundo['id']}", json={'numero': primero['numero']})
    assert r.status_code == 409
    assert 'ya está en uso' in r.get_json()['error'] or 'Ya existe' in r.get_json()['error']


def test_actualizar_mantiene_el_numero_si_no_cambia(client):
    creado = crear(client)
    r = client.put(f"/api/documentos/{creado['id']}", json={'numero': creado['numero']})
    assert r.status_code == 200
    assert r.get_json()['numero'] == creado['numero']


# ---------------------------------------------------------------------------
# Borrado
# ---------------------------------------------------------------------------

def test_eliminar_documento(client):
    creado = crear(client)
    r = client.delete(f"/api/documentos/{creado['id']}")
    assert r.status_code == 200
    assert client.get(f"/api/documentos/{creado['id']}").status_code == 404
    assert client.get('/api/documentos').get_json() == []


# ---------------------------------------------------------------------------
# Unidad de medida (columna UD. del PDF)
# ---------------------------------------------------------------------------

def test_linea_con_ud(client):
    items = [{'descripcion': 'Gotele', 'ud': 'm2', 'cantidad': 2, 'precioUnitario': 10, 'iva': 21}]
    datos = crear(client, items=items)
    assert datos['lineas'][0]['ud'] == 'm2'


def test_linea_sin_ud_devuelve_null(client):
    datos = crear(client)
    assert datos['lineas'][0]['ud'] is None


def test_ud_demasiado_larga_rechazada(client):
    items = [{'descripcion': 'Gotele', 'ud': 'x' * 21, 'cantidad': 1, 'precioUnitario': 1, 'iva': 21}]
    r = client.post('/api/documentos', json=payload(items=items))
    assert r.status_code == 400
    assert 'unidad' in r.get_json()['error']


def test_actualizar_ud_de_las_lineas(client):
    creado = crear(client)
    items = [{'descripcion': 'Gotele', 'ud': 'ud', 'cantidad': 1, 'precioUnitario': 10, 'iva': 21}]
    r = client.put(f"/api/documentos/{creado['id']}", json={'items': items})
    assert r.status_code == 200
    assert r.get_json()['lineas'][0]['ud'] == 'ud'


# ---------------------------------------------------------------------------
# Condiciones del presupuesto
# ---------------------------------------------------------------------------

def test_crear_sin_condiciones_devuelve_null(client):
    assert crear(client)['condiciones'] is None


def test_crear_con_condiciones(client):
    datos = crear(client, condiciones='  Validez: 30 días.  ')
    assert datos['condiciones'] == 'Validez: 30 días.'


def test_condiciones_vacias_en_post_se_guardan_como_null(client):
    assert crear(client, condiciones='   ')['condiciones'] is None


def test_condiciones_demasiado_largas_rechazadas(client):
    r = client.post('/api/documentos', json=payload(condiciones='x' * 2001))
    assert r.status_code == 400
    assert 'condiciones' in r.get_json()['error']


def test_actualizar_condiciones(client):
    creado = crear(client)
    r = client.put(f"/api/documentos/{creado['id']}", json={'condiciones': 'Alcance: solo lo descrito.'})
    assert r.status_code == 200
    assert r.get_json()['condiciones'] == 'Alcance: solo lo descrito.'


def test_actualizar_sin_clave_conserva_las_condiciones(client):
    creado = crear(client, condiciones='Validez: 30 días.')
    r = client.put(f"/api/documentos/{creado['id']}", json={'fecha': '2026-05-02'})
    assert r.status_code == 200
    assert r.get_json()['condiciones'] == 'Validez: 30 días.'


def test_condiciones_vacias_en_put_las_boran(client):
    creado = crear(client, condiciones='Validez: 30 días.')
    r = client.put(f"/api/documentos/{creado['id']}", json={'condiciones': ''})
    assert r.status_code == 200
    assert r.get_json()['condiciones'] is None


# ---------------------------------------------------------------------------
# Formas de pago (calendario)
# ---------------------------------------------------------------------------

FORMAS = [
    {'concepto': 'ACEPTACIÓN DE OBRA', 'porcentaje': 50},
    {'concepto': 'AVANCE DE OBRA', 'porcentaje': 25},
    {'concepto': 'FINALIZACIÓN DE OBRA', 'porcentaje': 25},
]


def test_crear_sin_formas_pago_devuelve_lista_vacia(client):
    datos = crear(client)
    assert datos['formas_pago'] == []


def test_crear_con_formas_pago(client):
    formas = [dict(f, descripcion='Texto del tramo') for f in FORMAS]
    datos = crear(client, formas_pago=formas)
    assert [f['concepto'] for f in datos['formas_pago']] == [
        'ACEPTACIÓN DE OBRA', 'AVANCE DE OBRA', 'FINALIZACIÓN DE OBRA'
    ]
    assert [f['porcentaje'] for f in datos['formas_pago']] == [50.0, 25.0, 25.0]
    assert datos['formas_pago'][0]['descripcion'] == 'Texto del tramo'


def test_formas_pago_con_descripcion_opcional(client):
    datos = crear(client, formas_pago=[{'concepto': 'GARANTÍA', 'porcentaje': 100}])
    assert datos['formas_pago'][0]['descripcion'] is None


def test_porcentajes_que_no_suman_100_rechazados(client):
    formas = [{'concepto': 'ÚNICO PAGO', 'porcentaje': 80}]
    r = client.post('/api/documentos', json=payload(formas_pago=formas))
    assert r.status_code == 400
    assert '100' in r.get_json()['error']


def test_porcentajes_con_decimales_suman_100(client):
    formas = [
        {'concepto': 'A', 'porcentaje': 33.33},
        {'concepto': 'B', 'porcentaje': 33.33},
        {'concepto': 'C', 'porcentaje': 33.34},
    ]
    assert crear(client, formas_pago=formas)['formas_pago']


def test_forma_pago_sin_concepto_rechazada(client):
    r = client.post('/api/documentos', json=payload(
        formas_pago=[{'concepto': '  ', 'porcentaje': 100}]
    ))
    assert r.status_code == 400
    assert 'concepto' in r.get_json()['error']


def test_concepto_demasiado_largo_rechazado(client):
    r = client.post('/api/documentos', json=payload(
        formas_pago=[{'concepto': 'x' * 61, 'porcentaje': 100}]
    ))
    assert r.status_code == 400
    assert 'concepto' in r.get_json()['error']


def test_porcentaje_cero_o_negativo_rechazado(client):
    for porcentaje in (0, -5):
        r = client.post('/api/documentos', json=payload(
            formas_pago=[{'concepto': 'ÚNICO PAGO', 'porcentaje': porcentaje}]
        ))
        assert r.status_code == 400


def test_porcentaje_mayor_100_rechazado(client):
    r = client.post('/api/documentos', json=payload(
        formas_pago=[{'concepto': 'ÚNICO PAGO', 'porcentaje': 120}]
    ))
    assert r.status_code == 400


def test_formas_pago_no_lista_rechazadas(client):
    r = client.post('/api/documentos', json=payload(formas_pago={'concepto': 'X', 'porcentaje': 100}))
    assert r.status_code == 400


def test_actualizar_reemplaza_las_formas_pago(client):
    creado = crear(client, formas_pago=[dict(FORMAS[0], porcentaje=100)])
    r = client.put(f"/api/documentos/{creado['id']}", json={'formas_pago': FORMAS})
    assert r.status_code == 200
    assert len(r.get_json()['formas_pago']) == 3


def test_actualizar_sin_clave_conserva_las_formas_pago(client):
    creado = crear(client, formas_pago=[dict(FORMAS[0], porcentaje=100)])
    r = client.put(f"/api/documentos/{creado['id']}", json={'fecha': '2026-05-02'})
    assert r.status_code == 200
    assert len(r.get_json()['formas_pago']) == 1


def test_formas_pago_vacias_en_put_las_boran(client):
    creado = crear(client, formas_pago=[dict(FORMAS[0], porcentaje=100)])
    r = client.put(f"/api/documentos/{creado['id']}", json={'formas_pago': []})
    assert r.status_code == 200
    assert r.get_json()['formas_pago'] == []


def test_eliminar_documento_borra_las_formas_pago(client):
    creado = crear(client, formas_pago=FORMAS)
    assert client.delete(f"/api/documentos/{creado['id']}").status_code == 200
    assert client.get(f"/api/documentos/{creado['id']}").status_code == 404
