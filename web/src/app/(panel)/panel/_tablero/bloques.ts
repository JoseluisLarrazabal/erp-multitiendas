// Qué ve cada rol en el tablero. Ocultar es comodidad: cada lectura y cada módulo vuelven a exigir el permiso en el servidor.
export type Bloques = ReturnType<typeof bloquesTablero>;

export function bloquesTablero(permisos: readonly string[], tipo: string) {
  const tiene = (...p: string[]) => p.some((x) => permisos.includes(x));
  const reportes = tiene("ver_reportes");
  const conCredito = tipo !== "lavanderia";
  const inventario = tiene("ajustar_inventario", "ver_reportes");
  const cuotas = conCredito && tiene("gestionar_credito", "ver_reportes");
  const reservas = conCredito && tiene("gestionar_reservas");
  const porPagar = tiene("gestionar_compras");
  return {
    acciones: {
      pos: tiene("vender"),
      compra: tiene("gestionar_compras"),
      entrada: tiene("ajustar_inventario"),
      reportes,
    },
    ventas: reportes,
    utilidad: reportes && tiene("ver_costos"),
    cajas: reportes,
    porRevisar: reportes,
    stockBajo: inventario,
    lotes: tipo === "frial" && inventario,
    cuotas,
    reservas,
    porPagar,
    creditos: cuotas || reservas || porPagar,
    masVendidos: conCredito && reportes,
    ordenes: tipo === "lavanderia" && tiene("ver_reportes", "cambiar_estado_orden"),
  };
}
