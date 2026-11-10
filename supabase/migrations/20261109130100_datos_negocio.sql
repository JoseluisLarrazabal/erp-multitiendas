-- Datos del negocio que salen impresos en la nota de venta y en la boleta (NIT y texto libre: dirección, teléfono).
-- Exige `usuarios`. Vacío guarda null. Audita solo si algo cambió.
create function public.guardar_datos_negocio(p_negocio_id uuid, p_nit text, p_datos_nota text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nit text := nullif(btrim(p_nit, E' \t\r\n'), '');
  v_nota text := nullif(btrim(replace(p_datos_nota, E'\r\n', E'\n'), E' \t\r\n'), '');
  v_antes_nit text;
  v_antes_nota text;
begin
  if not public.tiene_permiso(p_negocio_id, 'usuarios') then
    raise exception 'ERP_SIN_PERMISO';
  end if;
  if char_length(v_nit) > 20 or v_nit ~ '[\r\n]'
    or char_length(v_nota) > 300 or char_length(v_nota) - char_length(replace(v_nota, E'\n', '')) + 1 > 6 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  select nit, datos_nota into v_antes_nit, v_antes_nota from public.negocios where id = p_negocio_id for update;
  if found and (v_antes_nit is distinct from v_nit or v_antes_nota is distinct from v_nota) then
    insert into public.auditoria (tabla, registro_id, negocio_id, accion, antes, despues, usuario_id)
    values ('negocios', p_negocio_id::text, p_negocio_id, 'update',
      jsonb_build_object('nit', v_antes_nit, 'datos_nota', v_antes_nota),
      jsonb_build_object('nit', v_nit, 'datos_nota', v_nota), (select auth.uid()));
    update public.negocios set nit = v_nit, datos_nota = v_nota where id = p_negocio_id;
  end if;
end;
$$;

revoke all on function public.guardar_datos_negocio(uuid, text, text) from public, anon, authenticated;
grant execute on function public.guardar_datos_negocio(uuid, text, text) to authenticated;
