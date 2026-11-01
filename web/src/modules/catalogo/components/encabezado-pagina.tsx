export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{titulo}</h1>
        {descripcion && (
          <p className="text-muted-foreground mt-2 max-w-prose text-sm">{descripcion}</p>
        )}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-5 shadow-[0_2px_5px_#34345a0d] md:p-6">
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
