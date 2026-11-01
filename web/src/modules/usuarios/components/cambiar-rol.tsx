"use client";

import { useState } from "react";
import { SelectNativo } from "@/components/ui/select-nativo";
import { asignarUsuario } from "../actions";
import { etiquetaRol, type FilaUsuario } from "../domain";
import { ConfirmarAccion } from "@/components/panel/confirmar-accion";

type Props = {
  fila: FilaUsuario;
  negocioId: string;
  negocioNombre: string;
  roles: readonly string[];
};

// El select solo propone: el cambio se aplica al confirmar, así una flecha del teclado nunca dispara una petición.
// Cancelar o Esc devuelven el select al rol vigente; tras aplicar se queda en el nuevo.
// El padre le pone `key={fila.rol}`: al llegar el rol nuevo desde el servidor el estado se reinicia.
export function CambiarRol({ fila, negocioId, negocioNombre, roles }: Props) {
  const [propuesto, setPropuesto] = useState(fila.rol);
  const [abierto, setAbierto] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const { usuarioId, nombre } = fila;

  return (
    <>
      <SelectNativo
        aria-label={`Rol de ${nombre}`}
        value={abierto || aplicado ? propuesto : fila.rol}
        className="h-9 w-auto min-w-32 md:h-8"
        onChange={(e) => {
          setPropuesto(e.target.value);
          setAbierto(true);
        }}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {etiquetaRol(r)}
          </option>
        ))}
      </SelectNativo>
      <ConfirmarAccion
        destructiva={false}
        abierto={abierto}
        alCambiarAbierto={setAbierto}
        titulo={`¿Cambiar a ${nombre} de ${etiquetaRol(fila.rol)} a ${etiquetaRol(propuesto)}?`}
        descripcion={`${nombre} pierde los permisos de ${etiquetaRol(fila.rol)} y gana los de ${etiquetaRol(propuesto)} en ${negocioNombre}, de inmediato.`}
        confirmar="Cambiar rol"
        accion={async () => {
          const r = await asignarUsuario({ negocioId, usuarioId, rol: propuesto });
          if (r.ok) setAplicado(true);
          return r;
        }}
      />
    </>
  );
}
