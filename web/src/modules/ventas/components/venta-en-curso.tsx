"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PanelCaja } from "@/modules/caja";
import { CLAVE_CREDITO } from "../use-envio";
import { alcanceCuotas, hayCuotasSinConfirmar } from "../cobro-cuota";
import { montosCongelados } from "../cobro-pendiente";
import { aCentavos, bs } from "../domain";
import { datosBoleta } from "../orden";
import { useVenta, type OpcionesVenta } from "../use-venta";
import { AvisosVenta } from "./avisos-venta";
import { BarraEquipo } from "./barra-equipo";
import { Cobro } from "./cobro";
import { ConfirmarDescarte } from "./confirmar-descarte";
import { NotaVentaVista } from "./nota-venta";
import { PanelVenta } from "./panel-venta";
import { CreditosPos } from "./creditos-pos";
import { PlanCreditoVista } from "./plan-credito";
import { ReservasPos } from "./reservas-pos";
import { ZonaProductos } from "./zona-productos";

export function VentaEnCurso({
  alCambiarEquipo,
  ...opciones
}: OpcionesVenta & { alCambiarEquipo: () => void }) {
  // La caja reemplaza la zona de venta sin desmontar el hook: el carrito sigue intacto. Con la caja a la vista
  // F2 y "/" no actúan.
  const [verCaja, setVerCaja] = useState(false);
  // Modo Reservas: como la caja, no desmonta la venta (el carrito sigue intacto).
  const [verReservas, setVerReservas] = useState(false);
  // Modo Créditos: cobrar cuotas. Igual que la caja y las reservas, no desmonta la venta.
  const [verCreditos, setVerCreditos] = useState(false);
  const [verPlan, setVerPlan] = useState(false);
  const aparte = verCaja || verReservas || verCreditos;
  const v = useVenta({ ...opciones, atajosBloqueados: opciones.atajosBloqueados || aparte });
  const { negocio, equipo, cajaId } = opciones;
  const { envio } = v;
  // Lo que impide cerrar la caja o cambiar de equipo: la cola, un cobro en línea sin confirmar o una cuota sin confirmar.
  // Las cuotas se leen una vez al montar; después las avisa CreditosPos al fijar o quitar una, y otra pestaña por `storage`.
  const alcanceCuota = alcanceCuotas(opciones.negocioId, equipo.id);
  const [hayCuotas, setHayCuotas] = useState(() => hayCuotasSinConfirmar(alcanceCuota));
  useEffect(() => {
    const f = (e: StorageEvent) => {
      if (e.key === alcanceCuota || e.key === null)
        setHayCuotas(hayCuotasSinConfirmar(alcanceCuota));
    };
    window.addEventListener("storage", f);
    return () => window.removeEventListener("storage", f);
  }, [alcanceCuota]);
  const hayPendientes = v.colaBloquea || envio.pendientes.size > 0 || hayCuotas;
  const cierreBloqueado = v.colaBloqueaCierre || envio.pendientes.size > 0 || hayCuotas;

  if (v.nota) {
    const alNueva = () => {
      setVerPlan(false);
      v.setNota(null);
    };
    return v.nota.credito && verPlan ? (
      <PlanCreditoVista
        ventaId={v.nota.credito.ventaId}
        negocio={v.nota.negocio}
        numeroVenta={v.nota.numero}
        alVolver={() => setVerPlan(false)}
        alNueva={alNueva}
      />
    ) : (
      <NotaVentaVista
        nota={v.nota}
        enCola={v.notaEnCola}
        alNueva={alNueva}
        alVerPlan={v.nota.credito ? () => setVerPlan(true) : undefined}
      />
    );
  }

  const totales = v.resumen.totales;
  // Cobro online-only (reserva o crédito) sin confirmar: montos fijos (de lo enviado), no los del formulario.
  const clavePendiente = v.reserva ? v.reserva.id : v.formCredito.activo ? CLAVE_CREDITO : null;
  const ajeno = clavePendiente ? envio.pendientes.get(clavePendiente) : undefined;
  const pendiente = ajeno && envio.esPropio(ajeno.payload.id) ? ajeno : undefined;
  const congelado = montosCongelados(pendiente, envio.estado);
  const planCredito = v.credito?.ok ? v.credito.plan : null;
  return (
    <div className="flex flex-col gap-3 pb-24 lg:pb-0 print:hidden">
      <BarraEquipo
        equipo={equipo}
        cajaAbierta={!!cajaId}
        pendiente={hayPendientes}
        alCambiarEquipo={() =>
          v.carrito.length > 0 ? v.setConfirmandoEquipo(true) : alCambiarEquipo()
        }
        conReservas={opciones.permisos.includes("gestionar_reservas")}
        conCreditos={opciones.permisos.includes("caja") && opciones.tipoNegocio !== "lavanderia"}
        modo={
          verCaja
            ? "caja"
            : verReservas
              ? "reservas"
              : verCreditos
                ? "creditos"
                : v.consulta
                  ? "consulta"
                  : "vender"
        }
        alCambiarModo={(m) => {
          setVerCaja(m === "caja");
          setVerReservas(m === "reservas");
          setVerCreditos(m === "creditos");
          // Antes de cerrar la caja se intenta enviar lo que haya en la cola.
          if (m === "caja") opciones.cola.disparar(true);
          if (m !== "caja") v.setConsulta(m === "consulta");
        }}
      />
      {[...envio.pendientes]
        .filter(([clave]) => !(v.cobrando && clave === clavePendiente))
        .map(([clave, p]) => (
          <div
            key={clave}
            role="alert"
            className="border-warning-line bg-warning-soft flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
          >
            <p className="text-warning min-w-0 flex-1 font-medium">
              Cobro sin confirmar: {p.nota.numero}, {bs(aCentavos(p.payload.total))}
              {p.nota.cliente ? `, ${p.nota.cliente.nombre}` : ""}. No entregues el producto hasta
              verificar.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={envio.estado.t === "enviando" || envio.estado.t === "verificando"}
              onClick={() => void envio.descartarYVerificar(clave)}
            >
              Verificar cobro
            </Button>
          </div>
        ))}
      <AvisosVenta
        anuncio={v.anuncio}
        aviso={v.aviso}
        alCerrarAviso={() => v.setAviso(null)}
        rechazo={envio.estado.t === "rechazada" && !v.cobrando ? envio.estado.mensaje : null}
        catalogo={v.estado}
        alReintentarCatalogo={() => void v.recargar()}
      />
      {verCaja && (
        <PanelCaja
          negocioId={opciones.negocioId}
          dispositivoId={equipo.id}
          usuarioId={opciones.usuarioId}
          nombreEquipo={equipo.nombre}
          sesionId={cajaId}
          filas={opciones.cola.filas}
          ventaPendiente={cierreBloqueado}
          rechazadas={opciones.cola.estado.rechazadasEquipo}
          lecturaColaFallida={opciones.cola.estado.lecturaFallida}
          alEncolar={() => opciones.cola.disparar()}
          alCerrar={() => opciones.cajaCerrada(equipo.id)}
          alYaCerrada={() => opciones.verificarCaja(equipo.id)}
          alVolver={() => setVerCaja(false)}
        />
      )}
      {verReservas && (
        <ReservasPos
          negocioId={opciones.negocioId}
          equipoId={equipo.id}
          ubicacionId={equipo.ubicacionId}
          ubicaciones={v.catalogo?.ubicaciones ?? []}
          cajaId={cajaId}
          indice={v.indice}
          hayCarrito={v.carrito.length > 0}
          puedeCancelar={opciones.permisos.includes("anular")}
          alCompletar={(r) => {
            if (v.cargarReserva(r)) setVerReservas(false);
          }}
        />
      )}
      {verCreditos && (
        <CreditosPos
          negocioId={opciones.negocioId}
          equipoId={equipo.id}
          cajaId={cajaId}
          alCambiarPendientes={setHayCuotas}
          alCajaCerrada={v.alCajaCerrada}
        />
      )}
      <div
        hidden={aparte}
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] [&[hidden]]:hidden"
      >
        <ZonaProductos
          catalogo={v.catalogo}
          busqueda={v.busqueda}
          alCambiarBusqueda={v.setBusqueda}
          alEnter={v.alEnter}
          campo={v.campo}
          consulta={v.consulta}
          resultados={v.resultados}
          ubicacionId={equipo.ubicacionId}
          tipoNegocio={opciones.tipoNegocio}
          lista={v.listaVenta}
          alAgregar={v.agregar}
        />
        <PanelVenta
          consulta={v.consulta}
          resumen={v.resumen}
          cantidadLineas={v.carrito.length}
          permisos={v.permisosCarrito}
          negocioId={opciones.negocioId}
          ubicacionId={equipo.ubicacionId}
          clienteObligatorio={v.clienteObligatorio}
          cliente={v.cliente}
          alCambiarCliente={v.setCliente}
          despachar={v.despachar}
          bloqueado={v.bloqueado}
          descuentoTexto={v.descuentoVentaTexto}
          alCambiarDescuento={v.setDescuentoVentaTexto}
          motivoBloqueo={v.motivoBloqueo}
          puedeCobrar={v.puedeCobrar}
          abrirCobro={v.abrirCobro}
          tituloRef={v.titulo}
          sinRed={v.sinRed}
          reserva={
            v.reserva
              ? {
                  cliente: v.reserva.clienteNombre,
                  anticipo: aCentavos(v.reserva.anticipo),
                  alQuitar: v.descartarReserva,
                }
              : null
          }
          credito={
            v.puedeCredito && !v.reserva
              ? {
                  form: v.formCredito,
                  alCambiar: (cambios) => v.setFormCredito({ ...v.formCredito, ...cambios }),
                  alAlternar: (activo) => void v.alternarCredito(activo),
                  parametros: v.parametrosCredito,
                  plan: v.credito?.ok ? v.credito.plan : null,
                  alReintentar:
                    v.credito && !v.credito.ok && v.credito.reintentable ? v.reintentarPlan : null,
                }
              : null
          }
          orden={
            v.esOrden
              ? {
                  ficha: v.ficha,
                  alCambiarFicha: v.setFicha,
                  express: v.express,
                  alCambiarExpress: v.cambiarExpress,
                }
              : null
          }
        />
      </div>

      {!v.consulta && !aparte && (
        <div className="bg-card fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t p-3 lg:hidden">
          <p className="cifra flex-1 text-2xl">{bs(totales?.total ?? 0)}</p>
          <Button
            type="button"
            size="xl"
            className="px-8"
            disabled={!v.puedeCobrar}
            onClick={v.abrirCobro}
          >
            Cobrar
          </Button>
        </div>
      )}

      {v.cobrando && totales && (
        <Cobro
          total={planCredito ? planCredito.inicial : totales.total}
          titulo={planCredito ? "Cobrar la inicial del crédito" : undefined}
          detalle={
            planCredito
              ? `Total ${bs(totales.total)}: inicial ${bs(planCredito.inicial)} ahora y ${bs(planCredito.financiado)} en ${planCredito.cuotas} ${planCredito.cuotas === 1 ? "cuota" : "cuotas"}.`
              : undefined
          }
          anticipo={v.reserva ? aCentavos(v.reserva.anticipo) : undefined}
          congelado={congelado}
          alVerificar={() => clavePendiente && void envio.descartarYVerificar(clavePendiente)}
          estado={envio.estado}
          alCerrar={() => {
            envio.limpiarRechazo();
            v.setCobrando(false);
          }}
          alConfirmar={(c) => {
            // Una orden con ficha inválida no se degrada a venta común: se rechaza y se muestra el motivo.
            if (v.esOrden && !v.fichaValida.ok) {
              v.setCobrando(false);
              return v.setAviso(v.fichaValida.motivo);
            }
            const orden = v.esOrden && v.fichaValida.ok ? v.fichaValida.orden : undefined;
            const boleta = orden ? datosBoleta(orden, v.cliente) : null;
            void envio.confirmar(v.resumen, {
              clienteId: v.cliente?.id ?? null,
              ...(orden ? { orden } : {}),
              descuentoVentaTexto: v.descuentoVentaTexto,
              efectivo: c.efectivo,
              qr: c.qr,
              qrConfirmado: c.qrConfirmado,
              recibido: c.recibido,
              ...(v.reserva
                ? { reservaId: v.reserva.id, anticipo: aCentavos(v.reserva.anticipo) }
                : {}),
              ...(planCredito
                ? {
                    credito: {
                      cuotas: planCredito.cuotas,
                      docsCi: v.formCredito.docsCi,
                      docsDomicilio: v.formCredito.docsDomicilio,
                      docsPagare: v.formCredito.docsPagare,
                    },
                  }
                : {}),
              nota: {
                negocio: { nombre: negocio.nombre, nit: negocio.nit, datosNota: negocio.datosNota },
                vendedor: v.vendedor,
                cliente: boleta
                  ? boleta.cliente
                  : v.cliente
                    ? { nombre: v.cliente.nombre, documento: v.cliente.documento }
                    : null,
                ...(boleta ? { orden: boleta.orden } : {}),
              },
            });
          }}
        />
      )}
      <ConfirmarDescarte
        abierto={v.confirmandoEquipo}
        titulo="¿Cambiar de equipo?"
        descripcion="La venta en curso se descartará: el carrito se vacía."
        confirmar="Descartar y cambiar"
        alConfirmar={() => {
          v.setConfirmandoEquipo(false);
          alCambiarEquipo();
        }}
        alCancelar={() => v.setConfirmandoEquipo(false)}
      />
    </div>
  );
}
