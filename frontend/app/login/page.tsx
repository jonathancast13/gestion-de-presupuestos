"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { consumirAvisoCaducada } from "@/app/components/AuthGuard";
import { ErrorApi, iniciarSesion, verificarSesion } from "@/lib/api";
import { haySesion } from "@/lib/auth";
import { EMPRESA } from "@/lib/empresa";

export default function PaginaLogin() {
  const router = useRouter();

  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // El destino (?next=...) se lee en el primer render del cliente. No se
  // renderiza, así que no puede provocar un desajuste de hidratación.
  const [destino] = useState(() => {
    if (typeof window === "undefined") return "/";
    const siguiente = new URLSearchParams(window.location.search).get("next") || "/";
    return siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/";
  });
  const [avisoCaducada, setAvisoCaducada] = useState(false);

  useEffect(() => {
    let cancelado = false;

    // sessionStorage es client-only: se lee en un microtask, cuando la
    // hidratación ya ha terminado (evita el aviso de set-state-in-effect)
    void Promise.resolve().then(() => {
      if (!cancelado) setAvisoCaducada(consumirAvisoCaducada());
    });

    // Salto automático si ya hay una sesión válida
    if (haySesion()) {
      verificarSesion()
        .then((sesion) => {
          if (!cancelado && sesion) router.replace(destino);
        })
        .catch(() => {
          // Sin backend: nos quedamos en el login
        });
    }

    return () => {
      cancelado = true;
    };
  }, [destino, router]);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (enviando) return;

    if (!usuario.trim() || !contrasena) {
      setError("Introduce el usuario y la contraseña.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion(usuario.trim(), contrasena);
      router.replace(destino);
    } catch (causa) {
      if (causa instanceof ErrorApi && causa.estado === 0) {
        setError(causa.message);
      } else {
        setError(causa instanceof Error ? causa.message : "No se pudo iniciar sesión.");
      }
      setEnviando(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-carbon px-4 py-8">
      <div className="hoja w-full max-w-md overflow-hidden">
        <div className="h-1.5 bg-oro" aria-hidden="true" />
        <div className="px-6 pt-8 pb-6 text-center sm:px-8">
          <Image
            src={EMPRESA.logo}
            alt={`Logo de ${EMPRESA.nombre}`}
            className="mx-auto h-20 w-auto"
            priority
          />
          <h1 className="mt-4 text-[1.3rem] font-bold tracking-tight text-carbon">
            {EMPRESA.nombre}
          </h1>
          <p className="mt-1 text-sm text-albanil">Panel de presupuestos y facturas</p>
        </div>

        <form onSubmit={enviar} className="space-y-4 border-t border-linea px-6 pt-6 pb-8 sm:px-8">
          {avisoCaducada && !error && (
            <p
              role="status"
              className="rounded-lg border border-oro/40 bg-oro/10 px-3 py-2 text-sm text-[#7c5314]"
            >
              Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="usuario" className="etiqueta-campo">
              Usuario
            </label>
            <input
              id="usuario"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={usuario}
              onChange={(evento) => setUsuario(evento.target.value)}
              placeholder="Tu usuario"
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="contrasena" className="etiqueta-campo">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="contrasena"
                name="current-password"
                type={verClave ? "text" : "password"}
                autoComplete="current-password"
                value={contrasena}
                onChange={(evento) => setContrasena(evento.target.value)}
                placeholder="••••••••"
                className="campo pr-12"
              />
              <button
                type="button"
                onClick={() => setVerClave((valor) => !valor)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-2 text-albanil hover:text-carbon"
              >
                {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={enviando} className="boton boton-oro w-full">
            {enviando ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-carbon/30 border-t-carbon" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn size={18} /> Iniciar sesión
              </>
            )}
          </button>

          <p className="pt-2 text-center text-xs text-albanil">
            Acceso restringido. ¿No puedes entrar? Llama al {EMPRESA.telefono}.
          </p>
        </form>
      </div>
    </main>
  );
}
