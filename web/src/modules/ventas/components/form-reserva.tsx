"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNativo } from "@/components/ui/select-nativo";
import { MENSAJE_RED } from "@/lib/erp-errores";
import { createClient } from "@/lib/supabase/browser";
import { SelectorCliente, type ClienteElegido } from "@/modules/clientes";
import { buscar, textoMonto, type Indice, type ProductoPos } from "../domain";
import { crearReserva } from "../queries-reservas";
import { armarReserva, sePuedeReservar, type MedioReserva } from "../reservas";

// Alta de una reserva (RF-RES-01): cliente, producto del catálogo, cantidad, precio acordado y anticipo por caja.
// El id se fija al abrir el formulario y se conserva en los reintentos (idempotencia); cambia solo tras el éxito.
export function FormReserva({
  negocioId,
  cajaId,
  indice,
  alCrear,
}: {
  negocioId: string;
  cajaId: string | null;
  indice: Indice | null;
  alCrear: () => void;
}) {
  const id = useRef(crypto.randomUUID());
  const [cliente, setCliente] = useState<ClienteElegido | null>(null);
  const [producto, setProducto] = useState<ProductoPos | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cantidadTexto, setCantidadTexto] = useState("1");
  const [precioTexto, setPrecioTexto] = useState("");
  const [anticipoTexto, setAnticipoTexto] = useState("");
  const [medio, setMedio] = useState<MedioReserva>("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const resultados = indice && !producto ? buscar(indice, busqueda, 6).filter(sePuedeReservar) : [];

  function elegir(p: ProductoPos) {
    setProducto(p);
    setPrecioTexto(textoMonto(p.precios.contado ?? 0));
    setBusqueda("");
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (pendiente) return;
    const r = armarReserva(
      {
        clienteId: cliente?.id ?? null,
        producto,
        cantidadTexto,
        precioTexto,
        anticipoTexto,
        medio,
      },
      id.current,
      cajaId,
    );
    if (!r.ok) return setError(r.error);
    setPendiente(true);
    setError(null);
    try {
      const res = await crearReserva(createClient(), r.payload);
      if (!res.ok) return setError(res.error);
      id.current = crypto.randomUUID();
      setCliente(null);
      setProducto(null);
      setCantidadTexto("1");
      setPrecioTexto("");
      setAnticipoTexto("");
      alCrear();
    } catch {
      setError(MENSAJE_RED);
    } finally {
      setPendiente(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void enviar(e)}
      noValidate
      aria-label="Nueva reserva"
      className="bg-card grid gap-3 rounded-xl border p-3 sm:grid-cols-2"
    >
      <h3 className="text-sm font-semibold sm:col-span-2">Nueva reserva</h3>
      <div className="sm:col-span-2">
        <SelectorCliente negocioId={negocioId} obligatorio valor={cliente} alCambiar={setCliente} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="reserva-producto">Producto</Label>
        {producto ? (
          <p className="flex items-center gap-2 text-sm">
            <span className="font-medium">{producto.nombre}</span>
            <Button type="button" variant="ghost" className="h-9" onClick={() => setProducto(null)}>
              Cambiar
            </Button>
          </p>
        ) : (
          <>
            <Input
              id="reserva-producto"
              type="search"
              autoComplete="off"
              placeholder="Código o nombre"
              className="h-10"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <ul aria-label="Productos" className="divide-y rounded-lg border empty:hidden">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="hover:bg-muted min-h-10 w-full px-3 py-1.5 text-left text-sm"
                    onClick={() => elegir(p)}
                  >
                    {p.nombre} <span className="text-muted-foreground">({p.codigo})</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <Numero
        id="reserva-cantidad"
        etiqueta="Cantidad"
        valor={cantidadTexto}
        alCambiar={setCantidadTexto}
      />
      <Numero
        id="reserva-precio"
        etiqueta="Precio acordado (Bs)"
        valor={precioTexto}
        alCambiar={setPrecioTexto}
      />
      <Numero
        id="reserva-anticipo"
        etiqueta="Anticipo (Bs)"
        valor={anticipoTexto}
        alCambiar={setAnticipoTexto}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reserva-medio">Anticipo recibido por</Label>
        <SelectNativo
          id="reserva-medio"
          value={medio}
          onChange={(e) => setMedio(e.target.value as MedioReserva)}
        >
          <option value="efectivo">Efectivo</option>
          <option value="qr">QR</option>
        </SelectNativo>
      </div>
      <p role="alert" className="text-destructive text-sm empty:hidden sm:col-span-2">
        {error}
      </p>
      <Button type="submit" className="h-11 sm:col-span-2" aria-disabled={pendiente}>
        {pendiente && <Loader2 className="animate-spin" aria-hidden />} Reservar y cobrar anticipo
      </Button>
    </form>
  );
}

function Numero({
  id,
  etiqueta,
  valor,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="h-10 text-right tabular-nums"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
      />
    </div>
  );
}
