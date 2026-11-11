import Link from "next/link";
import { sinTildes } from "@/lib/texto";
import { cn } from "@/lib/utils";

// Id estable del h2 de un bloque, para que su section lo use como nombre accesible.
export const idDeTitulo = (titulo: string) =>
  `bloque-${sinTildes(titulo)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;

// Marco común de los bloques: título, enlace al módulo y contenido.
export function Tarjeta({
  titulo,
  enlace,
  className,
  children,
}: {
  titulo: string;
  enlace?: { href: string; texto: string };
  className?: string;
  children: React.ReactNode;
}) {
  const idTitulo = idDeTitulo(titulo);
  return (
    <section
      aria-labelledby={idTitulo}
      className={cn(
        "bg-card shadow-card flex min-w-0 flex-col gap-4 rounded-xl border p-5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={idTitulo} className="text-[15px] font-semibold tracking-tight">
          {titulo}
        </h2>
        {enlace && (
          <Link
            href={enlace.href}
            className="text-primary focus-visible:ring-ring -my-3 inline-flex min-h-11 items-center rounded-sm text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          >
            {enlace.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// Una lectura falló: el bloque lo dice y manda al módulo, sin tumbar el resto del tablero.
export function ErrorBloque({
  titulo,
  mensaje,
  href,
}: {
  titulo: string;
  mensaje: string;
  href: string;
}) {
  return (
    <Tarjeta titulo={titulo} enlace={{ href, texto: "Abrir módulo" }}>
      <p role="alert" className="text-destructive text-sm">
        {mensaje}
      </p>
    </Tarjeta>
  );
}

// Alto fijo: el bloque real ocupa su lugar sin mover lo de abajo.
export function Esqueleto({ className }: { className: string }) {
  return <div aria-hidden className={cn("bg-muted/60 animate-pulse rounded-xl", className)} />;
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
