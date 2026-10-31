import { describe, expect, it } from "vitest";
import {
  cabeEnUnaPagina,
  cuadra100,
  estimarAltoBloquePago,
  estimarAltoCondiciones,
  estimarAltoFilaPartida,
  formatoFechaCorta,
  importeFormaPago,
  repartirEnDosColumnas,
  sumaPorcentajes,
} from "./plantilla";

describe("formatoFechaCorta", () => {
  it("convierte ISO al formato de la plantilla (26-oct-26)", () => {
    expect(formatoFechaCorta("2026-10-26")).toBe("26-oct-26");
  });

  it("usa el día sin ceros a la izquierda", () => {
    expect(formatoFechaCorta("2026-05-01")).toBe("1-may-26");
  });

  it("devuelve el texto original si el formato no es ISO", () => {
    expect(formatoFechaCorta("mañana")).toBe("mañana");
    expect(formatoFechaCorta("")).toBe("");
  });
});

describe("importeFormaPago", () => {
  it("calcula el importe sobre el total con IVA (1.210 de 2.420 al 50 %)", () => {
    expect(importeFormaPago(2420, 50)).toBe(1210);
    expect(importeFormaPago(2420, 25)).toBe(605);
  });

  it("redondea a dos decimales", () => {
    expect(importeFormaPago(121.01, 33.33)).toBe(40.33);
  });

  it("tolera entradas no numéricas", () => {
    expect(importeFormaPago(Number.NaN, 50)).toBe(0);
    expect(importeFormaPago(100, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("suma de porcentajes", () => {
  it("suma la lista dada", () => {
    expect(sumaPorcentajes([50, 25, 25])).toBe(100);
  });

  it("cuadra 100 con tolerancia a decimales", () => {
    expect(cuadra100([33.33, 33.33, 33.34])).toBe(true);
    expect(cuadra100([50, 25, 25])).toBe(true);
    expect(cuadra100([80])).toBe(false);
    expect(cuadra100([])).toBe(true);
  });
});

describe("estimación de alturas", () => {
  it("una fila corta mide aproximadamente el mínimo (16 pt)", () => {
    const alto = estimarAltoFilaPartida("Gotele");
    expect(alto).toBeGreaterThanOrEqual(16);
    expect(alto).toBeLessThan(20);
  });

  it("una descripción larga ocupa más filas", () => {
    const corta = estimarAltoFilaPartida("Quitado de gotele");
    const larga = estimarAltoFilaPartida("x".repeat(250));
    expect(larga).toBeGreaterThan(corta);
  });

  it("las condiciones vacías ocupan un bloque mínimo", () => {
    expect(estimarAltoCondiciones("")).toBe(60);
  });

  it("más condiciones ocupan más alto", () => {
    const pocas = estimarAltoCondiciones("Validez: 30 días.");
    const muchas = estimarAltoCondiciones(Array(10).fill("Imprevistos: texto largo. " + "y".repeat(80)).join("\n"));
    expect(muchas).toBeGreaterThan(pocas);
  });

  it("el bloque de pago crece con los textos y los conceptos", () => {
    const corto = estimarAltoBloquePago(["Se abonará el 100%."], 1);
    const largo = estimarAltoBloquePago(["y".repeat(400)], 4);
    expect(largo).toBeGreaterThan(corto);
  });
});

describe("cabeEnUnaPagina", () => {
  const base = {
    altoFijoCabecera: 305,
    altoPartidas: 24,
    altoCondiciones: 90,
    altoBloquePago: 0,
    tieneBloquePago: false,
  };

  it("un documento pequeño sin forma de pago cabe en una página", () => {
    expect(cabeEnUnaPagina(base)).toBe(true);
  });

  it("un documento pequeño con bloque de pago cabe en una página", () => {
    expect(
      cabeEnUnaPagina({
        ...base,
        altoPartidas: 16,
        altoCondiciones: 60,
        tieneBloquePago: true,
        altoBloquePago: 250,
      })
    ).toBe(true);
  });

  it("con muchas partidas no cabe y hay que usar la segunda página", () => {
    expect(cabeEnUnaPagina({ ...base, altoPartidas: 500 })).toBe(false);
  });

  it("con bloque de pago muy alto tampoco cabe", () => {
    expect(cabeEnUnaPagina({ ...base, tieneBloquePago: true, altoBloquePago: 500 })).toBe(false);
  });
});

describe("repartirEnDosColumnas", () => {
  it("reparte en alterno y respeta el orden", () => {
    const [izquierda, derecha] = repartirEnDosColumnas([1, 2, 3, 4, 5]);
    expect(izquierda).toEqual([1, 3, 5]);
    expect(derecha).toEqual([2, 4]);
  });

  it("con lista vacía devuelve dos columnas vacías", () => {
    expect(repartirEnDosColumnas([])).toEqual([[], []]);
  });
});
