"use client";

import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import DocumentoPDF from "./DocumentoPDF";
import type { ClienteData, FormaPago, ItemLinea, TipoDocumento } from "@/types";

interface Props {
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  fecha: string;
  cliente: ClienteData;
  descripcionTrabajo?: string;
  condiciones?: string;
  items: ItemLinea[];
  formasPago?: FormaPago[];
}

// Importación dinámica exclusiva para el cliente (desactiva SSR)
const PDFDownloadLinkDynamic = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

export default function DescargaPDFButton(props: Props) {
  return (
    <PDFDownloadLinkDynamic
      document={<DocumentoPDF {...props} />}
      fileName={`${props.tipoDoc}-${props.numeroDoc || "documento"}.pdf`}
      className="boton boton-carbon w-full cursor-pointer sm:w-auto"
    >
      {({ loading }) =>
        loading ? (
          "Preparando PDF..."
        ) : (
          <>
            <Download size={18} /> Descargar PDF
          </>
        )
      }
    </PDFDownloadLinkDynamic>
  );
}
