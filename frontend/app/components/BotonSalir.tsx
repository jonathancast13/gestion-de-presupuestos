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
      className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium transition-colors min-h-10"
    >
      <LogOut size={16} /> Salir
    </button>
  );
}
