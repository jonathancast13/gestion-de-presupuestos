"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, History, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { eliminarDocumento, listarDocumentos } from "@/lib/api";
import { formatearEuros } from "@/lib/dinero";
import type { Documento } from "@/types";

function formatearFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

export default function Historial() {
  // null = aún no ha terminado de cargar
  const [documentos, setDocumentos] = useState<Documento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  const cargar = useCallback(() => {
    listarDocumentos()
      .then((listado) => {
        setDocumentos(listado);
        setError(null);
      })
      .catch((causa) => {
        setDocumentos((previo) => previo ?? []);
        setError(causa instanceof Error ? causa.message : "No se pudo cargar el historial.");
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const confirmarYEliminar = async (documento: Documento) => {
    const confirmado = window.confirm(
      `¿Eliminar el documento ${documento.numero}? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setEliminandoId(documento.id);
    try {
      await eliminarDocumento(documento.id);
      setDocumentos((previo) => (previo ?? []).filter((doc) => doc.id !== documento.id));
    } catch (causa) {
      alert(causa instanceof Error ? causa.message : "No se pudo eliminar el documento.");
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="max-w-5xl mx-auto p-6 bg-white shadow-lg rounded-xl border border-gray-100">
        <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <History className="text-blue-600" /> Historial de Documentos
          </h1>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void cargar()}
              className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors"
            >
              <RefreshCw size={16} /> Actualizar
            </button>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus size={16} /> Nuevo documento
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void cargar()}
              className="font-medium underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {documentos === null ? (
          <p className="py-10 text-center text-gray-500">Cargando documentos...</p>
        ) : documentos.length === 0 ? (
          <div className="py-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">Todavía no hay documentos guardados</p>
            <p className="text-sm text-gray-400 mt-1">
              Crea el primero desde el{" "}
              <Link href="/" className="text-blue-600 hover:underline">
                generador de documentos
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
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
                          onClick={() => void confirmarYEliminar(documento)}
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
        )}
      </div>
    </main>
  );
}
