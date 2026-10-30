"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

type Variante = "exito" | "error";

interface Aviso {
  id: number;
  mensaje: string;
  variante: Variante;
}

interface ContextoToast {
  /** Muestra un aviso flotante (auto-oculto a los pocos segundos). */
  mostrar: (mensaje: string, variante?: Variante) => void;
  exito: (mensaje: string) => void;
  error: (mensaje: string) => void;
}

const Contexto = createContext<ContextoToast | null>(null);

export function useToast(): ContextoToast {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return contexto;
}

let contadorAvisos = 0;
const DURACION_MS = 4500;

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const mostrar = useCallback((mensaje: string, variante: Variante = "exito") => {
    contadorAvisos += 1;
    const id = contadorAvisos;
    setAvisos((previos) => [...previos, { id, mensaje, variante }]);
    window.setTimeout(() => {
      setAvisos((previos) => previos.filter((aviso) => aviso.id !== id));
    }, DURACION_MS);
  }, []);

  const cerrar = useCallback((id: number) => {
    setAvisos((previos) => previos.filter((aviso) => aviso.id !== id));
  }, []);

  const valor = useMemo<ContextoToast>(
    () => ({
      mostrar,
      exito: (mensaje) => mostrar(mensaje, "exito"),
      error: (mensaje) => mostrar(mensaje, "error"),
    }),
    [mostrar]
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        className="fixed z-50 top-3 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 flex flex-col gap-2 w-[min(92vw,24rem)]"
        role="status"
        aria-live="polite"
      >
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              aviso.variante === "exito"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {aviso.variante === "exito" ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span className="flex-1">{aviso.mensaje}</span>
            <button
              type="button"
              onClick={() => cerrar(aviso.id)}
              aria-label="Cerrar aviso"
              className="p-1 -m-1 rounded hover:bg-black/5"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
