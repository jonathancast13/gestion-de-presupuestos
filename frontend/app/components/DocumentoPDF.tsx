import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { calcularTotales, desgloseIva, formatearEuros, subtotalDeLinea } from "@/lib/dinero";
import { EMPRESA } from "@/lib/empresa";
import type { ClienteData, ItemLinea, TipoDocumento } from "@/types";

/**
 * El PDF se genera en el navegador, así que la ruta del logo se resuelve
 * contra el origen de la página (en SSR no se usa este componente).
 */
const LOGO_SRC =
  typeof window !== "undefined" ? window.location.origin + EMPRESA.logoRuta : EMPRESA.logoRuta;

// Paleta corporativa derivada del logo (oro sobre carbón)
const COLORES = {
  oro: EMPRESA.colorPrimario, // #D9963A
  oroClaro: "#F0C378",
  carbon: EMPRESA.colorOscuro, // #0F1113
  champán: "#E7DCC9",
  fondoSeccion: "#FAF9F6",
  texto: "#1F2937",
  textoSuave: "#6B7280",
  linea: "#E7E4DE",
  blanco: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 46,
    paddingBottom: 44,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: COLORES.texto,
  },

  // --- Marca de agua: solo el logo, rotado y semitransparente -------------
  marcaAgua: {
    position: "absolute",
    top: "40%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-30deg)",
    opacity: 0.07,
  },
  marcaAguaLogo: { width: 230, height: 338 },

  // --- Banda superior (se repite en todas las páginas) --------------------
  banda: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: 10,
    backgroundColor: COLORES.carbon,
    borderBottomWidth: 2,
    borderBottomColor: COLORES.oro,
  },

  // --- Cabecera -----------------------------------------------------------
  cabecera: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.oro,
  },
  cabeceraIzquierda: { flexDirection: "row", alignItems: "flex-start", paddingRight: 12 },
  logo: { width: 46, height: 68, marginRight: 12 },
  empresaNombre: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORES.carbon,
    marginBottom: 4,
    maxWidth: 260,
  },
  empresaDato: { fontSize: 9, color: COLORES.textoSuave, marginBottom: 1.5 },
  cabeceraDerecha: { alignItems: "flex-end" },
  chip: {
    backgroundColor: COLORES.carbon,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    marginBottom: 6,
  },
  chipTexto: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORES.oroClaro,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  docDato: { fontSize: 9.5, color: COLORES.textoSuave, marginBottom: 2 },

  // --- Sección cliente ----------------------------------------------------
  seccionCliente: { flexDirection: "row", marginBottom: 18 },
  seccionBarra: { width: 4, backgroundColor: COLORES.oro },
  seccionCuerpo: {
    flex: 1,
    backgroundColor: COLORES.fondoSeccion,
    borderWidth: 1,
    borderColor: COLORES.linea,
    borderLeftWidth: 0,
    padding: 10,
  },
  seccionTitulo: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORES.carbon,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.linea,
    paddingBottom: 4,
  },
  filaCliente: { marginBottom: 2 },
  etiqueta: { fontWeight: "bold", color: COLORES.carbon },
  textoDescripcion: { fontSize: 9.5, lineHeight: 1.45, color: COLORES.texto },

  // --- Tabla de partidas --------------------------------------------------
  tabla: { width: "100%", marginBottom: 4 },
  cabeceraTabla: {
    flexDirection: "row",
    backgroundColor: COLORES.carbon,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  textoCabecera: {
    fontSize: 8.5,
    fontWeight: "bold",
    color: COLORES.oroClaro,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  filaTabla: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORES.linea,
    alignItems: "center",
  },
  colDesc: { width: "45%" },
  colCant: { width: "12%", textAlign: "center" },
  colPrice: { width: "18%", textAlign: "right" },
  colIva: { width: "10%", textAlign: "center" },
  colTotal: { width: "15%", textAlign: "right", fontWeight: "bold", color: COLORES.carbon },

  // --- Totales ------------------------------------------------------------
  zonaTotales: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  cajaTotales: {
    width: 230,
    backgroundColor: COLORES.fondoSeccion,
    borderWidth: 1,
    borderColor: COLORES.linea,
    padding: 10,
  },
  filaTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  filaTotalFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORES.carbon,
    borderRadius: 3,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  etiquetaTotal: { fontSize: 11, fontWeight: "bold", color: COLORES.champán },
  importeTotal: { fontSize: 13, fontWeight: "bold", color: COLORES.oro },

  // --- Pie (se repite en todas las páginas) -------------------------------
  pie: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: COLORES.linea,
    paddingTop: 8,
  },
  pieFila: { flexDirection: "row", justifyContent: "space-between" },
  pieTexto: { fontSize: 8, color: COLORES.textoSuave },
  pieNota: { fontSize: 8, color: COLORES.textoSuave, marginTop: 3, textAlign: "center" },
});

interface DocumentoPDFProps {
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  fecha: string;
  cliente: ClienteData;
  descripcionTrabajo?: string;
  items: ItemLinea[];
}

export default function DocumentoPDF({
  tipoDoc,
  numeroDoc,
  fecha,
  cliente,
  descripcionTrabajo,
  items,
}: DocumentoPDFProps) {
  // Los mismos cálculos que el formulario y el backend
  const { subtotal, total, totalIva } = calcularTotales(items);
  const desglose = desgloseIva(items);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Marca de agua (primer hijo: queda detrás de todo el contenido) */}
        <View style={styles.marcaAgua} fixed>
          <Image src={LOGO_SRC} style={styles.marcaAguaLogo} />
        </View>

        {/* Banda superior corporativa */}
        <View style={styles.banda} fixed />

        {/* Cabecera */}
        <View style={styles.cabecera}>
          <View style={styles.cabeceraIzquierda}>
            <Image src={LOGO_SRC} style={styles.logo} />
            <View>
              <Text style={styles.empresaNombre}>{EMPRESA.nombre}</Text>
              {EMPRESA.nif && <Text style={styles.empresaDato}>NIF: {EMPRESA.nif}</Text>}
              <Text style={styles.empresaDato}>Tel: {EMPRESA.telefono}</Text>
              {EMPRESA.direccion && <Text style={styles.empresaDato}>{EMPRESA.direccion}</Text>}
            </View>
          </View>
          <View style={styles.cabeceraDerecha}>
            <View style={styles.chip}>
              <Text style={styles.chipTexto}>{tipoDoc}</Text>
            </View>
            <Text style={styles.docDato}>Nº: {numeroDoc || "—"}</Text>
            <Text style={styles.docDato}>Fecha: {fecha || "—"}</Text>
          </View>
        </View>

        {/* Datos del cliente */}
        <View style={styles.seccionCliente}>
          <View style={styles.seccionBarra} />
          <View style={styles.seccionCuerpo}>
            <Text style={styles.seccionTitulo}>Datos del cliente</Text>
            <Text style={styles.filaCliente}>
              <Text style={styles.etiqueta}>Nombre:</Text> {cliente.nombre || "---"}
            </Text>
            <Text style={styles.filaCliente}>
              <Text style={styles.etiqueta}>NIF/CIF:</Text> {cliente.nif || "---"}
            </Text>
            <Text style={styles.filaCliente}>
              <Text style={styles.etiqueta}>Teléfono:</Text> {cliente.telefono || "---"}
            </Text>
            <Text style={styles.filaCliente}>
              <Text style={styles.etiqueta}>Dirección:</Text> {cliente.direccion || "---"}
            </Text>
          </View>
        </View>

        {/* Descripción del trabajo (opcional): solo si hay texto */}
        {descripcionTrabajo?.trim() && (
          <View style={styles.seccionCliente}>
            <View style={styles.seccionBarra} />
            <View style={styles.seccionCuerpo}>
              <Text style={styles.seccionTitulo}>Descripción del trabajo</Text>
              <Text style={styles.textoDescripcion}>{descripcionTrabajo.trim()}</Text>
            </View>
          </View>
        )}

        {/* Tabla de partidas (las filas continúan en páginas siguientes) */}
        <View style={styles.tabla}>
          <View style={styles.cabeceraTabla}>
            <Text style={[styles.textoCabecera, styles.colDesc]}>Descripción</Text>
            <Text style={[styles.textoCabecera, styles.colCant]}>Cant.</Text>
            <Text style={[styles.textoCabecera, styles.colPrice]}>Precio</Text>
            <Text style={[styles.textoCabecera, styles.colIva]}>IVA</Text>
            <Text style={[styles.textoCabecera, styles.colTotal]}>Subtotal</Text>
          </View>

          {items.map((item, indice) => (
            <View
              key={item.id}
              style={[
                styles.filaTabla,
                indice % 2 === 1 ? { backgroundColor: COLORES.fondoSeccion } : undefined,
              ]}
            >
              <Text style={styles.colDesc}>{item.descripcion || "Partida sin descripción"}</Text>
              <Text style={styles.colCant}>{item.cantidad}</Text>
              <Text style={styles.colPrice}>{formatearEuros(item.precioUnitario)}</Text>
              <Text style={styles.colIva}>{item.iva}%</Text>
              <Text style={styles.colTotal}>{formatearEuros(subtotalDeLinea(item))}</Text>
            </View>
          ))}
        </View>

        {/* Totales, con el IVA desglosado por tipo */}
        <View style={styles.zonaTotales}>
          <View style={styles.cajaTotales}>
            <View style={styles.filaTotal}>
              <Text>Base Imponible:</Text>
              <Text>{formatearEuros(subtotal)}</Text>
            </View>
            {desglose.map((entrada) => (
              <View key={entrada.iva} style={styles.filaTotal}>
                <Text>IVA {entrada.iva}%:</Text>
                <Text>{formatearEuros(entrada.importe)}</Text>
              </View>
            ))}
            <View style={styles.filaTotal}>
              <Text>Total IVA:</Text>
              <Text>{formatearEuros(totalIva)}</Text>
            </View>
            <View style={styles.filaTotalFinal}>
              <Text style={styles.etiquetaTotal}>TOTAL</Text>
              <Text style={styles.importeTotal}>{formatearEuros(total)}</Text>
            </View>
          </View>
        </View>

        {/* Pie con numeración de página */}
        <View style={styles.pie} fixed>
          <View style={styles.pieFila}>
            <Text style={styles.pieTexto}>
              {EMPRESA.nombre} · {EMPRESA.telefono}
            </Text>
            <Text
              style={styles.pieTexto}
              render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
            />
          </View>
          <Text style={styles.pieNota}>
            Documento generado digitalmente. Gracias por confiar en nuestros servicios de reforma.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
