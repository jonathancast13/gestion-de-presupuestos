import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { calcularTotales, desgloseIva, formatearEuros, subtotalDeLinea } from "@/lib/dinero";
import type { ClienteData, ItemLinea, TipoDocumento } from "@/types";

// Datos de la empresa, configurables en .env.local (ver .env.example)
const EMPRESA = {
  nombre: process.env.NEXT_PUBLIC_COMPANY_NAME || "Tu Empresa de Reformas",
  nif: process.env.NEXT_PUBLIC_COMPANY_NIF || "B-12345678",
  telefono: process.env.NEXT_PUBLIC_COMPANY_PHONE || "+34 600 000 000",
  direccion: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "",
};

// Estilos profesionales para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333333",
    position: "relative",
  },
  // Marca de agua corporativa de fondo
  watermarkContainer: {
    position: "absolute",
    top: "40%",
    left: "25%",
    transform: "translate(-50%, -50%) rotate(-30deg)",
    opacity: 0.06,
    zIndex: -1,
  },
  watermarkText: {
    fontSize: 70,
    fontWeight: "bold",
    color: "#2563eb",
    letterSpacing: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  companyInfo: {
    flexDirection: "column",
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  docTitleBlock: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2563eb",
    textTransform: "uppercase",
  },
  docDetails: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
  },
  sectionBox: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 2,
  },
  table: {
    width: "100%",
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    color: "#ffffff",
    padding: 6,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    padding: 6,
    alignItems: "center",
  },
  colDesc: { width: "45%" },
  colCant: { width: "12%", textAlign: "center" },
  colPrice: { width: "18%", textAlign: "right" },
  colIva: { width: "10%", textAlign: "center" },
  colTotal: { width: "15%", textAlign: "right" },
  totalsSection: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    paddingVertical: 3,
  },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    marginTop: 4,
    fontWeight: "bold",
    fontSize: 12,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
});

interface DocumentoPDFProps {
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  fecha: string;
  cliente: ClienteData;
  items: ItemLinea[];
}

export default function DocumentoPDF({ tipoDoc, numeroDoc, fecha, cliente, items }: DocumentoPDFProps) {
  // Los mismos cálculos que el formulario y el backend
  const { subtotal, total, totalIva } = calcularTotales(items);
  const desglose = desgloseIva(items);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Marca de agua de fondo */}
        <View style={styles.watermarkContainer}>
          <Text style={styles.watermarkText}>REFORMAS</Text>
        </View>

        {/* Cabecera */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{EMPRESA.nombre}</Text>
            <Text style={styles.docDetails}>NIF: {EMPRESA.nif}</Text>
            <Text style={styles.docDetails}>Teléfono: {EMPRESA.telefono}</Text>
            {EMPRESA.direccion && <Text style={styles.docDetails}>{EMPRESA.direccion}</Text>}
          </View>
          <View style={styles.docTitleBlock}>
            <Text style={styles.docTitle}>{tipoDoc}</Text>
            <Text style={styles.docDetails}>Nº: {numeroDoc || "—"}</Text>
            <Text style={styles.docDetails}>Fecha: {fecha || "—"}</Text>
          </View>
        </View>

        {/* Datos del Cliente */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>DATOS DEL CLIENTE</Text>
          <Text style={{ marginTop: 2 }}>
            <Text style={{ fontWeight: "bold" }}>Nombre:</Text> {cliente.nombre || "---"}
          </Text>
          <Text style={{ marginTop: 2 }}>
            <Text style={{ fontWeight: "bold" }}>NIF/CIF:</Text> {cliente.nif || "---"}
          </Text>
          <Text style={{ marginTop: 2 }}>
            <Text style={{ fontWeight: "bold" }}>Teléfono:</Text> {cliente.telefono || "---"}
          </Text>
          <Text style={{ marginTop: 2 }}>
            <Text style={{ fontWeight: "bold" }}>Dirección:</Text> {cliente.direccion || "---"}
          </Text>
        </View>

        {/* Tabla de Partidas */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Descripción</Text>
            <Text style={styles.colCant}>Cant.</Text>
            <Text style={styles.colPrice}>Precio</Text>
            <Text style={styles.colIva}>IVA</Text>
            <Text style={styles.colTotal}>Subtotal</Text>
          </View>

          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.descripcion || "Partida sin descripción"}</Text>
              <Text style={styles.colCant}>{item.cantidad}</Text>
              <Text style={styles.colPrice}>{formatearEuros(item.precioUnitario)}</Text>
              <Text style={styles.colIva}>{item.iva}%</Text>
              <Text style={styles.colTotal}>{formatearEuros(subtotalDeLinea(item))}</Text>
            </View>
          ))}
        </View>

        {/* Totales, con el IVA desglosado por tipo */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text>Base Imponible:</Text>
            <Text>{formatearEuros(subtotal)}</Text>
          </View>
          {desglose.map((entrada) => (
            <View key={entrada.iva} style={styles.totalRow}>
              <Text>IVA {entrada.iva}%:</Text>
              <Text>{formatearEuros(entrada.importe)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text>Total IVA:</Text>
            <Text>{formatearEuros(totalIva)}</Text>
          </View>
          <View style={styles.totalFinalRow}>
            <Text>TOTAL:</Text>
            <Text>{formatearEuros(total)}</Text>
          </View>
        </View>

        {/* Pie de página */}
        <View style={styles.footer}>
          <Text>Documento generado digitalmente. Gracias por confiar en nuestros servicios de reforma.</Text>
        </View>
      </Page>
    </Document>
  );
}
