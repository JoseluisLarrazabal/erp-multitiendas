import type { Metadata } from "next";
import { AVISO_FILTRO_INVALIDO } from "@/lib/filtros";
import { createClient } from "@/lib/supabase/server";
import { EncabezadoPagina, Paginador, Seccion } from "@/modules/catalogo/panel";
import {
  agruparPorCliente,
  cargarClientesConSaldo,
  cargarCuentas,
  cargarParametros,
  FormConfigCredito,
  FormSaldoInicial,
  leerFiltrosCreditos,
  PAGINA_CREDITOS,
  TablaSaldos,
  TablaVencidas,
} from "@/modules/creditos/panel";
import { exigirAlgunPermiso } from "@/modules/usuarios/panel";

export const metadata: Metadata = { title: "Créditos · ERP Multitiendas" };

export default async function PaginaCreditos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { activo, permisos } = await exigirAlgunPermiso(["gestionar_credito", "ver_reportes"]);
  const { filtros, invalido } = leerFiltrosCreditos(await searchParams);
  const gestiona = permisos.includes("gestionar_credito");
  const supabase = await createClient();
  // Paginado en SQL: la página trae solo los clientes que se muestran, con todos sus créditos.
  // shortcut: dos llamadas (la página de clientes y los vencidos); con 3 negocios no pesa. Si los créditos llegan a miles, una
  // sola RPC que devuelva la página y los vencidos.
  const [cuentas, atrasadas, parametros] = await Promise.all([
    cargarClientesConSaldo(supabase, activo.negocioId, filtros.pagina, PAGINA_CREDITOS),
    cargarCuentas(supabase, activo.negocioId, { soloVencidas: true, limite: PAGINA_CREDITOS }),
    cargarParametros(supabase, activo.negocioId),
  ]);

  const saldos = cuentas.ok ? agruparPorCliente(cuentas.data.cuentas) : [];
  const total = cuentas.ok ? cuentas.data.total : 0;
  const pagina = cuentas.ok ? cuentas.data.pagina : 1;

  return (
    <>
      <EncabezadoPagina
        titulo="Créditos"
        descripcion={`Cuentas por cobrar de ${activo.nombre}: saldo por cliente y cuotas vencidas. Las cuotas se cobran en el POS, por la caja.`}
      />
      <div className="flex min-w-0 flex-col gap-6">
        {invalido && (
          <p role="status" className="text-sm font-medium">
            {AVISO_FILTRO_INVALIDO}
          </p>
        )}
        {!cuentas.ok && (
          <p role="alert" className="text-destructive text-sm">
            {cuentas.error}
          </p>
        )}
        {cuentas.ok && (
          <>
            <Seccion titulo="Cuotas vencidas">
              {!atrasadas.ok ? (
                <p role="alert" className="text-destructive text-sm">
                  {atrasadas.error}
                </p>
              ) : atrasadas.data.cuentas.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay cuotas vencidas.</p>
              ) : (
                <>
                  <TablaVencidas cuentas={atrasadas.data.cuentas} />
                  {atrasadas.data.total > atrasadas.data.cuentas.length && (
                    <p className="text-muted-foreground text-xs">
                      Se muestran los {atrasadas.data.cuentas.length} más atrasados de{" "}
                      {atrasadas.data.total} créditos con cuotas vencidas.
                    </p>
                  )}
                </>
              )}
            </Seccion>
            <Seccion titulo="Saldo por cliente">
              {saldos.length === 0 ? (
                <p className="text-muted-foreground text-sm">Aún no hay créditos con saldo.</p>
              ) : (
                <>
                  <TablaSaldos saldos={saldos} creditos={cuentas.data.cuentas} />
                  <Paginador
                    pagina={pagina}
                    porPagina={PAGINA_CREDITOS}
                    total={total}
                    unidad="clientes"
                    hrefDe={(p) => `/panel/creditos${p > 1 ? `?pagina=${p}` : ""}`}
                  />
                </>
              )}
            </Seccion>
          </>
        )}
        {gestiona && (
          <>
            <Seccion titulo="Cargar saldo inicial">
              <p className="text-muted-foreground max-w-prose text-sm">
                Para los créditos que ya existen al arrancar: sin venta ni caja, solo el saldo y las
                cuotas que faltan.
              </p>
              <FormSaldoInicial negocioId={activo.negocioId} />
            </Seccion>
            <Seccion titulo="Parámetros del crédito">
              {parametros.ok ? (
                <FormConfigCredito negocioId={activo.negocioId} parametros={parametros.data} />
              ) : (
                <p role="alert" className="text-destructive text-sm">
                  {parametros.error}
                </p>
              )}
            </Seccion>
          </>
        )}
      </div>
    </>
  );
}
