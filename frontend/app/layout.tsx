import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthGuard from "./components/AuthGuard";
import ToastProvider from "./components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <AuthGuard>{children}</AuthGuard>
        </ToastProvider>
      </body>
    </html>
  );
}
