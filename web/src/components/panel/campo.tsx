import type { ZodType } from "zod";
import { Label } from "@/components/ui/label";

export type Errores = Record<string, string>;
// Campos de un formulario, en orden de pantalla: clave del schema -> id del control y su mensaje.
export type Campos = Record<string, { id: string; mensaje: string }>;

// Valida y reparte los issues por campo (`path[0]`); enfoca el primer inválido en orden de pantalla.
// Un issue fuera de `campos` (p. ej. negocioId) no tiene campo: devuelve `errores` vacío y el llamador usa el aviso general.
export function validarCampos<T>(
  formulario: HTMLFormElement,
  schema: ZodType<T>,
  entrada: unknown,
  campos: Campos,
): { datos: T } | { errores: Errores } {
  const r = schema.safeParse(entrada);
  if (r.success) return { datos: r.data };
  const rotos = new Set(r.error.issues.map((i) => String(i.path[0])));
  const errores: Errores = {};
  for (const [clave, { id, mensaje }] of Object.entries(campos)) {
    if (rotos.has(clave)) errores[id] = mensaje;
  }
  const primero = Object.values(campos).find((c) => errores[c.id]);
  if (primero) formulario.querySelector<HTMLElement>(`#${primero.id}`)?.focus();
  return { errores };
}

// aria-invalid y aria-describedby de un control, juntando error y ayuda.
export function propsCampo(id: string, errores: Errores, conAyuda = false) {
  const error = errores[id];
  const ids = [error && `${id}-error`, conAyuda && `${id}-ayuda`].filter(Boolean).join(" ");
  return { "aria-invalid": error ? true : undefined, "aria-describedby": ids || undefined };
}

// Etiqueta + control + ayuda + error, el patrón de todos los formularios del panel.
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  ocultarEtiqueta,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  // Etiqueta solo para lectores de pantalla (filas repetidas de una lista).
  ocultarEtiqueta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={ocultarEtiqueta ? "sr-only" : undefined}>
        {etiqueta}
      </Label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-muted-foreground text-[13px]">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
