import { expect, type Page } from "@playwright/test";
import { apiComo, NEGOCIOS } from "./helpers";
import { corrida, ubicaciones } from "./inventario-helpers";

// Datos de las pruebas del POS. Todo por PostgREST con sesiones guardadas (sin logins nuevos, sin service_role):
// el dueño prepara productos, precios y stock; el vendedor opera la caja del equipo C1 (el del seed).
export const tienda = NEGOCIOS.tienda.id;
let contador = 0;

export type ProductoPos = { id: string; codigo: string; nombre: string; barras: string };

const marca = String(Number.parseInt(corrida, 16) % 1e8).padStart(8, "0");

export async function crearProductoConPrecio(opts: {
  contado: number;
  minimo?: number;
  stock?: number;
  garantiaMeses?: number;
  controlaSerie?: boolean;
  unidad?: "unidad" | "kg";
  nombre?: string;
}): Promise<ProductoPos> {
  contador += 1;
  const n = `${corrida}${contador}`;
  const p = {
    codigo: `POS-${n}`,
    nombre: opts.nombre ?? `Producto POS ${n}`,
    barras: `9${marca}${String(contador).padStart(4, "0")}`,
  };
  const r = await apiComo("dueno", "rpc/guardar_producto", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: tienda,
      p_datos: {
        codigo: p.codigo,
        codigo_barras: p.barras,
        nombre: p.nombre,
        tipo: "producto",
        unidad: opts.unidad ?? "unidad",
        garantia_meses: opts.garantiaMeses ?? null,
        controla_serie: opts.controlaSerie ?? false,
      },
    },
  });
  expect(r.status).toBeLessThan(300);
  const id = r.json as string;
  const precios = await apiComo("dueno", "rpc/guardar_precios", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: tienda,
      p_items: [
        {
          producto_id: id,
          moneda: "BOB",
          precios: { contado: opts.contado, minimo: opts.minimo ?? opts.contado },
        },
      ],
    },
  });
  expect(precios.status).toBeLessThan(300);
  if (opts.stock) {
    const u = await ubicaciones();
    const e = await apiComo("dueno", "rpc/registrar_entrada", {
      metodo: "POST",
      cuerpo: {
        p_operacion_id: crypto.randomUUID(),
        p_negocio_id: tienda,
        p_producto_id: id,
        p_ubicacion_id: u.tienda,
        p_cantidad: opts.stock,
        p_costo_unitario: null,
        p_motivo: null,
      },
    });
    expect(e.status).toBeLessThan(300);
  }
  return { id, ...p };
}

export async function equipoC1() {
  const r = await apiComo(
    "vendedor",
    `dispositivos?select=id,prefijo,ultimo_numero&negocio_id=eq.${tienda}&prefijo=eq.C1`,
  );
  const fila = (r.json as { id: string; prefijo: string; ultimo_numero: number }[])[0];
  if (!fila) throw new Error("El seed no tiene el equipo C1.");
  return fila;
}

export async function sesionAbierta(dispositivoId: string) {
  const r = await apiComo("vendedor", "rpc/caja_sesion_abierta", {
    metodo: "POST",
    cuerpo: { p_dispositivo_id: dispositivoId },
  });
  return (r.json as { id: string }[])[0]?.id ?? null;
}

export async function cerrarCaja(dispositivoId: string) {
  const id = await sesionAbierta(dispositivoId);
  if (!id) return;
  const r = await apiComo("vendedor", "rpc/cerrar_caja", {
    metodo: "POST",
    cuerpo: { p_sesion_id: id, p_monto_contado: 0 },
  });
  expect(r.status).toBeLessThan(300);
}

export async function abrirCajaApi(dispositivoId: string) {
  const r = await apiComo("vendedor", "rpc/abrir_caja", {
    metodo: "POST",
    cuerpo: {
      p_id: crypto.randomUUID(),
      p_negocio_id: tienda,
      p_dispositivo_id: dispositivoId,
      p_monto_inicial: 100,
    },
  });
  expect(r.status).toBeLessThan(300);
}

// El navegador sabe de su equipo por localStorage: se fija antes de cargar para no depender de cuántos equipos haya.
export async function fijarEquipo(page: Page, dispositivoId: string) {
  await page.addInitScript(
    ([clave, id]) => localStorage.setItem(clave!, id!),
    [`erp:pos:equipo:${tienda}`, dispositivoId],
  );
}

export async function stockEn(productoId: string): Promise<number> {
  const u = await ubicaciones();
  const r = await apiComo(
    "dueno",
    `stock?select=cantidad&producto_id=eq.${productoId}&ubicacion_id=eq.${u.tienda}`,
  );
  return Number((r.json as { cantidad: number }[])[0]?.cantidad ?? 0);
}

// Carga series disponibles en la tienda (el stock debe cubrirlas: `crearProductoConPrecio` con `stock`).
export async function registrarSeries(productoId: string, series: string[]) {
  const u = await ubicaciones();
  const r = await apiComo("dueno", "rpc/registrar_series", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: tienda,
      p_producto_id: productoId,
      p_ubicacion_id: u.tienda,
      p_series: series,
    },
  });
  expect(r.status).toBeLessThan(300);
}

export async function estadoDeSerie(productoId: string, serie: string): Promise<string | null> {
  const r = await apiComo(
    "dueno",
    `series?select=estado&producto_id=eq.${productoId}&serie=eq.${encodeURIComponent(serie)}`,
  );
  return (r.json as { estado: string }[])[0]?.estado ?? null;
}

// Ventas de la sesión de caja abierta, con lo que importa para comprobar.
export async function ventasDeLaCaja(dispositivoId: string) {
  const cajaId = await sesionAbierta(dispositivoId);
  const r = await apiComo(
    "vendedor",
    `ventas?select=id,numero,total,estado,cliente_id,origen&caja_sesion_id=eq.${cajaId}`,
  );
  return r.json as {
    id: string;
    numero: string;
    total: number;
    estado: string;
    cliente_id: string | null;
    origen: string;
  }[];
}

// Libera el documento de un cliente de prueba (los clientes no se borran): sin él, volver a correr no choca.
export async function liberarCliente(clienteId: string) {
  await apiComo("dueno", "rpc/guardar_cliente", {
    metodo: "POST",
    cuerpo: {
      p_negocio_id: tienda,
      p_datos: { id: clienteId, nombre: "Cliente de prueba (liberado)", ci_nit: null },
    },
  });
}

// Venta por RPC con la sesión del vendedor (la prueba mira el panel, no el POS). Número: el siguiente al contador del
// servidor. Devuelve id y número.
export async function venderApi(opts: {
  equipoId: string;
  cajaId: string;
  items: { producto: ProductoPos; cantidad: number; precio: number }[];
  efectivo: number;
  qr?: number;
}) {
  const equipo = await equipoC1();
  const id = crypto.randomUUID();
  const numero = `C1-${String(equipo.ultimo_numero + 1).padStart(6, "0")}`;
  const total = opts.items.reduce((t, i) => t + i.cantidad * i.precio, 0);
  const pagos: { medio: string; monto: number; verificado?: boolean }[] = [];
  if (opts.efectivo > 0) pagos.push({ medio: "efectivo", monto: opts.efectivo });
  if (opts.qr) pagos.push({ medio: "qr", monto: opts.qr, verificado: true });
  const r = await apiComo("vendedor", "rpc/registrar_venta", {
    metodo: "POST",
    cuerpo: {
      p_venta: {
        id,
        dispositivo_id: opts.equipoId,
        caja_sesion_id: opts.cajaId,
        numero,
        creada_en_cliente: new Date().toISOString(),
        descuento: 0,
        total,
        items: opts.items.map((i) => ({
          producto_id: i.producto.id,
          lista: "contado",
          cantidad: i.cantidad,
          precio_unitario: i.precio,
          descuento: 0,
        })),
        pagos,
      },
    },
  });
  expect(r.status).toBeLessThan(300);
  return { id, numero };
}
