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
  cantidad: number;
  precioUnitario: number;
  iva: number;
}

// Línea tal y como la devuelve el backend (snake_case)
export interface LineaDocumento {
  id: number;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva: number;
  subtotal: number;
}

export interface Documento {
  id: number;
  tipo: TipoDocumento;
  numero: string;
  fecha: string;
  cliente: ClienteData | null;
  descripcion_trabajo: string | null;
  subtotal: number;
  total_iva: number;
  total_general: number;
  lineas: LineaDocumento[];
}

export type LineaEditable = Pick<ItemLinea, "descripcion" | "cantidad" | "precioUnitario" | "iva">;

export interface DocumentoPayload {
  tipo: TipoDocumento;
  numero?: string;
  fecha: string;
  cliente: ClienteData;
  // Opcional: ausente en PUT => conservar; cadena vacía => borrar
  descripcion_trabajo?: string;
  items: LineaEditable[];
}
