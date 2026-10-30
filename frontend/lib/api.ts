import { borrarToken, guardarToken, obtenerToken } from "@/lib/auth";
import type { Documento, DocumentoPayload, TipoDocumento } from "@/types";

// La URL del backend viene de .env.local (NEXT_PUBLIC_BACKEND_URL)
const BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000").replace(/\/+$/, "");

/** Error de API que conserva el código HTTP (0 = sin conexión). */
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorApi";
    this.estado = estado;
  }
}

// ---------------------------------------------------------------------------
// Sesión caducada: el AuthGuard registra aquí a dónde redirigir
// ---------------------------------------------------------------------------

let manejadorCaducada: (() => void) | null = null;

export function alCaducarSesion(manejador: (() => void) | null): void {
  manejadorCaducada = manejador;
}

function mensajeError(datos: unknown, estado: number): string {
  if (datos && typeof datos === "object" && "error" in datos) {
    const error = (datos as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  if (estado === 404) return "No se encontró el documento solicitado.";
  if (estado >= 500) return "El servidor ha fallado. Revisa la consola de Flask.";
  return `Error inesperado del servidor (${estado}).`;
}

async function pedirJson<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const token = obtenerToken();
  const cabeceras: Record<string, string> = { "Content-Type": "application/json" };
  if (token) cabeceras["Authorization"] = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      ...opciones,
      headers: { ...cabeceras, ...opciones?.headers },
    });
  } catch {
    throw new ErrorApi(
      "No se pudo conectar con el servidor de Python. Asegúrate de que Flask está encendido (python app.py).",
      0
    );
  }

  let datos: unknown = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    // 401 con sesión iniciada (y no en el propio login): el token ya no vale
    const esLogin = ruta.startsWith("/api/auth/login");
    if (respuesta.status === 401 && token && !esLogin) {
      borrarToken();
      manejadorCaducada?.();
    }
    throw new ErrorApi(mensajeError(datos, respuesta.status), respuesta.status);
  }
  if (datos === null) throw new ErrorApi("El servidor devolvió una respuesta no válida.", respuesta.status);
  return datos as T;
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

export interface RespuestaLogin {
  token: string;
  usuario: string;
  expira_en_minutos: number;
}

export async function iniciarSesion(usuario: string, contrasena: string): Promise<RespuestaLogin> {
  const datos = await pedirJson<RespuestaLogin>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ usuario, contrasena }),
  });
  guardarToken(datos.token);
  return datos;
}

/**
 * Comprueba el token guardado contra el backend.
 * Devuelve el usuario, o null si la sesión no es válida.
 * Lanza ErrorApi si el backend no responde (para no borrar la sesión por una caída).
 */
export async function verificarSesion(): Promise<string | null> {
  try {
    const datos = await pedirJson<{ usuario: string }>("/api/auth/me");
    return datos.usuario;
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 401) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export function listarDocumentos(): Promise<Documento[]> {
  return pedirJson<Documento[]>("/api/documentos");
}

export function obtenerDocumento(id: number): Promise<Documento> {
  return pedirJson<Documento>(`/api/documentos/${id}`);
}

export function crearDocumento(payload: DocumentoPayload): Promise<Documento> {
  return pedirJson<Documento>("/api/documentos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function actualizarDocumento(id: number, payload: DocumentoPayload): Promise<Documento> {
  return pedirJson<Documento>(`/api/documentos/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function eliminarDocumento(id: number): Promise<void> {
  await pedirJson<unknown>(`/api/documentos/${id}`, { method: "DELETE" });
}

export async function obtenerProximoNumero(tipo: TipoDocumento): Promise<string> {
  const datos = await pedirJson<{ numero: string }>(
    `/api/documentos/proximo-numero?tipo=${encodeURIComponent(tipo)}`
  );
  return datos.numero;
}
