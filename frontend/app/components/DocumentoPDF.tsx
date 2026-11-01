import {
  Document,
  Font,
  Image,
  Page,
  Polygon,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { calcularTotales, desgloseIva, formatearEuros } from "@/lib/dinero";
import { EMPRESA, ORO_PLANTILLA } from "@/lib/empresa";
import {
  cabeEnUnaPagina,
  estimarAltoBloquePago,
  estimarAltoCondiciones,
  estimarAltoFilaPartida,
  estimarAltoItemCondicion,
  formatoFechaCorta,
  importeFormaPago,
  partirTituloCondicion,
  repartirEnDosColumnas,
} from "@/lib/plantilla";
import type { ClienteData, FormaPago, ItemLinea, TipoDocumento } from "@/types";

/**
 * Réplica de la plantilla PDF del cliente (A4 con marco, cabecera bicolor
 * con triángulos dorados, tablas con bordes y segunda página de pago cuando
 * todo no cabe en una).
 */

// El PDF se genera en el navegador: las rutas se resuelven contra el origen
const ORIGEN = typeof window !== "undefined" ? window.location.origin : "";
const LOGO_SRC = ORIGEN + EMPRESA.logoRuta;

// Fuentes libres: Archivo sustituye a Aptos y Gelasio a Georgia/Century Schoolbook
Font.register({
  family: "Archivo",
  fonts: [
    { src: `${ORIGEN}/fuentes/Archivo-Regular.ttf`, fontWeight: 400 },
    { src: `${ORIGEN}/fuentes/Archivo-SemiBold.ttf`, fontWeight: 600 },
    { src: `${ORIGEN}/fuentes/Archivo-Bold.ttf`, fontWeight: 700 },
  ],
});
Font.register({
  family: "Gelasio",
  fonts: [
    { src: `${ORIGEN}/fuentes/Gelasio-Regular.ttf`, fontWeight: 400 },
    { src: `${ORIGEN}/fuentes/Gelasio-Bold.ttf`, fontWeight: 700 },
    {
      src: `${ORIGEN}/fuentes/Gelasio-BoldItalic.ttf`,
      fontWeight: 700,
      fontStyle: "italic",
    },
  ],
});

// Sin guiones de partición al final de línea: el texto fluye como en la plantilla
Font.registerHyphenationCallback((palabra) => [palabra]);

const NEGRO = "#000000";
const ORO = ORO_PLANTILLA; // #B99D4F, el oro exacto de la plantilla
const BORDE = 1.5;

// Márgenes del marco de la plantilla (izq. 17,3 / der. 23,6 sobre A4)
const MARGEN_IZQUIERDO = 17.3;
const MARGEN_DERECHO = 23.6;
const ANCHO_CUADRO = 595.28 - MARGEN_IZQUIERDO - MARGEN_DERECHO - 2 * BORDE;

// Anchos de columna de la tabla de partidas (medidos sobre la plantilla)
const COL_ITEM = 92;
const COL_UD = 34;
const COL_CANTIDAD = 57;
const COL_PRECIO = 65;
const COL_IMPORTE = 82;

// Condiciones: la columna izquierda tiene ~219 de texto útil y se rellena
// hasta el tope (como en la plantilla, que deja 3+1); la derecha ~166
const ANCHO_CONDICION_IZQUIERDA = 219;
const ALTO_MAXIMO_COLUMNA_CONDICIONES = 88;

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 54,
    paddingBottom: 56,
    paddingLeft: MARGEN_IZQUIERDO,
    paddingRight: MARGEN_DERECHO,
    backgroundColor: "#FFFFFF",
  },
  marco: {
    borderWidth: BORDE,
    borderColor: NEGRO,
    borderStyle: "solid",
    fontFamily: "Archivo",
    color: NEGRO,
    // El marco ocupa toda la altura de la página, como en la plantilla
    flexGrow: 1,
  },

  // --- Cabecera gráfica (triángulos dorados + logo) -----------------------
  grafica: { height: 107, position: "relative" },
  graficaSvg: { position: "absolute", top: 0, left: 0 },
  cajaLogo: {
    position: "absolute",
    left: 226,
    top: 0,
    width: 100,
    height: 107,
    backgroundColor: NEGRO,
    borderWidth: BORDE,
    borderColor: ORO,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 69, height: 84 },

  // --- Franja bicolor con el nombre ---------------------------------------
  franja: { flexDirection: "row", height: 35 },
  franjaIzquierda: { width: 246, backgroundColor: NEGRO },
  franjaDerecha: {
    flex: 1,
    backgroundColor: ORO,
    alignItems: "center",
    justifyContent: "center",
  },
  nombreEmpresa: { fontFamily: "Gelasio", fontWeight: "bold", fontSize: 14 },
  rangoEmpresa: { fontFamily: "Gelasio", fontSize: 9.5, letterSpacing: 0.6 },

  // --- Fila de número/fecha + contacto ------------------------------------
  filaDocumento: { flexDirection: "row" },
  celdaEtiquetaDoc: {
    width: 157,
    height: 30,
    borderRightWidth: BORDE,
    borderBottomWidth: BORDE,
    borderColor: NEGRO,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 10.5,
  },
  celdaFechaEtiqueta: {
    width: 157,
    height: 17,
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 10.5,
  },
  celdaValorDoc: {
    width: 85,
    height: 30,
    borderBottomWidth: BORDE,
    borderColor: NEGRO,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Gelasio",
    fontSize: 10,
  },
  celdaFechaValor: {
    width: 85,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Gelasio",
    fontSize: 10,
  },
  celdaContacto: {
    flex: 1,
    height: 47,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  textoContacto: {
    fontFamily: "Gelasio",
    fontSize: 10,
    textAlign: "center",
    lineHeight: 1.5,
  },

  // --- Banda de título de sección -----------------------------------------
  bandaSeccion: {
    height: 30,
    backgroundColor: ORO,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: BORDE,
    borderColor: NEGRO,
  },
  bandaSeccionTexto: {
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 10,
    letterSpacing: 0.4,
  },

  // --- Filas de datos del cliente -----------------------------------------
  filaCliente: { flexDirection: "row", height: 16, borderBottomWidth: BORDE, borderColor: NEGRO },
  filaClienteEtiqueta: {
    width: 93,
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    paddingLeft: 4,
    justifyContent: "center",
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 9,
  },
  filaClienteValor: {
    flex: 1,
    paddingLeft: 5,
    justifyContent: "center",
    fontFamily: "Archivo",
    fontSize: 8.5,
  },

  // --- Fila de descripción del trabajo ------------------------------------
  filaDescripcion: { flexDirection: "row", height: 30, borderBottomWidth: BORDE, borderColor: NEGRO },
  filaDescripcionEtiqueta: {
    width: 244,
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 10,
  },
  filaDescripcionValor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    fontFamily: "Archivo",
    fontSize: 9.5,
    textAlign: "center",
  },

  // --- Tabla de partidas ---------------------------------------------------
  cabeceraTabla: {
    flexDirection: "row",
    height: 16,
    backgroundColor: ORO,
    borderBottomWidth: BORDE,
    borderColor: NEGRO,
  },
  celdaCabecera: {
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: BORDE,
    borderColor: NEGRO,
  },
  textoCabecera: { fontFamily: "Gelasio", fontWeight: "bold", fontSize: 8 },
  filaPartida: { flexDirection: "row", borderBottomWidth: BORDE, borderColor: NEGRO, minHeight: 27 },
  celdaPartida: {
    justifyContent: "center",
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    paddingHorizontal: 3,
    paddingVertical: 2,
    fontFamily: "Archivo",
    fontSize: 8.5,
  },
  colItem: { width: COL_ITEM, alignItems: "center" },
  colDescripcion: { flex: 1, paddingHorizontal: 4 },
  colUd: { width: COL_UD, alignItems: "center" },
  colCantidad: { width: COL_CANTIDAD, alignItems: "center" },
  colPrecio: { width: COL_PRECIO, alignItems: "flex-end" },
  colImporte: {
    width: COL_IMPORTE,
    alignItems: "flex-end",
    borderRightWidth: 0,
    paddingRight: 4,
  },

  // --- Totales -------------------------------------------------------------
  zonaTotales: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  tablaTotales: {
    width: 396,
    borderLeftWidth: BORDE,
    borderRightWidth: BORDE,
    borderColor: NEGRO,
  },
  filaTotal: {
    flexDirection: "row",
    height: 15.5,
    borderColor: NEGRO,
  },
  filaTotalInicial: { borderTopWidth: BORDE },
  filaTotalSeparadora: { borderBottomWidth: BORDE },
  totalEtiqueta: {
    width: 150,
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 9.5,
  },
  totalEtiquetaOro: { backgroundColor: ORO },
  totalValor: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 6,
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 9.5,
  },

  // --- Condiciones ---------------------------------------------------------
  condiciones: { flexDirection: "row", borderTopWidth: BORDE, borderColor: NEGRO },
  condicionesEtiqueta: {
    width: 91,
    backgroundColor: ORO,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  condicionesEtiquetaTexto: {
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontSize: 9.5,
    textAlign: "center",
    lineHeight: 1.35,
  },
  condicionesCuerpo: { flex: 1, flexDirection: "row", paddingTop: 5, paddingBottom: 4 },
  condicionesColumnaIzquierda: { flex: 1, paddingLeft: 25, paddingRight: 14 },
  condicionesColumnaDerecha: { width: 200, paddingLeft: 26, paddingRight: 8 },
  condicionItem: { flexDirection: "row", marginBottom: 2 },
  condicionNumero: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: NEGRO,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginTop: 1.5,
  },
  condicionNumeroTexto: {
    fontFamily: "Archivo",
    fontWeight: "bold",
    color: "#FFFFFF",
    fontSize: 8,
    lineHeight: 1.25,
  },
  condicionCuerpo: { flex: 1 },
  condicionTitulo: { fontFamily: "Archivo", fontWeight: "bold", fontSize: 9, lineHeight: 1.28 },
  condicionParrafo: { fontFamily: "Archivo", fontSize: 8.7, lineHeight: 1.32 },

  // --- Forma de pago (página 2 o al pie de la única página) ----------------
  bloquePago: { marginTop: 4 },
  tituloPago: { fontFamily: "Gelasio", fontWeight: "bold", fontSize: 14, marginTop: 8 },
  subtituloPago: { fontFamily: "Archivo", fontSize: 10, marginTop: 2 },
  lineaPago: { fontFamily: "Archivo", fontSize: 9, lineHeight: 1.35, marginTop: 2 },
  cabeceraPago: {
    flexDirection: "row",
    marginTop: 6,
    backgroundColor: ORO,
    borderBottomWidth: BORDE,
    borderColor: NEGRO,
  },
  celdaCabeceraPago: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    paddingVertical: 3,
  },
  textoCabeceraPago: { fontFamily: "Gelasio", fontWeight: "bold", fontSize: 9, textAlign: "center" },
  filaPago: { flexDirection: "row", borderBottomWidth: BORDE, borderColor: NEGRO },
  celdaPago: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  textoPago: { fontFamily: "Archivo", fontSize: 8.5, lineHeight: 1.3, textAlign: "center" },
  textoPorcentaje: { fontWeight: "bold" },
  cabeceraConceptos: {
    flexDirection: "row",
    backgroundColor: ORO,
    borderBottomWidth: BORDE,
    borderColor: NEGRO,
  },
  celdaCabeceraConceptos: {
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    paddingVertical: 3,
  },
  filaConceptos: { flexDirection: "row", borderBottomWidth: BORDE, borderColor: NEGRO },
  celdaConceptos: {
    justifyContent: "center",
    borderRightWidth: BORDE,
    borderColor: NEGRO,
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontFamily: "Archivo",
    fontSize: 8.5,
    minHeight: 15,
  },
  colConcepto: { flex: 1 },
  colPorcentaje: { width: 180, alignItems: "center" },
  colImportePago: { width: 180, alignItems: "flex-end", paddingRight: 5, borderRightWidth: 0 },
  conceptoNegrita: { fontWeight: "bold" },

  // --- Banda de agradecimiento --------------------------------------------
  bandaGracias: {
    backgroundColor: ORO,
    flexGrow: 1,
    minHeight: 54,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textoGracias: {
    fontFamily: "Gelasio",
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 19,
    textAlign: "center",
  },
});

// Alturas fijas de la cabecera (para la estimación de una/dos páginas)
const ALTO_FIJO_CABECERA =
  107 + // gráfica
  35 + // franja
  30 +
  17 + // fila número/fecha
  30 + // banda "DATOS DEL CLIENTE"
  3 * 16 + // filas cliente
  30 + // fila descripción
  16; // cabecera de la tabla de partidas

interface DocumentoPDFProps {
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  fecha: string;
  cliente: ClienteData;
  descripcionTrabajo?: string;
  condiciones?: string;
  items: ItemLinea[];
  formasPago?: FormaPago[];
}

/** Cabecera gráfica + franja + fila de número/fecha y contacto */
function Cabecera() {
  return (
    <View>
      <View style={estilos.grafica}>
        <Svg width={ANCHO_CUADRO} height={107} style={estilos.graficaSvg}>
          <Rect x={0} y={0} width={ANCHO_CUADRO} height={107} fill={NEGRO} />
          <Rect x={4} y={0} width={476} height={2.5} fill={ORO} />
          <Polygon points="5,2.5 140,2.5 253,106 123,106" fill={ORO} />
          <Polygon points="345,2.5 483,2.5 531,106" fill={ORO} />
        </Svg>
        <View style={estilos.cajaLogo}>
          <Image src={LOGO_SRC} style={estilos.logo} />
        </View>
      </View>

      <View style={estilos.franja}>
        <View style={estilos.franjaIzquierda} />
        <View style={estilos.franjaDerecha}>
          <Text style={estilos.nombreEmpresa}>OSWALDO ARIZA</Text>
          <Text style={estilos.rangoEmpresa}>CONTRATISTA</Text>
        </View>
      </View>
    </View>
  );
}

interface CabeceraDocumentoProps {
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  fecha: string;
  cliente: ClienteData;
  descripcionTrabajo?: string;
}

/** Número/fecha, contacto de la empresa, datos del cliente y descripción */
function CabeceraDocumento({
  tipoDoc,
  numeroDoc,
  fecha,
  cliente,
  descripcionTrabajo,
}: CabeceraDocumentoProps) {
  const etiquetaNumero = tipoDoc === "factura" ? "FACTURA Nº" : "PRESUPUESTO Nº";
  return (
    <View>
      <View style={estilos.filaDocumento}>
        <View>
          <Text style={estilos.celdaEtiquetaDoc}>{etiquetaNumero}</Text>
          <Text style={estilos.celdaFechaEtiqueta}>FECHA</Text>
        </View>
        <View>
          <Text style={estilos.celdaValorDoc}>{numeroDoc || "—"}</Text>
          <Text style={estilos.celdaFechaValor}>{formatoFechaCorta(fecha)}</Text>
        </View>
        <View style={estilos.celdaContacto}>
          <Text style={estilos.textoContacto}>
            <Text style={{ fontWeight: "bold" }}>CONTACTO:</Text> {EMPRESA.telefono}
          </Text>
          <Text style={estilos.textoContacto}>
            <Text style={{ fontWeight: "bold" }}>DIRECCIÓN:</Text> {EMPRESA.direccion.toUpperCase()}
          </Text>
          <Text style={estilos.textoContacto}>{EMPRESA.ciudad.toUpperCase()}</Text>
        </View>
      </View>

      <View style={estilos.bandaSeccion}>
        <Text style={estilos.bandaSeccionTexto}>DATOS DEL CLIENTE</Text>
      </View>
      <View style={estilos.filaCliente}>
        <Text style={estilos.filaClienteEtiqueta}>NOMBRE</Text>
        <Text style={estilos.filaClienteValor}>{cliente.nombre || ""}</Text>
      </View>
      <View style={estilos.filaCliente}>
        <Text style={estilos.filaClienteEtiqueta}>DIRECCIÓN</Text>
        <Text style={estilos.filaClienteValor}>{cliente.direccion || ""}</Text>
      </View>
      <View style={estilos.filaCliente}>
        <Text style={estilos.filaClienteEtiqueta}>CONTACTO</Text>
        <Text style={estilos.filaClienteValor}>
          {cliente.telefono || cliente.nif || ""}
        </Text>
      </View>

      <View style={estilos.filaDescripcion}>
        <Text style={estilos.filaDescripcionEtiqueta}>DESCRIPCIÓN DEL TRABAJO</Text>
        <Text style={estilos.filaDescripcionValor}>{descripcionTrabajo?.trim() || ""}</Text>
      </View>
    </View>
  );
}

/** Tabla de partidas: ITEM | DESCRIPCIÓN | UD. | CANTIDAD | PRECIO UNIT. | IMPORTE */
function TablaPartidas({ items }: { items: ItemLinea[] }) {
  return (
    <View>
      <View style={estilos.cabeceraTabla}>
        <Text style={[estilos.textoCabecera, estilos.celdaCabecera, { width: COL_ITEM }]}>
          ITEM
        </Text>
        <Text style={[estilos.textoCabecera, estilos.celdaCabecera, { flex: 1 }]}>
          DESCRIPCIÓN
        </Text>
        <Text style={[estilos.textoCabecera, estilos.celdaCabecera, { width: COL_UD }]}>UD.</Text>
        <Text style={[estilos.textoCabecera, estilos.celdaCabecera, { width: COL_CANTIDAD }]}>
          CANTIDAD
        </Text>
        <Text style={[estilos.textoCabecera, estilos.celdaCabecera, { width: COL_PRECIO }]}>
          PRECIO UNIT.
        </Text>
        <Text
          style={[
            estilos.textoCabecera,
            estilos.celdaCabecera,
            { width: COL_IMPORTE, borderRightWidth: 0 },
          ]}
        >
          IMPORTE
        </Text>
      </View>

      {items.map((item, indice) => (
        <View key={item.id} style={estilos.filaPartida}>
          <Text style={[estilos.celdaPartida, estilos.colItem]}>
            {((indice + 1) / 10).toFixed(1)}
          </Text>
          <Text style={[estilos.celdaPartida, estilos.colDescripcion]}>
            {item.descripcion || ""}
          </Text>
          <Text style={[estilos.celdaPartida, estilos.colUd]}>{item.ud || "ud"}</Text>
          <Text style={[estilos.celdaPartida, estilos.colCantidad]}>{item.cantidad}</Text>
          <Text style={[estilos.celdaPartida, estilos.colPrecio]}>
            {formatearEuros(item.precioUnitario)}
          </Text>
          <Text style={[estilos.celdaPartida, estilos.colImporte]}>
            {formatearEuros(item.cantidad * item.precioUnitario)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Base imponible, IVA (una fila por tipo) y total, en una caja cerrada */
function Totales({
  subtotal,
  total,
  desglose,
}: {
  subtotal: number;
  total: number;
  desglose: Array<{ iva: number; importe: number }>;
}) {
  const filas: Array<{ etiqueta: string; valor: number; oro?: boolean }> = [
    { etiqueta: "BASE IMPONIBLE", valor: subtotal },
    ...desglose.map((entrada) => ({
      etiqueta: `IVA (${entrada.iva}%)`,
      valor: entrada.importe,
    })),
    { etiqueta: "TOTAL PRESUPUESTO", valor: total, oro: true },
  ];

  return (
    <View style={estilos.zonaTotales}>
      <View style={estilos.tablaTotales}>
        {filas.map((fila, indice) => (
          <View
            key={fila.etiqueta}
            style={[
              estilos.filaTotal,
              indice === 0 ? estilos.filaTotalInicial : undefined,
              indice < filas.length - 1 ? estilos.filaTotalSeparadora : undefined,
            ]}
          >
            <Text
              style={[estilos.totalEtiqueta, fila.oro ? estilos.totalEtiquetaOro : undefined]}
            >
              {fila.etiqueta}
            </Text>
            <Text style={estilos.totalValor}>{formatearEuros(fila.valor)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** "CONDICIONES DEL PRESUPUESTO": celda dorada + ítems numerados a dos columnas */
function Condiciones({ condiciones }: { condiciones: string }) {
  const parrafos = condiciones.split("\n").map((p) => p.trim()).filter(Boolean);
  const numerados = parrafos.map((parrafo, indice) => ({ parrafo, indice }));
  const [columnaIzquierda, columnaDerecha] = repartirEnDosColumnas(
    numerados,
    ({ parrafo }) => estimarAltoItemCondicion(parrafo, ANCHO_CONDICION_IZQUIERDA),
    ALTO_MAXIMO_COLUMNA_CONDICIONES
  );

  const renderCondicion = ({
    parrafo,
    indice,
  }: {
    parrafo: string;
    indice: number;
  }) => {
    const { titulo, cuerpo } = partirTituloCondicion(parrafo);
    return (
      <View key={parrafo} style={estilos.condicionItem}>
        <View style={estilos.condicionNumero}>
          <Text style={estilos.condicionNumeroTexto}>{indice + 1}</Text>
        </View>
        <View style={estilos.condicionCuerpo}>
          {!!titulo && <Text style={estilos.condicionTitulo}>{titulo}</Text>}
          <Text style={estilos.condicionParrafo}>{cuerpo}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={estilos.condiciones}>
      <View style={estilos.condicionesEtiqueta}>
        <Text style={estilos.condicionesEtiquetaTexto}>CONDICIONES DEL PRESUPUESTO</Text>
      </View>
      <View style={estilos.condicionesCuerpo}>
        <View style={estilos.condicionesColumnaIzquierda}>
          {columnaIzquierda.map(renderCondicion)}
        </View>
        <View style={estilos.condicionesColumnaDerecha}>
          {columnaDerecha.map(renderCondicion)}
        </View>
      </View>
    </View>
  );
}

/** Descripción de un tramo de pago con el porcentaje en negrita */
function TextoPago({ texto, porcentaje }: { texto: string; porcentaje: number }) {
  const marca = `${porcentaje}%`;
  const posicion = texto.indexOf(marca);
  if (posicion < 0) {
    return <Text style={estilos.textoPago}>{texto}</Text>;
  }
  return (
    <Text style={estilos.textoPago}>
      {texto.slice(0, posicion)}
      <Text style={estilos.textoPorcentaje}>{marca}</Text>
      {texto.slice(posicion + marca.length)}
    </Text>
  );
}

interface BloquePagoProps {
  formasPago: FormaPago[];
  total: number;
}

/** Forma de pago: columnas descriptivas + tabla de conceptos + banda final */
function BloquePago({ formasPago, total }: BloquePagoProps) {
  const formas = formasPago.filter((f) => f.concepto.trim() && f.porcentaje > 0);
  const suma = formas.reduce((acc, f) => acc + f.porcentaje, 0);

  return (
    <View wrap={false} style={estilos.bloquePago}>
      <Text style={estilos.tituloPago}>FORMA DE PAGO</Text>
      <Text style={estilos.subtituloPago}>DESGLOCE Y CONDICIONES</Text>
      <Text style={estilos.lineaPago}>
        Los pagos se efectuarán mediante transferencia bancaria u otro medio previamente acordado.
      </Text>
      <Text style={estilos.lineaPago}>
        El importe total del presupuesto se abonará según el siguiente calendario de pagos.
      </Text>

      {/* Columnas descriptivas, una por tramo */}
      <View style={estilos.cabeceraPago}>
        {formas.map((forma) => (
          <View key={forma.id} style={estilos.celdaCabeceraPago}>
            <Text style={estilos.textoCabeceraPago}>{forma.concepto}</Text>
          </View>
        ))}
      </View>
      <View style={estilos.filaPago}>
        {formas.map((forma) => (
          <View key={forma.id} style={estilos.celdaPago}>
            <TextoPago
              porcentaje={forma.porcentaje}
              texto={
                forma.descripcion?.trim() ||
                `Se abonará el ${forma.porcentaje}% del importe total del presupuesto, IVA incluido.`
              }
            />
          </View>
        ))}
      </View>

      {/* Tabla de conceptos e importes */}
      <View style={estilos.cabeceraConceptos}>
        <Text
          style={[
            estilos.textoCabeceraPago,
            estilos.celdaCabeceraConceptos,
            estilos.colConcepto,
            { alignItems: "flex-start", paddingLeft: 4 },
          ]}
        >
          CONCEPTO
        </Text>
        <Text
          style={[
            estilos.textoCabeceraPago,
            estilos.celdaCabeceraConceptos,
            estilos.colPorcentaje,
          ]}
        >
          PORCENTAJE
        </Text>
        <Text
          style={[
            estilos.textoCabeceraPago,
            estilos.celdaCabeceraConceptos,
            estilos.colImportePago,
          ]}
        >
          IMPORTE IVA INCLUIDO
        </Text>
      </View>
      {formas.map((forma) => (
        <View key={forma.id} style={estilos.filaConceptos}>
          <Text style={[estilos.celdaConceptos, estilos.colConcepto, estilos.conceptoNegrita]}>
            {forma.concepto}
          </Text>
          <Text style={[estilos.celdaConceptos, estilos.colPorcentaje]}>
            {forma.porcentaje}%
          </Text>
          <Text style={[estilos.celdaConceptos, estilos.colImportePago]}>
            {formatearEuros(importeFormaPago(total, forma.porcentaje))}
          </Text>
        </View>
      ))}
      <View style={estilos.filaConceptos}>
        <Text style={[estilos.celdaConceptos, estilos.colConcepto, estilos.conceptoNegrita]}>
          TOTAL PRESUPUESTO
        </Text>
        <Text style={[estilos.celdaConceptos, estilos.colPorcentaje]}>{suma}%</Text>
        <Text style={[estilos.celdaConceptos, estilos.colImportePago]}>
          {formatearEuros(total)}
        </Text>
      </View>
    </View>
  );
}

export default function DocumentoPDF({
  tipoDoc,
  numeroDoc,
  fecha,
  cliente,
  descripcionTrabajo,
  condiciones = "",
  items,
  formasPago = [],
}: DocumentoPDFProps) {
  // Los mismos cálculos que el formulario y el backend
  const { subtotal, total } = calcularTotales(items);
  const desglose = desgloseIva(items);

  const formasValidas = formasPago.filter((f) => f.concepto.trim() && f.porcentaje > 0);
  const tieneBloquePago = formasValidas.length > 0;

  // ¿Cabe todo en una sola página? Si no, la forma de pago va a la página 2
  const altoPartidas = items.reduce(
    (acc, item) => acc + estimarAltoFilaPartida(item.descripcion),
    0
  );
  const altoCondiciones = estimarAltoCondiciones(condiciones);
  const altoBloquePago =
    34 + // título + subtítulo
    28 + // dos líneas introductorias
    estimarAltoBloquePago(
      formasValidas.map(
        (f) =>
          f.descripcion?.trim() ||
          `Se abonará el ${f.porcentaje}% del importe total del presupuesto, IVA incluido.`
      ),
      formasValidas.length
    ) +
    62; // banda de agradecimiento

  const unaSoloPagina = cabeEnUnaPagina({
    altoFijoCabecera: ALTO_FIJO_CABECERA,
    altoPartidas,
    altoCondiciones,
    altoBloquePago,
    tieneBloquePago,
  });

  const cabeceraDocumento = (
    <CabeceraDocumento
      tipoDoc={tipoDoc}
      numeroDoc={numeroDoc}
      fecha={fecha}
      cliente={cliente}
      descripcionTrabajo={descripcionTrabajo}
    />
  );

  return (
    <Document>
      {/* Página 1: presupuesto completo */}
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.marco}>
          <Cabecera />
          {cabeceraDocumento}
          <TablaPartidas items={items} />
          <View style={{ flexGrow: 1 }} />
          <Totales subtotal={subtotal} total={total} desglose={desglose} />
          <Condiciones condiciones={condiciones} />
          {unaSoloPagina && tieneBloquePago && (
            <>
              <BloquePago formasPago={formasValidas} total={total} />
              <View style={estilos.bandaGracias}>
                <Text style={estilos.textoGracias}>¡GRACIAS POR CONFIAR EN NOSOTROS!</Text>
              </View>
            </>
          )}
        </View>
      </Page>

      {/* Página 2 (solo si la forma de pago no cabe en la primera) */}
      {!unaSoloPagina && tieneBloquePago && (
        <Page size="A4" style={estilos.pagina}>
          <View style={estilos.marco}>
            <Cabecera />
            {cabeceraDocumento}
            <BloquePago formasPago={formasValidas} total={total} />
            <View style={estilos.bandaGracias}>
              <Text style={estilos.textoGracias}>¡GRACIAS POR CONFIAR EN NOSOTROS!</Text>
            </View>
          </View>
        </Page>
      )}
    </Document>
  );
}
