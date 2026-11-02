"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { leerSinRed, useSinRed } from "@/lib/offline/red";
import type { ClienteElegido } from "@/modules/clientes";
import {
  exigeCliente,
  lineaIgual,
  lineasNoVendibles,
  motivoBloqueo,
  reducirCarrito,
  resumirCarrito,
} from "./carrito";
import {
  buscar,
  formatearCantidad,
  motivoNoVendible,
  porCodigoExacto,
  type ProductoPos,
} from "./domain";
import type { DatosNegocio, Equipo } from "./queries";
import type { VentaPayload } from "./schemas";
import { useAtajos } from "./use-atajos";
import { useCatalogo } from "./use-catalogo";
import type { ColaPos } from "./use-cola";
import { useEnvio } from "./use-envio";
import { useFocoVenta } from "./use-foco-venta";
import { useVendedor } from "./use-vendedor";
import type { NotaVenta } from "./venta";

// Lo que PosApp necesita saber de la venta para frenar un cambio de negocio.
export type GuardaVenta = { lineas: () => number; hayPendiente: () => Promise<boolean> };

export type OpcionesVenta = {
  negocioId: string;
  // Motor y estado de la cola, montados por encima de la venta (ver useColaPos).
  cola: ColaPos;
  // La sesión caducó o es de otra cuenta: no se cobra.
  sesionCaducada: boolean;
  tipoNegocio: string;
  negocio: DatosNegocio;
  equipo: Equipo;
  cajaId: string | null;
  permisos: readonly string[];
  usuarioId: string;
  recargarNegocio: () => Promise<void>;
  recargarPermisos: () => Promise<void>;
  verificarCaja: (equipoId: string) => Promise<string | null>;
  cajaCerrada: (equipoId: string) => void;
  registrarGuarda: (g: GuardaVenta) => void;
  // Un diálogo de fuera de la venta (cambio de negocio) está abierto: F2 y "/" no deben actuar.
  atajosBloqueados: boolean;
  // Edad del catálogo en uso (ms), para la barra de sin conexión.
  alCambiarCatalogo: (desde: number | null) => void;
};

// Estado y acciones de la venta en curso: catálogo, carrito, cliente, cobro y envío.
export function useVenta(o: OpcionesVenta) {
  const { negocioId, equipo, cajaId, recargarNegocio, recargarPermisos, verificarCaja } = o;
  const catalogoHook = useCatalogo(negocioId, equipo.ubicacionId, o.usuarioId);
  const sinRed = useSinRed();
  const { alCambiarCatalogo } = o;
  const catalogoDesde = catalogoHook.desde;
  useEffect(() => {
    alCambiarCatalogo(catalogoDesde);
    return () => alCambiarCatalogo(null);
  }, [catalogoDesde, alCambiarCatalogo]);
  const { estado: estadoCatalogo, indice, recargar, registrarVenta } = catalogoHook;
  const [carrito, despachar] = useReducer(reducirCarrito, []);
  const [descuentoVentaTexto, setDescuentoVentaTexto] = useState("");
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [confirmandoEquipo, setConfirmandoEquipo] = useState(false);
  const [nota, setNota] = useState<NotaVenta | null>(null);
  // La nota se entregó pero la venta aún no llegó al servidor (queda en la cola).
  const [notaEnCola, setNotaEnCola] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const vendedor = useVendedor(o.usuarioId);
  const { campo, titulo, enfocarTrasAccion } = useFocoVenta(nota);
  const siguienteId = useRef(0);
  const carritoActual = useRef(carrito);
  useEffect(() => {
    carritoActual.current = carrito;
  }, [carrito]);

  const puedeDescontar = o.permisos.includes("descontar");
  const topeDescuento = o.negocio.topeDescuento;
  const permisosCarrito = useMemo(
    () => ({ puedeDescontar, tope: topeDescuento }),
    [puedeDescontar, topeDescuento],
  );
  const resumen = useMemo(
    () => resumirCarrito(carrito, descuentoVentaTexto, permisosCarrito),
    [carrito, descuentoVentaTexto, permisosCarrito],
  );
  const clienteObligatorio = exigeCliente(o.tipoNegocio);

  // Precios, tope y permisos pueden haber cambiado: se recarga todo y la validación local con los datos frescos
  // muestra qué falla. El descuento de la venta se conserva; solo se quitan las líneas que ya no se pueden vender.
  const alErrorPrecios = useCallback(async () => {
    const [mapa] = await Promise.all([recargar(), recargarNegocio(), recargarPermisos()]);
    if (mapa) {
      const fuera = lineasNoVendibles(carritoActual.current, mapa);
      despachar({ tipo: "reemplazar", productos: mapa });
      if (fuera.length)
        setAviso(`Se quitó de la venta lo que ya no se puede vender: ${fuera.join(", ")}.`);
    }
    setCobrando(false);
  }, [recargar, recargarNegocio, recargarPermisos]);
  const alCajaCerrada = useCallback(async () => {
    const error = await verificarCaja(equipo.id);
    if (error) setAviso(`No se pudo comprobar la caja: ${error} Intenta cobrar de nuevo.`);
    setCobrando(false);
  }, [verificarCaja, equipo.id]);
  const alExito = useCallback(
    (n: NotaVenta, items: VentaPayload["items"], enviada: boolean) => {
      setNota(n);
      setNotaEnCola(!enviada);
      despachar({ tipo: "vaciar" });
      setDescuentoVentaTexto("");
      setCliente(null);
      setCobrando(false);
      setAviso(null);
      registrarVenta(items);
    },
    [registrarVenta],
  );
  const envio = useEnvio({
    negocioId,
    cola: o.cola,
    sesionCaducada: o.sesionCaducada,
    equipo,
    cajaId,
    tipoCambio: catalogoHook.catalogo?.tipoCambio ?? null,
    alErrorPrecios,
    alCajaCerrada,
    alExito,
    usuarioId: o.usuarioId,
  });
  const { hayPendiente, limpiarRechazo } = envio;

  const { registrarGuarda } = o;
  useEffect(() => {
    registrarGuarda({ lineas: () => carritoActual.current.length, hayPendiente });
  }, [registrarGuarda, hayPendiente]);

  const resultados = useMemo(() => (indice ? buscar(indice, busqueda) : []), [indice, busqueda]);

  function agregar(p: ProductoPos) {
    const motivo = motivoNoVendible(p, o.tipoNegocio);
    // Las series se eligen contra el servidor (RF-VEN-14).
    if (p.controlaSerie && leerSinRed())
      return setAviso(`Este producto necesita conexión: "${p.nombre}" lleva serie.`);
    if (motivo) return setAviso(`"${p.nombre}" no se puede vender: ${motivo.toLowerCase()}.`);
    const igual = lineaIgual(carrito, p);
    siguienteId.current += 1;
    despachar({ tipo: "agregar", producto: p, id: `l${siguienteId.current}` });
    // Con la cantidad, repetir el mismo producto cambia el texto y el lector lo vuelve a anunciar.
    setAnuncio(
      `Agregado: ${p.nombre}, ${formatearCantidad((igual?.cantidad ?? 0) + 1000)} en la venta`,
    );
    setBusqueda("");
    enfocarTrasAccion();
  }

  function alEnter() {
    if (consulta || !indice) return;
    const exacto = porCodigoExacto(indice, busqueda);
    if (exacto) return agregar(exacto);
    const unico = resultados.length === 1 ? resultados[0] : undefined;
    if (unico) return agregar(unico);
    if (busqueda.trim())
      setAviso(
        resultados.length === 0 ? "Sin coincidencias." : "Hay varios resultados: elige uno.",
      );
  }

  const puedeCobrar =
    !consulta &&
    !!cajaId &&
    !(sinRed && clienteObligatorio && !cliente) &&
    !!resumen.totales &&
    !resumen.error &&
    (!clienteObligatorio || !!cliente) &&
    estadoCatalogo.t === "listo";
  const abrirCobro = useCallback(() => {
    if (puedeCobrar) {
      limpiarRechazo();
      setCobrando(true);
    }
  }, [puedeCobrar, limpiarRechazo]);
  useAtajos({
    cobrando: cobrando || confirmandoEquipo || o.atajosBloqueados,
    abrirCobro,
    campo,
  });

  return {
    ...catalogoHook,
    campo,
    titulo,
    carrito,
    despachar,
    resumen,
    permisosCarrito,
    descuentoVentaTexto,
    setDescuentoVentaTexto,
    cliente,
    setCliente,
    clienteObligatorio,
    busqueda,
    setBusqueda,
    consulta,
    setConsulta,
    cobrando,
    setCobrando,
    confirmandoEquipo,
    setConfirmandoEquipo,
    nota,
    notaEnCola,
    setNota,
    aviso,
    setAviso,
    anuncio,
    vendedor,
    envio,
    resultados,
    agregar,
    alEnter,
    puedeCobrar,
    abrirCobro,
    motivoBloqueo: consulta
      ? null
      : sinRed && clienteObligatorio && !cliente && resumen.lineas.length > 0
        ? "Esta venta necesita conexión: el negocio exige cliente y no se puede buscar sin red."
        : motivoBloqueo(resumen, {
            cajaAbierta: !!cajaId,
            clienteObligatorio,
            hayCliente: !!cliente,
          }),
    sinRed,
    // El carrito no se edita mientras la venta viaja al servidor.
    bloqueado: envio.estado.t === "enviando",
    // Cola del equipo (pendientes y rechazadas): bloquea cerrar la caja y cambiar de equipo o de negocio.
    colaBloquea: o.cola.estado.bloqueaEquipo,
  };
}
