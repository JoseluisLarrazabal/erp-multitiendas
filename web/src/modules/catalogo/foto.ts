import { createClient } from "@/lib/supabase/browser";
import { rutaDeFoto } from "./domain";

// Sube directo a Storage con la sesión del navegador (la policy exige editar_productos en el negocio de la ruta).
// Devuelve la ruta nueva, o null si falló. Si la extensión cambió, borra la foto anterior (otra ruta).
export async function subirFoto(
  negocioId: string,
  productoId: string,
  archivo: File,
  rutaAnterior: string | null,
): Promise<string | null> {
  const supabase = createClient();
  const ruta = rutaDeFoto(negocioId, productoId, archivo.type);
  const { error } = await supabase.storage
    .from("productos")
    .upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  if (error) return null;
  if (rutaAnterior && rutaAnterior !== ruta) {
    // Una foto vieja huérfana no rompe nada: se ignora el fallo.
    await supabase.storage.from("productos").remove([rutaAnterior]);
  }
  return ruta;
}
