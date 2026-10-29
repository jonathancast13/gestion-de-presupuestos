// Cálculos de dinero compartidos por formulario, historial y PDF.
// El backend redondea igual (2 decimales por línea, half up), así que los
// totales que se muestran coinciden con los que se guardan.

interface LineaCalculo {
  cantidad: number;
  precioUnitario: number;
  iva: number;
}

export function redondearDinero(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function subtotalDeLinea(linea: LineaCalculo): number {
  return redondearDinero(linea.cantidad * linea.precioUnitario);
}

export function ivaDeLinea(linea: LineaCalculo): number {
  return redondearDinero((subtotalDeLinea(linea) * linea.iva) / 100);
}

export function calcularTotales(items: LineaCalculo[]) {
  const subtotal = redondearDinero(items.reduce((acc, item) => acc + subtotalDeLinea(item), 0));
  const totalIva = redondearDinero(items.reduce((acc, item) => acc + ivaDeLinea(item), 0));
  return { subtotal, totalIva, total: redondearDinero(subtotal + totalIva) };
}

// Desglose del IVA agrupado por tipo, ordenado de mayor a menor
// ej: [{ iva: 21, importe: 31.5 }, { iva: 10, importe: 4 }]
export function desgloseIva(items: LineaCalculo[]): Array<{ iva: number; importe: number }> {
  const importes = new Map<number, number>();
  for (const item of items) {
    importes.set(item.iva, redondearDinero((importes.get(item.iva) ?? 0) + ivaDeLinea(item)));
  }
  return [...importes.entries()]
    .map(([iva, importe]) => ({ iva, importe }))
    .sort((a, b) => b.iva - a.iva);
}

const formatoEuros = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatearEuros(valor: number): string {
  return formatoEuros.format(valor);
}
