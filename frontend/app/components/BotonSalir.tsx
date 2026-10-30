"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { borrarToken } from "@/lib/auth";

/** Cierra la sesión y vuelve al login. */
export default function BotonSalir() {
  const router = useRouter();

  const salir = () => {
    borrarToken();
    router.replace("/login");
  };

  return (
    <button
      type="button"
      onClick={salir}
      className="boton boton-hueco boton-chico"
    >
      <LogOut size={16} /> Salir
    </button>
  );
}
