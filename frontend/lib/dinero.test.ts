import { describe, expect, it } from "vitest";
import {
  calcularTotales,
  desgloseIva,
  formatearEuros,
  ivaDeLinea,
  redondearDinero,
  subtotalDeLinea,
} from "@/lib/dinero";

describe("redondearDinero", () => {
  it("redondea a 2 decimales", () => {
    expect(redondearDinero(10.005)).toBe(10.01);
    expect(redondearDinero(10.004)).toBe(10);
  });

  it("devuelve 0 ante valores no finitos", () => {
    expect(redondearDinero(Number.NaN)).toBe(0);
    expect(redondearDinero(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("subtotalDeLinea / ivaDeLinea", () => {
  it("calcula el subtotal de una línea", () => {
    expect(subtotalDeLinea({ cantidad: 3, precioUnitario: 33.33, iva: 21 })).toBe(99.99);
  });

  it("calcula el IVA sobre el subtotal redondeado", () => {
    // 100.00 * 21% = 21 (mismo criterio que el backend)
    expect(ivaDeLinea({ cantidad: 1, precioUnitario: 100, iva: 21 })).toBe(21);
    // 33.33 * 3 = 99.99 -> 21% = 20.9979 -> 21.00
    expect(ivaDeLinea({ cantidad: 3, precioUnitario: 33.33, iva: 21 })).toBe(21);
  });

  it("soporta IVA 0", () => {
    expect(ivaDeLinea({ cantidad: 2, precioUnitario: 50, iva: 0 })).toBe(0);
  });
});

describe("calcularTotales", () => {
  it("suma varias líneas con IVAs distintos", () => {
    const totales = calcularTotales([
      { cantidad: 1, precioUnitario: 100, iva: 21 }, // 100 + 21
      { cantidad: 2, precioUnitario: 50, iva: 10 }, // 100 + 10
    ]);
    expect(totales.subtotal).toBe(200);
    expect(totales.totalIva).toBe(31);
    expect(totales.total).toBe(231);
  });

  it("devuelve todo en 0 con la lista vacía", () => {
    expect(calcularTotales([])).toEqual({ subtotal: 0, totalIva: 0, total: 0 });
  });

  it("coincide con el total de un presupuesto de ejemplo", () => {
    // Caso real: demolición 1x100 (21%) + pintura 2x150,50 (10%)
    const totales = calcularTotales([
      { cantidad: 1, precioUnitario: 100, iva: 21 },
      { cantidad: 2, precioUnitario: 150.5, iva: 10 },
    ]);
    expect(totales.subtotal).toBe(401);
    expect(totales.totalIva).toBe(51.1); // 21 + 30.10
    expect(totales.total).toBe(452.1);
  });
});

describe("desgloseIva", () => {
  it("agrupa por tipo y ordena de mayor a menor", () => {
    const desglose = desgloseIva([
      { cantidad: 1, precioUnitario: 100, iva: 10 },
      { cantidad: 1, precioUnitario: 100, iva: 21 },
      { cantidad: 1, precioUnitario: 100, iva: 10 },
    ]);
    expect(desglose).toEqual([
      { iva: 21, importe: 21 },
      { iva: 10, importe: 20 },
    ]);
  });

  it("devuelve una lista vacía sin líneas", () => {
    expect(desgloseIva([])).toEqual([]);
  });
});

describe("formatearEuros", () => {
  it("formatea en euros con 2 decimales", () => {
    const texto = formatearEuros(1234.5);
    expect(texto).toContain("1");
    expect(texto).toContain("234");
    expect(texto).toMatch(/,\d{2}/); // coma decimal española
  });
});
