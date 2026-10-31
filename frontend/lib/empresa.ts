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
  ciudad: "Catarroja",

  // Paleta corporativa derivada del logo (oro sobre carbón)
  colorPrimario: "#D9963A",
  colorOscuro: "#0F1113",

  /** Logo (imagen estática de Next, para <Image src={...}>) */
  logo: logoAsset,
  /** Ruta del logo ("/_next/static/media/...png") — para @react-pdf/renderer */
  logoRuta: logoAsset.src,
} as const;

/** Oro exacto de la plantilla PDF del cliente (#B99D4F) */
export const ORO_PLANTILLA = "#B99D4F";

/**
 * Texto por defecto de "CONDICIONES DEL PRESUPUESTO" del PDF.
 * Se precarga en el formulario y cada documento puede editarlo.
 */
export const CONDICIONES_POR_DEFECTO = [
  "Validez: 30 días naturales desde su emisión.",
  "Alcance: Incluye solo lo descrito en el presupuesto.",
  "Imprevistos: Los trabajos no previstos se valorarán aparte y requerirán aceptación previa.",
  "Plazos y modificaciones: Los plazos podrán ajustarse por imprevistos, suministros o cambios solicitados por el cliente previa comunicación.",
].join("\n");

/**
 * Calendario de pagos por defecto (50/25/25), tal y como aparece en la
 * plantilla. Es editable en el formulario.
 */
export const FORMAS_PAGO_POR_DEFECTO = [
  {
    concepto: "ACEPTACIÓN DE OBRA",
    porcentaje: 50,
    descripcion:
      "Se abonará el 50% del importe total del presupuesto, IVA incluido, en el momento de su aceptación. Este pago permite formalizar el encargo, reservar las fechas de inicio de obra y gestionar la compra inicial de materiales necesarios para la ejecución.",
  },
  {
    concepto: "AVANCE DE OBRA",
    porcentaje: 25,
    descripcion:
      "Se abonará el 25% del importe total del presupuesto correspondiente al avance de los trabajos.",
  },
  {
    concepto: "FINALIZACIÓN DE OBRA",
    porcentaje: 25,
    descripcion:
      "El 25% restante se abonará una vez finalizados los trabajos incluidos en el presupuesto y realizada la revisión conjunta de los acabados con el cliente.",
  },
] as const;
