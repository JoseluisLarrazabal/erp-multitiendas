import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: React.ReactNode;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h1 className="min-w-0 text-[26px] leading-tight font-bold tracking-tight">{titulo}</h1>
        {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
      </div>
      {descripcion && (
        <p className="text-muted-foreground mt-2 max-w-prose text-sm">{descripcion}</p>
      )}
    </div>
  );
}

// Enlace de volver de las pantallas de detalle: siempre el mismo botón con flecha.
export function EnlaceVolver({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "outline" })}>
      <ArrowLeft aria-hidden /> {children}
    </Link>
  );
}

export function Seccion({
  titulo,
  children,
  ...props
}: { titulo: string } & React.ComponentProps<"section">) {
  return (
    <section
      {...props}
      className="bg-card shadow-card flex flex-col gap-4 rounded-xl border p-5 md:p-6"
    >
      <h2 className="text-[15px] font-semibold tracking-tight">{titulo}</h2>
      {children}
    </section>
  );
}

export function Dato({ t, d }: { t: string; d: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs font-semibold">{t}</dt>
      <dd>{d}</dd>
    </div>
  );
}
