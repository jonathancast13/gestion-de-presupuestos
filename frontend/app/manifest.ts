import type { MetadataRoute } from "next";
import { EMPRESA } from "@/lib/empresa";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${EMPRESA.nombre} | Presupuestos y facturas`,
    short_name: "Panel Reformas",
    description: "Genera presupuestos y facturas de reformas en segundos",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: EMPRESA.colorOscuro,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
