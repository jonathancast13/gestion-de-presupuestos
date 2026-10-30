"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, History, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import BandaMarca from "../components/BandaMarca";
import BotonSalir from "../components/BotonSalir";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";
import { eliminarDocumento, listarDocumentos } from "@/lib/api";
import { formatearEuros } from "@/lib/dinero";
import type { Documento } from "@/types";

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

export default function Historial() {
  const toast = useToast();
  // null = aún no ha terminado de cargar
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [porEliminar, setPorEliminar] = useState<Documento | null>(null);

  const cargar = useCallback(
    async (avisar = false) => {
      try {
        const listado = await listarDocumentos();
        setDocumentos(listado);
        setError(null);
        if (avisar) toast.exito("Historial actualizado.");
      } catch (causa) {
        setDocumentos((previo) => previo ?? []);
        const mensaje = causa instanceof Error ? causa.message : "No se pudo cargar el historial.";
        setError(mensaje);
        if (avisar) toast.error(mensaje);
      }
    },
    [toast]
  );

  // Carga inicial: callbacks sobre la promesa en vez de llamar a cargar()
  // directamente, para no encadenar renders síncronos dentro del efecto
  // (regla set-state-in-effect). Actualizar/Reintentar siguen usando cargar().
  useEffect(() => {
    let cancelado = false;

    listarDocumentos()
      .then((listado) => {
        if (cancelado) return;
        setDocumentos(listado);
        setError(null);
      })
      .catch((causa: unknown) => {
        if (cancelado) return;
        setDocumentos((previo) => previo ?? []);
        setError(causa instanceof Error ? causa.message : "No se pudo cargar el historial.");
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const confirmarEliminacion = async () => {
    if (!porEliminar) return;

    setEliminandoId(porEliminar.id);
    try {
      await eliminarDocumento(porEliminar.id);
      const numero = porEliminar.numero;
      setDocumentos((previo) => (previo ?? []).filter((doc) => doc.id !== porEliminar.id));
      setPorEliminar(null);
      toast.exito(`Documento ${numero} eliminado.`);
    } catch (causa) {
      toast.error(causa instanceof Error ? causa.message : "No se pudo eliminar el documento.");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <main className="min-h-screen bg-cemento">
      <BandaMarca />
      <div className="hoja mx-auto my-5 max-w-5xl px-4 py-5 sm:my-8 sm:px-6 sm:py-6">
        <div className="mb-6 flex flex-col gap-4 border-b border-linea pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="flex items-center gap-2 text-[1.35rem] font-bold tracking-tight text-carbon sm:text-2xl">
            <History className="shrink-0 text-oro-oscuro" size={22} aria-hidden="true" />{" "}
            Historial de documentos
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void cargar(true)}
              className="boton boton-hueco boton-chico"
            >
              <RefreshCw size={16} /> Actualizar
            </button>
            <Link href="/" className="boton boton-oro boton-chico">
              <Plus size={16} /> Nuevo documento
            </Link>
            <BotonSalir />
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void cargar(true)}
              className="font-medium underline hover:no-underline shrink-0"
            >
              Reintentar
            </button>
          </div>
        )}

        {documentos === null ? (
          <p className="py-10 text-center text-albanil">Cargando documentos...</p>
        ) : documentos.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={40} className="mx-auto text-linea mb-3" aria-hidden="true" />
            <p className="font-medium text-carbon">Todavía no hay documentos guardados</p>
            <p className="mt-1 text-sm text-albanil">
              Crea el primero desde el{" "}
              <Link
                href="/"
                className="font-medium text-carbon underline decoration-oro decoration-2 underline-offset-2 hover:no-underline"
              >
                generador de documentos
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            {/* Móvil: tarjetas */}
            <ul className="space-y-3 sm:hidden">
              {documentos.map((documento) => (
                <li key={documento.id} className="rounded-lg border border-linea bg-cemento/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        documento.tipo === "factura"
                          ? "bg-carbon text-oro-claro"
                          : "border border-oro/50 bg-oro/15 text-[#8a5a12]"
                      }`}
                    >
                      {documento.tipo === "factura" ? "Factura" : "Presupuesto"}
                    </span>
                    <span className="cifras font-semibold text-carbon">{documento.numero}</span>
                  </div>

                  <p className="mt-2 truncate text-sm text-albanil">
                    {documento.cliente?.nombre || "—"}
                    {documento.cliente?.nif && (
                      <span className="text-albanil-claro"> · {documento.cliente.nif}</span>
                    )}
                  </p>

                  <div className="mt-1 flex items-center justify-between">
                    <span className="cifras text-sm text-albanil">
                      {formatearFecha(documento.fecha)}
                    </span>
                    <span className="cifras font-bold text-carbon">
                      {formatearEuros(documento.total_general)}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-end gap-2 border-t border-linea pt-2">
                    <Link
                      href={`/?editar=${documento.id}`}
                      aria-label={`Editar documento ${documento.numero}`}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-carbon transition-colors hover:bg-oro/15 hover:text-oro-oscuro"
                    >
                      <Pencil size={18} />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Eliminar documento ${documento.numero}`}
                      disabled={eliminandoId === documento.id}
                      onClick={() => setPorEliminar(documento)}
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-senal transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            {/* Tablet y escritorio: tabla */}
            <div className="hidden overflow-x-auto border rounded-lg sm:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-sm text-gray-600">
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Nº</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((documento) => (
                    <tr key={documento.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            documento.tipo === "factura"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {documento.tipo === "factura" ? "Factura" : "Presupuesto"}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-800">{documento.numero}</td>
                      <td className="p-3 text-gray-600">{formatearFecha(documento.fecha)}</td>
                      <td className="p-3 text-gray-600">
                        {documento.cliente?.nombre || "—"}
                        {documento.cliente?.nif && (
                          <span className="block text-xs text-gray-400">{documento.cliente.nif}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-semibold text-gray-800">
                        {formatearEuros(documento.total_general)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/?editar=${documento.id}`}
                            title="Editar documento"
                            className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <Pencil size={17} />
                          </Link>
                          <button
                            type="button"
                            title="Eliminar documento"
                            disabled={eliminandoId === documento.id}
                            onClick={() => setPorEliminar(documento)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        abierto={porEliminar !== null}
        titulo="Eliminar documento"
        mensaje={`¿Eliminar el documento ${porEliminar?.numero ?? ""}? Esta acción no se puede deshacer.`}
        textoConfirmar="Eliminar"
        procesando={porEliminar !== null && eliminandoId === porEliminar.id}
        onConfirmar={() => void confirmarEliminacion()}
        onCancelar={() => setPorEliminar(null)}
      />
    </main>
  );
}
