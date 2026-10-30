import logoAsset from "@/assets/logo-empresa-transparente.png";

/**
 * Datos de la empresa (fuente única): PDF, login y PWA.
 *
 * El logo es el PNG con fondo transparente generado por
 * `scripts/preparar_logo.py` a partir del original.
 */
export const EMPRESA = {
  nombre: "Oswaldo Ariza CONTRATISTA",
  // TODO: rellenar cuando se obtenga el NIF. Si está vacío, el PDF omite la línea.
  nif: "",
  telefono: "632606190",
  direccion: "Calle Musico Gimeno Puchal 11 bajo",

  // Paleta corporativa derivada del logo (oro sobre carbón)
  colorPrimario: "#D9963A",
  colorOscuro: "#0F1113",

  /** Logo (imagen estática de Next, para <Image src={...}>) */
  logo: logoAsset,
  /** Ruta del logo ("/_next/static/media/...png") — para @react-pdf/renderer */
  logoRuta: logoAsset.src,
} as const;
