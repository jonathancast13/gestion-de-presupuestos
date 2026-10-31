// Lógica de la plantilla PDF del cliente: formato de fechas, importes del
// calendario de pagos y estimación de alturas para decidir si el documento
// cabe en una sola página. Son funciones puras para poder testearlas.

const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/** Fecha ISO (AAAA-MM-DD) en el formato de la plantilla: 26-oct-26 */
export function formatoFechaCorta(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!partes) return iso;
  const [, anio, mes, dia] = partes;
  const indice = Number(mes) - 1;
  if (indice < 0 || indice > 11) return iso;
  return `${Number(dia)}-${MESES_CORTOS[indice]}-${anio.slice(2)}`;
}

/** Importe de un tramo del calendario de pagos (sobre el total con IVA) */
export function importeFormaPago(total: number, porcentaje: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(porcentaje)) return 0;
  return Math.round(((total * porcentaje) / 100 + Number.EPSILON) * 100) / 100;
}

/** Suma de porcentajes del calendario de pagos (con tolerancia a decimales) */
export function sumaPorcentajes(porcentajes: number[]): number {
  return porcentajes.reduce((acc, valor) => acc + (Number.isFinite(valor) ? valor : 0), 0);
}

export function cuadra100(porcentajes: number[]): boolean {
  if (porcentajes.length === 0) return true;
  return Math.abs(sumaPorcentajes(porcentajes) - 100) <= 0.01;
}

// --- Estimación de alturas (pt) -------------------------------------------
// Aproximación de ancho de carácter para las fuentes de la plantilla:
// Archivo (cuerpo ~0.50) y Gelasio (serif ~0.52). Se usa un margen holgado
// para que la decisión de "una sola página" sea conservadora.

function lineasDeTexto(texto: string, anchoDisponible: number, anchoCaracter: number): number {
  const limpio = texto.trim();
  if (!limpio) return 1;
  const porLinea = Math.max(8, Math.floor(anchoDisponible / anchoCaracter));
  return Math.ceil(limpio.length / porLinea);
}

/** Alto estimado de una fila de la tabla de partidas */
export function estimarAltoFilaPartida(descripcion: string, anchoColumna = 253): number {
  const lineas = lineasDeTexto(descripcion, anchoColumna, 4.6);
  return Math.max(16, lineas * 11.2 + 5);
}

/** Alto estimado del bloque de condiciones a dos columnas */
export function estimarAltoCondiciones(condiciones: string, anchoColumna = 220): number {
  const parrafos = condiciones.split("\n").map((p) => p.trim()).filter(Boolean);
  if (parrafos.length === 0) return 60;
  let lineas = 0;
  // Reparto alterno en dos columnas: la altura es la de la más cargada
  const columnas = [[], []] as string[][];
  parrafos.forEach((parrafo, i) => columnas[i % 2].push(parrafo));
  for (const columna of columnas) {
    lineas = Math.max(
      lineas,
      columna.reduce((acc, parrafo) => acc + lineasDeTexto(parrafo, anchoColumna, 4.2), 0)
    );
  }
  return Math.max(60, lineas * 11 + 14);
}

/**
 * Alto estimado del bloque de forma de pago (columnas + tabla de conceptos +
 * banda de agradecimiento), sin contar el título ni los párrafos introductorios.
 */
export function estimarAltoBloquePago(
  descripciones: string[],
  numeroConceptos: number,
  anchoColumna = 181
): number {
  let altoTexto = 0;
  for (const texto of descripciones) {
    const lineas = lineasDeTexto(texto, anchoColumna, 4.6);
    altoTexto = Math.max(altoTexto, lineas * 11.5 + 10);
  }
  const cabeceraColumnas = 16;
  const tablaConceptos = 17 * (numeroConceptos + 2); // cabecera + filas + total
  return cabeceraColumnas + Math.max(60, altoTexto) + tablaConceptos;
}

/**
 * ¿Cabe el documento en una sola página?
 *
 * Suma las alturas estimadas de cabecera, cliente, partidas, totales,
 * condiciones y bloque de pago y las compara con el alto disponible dentro
 * del marco. Un colchón de holgura evita decidir "una página" cuando el
 * contenido real desbordaría.
 */
export function cabeEnUnaPagina(parametros: {
  altoFijoCabecera: number;
  altoPartidas: number;
  altoCondiciones: number;
  altoBloquePago: number;
  tieneBloquePago: boolean;
}): boolean {
  const { altoFijoCabecera, altoPartidas, altoCondiciones, altoBloquePago, tieneBloquePago } =
    parametros;
  // A4 (841.28) - márgenes superior e inferior - borde del marco
  const ALTO_DISPONIBLE = 841.28 - 54 - 56 - 3;
  const MARGEN_SEGURIDAD = 14;
  const altoTotales = 12 + 3 * 17;
  const alto =
    altoFijoCabecera +
    altoPartidas +
    altoTotales +
    altoCondiciones +
    (tieneBloquePago ? altoBloquePago : 0);
  return alto + MARGEN_SEGURIDAD <= ALTO_DISPONIBLE;
}

/** Reparte párrafos en dos columnas (alterno), como las condiciones del PDF */
export function repartirEnDosColumnas<T>(elementos: T[]): [T[], T[]] {
  const primera: T[] = [];
  const segunda: T[] = [];
  elementos.forEach((elemento, i) => (i % 2 === 0 ? primera : segunda).push(elemento));
  return [primera, segunda];
}
