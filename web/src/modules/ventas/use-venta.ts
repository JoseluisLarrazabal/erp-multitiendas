"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { leerSinRed, useSinRed } from "@/lib/offline/red";
import type { ClienteElegido } from "@/modules/clientes";
import { cargarParametros, type Parametros } from "@/modules/creditos";
import { createClient } from "@/lib/supabase/browser";
import {
  exigeCliente,
  lineaIgual,
  lineasNoVendibles,
  motivoBloqueo,
  reducirCarrito,
  resumirCarrito,
  sinPrecioEn,
} from "./carrito";
import {
  aMilesimas,
  buscar,
  formatearCantidad,
  motivoNoVendible,
  type Lista,
  candidatosExactos,
  textoMonto,
  aCentavos,
  type ProductoPos,
} from "./domain";
import { formCreditoInicial, type FormCredito } from "./credito-venta";
import { armarOrden, fichaInicial, hoyLaPaz, type FichaTexto } from "./orden";
import type { ReservaActiva } from "./reservas";
import type { DatosNegocio, Equipo } from "./queries";
import type { VentaPayload } from "./schemas";
import { useAtajos } from "./use-atajos";
import { useCatalogo } from "./use-catalogo";
import { useSimulacionCredito } from "./use-simulacion-credito";
import type { ColaPos } from "./use-cola";
import { CLAVE_CREDITO, useEnvio } from "./use-envio";
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
  // El resultado del cierre de caja está (o dejó de estar) en pantalla.
  alVerCierre: (visible: boolean) => void;
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
  // Reserva que esta venta completa (RF-RES-02): carrito fijo, anticipo como pago, solo en línea.
  const [reserva, setReserva] = useState<ReservaActiva | null>(null);
  // Lavandería: la venta es una orden, con su ficha y la lista normal o express en todas las líneas.
  const esOrden = o.tipoNegocio === "lavanderia";
  const [express, setExpress] = useState(false);
  const [ficha, setFicha] = useState<FichaTexto>(() => fichaInicial());
  // Venta a crédito (RF-CRE-01): online-only, con la lista `credito` en todas las líneas y la inicial como cobro.
  const puedeCredito = !esOrden && o.permisos.includes("gestionar_credito");
  const [formCredito, setFormCredito] = useState<FormCredito>(formCreditoInicial);
  const [parametrosCredito, setParametrosCredito] = useState<Parametros | null>(null);
  // Sube al recargar los parámetros: obliga a pedir el plan de nuevo al servidor.
  const [versionCredito, setVersionCredito] = useState(0);
  const listaVenta: Lista = esOrden
    ? express
      ? "express"
      : "normal"
    : formCredito.activo
      ? "credito"
      : "contado";
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
  const clienteObligatorio = exigeCliente(o.tipoNegocio) || formCredito.activo;
  // El plan, el mínimo y los vencimientos los calcula el servidor (simular_credito), con debounce.
  const { resultado: credito, reintentar: reintentarPlan } = useSimulacionCredito({
    negocioId,
    form: formCredito,
    totalCentavos: resumen.totales?.total ?? 0,
    hayCliente: !!cliente,
    version: versionCredito,
  });

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
      setExpress(false);
      setFicha(fichaInicial());
      setReserva(null);
      setFormCredito(formCreditoInicial);
      setCobrando(false);
      setAviso(null);
      // El carrito queda vacío: un "Agregado: ..." viejo sería un anuncio engañoso al volver a la venta.
      setAnuncio("");
      registrarVenta(items);
    },
    [registrarVenta],
  );
  // Parámetros del crédito cambiados desde que se activó (inicial, cuotas): se releen SIN tocar precios ni descuentos.
  const refrescarCredito = useCallback(async () => {
    const r = await cargarParametros(createClient(), negocioId);
    if (r.ok) {
      setParametrosCredito(r.data);
      setVersionCredito((v) => v + 1);
    } else setAviso(`No se pudieron releer los parámetros del crédito: ${r.error}`);
  }, [negocioId]);
  const alVerificada = useCallback((n: NotaVenta) => {
    setNota(n);
    setNotaEnCola(false);
  }, []);
  const envio = useEnvio({
    negocioId,
    cola: o.cola,
    sesionCaducada: o.sesionCaducada,
    equipo,
    cajaId,
    tipoCambio: catalogoHook.catalogo?.tipoCambio ?? null,
    alErrorPrecios,
    alCajaCerrada,
    alErrorCredito: refrescarCredito,
    alExito,
    alVerificada,
    usuarioId: o.usuarioId,
  });
  const { hayPendiente, limpiarRechazo } = envio;
  // Cobro a crédito sin confirmar: el carrito, el cliente y las condiciones quedan fijos hasta saber qué pasó.
  const creditoPendiente = envio.pendientes.has(CLAVE_CREDITO);

  const { registrarGuarda } = o;
  useEffect(() => {
    registrarGuarda({ lineas: () => carritoActual.current.length, hayPendiente });
  }, [registrarGuarda, hayPendiente]);

  const resultados = useMemo(() => (indice ? buscar(indice, busqueda) : []), [indice, busqueda]);

  function agregar(p: ProductoPos) {
    if (reserva)
      return setAviso("Estás completando una reserva: no se pueden agregar más productos.");
    const motivo = motivoNoVendible(p, o.tipoNegocio, listaVenta);
    // Las series se eligen contra el servidor (RF-VEN-14).
    if (p.controlaSerie && leerSinRed())
      return setAviso(`Este producto necesita conexión: "${p.nombre}" lleva serie.`);
    if (motivo) return setAviso(`"${p.nombre}" no se puede vender: ${motivo.toLowerCase()}.`);
    const igual = lineaIgual(carrito, p, listaVenta);
    siguienteId.current += 1;
    despachar({ tipo: "agregar", producto: p, id: `l${siguienteId.current}`, lista: listaVenta });
    // Con la cantidad, repetir el mismo producto cambia el texto y el lector lo vuelve a anunciar.
    setAnuncio(
      `Agregado: ${p.nombre}, ${formatearCantidad((igual?.cantidad ?? 0) + 1000)} en la venta`,
    );
    setBusqueda("");
    enfocarTrasAccion();
  }

  function alEnter() {
    if (consulta || !indice) return;
    const exactos = candidatosExactos(indice, busqueda);
    if (exactos.length === 1) return agregar(exactos[0]!);
    if (exactos.length > 1)
      return setAviso(`Ese código coincide con ${exactos.length} productos: elige uno.`);
    const unico = resultados.length === 1 ? resultados[0] : undefined;
    if (unico) return agregar(unico);
    if (busqueda.trim())
      setAviso(
        resultados.length === 0 ? "Sin coincidencias." : "Hay varios resultados: elige uno.",
      );
  }

  // Carga la reserva en un carrito vacío: un solo ítem al precio acordado, el cliente de la reserva y sin descuentos.
  function cargarReserva(r: ReservaActiva): boolean {
    const producto = catalogoHook.catalogo?.productos.find((p) => p.id === r.productoId);
    if (carrito.length > 0 || formCredito.activo) {
      setAviso("Termina o vacía la venta en curso antes de completar una reserva.");
      return false;
    }
    if (!producto || producto.controlaSerie) {
      setAviso(`"${r.productoNombre}" no está disponible en el catálogo de este equipo.`);
      return false;
    }
    siguienteId.current += 1;
    const id = `l${siguienteId.current}`;
    despachar({ tipo: "agregar", producto, id, lista: "contado" });
    despachar({
      tipo: "cambiar",
      id,
      cambios: {
        cantidadTexto: formatearCantidad(aMilesimas(r.cantidad)),
        precioTexto: textoMonto(aCentavos(r.precioAcordado)),
        precioFijo: true,
      },
    });
    setDescuentoVentaTexto("");
    setCliente({ id: r.clienteId, nombre: r.clienteNombre, documento: null });
    setReserva(r);
    setAviso(null);
    return true;
  }
  function descartarReserva() {
    if (reserva && envio.pendientes.has(reserva.id))
      return setAviso(
        "Hay un cobro sin confirmar de esta reserva: abre el cobro y usa «Descartar y verificar».",
      );
    setReserva(null);
    despachar({ tipo: "vaciar" });
    setCliente(null);
  }

  // Activar el crédito pasa todas las líneas a la lista `credito` (reinicia precios y descuentos manuales); desactivarlo, a contado.
  async function alternarCredito(valor: boolean) {
    if (creditoPendiente || (valor && reserva)) return;
    const lista: Lista = valor ? "credito" : "contado";
    const faltan = sinPrecioEn(carrito, lista);
    if (faltan.length)
      return setAviso(`${faltan.join(", ")} no tiene precio de ${valor ? "crédito" : "contado"}.`);
    if (valor) {
      // Se leen al activar: el negocio pudo cambiar la inicial o el interés. Si no se pueden leer, el crédito no se activa
      // (nunca se vende con parámetros viejos sin avisar).
      const r = await cargarParametros(createClient(), negocioId);
      if (!r.ok)
        return setAviso(`No se activó el crédito: no se pudieron leer sus parámetros (${r.error})`);
      setParametrosCredito(r.data);
      setVersionCredito((v) => v + 1);
    }
    setAviso(null);
    despachar({ tipo: "listaTodas", lista });
    setFormCredito(valor ? { ...formCreditoInicial, activo: true } : formCreditoInicial);
  }

  function cambiarExpress(valor: boolean) {
    const lista: Lista = valor ? "express" : "normal";
    const faltan = sinPrecioEn(carrito, lista);
    if (faltan.length)
      return setAviso(
        `${faltan.join(", ")} no tiene precio ${lista === "express" ? "express" : "normal"}.`,
      );
    setExpress(valor);
    despachar({ tipo: "listaTodas", lista });
  }
  const fichaValida = armarOrden(ficha, { express, conCliente: !!cliente, hoy: hoyLaPaz() });
  // Sin red no se busca cliente: la orden lleva el nombre escrito en la ficha.
  const clienteListo = esOrden
    ? (!!cliente || sinRed) && fichaValida.ok
    : !(sinRed && clienteObligatorio && !cliente) && (!clienteObligatorio || !!cliente);
  const puedeCobrar =
    !(reserva && sinRed) &&
    !(formCredito.activo && (sinRed || !credito?.ok)) &&
    !consulta &&
    !!cajaId &&
    clienteListo &&
    !!resumen.totales &&
    !resumen.error &&
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
    // Con un cobro a crédito sin confirmar el cliente no cambia: el payload pendiente ya lo lleva.
    setCliente: (c: ClienteElegido | null) => {
      if (!creditoPendiente) setCliente(c);
    },
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
    esOrden,
    express,
    cambiarExpress,
    ficha,
    setFicha,
    fichaValida,
    listaVenta,
    reserva,
    puedeCredito,
    alCajaCerrada,
    formCredito,
    setFormCredito,
    credito,
    reintentarPlan,
    creditoPendiente,
    parametrosCredito,
    alternarCredito,
    cargarReserva,
    descartarReserva,
    motivoBloqueo: consulta
      ? null
      : formCredito.activo
        ? sinRed
          ? "Vender a crédito necesita conexión."
          : (motivoBloqueo(resumen, {
              cajaAbierta: !!cajaId,
              clienteObligatorio: false,
              hayCliente: true,
            }) ?? (resumen.lineas.length > 0 && credito && !credito.ok ? credito.motivo : null))
        : reserva && sinRed
          ? "Completar una reserva necesita conexión."
          : esOrden
            ? (motivoBloqueo(resumen, {
                cajaAbierta: !!cajaId,
                clienteObligatorio: !sinRed,
                hayCliente: !!cliente,
              }) ?? (resumen.lineas.length > 0 && !fichaValida.ok ? fichaValida.motivo : null))
            : sinRed && clienteObligatorio && !cliente && resumen.lineas.length > 0
              ? "Esta venta necesita conexión: el negocio exige cliente y no se puede buscar sin red."
              : motivoBloqueo(resumen, {
                  cajaAbierta: !!cajaId,
                  clienteObligatorio,
                  hayCliente: !!cliente,
                }),
    sinRed,
    // El carrito no se edita mientras la venta viaja al servidor.
    bloqueado:
      envio.estado.t === "enviando" ||
      envio.estado.t === "verificando" ||
      reserva !== null ||
      creditoPendiente,
    // Cola del equipo (pendientes y rechazadas): bloquea cerrar la caja y cambiar de equipo o de negocio.
    colaBloquea: o.cola.estado.bloqueaEquipo,
    // Como colaBloquea, pero las ventas y movimientos rechazados no impiden cerrar la caja (M-11).
    colaBloqueaCierre: o.cola.estado.bloqueaCierre,
  };
}
