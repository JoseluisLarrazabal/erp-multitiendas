import { createClient } from "@/lib/supabase/browser";
import { asignarFoto } from "./actions";
import { rutaDeFoto } from "./domain";

const LADO_MAX = 1200;
const UMBRAL_BYTES = 300 * 1024;

// Lado mayor a `ladoMax` conservando la proporción; si ya cabe, las medidas originales.
export function medidasDestino(ancho: number, alto: number, ladoMax: number) {
  const mayor = Math.max(ancho, alto);
  if (mayor <= ladoMax) return { ancho, alto };
  const f = ladoMax / mayor;
  return { ancho: Math.round(ancho * f), alto: Math.round(alto * f) };
}

// Achica la foto antes de subir (el celular entrega 4-8 MB). Ante cualquier falla devuelve el original.
export async function comprimirFoto(archivo: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(archivo);
    const { ancho, alto } = medidasDestino(bmp.width, bmp.height, LADO_MAX);
    if (ancho === bmp.width && alto === bmp.height && archivo.size < UMBRAL_BYTES) {
      bmp.close();
      return archivo;
    }
    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return archivo;
    // Fondo blanco: el JPEG no tiene transparencia (el PNG con alfa saldría negro).
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(bmp, 0, 0, ancho, alto);
    bmp.close();
    const aBlob = (tipo: string, calidad: number) =>
      new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, calidad));
    let blob = await aBlob("image/webp", 0.8);
    // Safari viejo no codifica WebP y devuelve PNG.
    if (blob?.type !== "image/webp") blob = await aBlob("image/jpeg", 0.82);
    if (!blob || blob.size >= archivo.size) return archivo;
    return new File([blob], archivo.name, { type: blob.type });
  } catch {
    return archivo;
  }
}

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
