/**
 * Sesión de usuario: el token JWT vive en el localStorage del navegador.
 *
 * Solo lo guardamos aquí; el backend valida cada petición con
 * `Authorization: Bearer <token>`.
 */

const CLAVE_TOKEN = "panel-reformas-token";

/** Devuelve el token guardado o null si no hay sesión. */
export function obtenerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CLAVE_TOKEN);
  } catch {
    // localStorage bloqueado (modo privado, etc.)
    return null;
  }
}

export function haySesion(): boolean {
  return obtenerToken() !== null;
}

export function guardarToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE_TOKEN, token);
  } catch {
    // Si no se puede guardar, la sesión simplemente no persiste
  }
}

export function borrarToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Nada que hacer
  }
}
