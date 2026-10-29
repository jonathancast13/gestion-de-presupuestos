import { Suspense } from "react";
import PresupuestoForm from "./components/PresupuestoForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-extrabold text-gray-800">Panel de Reformas</h1>
        <p className="text-gray-500 text-sm mt-1">Genera presupuestos y facturas en segundos</p>
      </div>
      {/* useSearchParams obliga a envolver el formulario en <Suspense> */}
      <Suspense
        fallback={
          <div className="max-w-4xl mx-auto my-8 p-10 bg-white shadow-lg rounded-xl border border-gray-100 text-center text-gray-500">
            Cargando formulario...
          </div>
        }
      >
        <PresupuestoForm />
      </Suspense>
    </main>
  );
}
