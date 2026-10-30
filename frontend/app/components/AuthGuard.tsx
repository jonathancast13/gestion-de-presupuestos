"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { alCaducarSesion, verificarSesion } from "@/lib/api";
import { haySesion } from "@/lib/auth";

const AVISO_CADUCADA = "sesion-caducada";

function destinoLogin(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`;
}

/**
 * Protege todas las rutas: sin token válido se redirige al login.
 *
 * El token vive en localStorage (el servidor no puede leerlo), así que la
 * comprobación es cliente y se contrasta con GET /api/auth/me.
 *
 * Siempre renderiza {children} (aunque sea durante el prerender): ocultarlos
 * aquí rompería la validación de "instant navigation" de Next 16, porque el
 * guard vive dentro del layout. Los datos sensibles nunca vienen del SSR:
 * los descarga el cliente contra la API, que exige el token.
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // El login no se protege (así se evita el bucle de redirecciones)
  const esLogin = pathname === "/login";

  useEffect(() => {
    if (esLogin) return;

    const destino = destinoLogin(pathname);

    if (!haySesion()) {
      router.replace(destino);
      return;
    }

    let cancelado = false;

    // Si el backend rechaza el token en cualquier petición, volvemos al login
    alCaducarSesion(() => {
      try {
        window.sessionStorage.setItem(AVISO_CADUCADA, "1");
      } catch {
        // sin sessionStorage seguimos sin avisar
      }
      router.replace(destino);
    });

    verificarSesion()
      .then((usuario) => {
        if (!cancelado && usuario === null) router.replace(destino);
      })
      .catch(() => {
        // Backend no responde: dejamos pasar; las páginas mostrarán su error
      });

    return () => {
      cancelado = true;
      alCaducarSesion(null);
    };
  }, [esLogin, pathname, router]);

  return <>{children}</>;
}

/** Lee (y consume) el aviso de sesión caducada dejado por AuthGuard. */
export function consumirAvisoCaducada(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const aviso = window.sessionStorage.getItem(AVISO_CADUCADA);
    if (aviso) window.sessionStorage.removeItem(AVISO_CADUCADA);
    return aviso === "1";
  } catch {
    return false;
  }
}
