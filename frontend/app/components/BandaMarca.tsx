import Image from "next/image";
import { EMPRESA } from "@/lib/empresa";

/**
 * Banda de marca: la cabecera del PDF llevada a la pantalla.
 * Carbón con filete oro; se repite en todas las páginas de la app.
 */
export default function BandaMarca() {
  return (
    <header className="bg-carbon border-b-2 border-oro">
      <div className="max-w-5xl mx-auto flex h-14 items-center gap-3 px-4 sm:px-6">
        <Image
          src={EMPRESA.logo}
          alt=""
          aria-hidden="true"
          width={26}
          height={34}
          priority
          className="h-8 w-auto shrink-0"
        />
        <span className="text-[15px] font-bold tracking-tight text-cal">{EMPRESA.nombre}</span>
        <span className="ml-auto hidden text-[13px] text-albanil-claro sm:block">
          Presupuestos y facturas
        </span>
      </div>
    </header>
  );
}
