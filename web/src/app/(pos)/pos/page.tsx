import type { Metadata } from "next";
import { PosApp } from "./pos-app";

export const metadata: Metadata = { title: "Punto de venta · ERP Multitiendas" };

// Estático a propósito: sin cookies() ni headers() para que se precachee. La sesión se guarda en el cliente.
export default function PosPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[1400px] flex-col gap-3 px-3 py-3 sm:px-4 print:block print:min-h-0 print:max-w-none print:p-0">
      <PosApp titulo={<h1 className="text-lg font-bold tracking-tight">Punto de venta</h1>} />
    </main>
  );
}
