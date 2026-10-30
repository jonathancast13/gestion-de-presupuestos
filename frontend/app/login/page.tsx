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
    <main className="min-h-[100dvh] flex items-center justify-center bg-[#0F1113] px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border-t-4 border-[#D9963A]">
        <div className="px-6 pt-8 pb-6 sm:px-8 text-center">
          <Image
            src={EMPRESA.logo}
            alt={`Logo de ${EMPRESA.nombre}`}
            className="mx-auto h-20 w-auto"
            priority
          />
          <h1 className="mt-4 text-xl font-bold text-[#0F1113]">{EMPRESA.nombre}</h1>
          <p className="mt-1 text-sm text-gray-500">Panel de presupuestos y facturas</p>
        </div>

        <form onSubmit={enviar} className="px-6 pb-8 sm:px-8 space-y-4">
          {avisoCaducada && !error && (
            <p role="status" className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              Tu sesión ha caducado. Vuelve a iniciar sesión para continuar.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="usuario" className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base outline-none focus:border-[#D9963A] focus:ring-2 focus:ring-[#D9963A]/30"
            />
          </div>

          <div>
            <label htmlFor="contrasena" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full rounded-lg border border-gray-300 px-3 py-3 pr-12 text-base outline-none focus:border-[#D9963A] focus:ring-2 focus:ring-[#D9963A]/30"
              />
              <button
                type="button"
                onClick={() => setVerClave((valor) => !valor)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600"
              >
                {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#D9963A] hover:bg-[#c7862f] text-[#0F1113] font-semibold py-3.5 text-base transition-colors disabled:opacity-60"
          >
            {enviando ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F1113]/30 border-t-[#0F1113]" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn size={18} /> Iniciar sesión
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400 pt-2">
            Acceso restringido · {EMPRESA.telefono}
          </p>
        </form>
      </div>
    </main>
  );
}
