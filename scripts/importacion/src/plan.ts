import { z } from "zod";
import type { FilaCruda } from "./leer.ts";
import {
  categoriasParecidas,
  claveCategoria,
  claveDuplicado,
  esFilaEjemplo,
  esFilaSuelta,
  limpiarCodigo,
  limpiarMarcaModelo,
  limpiarTexto,
  normalizarBarras,
  normalizarUbicacion,
  parsearStock,
  type Ubicacion,
} from "./reglas.ts";

export const ProductoSchema = z.object({
  fila: z.number().int().positive(),
  codigo: z.string().min(1),
  barras: z.string().min(1).nullable(),
  nombre: z.string().min(1),
  marca: z.string(),
  modelo: z.string(),
  categoria: z.string().min(1).nullable(),
  ubicacion: z.enum(["Tienda", "Depósito"]),
  stock: z.number().nonnegative(),
});
export type Producto = z.infer<typeof ProductoSchema>;

export type Evento = { fila: number; regla: string };

export type Plan = {
  /** Filas con algún valor debajo del encabezado. */
  filasDeDatos: number;
  excluidas: Evento[];
  rechazadas: Evento[];
  aceptadas: Producto[];
  corregidas: Evento[];
  avisos: Evento[];
  /** Solo las categorías usadas, con la grafía de su primera aparición. */
  categorias: string[];
  categoriasParecidas: [string, string][];
  /** Grupos de filas con igual nombre, marca y modelo. */
  posiblesDuplicados: number[][];
  stock: {
    /** Suma de lo legible en todas las filas de datos no excluidas. */
    fuente: number;
    aceptado: number;
    rechazado: number;
    /** Filas rechazadas cuyo stock no se pudo leer: no suman a `fuente`. */
    ilegible: number;
    porUbicacion: Record<Ubicacion, number>;
    /** Unidades sin ubicación o con una desconocida, asignadas a Tienda. */
    porDefecto: number;
  };
};

type Candidato = {
  producto: Producto;
  correcciones: string[];
  avisos: string[];
  porDefecto: boolean;
};

export function construirPlan(filas: FilaCruda[]): Plan {
  const plan: Plan = {
    filasDeDatos: filas.length,
    excluidas: [],
    rechazadas: [],
    aceptadas: [],
    corregidas: [],
    avisos: [],
    categorias: [],
    categoriasParecidas: [],
    posiblesDuplicados: [],
    stock: {
      fuente: 0,
      aceptado: 0,
      rechazado: 0,
      ilegible: 0,
      porUbicacion: { Tienda: 0, Depósito: 0 },
      porDefecto: 0,
    },
  };
  const candidatos: Candidato[] = [];
  const stockLegible = new Map<number, number>();

  for (const { fila, celdas, valores } of filas) {
    if (esFilaEjemplo(fila)) {
      plan.excluidas.push({ fila, regla: "ejemplo" });
      continue;
    }
    if (esFilaSuelta(valores)) {
      plan.excluidas.push({ fila, regla: "fila_suelta" });
      continue;
    }
    const rechazar = (regla: string) => plan.rechazadas.push({ fila, regla });

    const stock = parsearStock(celdas.stock.texto);
    // Un decimal rechazado igual suma a la fuente: el número se lee, solo no vale para una unidad.
    if (stock.ok) stockLegible.set(fila, stock.valor);
    else if (stock.motivo === "stock_decimal")
      stockLegible.set(fila, Number(celdas.stock.texto.trim().replace(",", ".")));
    else plan.stock.ilegible++;

    const correcciones: string[] = [];
    const avisos: string[] = [];
    const texto = (crudo: string) => {
      const limpio = limpiarTexto(crudo);
      if (limpio !== crudo) correcciones.push("espacios");
      return limpio;
    };

    const codigo = limpiarCodigo(celdas.codigo);
    const nombre = texto(celdas.nombre.texto);
    if (codigo === "") {
      rechazar("sin_codigo");
      continue;
    }
    if (nombre === "") {
      rechazar("sin_nombre");
      continue;
    }
    if (!stock.ok) {
      rechazar(stock.motivo);
      continue;
    }

    const marca = limpiarMarcaModelo(celdas.marca.texto);
    const modeloLimpio = limpiarMarcaModelo(celdas.modelo.texto);
    texto(celdas.marca.texto);
    texto(celdas.modelo.texto);
    for (const crudo of [celdas.marca.texto, celdas.modelo.texto]) {
      if (limpiarTexto(crudo) === "--") correcciones.push("marca_modelo_vacio");
    }
    const barras = normalizarBarras(celdas.barras, modeloLimpio);
    correcciones.push(...barras.correcciones);
    avisos.push(...barras.avisos);
    const categoriaTexto = texto(celdas.categoria.texto);
    const ubicacion = normalizarUbicacion(celdas.ubicacion.texto);
    if (ubicacion.aviso) avisos.push(ubicacion.aviso);

    const producto = ProductoSchema.safeParse({
      fila,
      codigo,
      barras: barras.barras,
      nombre,
      marca,
      modelo: barras.modelo,
      categoria: categoriaTexto === "" ? null : categoriaTexto,
      ubicacion: ubicacion.ubicacion,
      stock: stock.valor,
    });
    if (!producto.success) {
      rechazar("esquema_invalido");
      continue;
    }
    candidatos.push({
      producto: producto.data,
      correcciones,
      avisos,
      porDefecto: Boolean(ubicacion.aviso),
    });
  }

  // Código interno repetido: la primera fila gana, las demás se rechazan.
  const codigos = new Set<string>();
  const barrasVistas = new Set<string>();
  for (const c of candidatos) {
    const { fila, codigo } = c.producto;
    if (codigos.has(codigo)) {
      plan.rechazadas.push({ fila, regla: "codigo_repetido" });
      continue;
    }
    codigos.add(codigo);
    // Barras repetido: conserva la primera fila, deja vacío en las demás hasta que el cliente decida.
    if (c.producto.barras !== null) {
      if (barrasVistas.has(c.producto.barras)) {
        c.producto.barras = null;
        c.avisos.push("barras_repetida");
      } else barrasVistas.add(c.producto.barras);
    }
    plan.aceptadas.push(c.producto);
    plan.corregidas.push(...c.correcciones.map((regla) => ({ fila, regla })));
    plan.avisos.push(...c.avisos.map((regla) => ({ fila, regla })));
    if (c.porDefecto) plan.stock.porDefecto += c.producto.stock;
  }

  // Stock: de la fuente, de lo aceptado y de lo rechazado.
  const aceptadas = new Set(plan.aceptadas.map((p) => p.fila));
  for (const [fila, valor] of stockLegible) {
    plan.stock.fuente += valor;
    if (!aceptadas.has(fila)) plan.stock.rechazado += valor;
  }
  for (const p of plan.aceptadas) {
    plan.stock.aceptado += p.stock;
    plan.stock.porUbicacion[p.ubicacion] += p.stock;
  }

  // Categorías usadas, unidas sin distinguir mayúsculas.
  const categorias = new Map<string, string>();
  for (const p of plan.aceptadas) {
    if (p.categoria !== null && !categorias.has(claveCategoria(p.categoria))) {
      categorias.set(claveCategoria(p.categoria), p.categoria);
    }
  }
  plan.categorias = [...categorias.values()];
  plan.categoriasParecidas = categoriasParecidas(plan.categorias);

  const grupos = new Map<string, number[]>();
  for (const p of plan.aceptadas) {
    const clave = claveDuplicado(p.nombre, p.marca, p.modelo);
    grupos.set(clave, [...(grupos.get(clave) ?? []), p.fila]);
  }
  plan.posiblesDuplicados = [...grupos.values()].filter((g) => g.length > 1);
  return plan;
}
