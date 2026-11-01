import type { Metadata } from "next";
import { PosSesion } from "@/modules/usuarios";

export const metadata: Metadata = { title: "Punto de venta · ERP Multitiendas" };

// Estático a propósito: sin cookies() ni headers() para que se precachee. La sesión se guarda en el cliente.
export default function PosPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <PosSesion />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Punto de venta</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          El registro de ventas aún no está disponible en esta versión.
        </p>
      </div>
    </main>
  );
}
