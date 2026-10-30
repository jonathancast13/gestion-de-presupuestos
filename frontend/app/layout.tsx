import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import AuthGuard from "./components/AuthGuard";
import ToastProvider from "./components/Toast";
import "./globals.css";

// Grotesca de señalética técnica: una sola familia para toda la app,
// la jerarquía se construye con peso y tamaño (ver globals.css)
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Panel de Reformas | Presupuestos y facturas",
  description: "Genera presupuestos y facturas en segundos",
  // PWA: al añadir a pantalla de inicio en iOS Safari
  appleWebApp: {
    title: "Panel Reformas",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F1113",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthGuard>{children}</AuthGuard>
        </ToastProvider>
      </body>
    </html>
  );
}
