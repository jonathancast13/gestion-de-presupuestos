// Tipos compartidos entre formulario, historial y PDF

export type TipoDocumento = "presupuesto" | "factura";

export interface ClienteData {
  id?: number;
  nombre: string;
  nif: string;
  telefono: string;
  direccion: string;
}

export interface ItemLinea {
  id: string;
  descripcion: string;
  /** Unidad de medida de la columna UD. del PDF (opcional) */
  ud: string;
  cantidad: number;
  precioUnitario: number;
  iva: number;
}

// Línea tal y como la devuelve el backend (snake_case)
export interface LineaDocumento {
  id: number;
  descripcion: string;
  ud: string | null;
  cantidad: number;
  precio_unitario: number;
  iva: number;
  subtotal: number;
}

// Tramo del calendario de pagos (concepto + porcentaje del total)
export interface FormaPago {
  id: string;
  concepto: string;
  porcentaje: number;
  descripcion: string;
}

// Tal y como la devuelve el backend (sin id local)
export interface FormaPagoBackend {
  id: number;
  concepto: string;
  porcentaje: number;
  descripcion: string | null;
}

export interface Documento {
  id: number;
  tipo: TipoDocumento;
  numero: string;
  fecha: string;
  cliente: ClienteData | null;
  descripcion_trabajo: string | null;
  condiciones: string | null;
  subtotal: number;
  total_iva: number;
  total_general: number;
  lineas: LineaDocumento[];
  formas_pago: FormaPagoBackend[];
}

export type LineaEditable = Pick<ItemLinea, "descripcion" | "ud" | "cantidad" | "precioUnitario" | "iva">;

// Forma de pago enviada al backend (sin id local)
export type FormaPagoEditable = Pick<FormaPago, "concepto" | "porcentaje" | "descripcion">;

export interface DocumentoPayload {
  tipo: TipoDocumento;
  numero?: string;
  fecha: string;
  cliente: ClienteData;
  // Opcional: ausente en PUT => conservar; cadena vacía => borrar
  descripcion_trabajo?: string;
  // Opcional: ausente en PUT => conservar; lista vacía => borrar
  condiciones?: string;
  items: LineaEditable[];
  formas_pago?: FormaPagoEditable[];
}
