import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { alCaducarSesion, ErrorApi, iniciarSesion, listarDocumentos, obtenerProximoNumero } from "@/lib/api";

// Respuesta JSON simulada con la forma que espera el cliente
function respuesta(estado: number, cuerpo: unknown): Response {
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    json: async () => cuerpo,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  alCaducarSesion(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  alCaducarSesion(null);
});

describe("cabeceras de petición", () => {
  it("envía Authorization: Bearer cuando hay token", async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));
    window.localStorage.setItem("panel-reformas-token", "jwt-abc123");

    await listarDocumentos();

    const [url, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/documentos");
    expect((opciones.headers as Record<string, string>)["Authorization"]).toBe("Bearer jwt-abc123");
    expect((opciones.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("no envía Authorization sin sesión", async () => {
    fetchMock.mockResolvedValue(respuesta(200, []));
    await listarDocumentos();
    const [, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((opciones.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });
});

describe("manejo de errores", () => {
  it("convierte errores HTTP en ErrorApi con el estado", async () => {
    fetchMock.mockResolvedValue(respuesta(404, { error: "Documento no encontrado" }));
    await expect(listarDocumentos()).rejects.toMatchObject({
      name: "ErrorApi",
      estado: 404,
      message: "Documento no encontrado",
    });
  });

  it("usa el mensaje genérico cuando el cuerpo no trae error", async () => {
    fetchMock.mockResolvedValue(respuesta(500, null));
    const promesa = listarDocumentos();
    await expect(promesa).rejects.toBeInstanceOf(ErrorApi);
    await expect(listarDocumentos()).rejects.toThrow(/servidor/i);
  });

  it("devuelve estado 0 si el backend no responde", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const promesa = listarDocumentos();
    await expect(promesa).rejects.toBeInstanceOf(ErrorApi);
    await expect(listarDocumentos()).rejects.toThrow(/Flask/i);
  });
});

describe("sesión caducada (401)", () => {
  it("borra el token y avisa al guard con sesión iniciada", async () => {
    window.localStorage.setItem("panel-reformas-token", "jwt-vencido");
    const manejador = vi.fn();
    alCaducarSesion(manejador);
    fetchMock.mockResolvedValue(respuesta(401, { error: "Token no válido, inicia de nuevo." }));

    await expect(listarDocumentos()).rejects.toMatchObject({ estado: 401 });

    expect(manejador).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("panel-reformas-token")).toBeNull();
  });

  it("NO avisa si el 401 viene del propio login", async () => {
    const manejador = vi.fn();
    alCaducarSesion(manejador);
    fetchMock.mockResolvedValue(respuesta(401, { error: "Usuario o contraseña incorrectos." }));

    await expect(iniciarSesion("admin", "mala")).rejects.toMatchObject({ estado: 401 });
    expect(manejador).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("panel-reformas-token")).toBeNull();
  });

  it("NO avisa si no había sesión guardada", async () => {
    const manejador = vi.fn();
    alCaducarSesion(manejador);
    fetchMock.mockResolvedValue(respuesta(401, { error: "Falta la cabecera de autenticación." }));

    await expect(listarDocumentos()).rejects.toMatchObject({ estado: 401 });
    expect(manejador).not.toHaveBeenCalled();
  });
});

describe("iniciarSesion", () => {
  it("envía las credenciales y guarda el token devuelto", async () => {
    fetchMock.mockResolvedValue(
      respuesta(200, { token: "jwt-nuevo", usuario: "admin", expira_en_minutos: 720 })
    );

    const datos = await iniciarSesion("admin", "admin123");

    expect(datos.token).toBe("jwt-nuevo");
    expect(window.localStorage.getItem("panel-reformas-token")).toBe("jwt-nuevo");

    const [url, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/auth/login");
    expect(opciones.method).toBe("POST");
    expect(JSON.parse(opciones.body as string)).toEqual({ usuario: "admin", contrasena: "admin123" });
  });
});

describe("obtenerProximoNumero", () => {
  it("devuelve el número propuesto por el backend", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { numero: "PRE-2026-007" }));
    await expect(obtenerProximoNumero("presupuesto")).resolves.toBe("PRE-2026-007");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("tipo=presupuesto");
  });
});
