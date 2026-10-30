"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, History, Plus, Send, Trash2 } from "lucide-react";
import BotonSalir from "./BotonSalir";
import DescargaPDFButton from "./DescargaPDFButton";
import { useToast } from "./Toast";
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

// Campos definidos en globals.css: 16px de fuente evita el zoom de iOS
const CLASE_INPUT = "campo";
const CLASE_INPUT_TABLA = "campo campo-tabla";

export default function PresupuestoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const editId = searchParams.get("editar");
  const idEditando = editId ? Number(editId) : null;
  const esEdicion = idEditando !== null && Number.isInteger(idEditando) && idEditando > 0;

  // Estado del documento
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>("presupuesto");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [fecha, setFecha] = useState(FECHA_INICIAL);
  const [descripcionTrabajo, setDescripcionTrabajo] = useState("");
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
        setDescripcionTrabajo(documento.descripcion_trabajo ?? "");
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
        toast.error(error instanceof Error ? error.message : "No se pudo cargar el documento.");
        router.push("/historial");
      });

    return () => {
      cancelado = true;
    };
  }, [esEdicion, idEditando, router, toast]);

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
      toast.error("Introduce el nombre del cliente.");
      return;
    }
    const sinDescripcion = items.findIndex((item) => !item.descripcion.trim());
    if (sinDescripcion >= 0) {
      toast.error(`La partida ${sinDescripcion + 1} necesita una descripción.`);
      return;
    }
    const sinCantidad = items.findIndex((item) => !(item.cantidad > 0));
    if (sinCantidad >= 0) {
      toast.error(`La partida ${sinCantidad + 1} necesita una cantidad mayor que 0.`);
      return;
    }

    const payload: DocumentoPayload = {
      tipo: tipoDoc,
      numero: numeroDoc,
      fecha,
      cliente,
      descripcion_trabajo: descripcionTrabajo,
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

      toast.exito(
        esEdicion
          ? `Documento ${guardado.numero} actualizado con éxito.`
          : `Documento guardado con éxito. Número asignado: ${guardado.numero}`
      );
      router.push("/historial");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el documento.");
    } finally {
      setGuardando(false);
    }
  };

  // Envío por WhatsApp del resumen del documento
  const enviarWhatsApp = () => {
    const telefono = cliente.telefono.replace(/\D/g, "");
    if (!telefono) {
      toast.error("Introduce el teléfono del cliente para enviar por WhatsApp.");
      return;
    }
    const texto = `Hola ${cliente.nombre || "Cliente"}, le adjunto el ${tipoDoc} (${numeroDoc}) por un importe total de ${formatearEuros(total)}. Cualquier duda me comenta. ¡Un saludo!`;
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  };

  return (
    <div className="hoja my-5 px-4 py-5 sm:my-8 sm:px-6 sm:py-6">
      <div className="mb-6 flex flex-col gap-4 border-b border-linea pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-[1.35rem] font-bold leading-tight tracking-tight text-carbon sm:text-2xl">
          <FileText className="shrink-0 text-oro-oscuro" size={22} aria-hidden="true" />
          {esEdicion ? `Editando ${numeroDoc || `documento #${idEditando}`}` : "Generador de documentos"}
          {cargandoDocumento && (
            <span className="text-sm font-medium text-albanil">(cargando...)</span>
          )}
        </h1>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href="/historial"
            className="boton boton-hueco boton-chico"
          >
            <History size={16} /> Ver Historial
          </Link>

          <div className="flex rounded-lg border border-linea bg-cemento p-0.5">
            <button
              type="button"
              onClick={() => setTipoDoc("presupuesto")}
              aria-pressed={tipoDoc === "presupuesto"}
              className={`min-h-10 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                tipoDoc === "presupuesto"
                  ? "bg-carbon text-cal"
                  : "text-albanil hover:text-carbon"
              }`}
            >
              Presupuesto
            </button>
            <button
              type="button"
              onClick={() => setTipoDoc("factura")}
              aria-pressed={tipoDoc === "factura"}
              className={`min-h-10 rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                tipoDoc === "factura"
                  ? "bg-carbon text-cal"
                  : "text-albanil hover:text-carbon"
              }`}
            >
              Factura
            </button>
          </div>

          <BotonSalir />
        </div>
      </div>

      {/* Datos generales y del cliente */}
      <div className="mb-7 grid grid-cols-1 gap-7 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="seccion-titulo">Datos del documento</h2>
          <div>
            <label htmlFor="numero-doc" className="etiqueta-campo">
              Nº de documento
            </label>
            <input
              id="numero-doc"
              type="text"
              value={numeroDoc}
              readOnly={!esEdicion}
              placeholder="PRE-2026-001"
              onChange={(e) => setNumeroDoc(e.target.value)}
              className={CLASE_INPUT}
            />
            {!esEdicion && (
              <p className="mt-1.5 text-xs text-albanil">Se asigna automáticamente al guardar.</p>
            )}
          </div>
          <div>
            <label htmlFor="fecha-doc" className="etiqueta-campo">
              Fecha
            </label>
            <input
              id="fecha-doc"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={`${CLASE_INPUT} cifras`}
            />
          </div>
          <div>
            <label htmlFor="descripcion-trabajo" className="etiqueta-campo">
              Descripción del trabajo{" "}
              <span className="font-normal text-albanil">(opcional)</span>
            </label>
            <textarea
              id="descripcion-trabajo"
              value={descripcionTrabajo}
              onChange={(e) => setDescripcionTrabajo(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Breve descripción del trabajo a realizar..."
              className={`${CLASE_INPUT} resize-y`}
            />
            <p className="mt-1.5 text-right text-xs cifras text-albanil">
              {descripcionTrabajo.length}/500
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="seccion-titulo">Datos del cliente</h2>
          <div>
            <label htmlFor="cliente-nombre" className="etiqueta-campo">
              Nombre / Razón Social
            </label>
            <input
              id="cliente-nombre"
              type="text"
              placeholder="Ej. Juan Pérez"
              value={cliente.nombre}
              onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
              className={CLASE_INPUT}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="cliente-nif" className="etiqueta-campo">
                NIF / CIF
              </label>
              <input
                id="cliente-nif"
                type="text"
                placeholder="12345678X"
                value={cliente.nif}
                onChange={(e) => setCliente({ ...cliente, nif: e.target.value })}
                className={CLASE_INPUT}
              />
            </div>
            <div>
              <label htmlFor="cliente-telefono" className="etiqueta-campo">
                Teléfono (WhatsApp)
              </label>
              <input
                id="cliente-telefono"
                type="tel"
                inputMode="tel"
                placeholder="34600000000"
                value={cliente.telefono}
                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                className={CLASE_INPUT}
              />
            </div>
          </div>
          <div>
            <label htmlFor="cliente-direccion" className="etiqueta-campo">
              Dirección
            </label>
            <input
              id="cliente-direccion"
              type="text"
              placeholder="Calle, número, ciudad"
              value={cliente.direccion}
              onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
              className={CLASE_INPUT}
            />
          </div>
        </div>
      </div>

      {/* Líneas de partidas */}
      <div className="mb-7">
        <h2 className="seccion-titulo mb-3">Partidas de la reforma</h2>

        {/* Móvil: tarjetas con campos apilados */}
        <ul className="space-y-3 sm:hidden">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-linea bg-cemento/60 p-3">
              <div className="flex items-start gap-2">
                <label className="min-w-0 flex-1">
                  <span className="etiqueta-campo">Descripción</span>
                  <input
                    type="text"
                    placeholder="Trabajo o material..."
                    value={item.descripcion}
                    onChange={(e) => actualizarLinea(item.id, "descripcion", e.target.value)}
                    className={CLASE_INPUT}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => eliminarLinea(item.id)}
                  aria-label={`Eliminar partida ${item.descripcion || ""}`}
                  className="mt-6 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-linea bg-cal p-2.5 text-senal hover:bg-red-50"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label>
                  <span className="etiqueta-campo">Cantidad</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => actualizarLinea(item.id, "cantidad", Number(e.target.value))}
                    className={`${CLASE_INPUT} cifras`}
                  />
                </label>
                <label>
                  <span className="etiqueta-campo">Precio (€)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={item.precioUnitario}
                    onChange={(e) => actualizarLinea(item.id, "precioUnitario", Number(e.target.value))}
                    className={`${CLASE_INPUT} cifras`}
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-2 items-end gap-3">
                <label>
                  <span className="etiqueta-campo">IVA (%)</span>
                  <select
                    value={item.iva}
                    onChange={(e) => actualizarLinea(item.id, "iva", Number(e.target.value))}
                    className={CLASE_INPUT}
                  >
                    <option value={21}>21%</option>
                    <option value={10}>10%</option>
                    <option value={4}>4%</option>
                    <option value={0}>0%</option>
                  </select>
                </label>
                <p className="flex items-center justify-between gap-2 pb-2.5 text-sm">
                  <span className="text-albanil">Subtotal:</span>
                  <span className="cifras font-semibold text-carbon">
                    {formatearEuros(subtotalDeLinea(item))}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Tablet y escritorio: tabla (misma cabecera que el PDF) */}
        <div className="hidden overflow-hidden rounded-lg border border-linea sm:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="cabecera-tabla">
                <th className="px-3 py-2.5">Descripción</th>
                <th className="w-20 px-3 py-2.5 text-center">Cant.</th>
                <th className="w-28 px-3 py-2.5 text-right">Precio (€)</th>
                <th className="w-20 px-3 py-2.5 text-center">IVA (%)</th>
                <th className="w-32 px-3 py-2.5 text-right">Subtotal</th>
                <th className="w-12 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-linea transition-colors last:border-b-0 hover:bg-cemento/50"
                >
                  <td className="p-2">
                    <input
                      type="text"
                      placeholder="Descripción del trabajo o material..."
                      value={item.descripcion}
                      onChange={(e) => actualizarLinea(item.id, "descripcion", e.target.value)}
                      className={CLASE_INPUT_TABLA}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => actualizarLinea(item.id, "cantidad", Number(e.target.value))}
                      className={`${CLASE_INPUT_TABLA} cifras text-center`}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={item.precioUnitario}
                      onChange={(e) => actualizarLinea(item.id, "precioUnitario", Number(e.target.value))}
                      className={`${CLASE_INPUT_TABLA} cifras text-right`}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      value={item.iva}
                      onChange={(e) => actualizarLinea(item.id, "iva", Number(e.target.value))}
                      className={`${CLASE_INPUT_TABLA} text-center`}
                    >
                      <option value={21}>21%</option>
                      <option value={10}>10%</option>
                      <option value={4}>4%</option>
                      <option value={0}>0%</option>
                    </select>
                  </td>
                  <td className="cifras p-2 text-right text-sm font-semibold text-carbon">
                    {formatearEuros(subtotalDeLinea(item))}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => eliminarLinea(item.id)}
                      aria-label={`Eliminar partida ${item.descripcion || ""}`}
                      className="rounded-md p-1.5 text-senal transition-colors hover:bg-red-50"
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
          className="boton boton-hueco boton-chico mt-3"
        >
          <Plus size={16} /> Añadir partida
        </button>
      </div>

      {/* Totales: el mismo bloque carbón con importe en oro que el PDF */}
      <div className="mb-7 flex justify-end sm:mb-8">
        <div className="w-full rounded-lg bg-carbon p-4 text-cal sm:w-72">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-albanil-claro">Base imponible</span>
            <span className="cifras">{formatearEuros(subtotal)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-albanil-claro">Total IVA</span>
            <span className="cifras">{formatearEuros(totalIva)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-2.5">
            <span className="text-sm font-bold uppercase tracking-wide text-oro-claro">Total</span>
            <span className="cifras text-xl font-bold text-oro">{formatearEuros(total)}</span>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col gap-3 border-t border-linea pt-4 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={guardarEnBackend}
          disabled={guardando || cargandoDocumento}
          className="boton boton-oro w-full sm:w-auto"
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
          descripcionTrabajo={descripcionTrabajo}
          items={items}
        />

        <button
          type="button"
          onClick={enviarWhatsApp}
          className="boton boton-hueco w-full sm:w-auto"
        >
          <Send size={18} /> Enviar por WhatsApp
        </button>
      </div>
    </div>
  );
}
