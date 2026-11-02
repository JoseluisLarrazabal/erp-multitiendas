import {
  brutoLinea,
  listaBaseDe,
  calcularTotales,
  formatearCantidad,
  LISTAS,
  parsearCantidad,
  parsearMonto,
  pisoUnitario,
  textoMonto,
  type EntradaLinea,
  type Lista,
  type ProductoPos,
  type Totales,
  vendible,
} from "./domain";

// El carrito guarda lo que el cajero escribe (texto) y deriva los números en cada render.
export type Linea = {
  id: string;
  producto: ProductoPos;
  lista: Lista;
  cantidadTexto: string;
  precioTexto: string;
  descuentoTexto: string;
  serieId: string | null;
  serieTexto: string | null;
};

export type AccionCarrito =
  | { tipo: "agregar"; producto: ProductoPos; id: string; lista?: Lista }
  // Lavandería: todas las líneas pasan a normal o express, con el precio de esa lista.
  | { tipo: "listaTodas"; lista: Lista }
  | { tipo: "quitar"; id: string }
  | { tipo: "cambiar"; id: string; cambios: Partial<Omit<Linea, "id" | "producto">> }
  | { tipo: "lista"; id: string; lista: Lista }
  | { tipo: "reemplazar"; productos: ReadonlyMap<string, ProductoPos> }
  | { tipo: "vaciar" };

const precioDe = (p: ProductoPos, lista: Lista) => p.precios[lista];

export function nuevaLinea(producto: ProductoPos, id: string, lista: Lista = "contado"): Linea {
  return {
    id,
    producto,
    lista,
    cantidadTexto: "1",
    precioTexto: textoMonto(producto.precios[lista] ?? 0),
    descuentoTexto: "",
    serieId: null,
    serieTexto: null,
  };
}

// Línea que absorbe un producto agregado de nuevo (sin serie, a precio de lista, sin descuento) y su cantidad en milésimas.
export function lineaIgual(
  estado: readonly Linea[],
  producto: ProductoPos,
  lista: Lista = "contado",
) {
  const igual = estado.find(
    (l) =>
      l.producto.id === producto.id &&
      !l.producto.controlaSerie &&
      l.lista === lista &&
      l.descuentoTexto === "" &&
      l.precioTexto === textoMonto(producto.precios[lista] ?? 0),
  );
  const cantidad = igual && parsearCantidad(igual.cantidadTexto, igual.producto.unidad);
  return igual && cantidad ? { linea: igual, cantidad } : null;
}

// Nombres de las líneas que el catálogo nuevo ya no permite vender (salieron del catálogo o perdieron el precio de contado).
export const lineasNoVendibles = (
  estado: readonly Linea[],
  productos: ReadonlyMap<string, ProductoPos>,
) =>
  estado
    .filter((l) => !productoVendible(productos.get(l.producto.id), l.lista))
    .map((l) => l.producto.nombre);

const productoVendible = (p: ProductoPos | undefined, lista: Lista): p is ProductoPos =>
  !!p && vendible(p, listaBaseDe(lista));

export function reducirCarrito(estado: readonly Linea[], accion: AccionCarrito): Linea[] {
  switch (accion.tipo) {
    case "agregar": {
      const lista = accion.lista ?? "contado";
      const igual = lineaIgual(estado, accion.producto, lista);
      if (igual)
        return estado.map((l) =>
          l === igual.linea ? { ...l, cantidadTexto: formatearCantidad(igual.cantidad + 1000) } : l,
        );
      return [...estado, nuevaLinea(accion.producto, accion.id, lista)];
    }
    case "listaTodas":
      return estado.map((l) => ({
        ...l,
        lista: accion.lista,
        precioTexto: textoMonto(precioDe(l.producto, accion.lista) ?? 0),
        descuentoTexto: "",
      }));
    case "quitar":
      return estado.filter((l) => l.id !== accion.id);
    case "cambiar":
      return estado.map((l) => (l.id === accion.id ? { ...l, ...accion.cambios } : l));
    case "lista":
      return estado.map((l) =>
        l.id === accion.id
          ? {
              ...l,
              lista: accion.lista,
              precioTexto: textoMonto(precioDe(l.producto, accion.lista) ?? 0),
              descuentoTexto: "",
            }
          : l,
      );
    // Catálogo recargado: la línea toma el producto nuevo y se quita si ya no se puede vender. Un precio que el
    // cajero editó y un descuento se conservan (resolverLinea los valida con el piso y el tope nuevos); solo cambian
    // el precio sin tocar, que sigue a su lista, y una lista que ya no tiene precio, que vuelve a contado.
    case "reemplazar":
      return estado.flatMap((l) => {
        const producto = accion.productos.get(l.producto.id);
        if (!productoVendible(producto, l.lista)) return [];
        const lista = producto.precios[l.lista] === null ? "contado" : l.lista;
        const sinTocar =
          lista !== l.lista || l.precioTexto === textoMonto(l.producto.precios[l.lista] ?? 0);
        return [
          {
            ...l,
            producto,
            lista,
            precioTexto: sinTocar ? textoMonto(producto.precios[lista] ?? 0) : l.precioTexto,
            descuentoTexto: lista !== l.lista ? "" : l.descuentoTexto,
          },
        ];
      });
    case "vaciar":
      return [];
  }
}

// Nombres de los productos sin precio en `lista`. El cambio de lista de toda la venta reinicia precios y descuentos
// manuales (aceptable: las órdenes van a precio de lista).
export const sinPrecioEn = (lineas: readonly Linea[], lista: Lista): string[] =>
  lineas.filter((l) => precioDe(l.producto, lista) === null).map((l) => l.producto.nombre);

export type LineaResuelta = {
  linea: Linea;
  entrada: EntradaLinea | null;
  precioLista: number;
  error: string | null;
};

export type Permisos = { puedeDescontar: boolean; tope: number };

export function resolverLinea(l: Linea, permisos: Permisos): LineaResuelta {
  const precioLista = precioDe(l.producto, l.lista) ?? 0;
  const base = { linea: l, entrada: null, precioLista };
  const cantidadMilesimas = parsearCantidad(l.cantidadTexto, l.producto.unidad);
  if (cantidadMilesimas === null)
    return {
      ...base,
      error:
        l.producto.unidad === "kg" ? "Cantidad inválida (hasta 3 decimales)" : "Cantidad entera",
    };
  const precio = parsearMonto(l.precioTexto);
  if (precio === null || precio <= 0) return { ...base, error: "Precio inválido" };
  const descuento = l.descuentoTexto.trim() === "" ? 0 : parsearMonto(l.descuentoTexto);
  if (descuento === null) return { ...base, error: "Descuento inválido" };
  const piso = pisoUnitario(precioDe(l.producto, "minimo"), precioLista);
  const entrada = { cantidadMilesimas, precio, descuento, pisoUnitario: piso };
  const puedeBajar = permisos.puedeDescontar && permisos.tope > 0;
  if (precio < piso && !puedeBajar)
    return {
      ...base,
      entrada,
      error: `Bajo el mínimo (${textoMonto(piso)}). Pide a un encargado.`,
    };
  if (descuento > 0 && !puedeBajar)
    return { ...base, entrada, error: "Sin permiso de descuento. Pide a un encargado." };
  if (l.producto.controlaSerie && !l.serieId) return { ...base, entrada, error: "Elige la serie" };
  return { ...base, entrada, error: null };
}

export type ResumenCarrito = {
  lineas: LineaResuelta[];
  totales: Totales | null;
  error: string | null;
};

export function resumirCarrito(
  lineas: readonly Linea[],
  descuentoVentaTexto: string,
  permisos: Permisos,
): ResumenCarrito {
  const resueltas = lineas.map((l) => resolverLinea(l, permisos));
  const descuentoVenta = descuentoVentaTexto.trim() === "" ? 0 : parsearMonto(descuentoVentaTexto);
  const puedeBajar = permisos.puedeDescontar && permisos.tope > 0;
  const primerError = resueltas.find((r) => r.error)?.error ?? null;
  const entradas = resueltas.map((r) => r.entrada);
  if (lineas.length === 0) return { lineas: resueltas, totales: null, error: null };
  if (entradas.some((e) => e === null) || descuentoVenta === null)
    return {
      lineas: resueltas,
      totales: null,
      error: primerError ?? "Descuento de la venta inválido",
    };
  if (descuentoVenta > 0 && !puedeBajar)
    return {
      lineas: resueltas,
      totales: null,
      error: "Sin permiso de descuento. Pide a un encargado.",
    };
  const totales = calcularTotales(entradas as EntradaLinea[], descuentoVenta, permisos.tope);
  let error = primerError;
  if (!error && totales.excedeTope) error = `El descuento supera el tope de ${permisos.tope} %.`;
  if (!error && totales.sumaLineas - descuentoVenta <= 0) error = "El total debe ser mayor a cero.";
  if (
    !error &&
    resueltas.some(
      (r) =>
        r.entrada &&
        brutoLinea(r.entrada.cantidadMilesimas, r.entrada.precio) < r.entrada.descuento,
    )
  )
    error = "El descuento de una línea supera su importe.";
  return { lineas: resueltas, totales, error };
}

export const listasDisponibles = (p: ProductoPos) => LISTAS.filter((l) => p.precios[l] !== null);

// RF-VEN-04: la lavandería no vende a cliente general.
export const exigeCliente = (tipoNegocio: string) => tipoNegocio === "lavanderia";

// Por qué el cobro está bloqueado, para mostrarlo bajo el total. null: nada que decir (carrito vacío o cobrable).
// Un error de línea ya se ve en su fila, así que solo cuenta el de la venta entera.
export function motivoBloqueo(
  resumen: ResumenCarrito,
  o: { cajaAbierta: boolean; clienteObligatorio: boolean; hayCliente: boolean },
): string | null {
  if (resumen.lineas.length === 0) return null;
  if (!o.cajaAbierta) return "Abre la caja para cobrar.";
  const errorDeVenta = resumen.lineas.some((l) => l.error) ? null : resumen.error;
  return (
    errorDeVenta ??
    (o.clienteObligatorio && !o.hayCliente ? "Esta venta necesita un cliente." : null)
  );
}
