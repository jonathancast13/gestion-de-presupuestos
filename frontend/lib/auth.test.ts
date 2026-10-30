import { beforeEach, describe, expect, it } from "vitest";
import { borrarToken, haySesion, obtenerToken } from "@/lib/auth";

const CLAVE = "panel-reformas-token";

describe("sesión en localStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("no hay sesión sin token", () => {
    expect(obtenerToken()).toBeNull();
    expect(haySesion()).toBe(false);
  });

  it("guarda, lee y borra el token", async () => {
    const { guardarToken } = await import("@/lib/auth");
    guardarToken("jwt-de-ejemplo");
    expect(obtenerToken()).toBe("jwt-de-ejemplo");
    expect(haySesion()).toBe(true);

    borrarToken();
    expect(obtenerToken()).toBeNull();
    expect(haySesion()).toBe(false);
  });

  it("usa siempre la misma clave de almacenamiento", async () => {
    const { guardarToken } = await import("@/lib/auth");
    guardarToken("abc");
    expect(window.localStorage.getItem(CLAVE)).toBe("abc");
  });

  it("tolera localStorage inaccesible (modo privado)", () => {
    const original = window.localStorage;
    // Simula el error que lanzan los navegadores en modo privado estricto
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage bloqueado");
      },
    });

    expect(obtenerToken()).toBeNull();
    expect(() => borrarToken()).not.toThrow();
    expect(() => haySesion()).not.toThrow();

    Object.defineProperty(window, "localStorage", { configurable: true, value: original });
  });
});
