"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  /** Texto del botón de confirmación (por defecto "Confirmar"). */
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Muestra estado de carga y deshabilita los botones. */
  procesando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Diálogo de confirmación accesible (sustituye a window.confirm). */
export default function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  procesando = false,
  onConfirmar,
  onCancelar,
}: Props) {
  const botonConfirmar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;

    const alPulsarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !procesando) onCancelar();
    };
    document.addEventListener("keydown", alPulsarTecla);
    botonConfirmar.current?.focus();
    return () => document.removeEventListener("keydown", alPulsarTecla);
  }, [abierto, procesando, onCancelar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmar-titulo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !procesando) onCancelar();
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 rounded-full bg-red-50 p-1.5 text-red-600">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="confirmar-titulo" className="font-semibold text-gray-900">
              {titulo}
            </h2>
            <p className="mt-1 text-sm text-gray-600 break-words">{mensaje}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={procesando}
            className="min-h-11 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {textoCancelar}
          </button>
          <button
            ref={botonConfirmar}
            type="button"
            onClick={onConfirmar}
            disabled={procesando}
            className="min-h-11 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {procesando ? "Procesando..." : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
