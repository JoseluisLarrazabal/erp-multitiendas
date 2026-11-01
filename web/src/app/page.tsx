import { redirect } from "next/navigation";
import { destinoInicial, obtenerContexto } from "@/modules/usuarios";

// Portada: solo decide a dónde ir. Sin sesión, al login; con sesión, según permisos.
export default async function Home() {
  const contexto = await obtenerContexto();
  if (!contexto) redirect("/login");
  redirect(destinoInicial(contexto.activo, contexto.permisos));
}
