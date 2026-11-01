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

/** Alto estimado de una fila de la tabla de partidas (columna DESCRIPCIÓN ~213) */
export function estimarAltoFilaPartida(descripcion: string, anchoColumna = 213): number {
  const lineas = lineasDeTexto(descripcion, anchoColumna, 4.3);
  return Math.max(27, lineas * 13.5 + 6);
}

/**
 * Separa un párrafo de condiciones en título (hasta los dos puntos, como en la
 * plantilla) y cuerpo del texto.
 */
export function partirTituloCondicion(parrafo: string): { titulo: string; cuerpo: string } {
  const limpio = parrafo.trim();
  const separador = limpio.indexOf(":");
  if (separador > 0 && separador < 30) {
    return { titulo: limpio.slice(0, separador + 1), cuerpo: limpio.slice(separador + 1).trim() };
  }
  return { titulo: "", cuerpo: limpio };
}

/** Alto estimado de un ítem numerado del bloque de condiciones */
export function estimarAltoItemCondicion(parrafo: string, anchoColumna = 166): number {
  const { titulo, cuerpo } = partirTituloCondicion(parrafo);
  const lineas =
    lineasDeTexto(titulo, anchoColumna, 4.4) + lineasDeTexto(cuerpo, anchoColumna, 4.2);
  return lineas * 11.5 + 2.5;
}

/**
 * Reparte párrafos en dos columnas contiguas, como en la plantilla: se llena
 * la columna izquierda hasta el tope indicado y el resto pasa a la derecha.
 */
export function repartirEnDosColumnas<T>(
  elementos: T[],
  altoDe: (elemento: T) => number,
  altoMaximoColumna: number
): [T[], T[]] {
  const primera: T[] = [];
  const segunda: T[] = [];
  let altoPrimera = 0;
  for (const elemento of elementos) {
    const alto = altoDe(elemento);
    if (primera.length === 0 || altoPrimera + alto <= altoMaximoColumna) {
      primera.push(elemento);
      altoPrimera += alto;
    } else {
      segunda.push(elemento);
    }
  }
  return [primera, segunda];
}

/** Alto estimado del bloque de condiciones (la columna más cargada) */
export function estimarAltoCondiciones(
  condiciones: string,
  anchoIzquierda = 219,
  anchoDerecha = 166
): number {
  const parrafos = condiciones.split("\n").map((p) => p.trim()).filter(Boolean);
  if (parrafos.length === 0) return 60;
  const altoIzquierda = (parrafo: string) => estimarAltoItemCondicion(parrafo, anchoIzquierda);
  const altoDerecha = (parrafo: string) => estimarAltoItemCondicion(parrafo, anchoDerecha);
  // La columna izquierda es más ancha, así que sus ítems son más bajos
  const [izquierda, derecha] = repartirEnDosColumnas(parrafos, altoIzquierda, 88);
  const suma = (columna: string[], altoDe: (p: string) => number) =>
    columna.reduce((acc, parrafo) => acc + altoDe(parrafo), 0);
  return Math.max(
    60,
    Math.max(suma(izquierda, altoIzquierda), suma(derecha, altoDerecha)) + 10
  );
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
  // Colchón para los bordes acumulados y las aproximaciones de alturas
  const MARGEN_SEGURIDAD = 20;
  const altoTotales = 8 + 3 * 15.5 + 4.5; // separación + 3 filas + bordes
  const alto =
    altoFijoCabecera +
    altoPartidas +
    altoTotales +
    altoCondiciones +
    (tieneBloquePago ? altoBloquePago : 0);
  return alto + MARGEN_SEGURIDAD <= ALTO_DISPONIBLE;
}
