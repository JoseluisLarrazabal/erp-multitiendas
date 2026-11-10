import { parsearCantidad, type Unidad } from "./domain";

// Lo que solo usa el panel (ventas, detalle, anulación y devolución). Sin server actions.

export const PAGINA_VENTAS = 25;
export const PLAZO_HORAS = 24;
export const PAGINA_RECONCILIACION = 25;

// Aviso del Inicio del panel (RF-VEN-13): null si no hay nada; con más de una página de ventas se cuenta "25+".
// La caja por revisar trae hasta 100: con más, "100+".
export function textoPorRevisar(
  ventas: number,
  hayMasVentas: boolean,
  caja = 0,
  hayMasCaja = false,
): string | null {
  const partes: string[] = [];
  if (ventas > 0) {
    const n = hayMasVentas ? `${ventas}+` : String(ventas);
    partes.push(ventas === 1 && !hayMasVentas ? "1 venta" : `${n} ventas`);
  }
  if (caja > 0) {
    const n = hayMasCaja ? `${caja}+` : String(caja);
    partes.push(caja === 1 && !hayMasCaja ? "1 movimiento de caja" : `${n} movimientos de caja`);
  }
  return partes.length ? `${partes.join(" y ")} por revisar` : null;
}

// Marcas de motivos_revision (registrar_venta con p_offline), en palabras del encargado.
export const ETIQUETA_MOTIVO: Record<string, string> = {
  producto_inactivo: "Producto inactivo al enviarse",
  sin_precio: "Producto sin precio de lista",
  descuento_sin_permiso: "Descuento sin permiso de quien vendió",
  sobre_tope: "Descuento sobre el tope",
  renumerada: "Número cambiado al enviarse",
  otra_cuenta: "Enviada desde otra cuenta",
  sin_cliente: "Sin cliente registrado",
  caja_cerrada: "Enviada después de que se cerró la caja",
};
export const textoMotivo = (m: string) => ETIQUETA_MOTIVO[m] ?? m;

export const ETIQUETA_ESTADO: Record<string, string> = {
  completada: "Completada",
  anulada: "Anulada",
};
export const ETIQUETA_ORIGEN: Record<string, string> = {
  online: "Con conexión",
  offline: "Sin conexión",
};

// RN-08: pasadas 24 h solo con `devolver_fuera_plazo`. La RPC decide; esto solo avisa antes.
export const fueraDePlazo = (recibidaEn: string, ahora: number) =>
  ahora - new Date(recibidaEn).getTime() > PLAZO_HORAS * 3_600_000;

// Códigos de anular_venta, devolver_venta y fijar_tope_descuento, en palabras del panel y según la acción. Los que no
// estén aquí caen en lib/erp-errores (única fuente de los demás, p. ej. ERP_CLIENTE_DUPLICADO de clientes).
export type AccionVentas = "anular" | "devolver" | "tope" | "datos" | "revisar" | "qr";

const COMUNES: Record<string, string> = {
  ERP_SIN_PERMISO:
    "No tienes permiso para esto. Pasadas 24 horas de la venta, anular o devolver exige el permiso de devolución fuera de plazo.",
  ERP_OPERACION_REPETIDA:
    "Esta operación ya se registró con otros datos. Recarga la página y revisa el estado de la venta.",
  ERP_CAJA_CERRADA:
    "La caja está cerrada. Una venta de una caja cerrada solo se devuelve, con la caja abierta de un equipo.",
};

const PROPIOS: Record<AccionVentas, Record<string, string>> = {
  anular: {
    ERP_DATOS_INVALIDOS: "Escribe el motivo de la anulación (hasta 200 caracteres).",
    ERP_EFECTIVO_INSUFICIENTE:
      "La caja de la venta no tiene efectivo suficiente para reponer lo cobrado. Repón efectivo con un ingreso.",
    ERP_ORDEN_ENTREGADA: "La orden ya se entregó: registra una devolución en lugar de anular.",
    ERP_VENTA_CON_DEVOLUCIONES:
      "La venta ya tiene devoluciones y no se puede anular. Devuelve lo que falte.",
  },
  devolver: {
    ERP_DATOS_INVALIDOS:
      "Revisa los datos: hay algo incompleto o inválido (motivo, cantidades o caja elegida).",
    ERP_EFECTIVO_INSUFICIENTE:
      "La caja no tiene efectivo suficiente para esta devolución. Repón efectivo con un ingreso o usa otra caja.",
    ERP_VENTA_ANULADA: "La venta está anulada: no admite devolución.",
    ERP_QR_RECHAZADO: "El pago QR de esta venta fue rechazado: solo se puede devolver lo cobrado.",
  },
  tope: {
    ERP_DATOS_INVALIDOS: "El tope debe ser un porcentaje entre 0 y 100 con hasta 2 decimales",
  },
  datos: {
    ERP_DATOS_INVALIDOS:
      "El NIT admite hasta 20 caracteres en una línea; la nota, hasta 300 caracteres y 6 líneas.",
  },
  revisar: {
    ERP_DATOS_INVALIDOS: "Esta venta no tiene nada que revisar. Recarga la página.",
    ERP_VENTA_ANULADA: "La venta está anulada: ya no hay nada que revisar.",
  },
  qr: {
    ERP_DATOS_INVALIDOS: "Este pago no es un QR. Recarga la página.",
    ERP_VENTA_ANULADA: "La venta está anulada: el cobro ya se revirtió.",
    ERP_OPERACION_REPETIDA: "Este pago ya se resolvió de la otra forma. Recarga la página.",
  },
};

export const mensajeDeVentas = (accion: AccionVentas, codigo: string | null | undefined) =>
  codigo ? (PROPIOS[accion][codigo] ?? COMUNES[codigo]) : undefined;

// Texto crudo de una cantidad a devolver -> cantidad (unidades, no milésimas). null si no es válida, es cero o supera
// lo que queda por devolver (milésimas).
export function cantidadADevolver(
  texto: string,
  unidad: Unidad,
  quedaMilesimas: number,
): number | null {
  const m = parsearCantidad(texto, unidad);
  return m === null || m > quedaMilesimas ? null : m / 1000;
}

// Ventas que el servidor no deja anular ni devolver (ERP_VENTA_DE_RESERVA y ERP_VENTA_CON_CREDITO): el anticipo, la inicial y
// las cuotas ya están repartidos y no hay reverso automático. Si nacieron de una reserva, la reserva manda (misma prioridad
// que en el servidor).
export type VentaEspecial = "credito" | "reserva";
export const ETIQUETA_ESPECIAL: Record<VentaEspecial, string> = {
  credito: "Crédito",
  reserva: "Reserva",
};
export const tipoEspecial = (condicion: string, deReserva: boolean): VentaEspecial | null =>
  deReserva ? "reserva" : condicion === "credito" ? "credito" : null;
export const permiteAnularODevolver = (tipo: VentaEspecial | null) => tipo === null;
export const EXPLICACION_ESPECIAL: Record<VentaEspecial, string> = {
  credito:
    "Esta venta es a crédito: la inicial y las cuotas ya quedaron registradas, por eso el sistema no permite anularla ni devolverla. Los pagos y el saldo se ven en el crédito.",
  reserva:
    "Esta venta completó una reserva: el anticipo ya está en caja, por eso el sistema no permite anularla ni devolverla.",
};
