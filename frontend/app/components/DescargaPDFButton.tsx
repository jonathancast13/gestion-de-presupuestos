"use client";

import dynamic from "next/dynamic";
import { Download } from "lucide-react";
import DocumentoPDF from "./DocumentoPDF";
import type { ClienteData, ItemLinea, TipoDocumento } from "@/types";

interface Props {
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  fecha: string;
  cliente: ClienteData;
  descripcionTrabajo?: string;
  items: ItemLinea[];
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
      className="flex items-center justify-center gap-2 min-h-11 w-full sm:w-auto bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer"
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
