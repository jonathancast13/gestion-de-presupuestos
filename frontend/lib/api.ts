import type { Documento, DocumentoPayload, TipoDocumento } from "@/types";

// La URL del backend viene de .env.local (NEXT_PUBLIC_BACKEND_URL)
const BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000").replace(/\/+$/, "");

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
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      ...opciones,
      headers: { "Content-Type": "application/json", ...opciones?.headers },
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor de Python. Asegúrate de que Flask está encendido (python app.py)."
    );
  }

  let datos: unknown = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  if (!respuesta.ok) throw new Error(mensajeError(datos, respuesta.status));
  if (datos === null) throw new Error("El servidor devolvió una respuesta no válida.");
  return datos as T;
}

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
