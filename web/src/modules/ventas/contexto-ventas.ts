import { z } from "zod";
import { guardarDato, guardarDatoDiferido, leerDato } from "@/lib/offline/datos";
import type { Catalogo } from "./schemas";
import {
  catalogoGuardadoSchema,
  datosNegocioSchema,
  equiposGuardadosSchema,
  type CatalogoGuardado,
} from "./schemas";
import type { DatosNegocio, Equipo } from "./queries";

// Contexto de venta para abrir sin red (docs/plan-fase-3.md). Claves por cuenta y negocio; borrarlo al cerrar sesión es
// cosa de `usuarios`. Nada de costos ni de clientes: catalogo_pos no los trae.
const claveNegocio = (u: string, n: string) => `negocio:${u}:${n}`;
const claveEquipos = (u: string, n: string) => `equipos:${u}:${n}`;
const claveCatalogo = (u: string, n: string, ubicacionId: string) =>
  `catalogo:${u}:${n}:${ubicacionId}`;
const claveVendedor = (u: string) => `vendedor:${u}`;

export const leerNegocioLocal = (u: string, n: string): Promise<DatosNegocio | null> =>
  leerDato(claveNegocio(u, n), datosNegocioSchema);
export const guardarNegocioLocal = (u: string, n: string, d: DatosNegocio) =>
  guardarDato(claveNegocio(u, n), d);

export const leerEquiposLocal = (u: string, n: string): Promise<Equipo[] | null> =>
  leerDato(claveEquipos(u, n), equiposGuardadosSchema);
export const guardarEquiposLocal = (u: string, n: string, e: Equipo[]) =>
  guardarDato(claveEquipos(u, n), e);

export const leerCatalogoLocal = (
  u: string,
  n: string,
  ubicacionId: string,
): Promise<CatalogoGuardado | null> =>
  leerDato(claveCatalogo(u, n, ubicacionId), catalogoGuardadoSchema);

// Diferido: el catálogo pesa ~1 MB y se reescribe tras cada venta (stock); no puede competir con el teclado.
export function guardarCatalogoLocal(
  u: string,
  n: string,
  ubicacionId: string,
  datos: () => {
    catalogo: Catalogo;
    marcas: ReadonlyMap<string, string>;
    guardadoEn: number;
  } | null,
) {
  let desde = 0;
  guardarDatoDiferido(
    claveCatalogo(u, n, ubicacionId),
    () => {
      const d = datos();
      if (!d) return undefined;
      desde = d.guardadoEn;
      const g: CatalogoGuardado = {
        guardadoEn: d.guardadoEn,
        marcas: [...d.marcas],
        catalogo: d.catalogo,
      };
      return g;
    },
    undefined,
    // La edad se guarda después del catálogo: nunca dice que es más nuevo de lo que hay guardado.
    () => guardarCatalogoDesde(u, n, ubicacionId, desde),
  );
}

// Edad del catálogo guardado, aparte del catálogo: la barra de sin conexión la lee sin bajar ~1 MB (p. ej. con la caja
// cerrada, cuando aún no hay venta montada).
const claveDesde = (u: string, n: string, ubicacionId: string) =>
  `catalogo-desde:${u}:${n}:${ubicacionId}`;
export const guardarCatalogoDesde = (u: string, n: string, ubicacionId: string, ms: number) =>
  guardarDato(claveDesde(u, n, ubicacionId), ms);
export const leerCatalogoDesde = (u: string, n: string, ubicacionId: string) =>
  leerDato(claveDesde(u, n, ubicacionId), z.number());

const vendedorSchema = z.string().min(1);
export const leerVendedorLocal = (u: string) => leerDato(claveVendedor(u), vendedorSchema);
export const guardarVendedorLocal = (u: string, nombre: string) =>
  guardarDato(claveVendedor(u), nombre);
