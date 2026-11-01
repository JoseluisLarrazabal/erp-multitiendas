import { createClient } from "@/lib/supabase/browser";
import { asignarFoto } from "./actions";
import { rutaDeFoto } from "./domain";

// Sube directo a Storage con la sesión del navegador (la policy exige editar_productos en el negocio de la ruta),
// asigna la ruta al producto y, solo entonces, borra la foto anterior si la extensión cambió (otra ruta): si la
// asignación falla, la anterior sigue siendo la del producto. true si quedó asignada.
export async function subirYAsignarFoto(
  negocioId: string,
  productoId: string,
  archivo: File,
  rutaAnterior: string | null,
): Promise<boolean> {
  const supabase = createClient();
  const ruta = rutaDeFoto(negocioId, productoId, archivo.type);
  const { error } = await supabase.storage
    .from("productos")
    .upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  if (error) return false;
  const asignada = await asignarFoto({ productoId, fotoPath: ruta });
  if (!asignada.ok) return false;
  if (rutaAnterior && rutaAnterior !== ruta) {
    // Una foto vieja huérfana no rompe nada: se ignora el fallo.
    await supabase.storage.from("productos").remove([rutaAnterior]);
  }
  return true;
}
