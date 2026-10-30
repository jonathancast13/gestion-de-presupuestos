import { Suspense } from "react";
import BandaMarca from "./components/BandaMarca";
import PresupuestoForm from "./components/PresupuestoForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-cemento">
      <BandaMarca />
      <div className="max-w-4xl mx-auto px-3 py-5 sm:px-4 sm:py-8">
        {/* useSearchParams obliga a envolver el formulario en <Suspense> */}
        <Suspense
          fallback={
            <div className="hoja p-10 text-center text-albanil">Cargando formulario...</div>
          }
        >
          <PresupuestoForm />
        </Suspense>
      </div>
    </main>
  );
}
