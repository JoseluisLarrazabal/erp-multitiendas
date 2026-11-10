"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Campo } from "@/components/panel/campo";
import { ERROR_CONEXION } from "@/lib/supabase/errores";
import { buscarProductosAccion } from "../actions";
import type { ProductoElegible } from "../domain";

type Props = {
  negocioId: string;
  id: string;
  valor: ProductoElegible | null;
  alElegir: (producto: ProductoElegible | null) => void;
  // Id del control que recibe el foco al elegir (la cantidad): el lector USB escanea, Enter y sigue tecleando.
  idSiguiente: string;
  error?: string;
  // Etiqueta del campo (el consumo de insumos lo llama "Insumo").
  etiqueta?: string;
};

const DEMORA_MS = 250;

// Combobox de producto por código, código de barras o texto. Enter elige el producto exacto del escaneo.
export function SelectorProducto({
  negocioId,
  id,
  valor,
  alElegir,
  idSiguiente,
  error,
  etiqueta = "Producto",
}: Props) {
  const lista = useId();
  const campo = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  const consulta = useRef(0);
  const huboValor = useRef(false);
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState<ProductoElegible[]>([]);
  const [activo, setActivo] = useState(-1);
  const [abierto, setAbierto] = useState(false);
  const [falla, setFalla] = useState<string | null>(null);

  // Escanear sin clic previo (RF-CAT-03), solo con puntero fino: en un móvil el foco automático abre el teclado.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) campo.current?.focus();
    return () => clearTimeout(temporizador.current);
  }, []);
  // Tras "Cambiar" o tras registrar (hubo producto y ya no), el foco vuelve al campo de búsqueda.
  useEffect(() => {
    if (valor !== null) huboValor.current = true;
    else if (huboValor.current) {
      huboValor.current = false;
      campo.current?.focus();
    }
  }, [valor]);

  async function buscar(q: string): Promise<ProductoElegible[]> {
    const turno = ++consulta.current;
    try {
      const r = await buscarProductosAccion({ negocioId, q });
      if (turno !== consulta.current) return [];
      setFalla(r.ok ? null : r.error);
      const filas = r.ok ? r.data : [];
      setOpciones(filas);
      setActivo(-1);
      setAbierto(true);
      return filas;
    } catch {
      setFalla(ERROR_CONEXION);
      return [];
    }
  }

  function elegir(p: ProductoElegible) {
    clearTimeout(temporizador.current);
    consulta.current++;
    setTexto("");
    setOpciones([]);
    setAbierto(false);
    alElegir(p);
    document.getElementById(idSiguiente)?.focus();
  }

  function alEscribir(q: string) {
    setTexto(q);
    clearTimeout(temporizador.current);
    if (!q.trim()) {
      consulta.current++;
      setOpciones([]);
      return setAbierto(false);
    }
    temporizador.current = setTimeout(() => void buscar(q), DEMORA_MS);
  }

  async function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (opciones.length === 0) return;
      setAbierto(true);
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setActivo((a) => (a + paso + opciones.length) % opciones.length);
    } else if (e.key === "Escape") {
      setAbierto(false);
    } else if (e.key === "Enter") {
      // Nunca envía el formulario desde aquí.
      e.preventDefault();
      const elegida = abierto ? opciones[activo] : undefined;
      if (elegida) return elegir(elegida);
      const q = texto.trim();
      if (!q) return;
      clearTimeout(temporizador.current);
      const filas = await buscar(q);
      const minuscula = q.toLowerCase();
      const exactas = filas.filter(
        (p) => p.codigo.toLowerCase() === minuscula || p.codigoBarras === q,
      );
      // Con varias coincidencias exactas no elige: deja la lista abierta.
      const unica = exactas.length === 1 ? exactas[0] : filas.length === 1 ? filas[0] : undefined;
      if (unica && exactas.length < 2) elegir(unica);
    }
  }

  return (
    <Campo
      id={id}
      etiqueta={etiqueta}
      error={error}
      ayuda={valor ? undefined : "Escribe o escanea el código."}
    >
      {valor ? (
        <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border px-3 py-1.5">
          <p id={id} tabIndex={-1} className="min-w-0 text-sm">
            <span className="text-muted-foreground font-mono text-xs">{valor.codigo}</span>{" "}
            <span className="font-semibold">{valor.nombre}</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 shrink-0"
            onClick={() => alElegir(null)}
          >
            <X aria-hidden /> Cambiar
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            ref={campo}
            id={id}
            role="combobox"
            aria-expanded={abierto && opciones.length > 0}
            aria-controls={lista}
            aria-autocomplete="list"
            aria-activedescendant={activo >= 0 ? `${lista}-${activo}` : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : `${id}-ayuda`}
            autoComplete="off"
            value={texto}
            onChange={(e) => alEscribir(e.target.value)}
            onKeyDown={alTeclear}
            onBlur={() => setAbierto(false)}
            placeholder="Código, código de barras o nombre"
            className="h-10"
          />
          <ul
            id={lista}
            role="listbox"
            aria-label="Productos"
            hidden={!abierto || opciones.length === 0}
            className="bg-popover absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border p-1 shadow-md"
          >
            {opciones.map((p, i) => (
              <li
                key={p.id}
                id={`${lista}-${i}`}
                role="option"
                aria-selected={i === activo}
                // mousedown antes del blur del campo: si no, la lista se cierra y el clic se pierde.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(p)}
                className="aria-selected:bg-muted hover:bg-muted flex min-h-11 cursor-pointer flex-col justify-center rounded-md px-2.5 py-1 text-sm"
              >
                <span className="font-medium">{p.nombre}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {p.codigo}
                  {p.codigoBarras ? ` · ${p.codigoBarras}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p role="status" className="sr-only">
            {abierto && texto.trim() ? `${opciones.length} productos encontrados` : ""}
          </p>
          {abierto && texto.trim() && opciones.length === 0 && !falla && (
            <p className="text-muted-foreground mt-1 text-xs">Ningún producto coincide.</p>
          )}
          {falla && (
            <p role="alert" className="text-destructive mt-1 text-xs">
              {falla}
            </p>
          )}
        </div>
      )}
    </Campo>
  );
}
