"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, History, Plus, Send, Trash2 } from "lucide-react";
import DescargaPDFButton from "./DescargaPDFButton";
import { actualizarDocumento, crearDocumento, obtenerDocumento, obtenerProximoNumero } from "@/lib/api";
import { calcularTotales, formatearEuros, subtotalDeLinea } from "@/lib/dinero";
import type { ClienteData, DocumentoPayload, ItemLinea, TipoDocumento } from "@/types";

// Valor por defecto calculado fuera del render (la pureza de React lo exige)
const FECHA_INICIAL = new Date().toISOString().split("T")[0];

// Identificadores de línea: contador incremental, nunca Date.now() en render
let contadorLineas = 0;
function siguienteIdLinea(): string {
  contadorLineas += 1;
  return `linea-${contadorLineas}`;
}

function lineaVacia(): ItemLinea {
  return { id: siguienteIdLinea(), descripcion: "", cantidad: 1, precioUnitario: 0, iva: 21 };
}

export default function PresupuestoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editar");
  const idEditando = editId ? Number(editId) : null;
  const esEdicion = idEditando !== null && Number.isInteger(idEditando) && idEditando > 0;

  // Estado del documento
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>("presupuesto");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [fecha, setFecha] = useState(FECHA_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [cargandoDocumento, setCargandoDocumento] = useState(esEdicion);

  // Estado del cliente
  const [cliente, setCliente] = useState<ClienteData>({
    nombre: "",
    nif: "",
    telefono: "",
    direccion: "",
  });

  // Estado de las líneas (partidas de la reforma)
  const [items, setItems] = useState<ItemLinea[]>([lineaVacia()]);

  // Cargar el documento cuando se llega con ?editar=id
  useEffect(() => {
    if (!esEdicion || idEditando === null) return;
    let cancelado = false;

    obtenerDocumento(idEditando)
      .then((documento) => {
        if (cancelado) return;
        setTipoDoc(documento.tipo);
        setNumeroDoc(documento.numero);
        setFecha(documento.fecha);
        if (documento.cliente) {
          setCliente({
            nombre: documento.cliente.nombre ?? "",
            nif: documento.cliente.nif ?? "",
            telefono: documento.cliente.telefono ?? "",
            direccion: documento.cliente.direccion ?? "",
          });
        }
        setItems(
          documento.lineas.length > 0
            ? documento.lineas.map((linea, indice) => ({
                id: `cargada-${indice}`,
                descripcion: linea.descripcion,
                cantidad: linea.cantidad,
                precioUnitario: linea.precio_unitario,
                iva: linea.iva,
              }))
            : [lineaVacia()]
        );
        setCargandoDocumento(false);
      })
      .catch((error) => {
        if (cancelado) return;
        alert(error instanceof Error ? error.message : "No se pudo cargar el documento.");
        router.push("/historial");
      });

    return () => {
      cancelado = true;
    };
  }, [esEdicion, idEditando, router]);

  // En modo creación el backend propone el siguiente número (PRE-2026-001...)
  useEffect(() => {
    if (esEdicion) return;
    let cancelado = false;

    obtenerProximoNumero(tipoDoc)
      .then((numero) => {
        if (!cancelado) setNumeroDoc(numero);
      })
      .catch(() => {
        // Sin backend no hay sugerencia: el número se asignará al guardar
        if (!cancelado) setNumeroDoc("");
      });

    return () => {
      cancelado = true;
    };
  }, [esEdicion, tipoDoc]);

  // Añadir nueva línea
  const agregarLinea = () => {
    setItems((prev) => [...prev, lineaVacia()]);
  };

  // Eliminar línea (siempre debe quedarse al menos una)
  const eliminarLinea = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  // Actualizar una línea específica
  const actualizarLinea = <K extends keyof ItemLinea>(id: string, campo: K, valor: ItemLinea[K]) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const actualizado = { ...item };
        actualizado[campo] = valor;
        return actualizado;
      })
    );
  };

  // Cálculos automáticos (misma aritmética que el backend)
  const { subtotal, totalIva, total } = calcularTotales(items);

  // Guardar en el backend (POST al crear, PUT al editar)
  const guardarEnBackend = async () => {
    if (guardando || cargandoDocumento) return;

    if (!cliente.nombre.trim()) {
      alert("Introduce el nombre del cliente.");
      return;
    }
    const sinDescripcion = items.findIndex((item) => !item.descripcion.trim());
    if (sinDescripcion >= 0) {
      alert(`La partida ${sinDescripcion + 1} necesita una descripción.`);
      return;
    }
    const sinCantidad = items.findIndex((item) => !(item.cantidad > 0));
    if (sinCantidad >= 0) {
      alert(`La partida ${sinCantidad + 1} necesita una cantidad mayor que 0.`);
      return;
    }

    const payload: DocumentoPayload = {
      tipo: tipoDoc,
      numero: numeroDoc,
      fecha,
      cliente,
      items: items.map(({ descripcion, cantidad, precioUnitario, iva }) => ({
        descripcion,
        cantidad,
        precioUnitario,
        iva,
      })),
    };

    setGuardando(true);
    try {
      const guardado =
        esEdicion && idEditando !== null
          ? await actualizarDocumento(idEditando, payload)
          : await crearDocumento(payload);

      alert(
        esEdicion
          ? `¡Documento ${guardado.numero} actualizado con éxito!`
          : `¡Documento guardado con éxito! Número asignado: ${guardado.numero}`
      );
      router.push("/historial");
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo guardar el documento.");
    } finally {
      setGuardando(false);
    }
  };

  // Envío por WhatsApp del resumen del documento
  const enviarWhatsApp = () => {
    const telefono = cliente.telefono.replace(/\D/g, "");
    if (!telefono) {
      alert("Introduce el teléfono del cliente para enviar por WhatsApp.");
      return;
    }
    const texto = `Hola ${cliente.nombre || "Cliente"}, le adjunto el ${tipoDoc} (${numeroDoc}) por un importe total de ${formatearEuros(total)}. Cualquier duda me comenta. ¡Un saludo!`;
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white shadow-lg rounded-xl my-8 border border-gray-100">
      <div className="flex justify-between items-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-blue-600" />
          {esEdicion ? `Editando ${numeroDoc || `documento #${idEditando}`}` : "Generador de Documentos"}
          {cargandoDocumento && <span className="text-sm font-normal text-gray-400">(cargando...)</span>}
        </h1>

        <div className="flex items-center gap-3">
          <Link
            href="/historial"
            className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors"
          >
            <History size={16} /> Ver Historial
          </Link>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTipoDoc("presupuesto")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                tipoDoc === "presupuesto"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Presupuesto
            </button>
            <button
              type="button"
              onClick={() => setTipoDoc("factura")}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                tipoDoc === "factura"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Factura
            </button>
          </div>
        </div>
      </div>

      {/* Datos generales y del cliente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">Datos del Documento</h2>
          <div>
            <label className="block text-sm font-medium text-gray-600">Nº de Documento</label>
            <input
              type="text"
              value={numeroDoc}
              readOnly={!esEdicion}
              placeholder="PRE-2026-001"
              onChange={(e) => setNumeroDoc(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none read-only:bg-gray-50 read-only:text-gray-500"
            />
            {!esEdicion && (
              <p className="text-xs text-gray-400 mt-1">Se asigna automáticamente al guardar.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-700">Datos del Cliente</h2>
          <div>
            <label className="block text-sm font-medium text-gray-600">Nombre / Razón Social</label>
            <input
              type="text"
              placeholder="Ej. Juan Pérez"
              value={cliente.nombre}
              onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
              className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-600">NIF / CIF</label>
              <input
                type="text"
                placeholder="12345678X"
                value={cliente.nif}
                onChange={(e) => setCliente({ ...cliente, nif: e.target.value })}
                className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Teléfono (WhatsApp)</label>
              <input
                type="text"
                placeholder="34600000000"
                value={cliente.telefono}
                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Dirección</label>
            <input
              type="text"
              placeholder="Calle, número, ciudad"
              value={cliente.direccion}
              onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
              className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Líneas de partidas */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Partidas de la Reforma</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b text-sm text-gray-600">
                <th className="p-3">Descripción</th>
                <th className="p-3 w-24">Cant.</th>
                <th className="p-3 w-32">Precio (€)</th>
                <th className="p-3 w-24">IVA (%)</th>
                <th className="p-3 w-32">Subtotal</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-2">
                    <input
                      type="text"
                      placeholder="Descripción del trabajo o material..."
                      value={item.descripcion}
                      onChange={(e) => actualizarLinea(item.id, "descripcion", e.target.value)}
                      className="w-full p-1.5 border rounded outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => actualizarLinea(item.id, "cantidad", Number(e.target.value))}
                      className="w-full p-1.5 border rounded outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.precioUnitario}
                      onChange={(e) => actualizarLinea(item.id, "precioUnitario", Number(e.target.value))}
                      className="w-full p-1.5 border rounded outline-none focus:border-blue-500"
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={item.iva}
                      onChange={(e) => actualizarLinea(item.id, "iva", Number(e.target.value))}
                      className="w-full p-1.5 border rounded outline-none focus:border-blue-500 bg-white"
                    >
                      <option value={21}>21%</option>
                      <option value={10}>10%</option>
                      <option value={4}>4%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  <td className="p-2 font-medium text-gray-700">{formatearEuros(subtotalDeLinea(item))}</td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => eliminarLinea(item.id)}
                      aria-label={`Eliminar partida ${item.descripcion || ""}`}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={agregarLinea}
          className="mt-3 flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus size={16} /> Añadir partida
        </button>
      </div>

      {/* Totales */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2 bg-gray-50 p-4 rounded-lg border">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Base Imponible:</span>
            <span>{formatearEuros(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Total IVA:</span>
            <span>{formatearEuros(totalIva)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-800 border-t pt-2">
            <span>TOTAL:</span>
            <span>{formatearEuros(total)}</span>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-4 justify-end border-t pt-4">
        <button
          type="button"
          onClick={guardarEnBackend}
          disabled={guardando || cargandoDocumento}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {guardando
            ? "Guardando..."
            : cargandoDocumento
              ? "Cargando..."
              : esEdicion
                ? "Actualizar en Base de Datos"
                : "Guardar en Base de Datos"}
        </button>

        <DescargaPDFButton
          tipoDoc={tipoDoc}
          numeroDoc={numeroDoc}
          fecha={fecha}
          cliente={cliente}
          items={items}
        />

        <button
          type="button"
          onClick={enviarWhatsApp}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Send size={18} /> Enviar por WhatsApp
        </button>
      </div>
    </div>
  );
}
