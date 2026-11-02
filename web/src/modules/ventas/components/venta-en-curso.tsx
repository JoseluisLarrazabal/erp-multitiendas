"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PanelCaja } from "@/modules/caja";
import { bs } from "../domain";
import { useVenta, type OpcionesVenta } from "../use-venta";
import { AvisosVenta } from "./avisos-venta";
import { BarraEquipo } from "./barra-equipo";
import { Cobro } from "./cobro";
import { ConfirmarDescarte } from "./confirmar-descarte";
import { NotaVentaVista } from "./nota-venta";
import { PanelVenta } from "./panel-venta";
import { ZonaProductos } from "./zona-productos";

export function VentaEnCurso({
  alCambiarEquipo,
  ...opciones
}: OpcionesVenta & { alCambiarEquipo: () => void }) {
  // La caja reemplaza la zona de venta sin desmontar el hook: el carrito sigue intacto. Con la caja a la vista
  // F2 y "/" no actúan.
  const [verCaja, setVerCaja] = useState(false);
  const v = useVenta({ ...opciones, atajosBloqueados: opciones.atajosBloqueados || verCaja });
  const { negocio, equipo, cajaId } = opciones;
  const { envio } = v;

  if (v.nota)
    return <NotaVentaVista nota={v.nota} enCola={v.notaEnCola} alNueva={() => v.setNota(null)} />;

  const totales = v.resumen.totales;
  return (
    <div className="flex flex-col gap-3 pb-20 lg:pb-0 print:hidden">
      <BarraEquipo
        equipo={equipo}
        cajaAbierta={!!cajaId}
        pendiente={v.colaBloquea}
        alCambiarEquipo={() =>
          v.carrito.length > 0 ? v.setConfirmandoEquipo(true) : alCambiarEquipo()
        }
        modo={verCaja ? "caja" : v.consulta ? "consulta" : "vender"}
        alCambiarModo={(m) => {
          setVerCaja(m === "caja");
          // Antes de cerrar la caja se intenta enviar lo que haya en la cola.
          if (m === "caja") opciones.cola.disparar(true);
          if (m !== "caja") v.setConsulta(m === "consulta");
        }}
      />
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
          nombreEquipo={equipo.nombre}
          sesionId={cajaId}
          ventaPendiente={v.colaBloquea}
          lecturaColaFallida={opciones.cola.estado.lecturaFallida}
          alCerrar={() => opciones.cajaCerrada(equipo.id)}
          alYaCerrada={() => opciones.verificarCaja(equipo.id)}
          alVolver={() => setVerCaja(false)}
        />
      )}
      <div
        hidden={verCaja}
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
        />
      </div>

      {!v.consulta && !verCaja && (
        <div className="bg-card fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t p-3 lg:hidden">
          <p className="flex-1 text-xl font-bold tabular-nums">{bs(totales?.total ?? 0)}</p>
          <Button
            type="button"
            className="h-12 px-6 text-base"
            disabled={!v.puedeCobrar}
            onClick={v.abrirCobro}
          >
            Cobrar
          </Button>
        </div>
      )}

      {v.cobrando && totales && (
        <Cobro
          total={totales.total}
          estado={envio.estado}
          alCerrar={() => {
            envio.limpiarRechazo();
            v.setCobrando(false);
          }}
          alConfirmar={(c) =>
            void envio.confirmar(v.resumen, {
              clienteId: v.cliente?.id ?? null,
              descuentoVentaTexto: v.descuentoVentaTexto,
              efectivo: c.efectivo,
              qr: c.qr,
              recibido: c.recibido,
              nota: {
                negocio: { nombre: negocio.nombre, nit: negocio.nit, datosNota: negocio.datosNota },
                vendedor: v.vendedor,
                cliente: v.cliente
                  ? { nombre: v.cliente.nombre, documento: v.cliente.documento }
                  : null,
              },
            })
          }
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
