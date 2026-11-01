import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BotonCerrarSesion } from "@/modules/usuarios";
import { obtenerContexto } from "@/modules/usuarios/servidor";

export const metadata: Metadata = { title: "Sin acceso · ERP Multitiendas" };

export default async function SinAccesoPage() {
  const contexto = await obtenerContexto();
  if (!contexto) redirect("/login");
  if (contexto.activo) redirect("/"); // Tiene negocios: no es su pantalla.

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Sin acceso</h1>
      <p className="text-muted-foreground mt-2 mb-6 text-sm">
        La cuenta {contexto.usuario.correo} no tiene negocios asignados o está desactivada. Pide a
        tu administrador que revise tu acceso.
      </p>
      <BotonCerrarSesion />
    </>
  );
}
