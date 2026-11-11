import { createClient } from "@/lib/supabase/server";
import { DIAS_SIN_RECOGER, hrefOrdenes, listarOrdenes } from "@/modules/ventas/panel";
import { ErrorBloque, plural, Tarjeta } from "./comun";
import { ordenesSinRecoger } from "./lecturas";
import { masSi } from "./texto";

const LIMITE = 50;
const titulo = "Órdenes listas";

export async function OrdenesListas({ negocioId }: { negocioId: string }) {
  const [listas, viejas] = await Promise.all([
    createClient().then((s) =>
      listarOrdenes(s, negocioId, { q: "", estado: "lista", desde: "" }, LIMITE),
    ),
    ordenesSinRecoger(negocioId),
  ]);
  if (!listas.ok)
    return <ErrorBloque titulo={titulo} mensaje={listas.error} href="/panel/ordenes" />;
  return (
    <Tarjeta
      titulo={titulo}
      enlace={{ href: hrefOrdenes({ estado: "lista" }), texto: "Ver órdenes" }}
    >
      <div className="flex items-baseline justify-between gap-4 border-b pb-3">
        <div>
          <p className="text-sm font-semibold">Listas para recoger</p>
          <p className="text-muted-foreground text-[13px]">
            Ropa terminada que el cliente aún no retira
          </p>
        </div>
        <p className="cifra text-[15px]" data-testid="ordenes-listas-total">
          {listas.data.filas.length}
          {masSi(listas.data.siguiente !== null)}
        </p>
      </div>
      {viejas.ok ? (
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">
              Sin recoger hace más de {plural(DIAS_SIN_RECOGER, "día", "días")}
            </p>
            <p className="text-muted-foreground text-[13px]">Conviene avisar al cliente</p>
          </div>
          <p
            className={`cifra text-[15px] ${viejas.data.filas.length > 0 ? "text-destructive" : ""}`}
          >
            {viejas.data.filas.length}
            {masSi(viejas.data.siguiente !== null)}
          </p>
        </div>
      ) : (
        <p role="alert" className="text-destructive text-sm">
          {viejas.error}
        </p>
      )}
    </Tarjeta>
  );
}
