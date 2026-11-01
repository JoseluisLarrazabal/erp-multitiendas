-- Clientes (RF-CLI-01, RF-CLI-02). Por negocio: no se comparten. Solo lectura por la API; guardar_cliente escribe.
-- ci_nit se guarda normalizado (sin espacios, mayúsculas) para que la unicidad no dependa del formato tipeado.
-- Errores: ERP_SIN_PERMISO, ERP_DATOS_INVALIDOS, ERP_CLIENTE_DUPLICADO. Ningún mensaje lleva datos personales.
-- No se audita (auditar_cambio): copiaría nombre, documento y teléfono a una tabla append-only que no se puede
-- depurar si el cliente pide borrar sus datos. updated_at deja la huella mínima del cambio.

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id),
  nombre text not null check (btrim(nombre) <> ''),
  ci_nit text check (ci_nit = upper(regexp_replace(ci_nit, '\s', '', 'g')) and ci_nit <> ''),
  telefono text,
  direccion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (negocio_id, id)
);
create unique index clientes_documento_uq on public.clientes (negocio_id, ci_nit) where ci_nit is not null;
-- shortcut: búsqueda sin índice (seq scan por negocio); pg_trgm si un negocio pasa de ~10k clientes.

create trigger clientes_updated_at
  before update on public.clientes
  for each row execute function public.tocar_updated_at();

alter table public.clientes enable row level security;
create policy clientes_select on public.clientes
  for select to authenticated
  using (negocio_id in (select public.mis_negocios()));
revoke all on public.clientes from anon, authenticated, public;
grant select on public.clientes to authenticated;

-- Sin id crea (permiso vender o editar_productos); con id edita y reemplaza los cuatro campos (editar_productos).
-- p_datos: nombre (obligatorio), ci_nit, telefono, direccion. Devuelve el id.
create function public.guardar_cliente(p_negocio_id uuid, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_nombre text;
  v_doc text;
  v_tel text;
  v_dir text;
  k text;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;
  -- Textos o null; id solo uuid. Cualquier otra clave se rechaza para no ignorar datos en silencio.
  for k in select jsonb_object_keys(p_datos) loop
    if k not in ('id', 'nombre', 'ci_nit', 'telefono', 'direccion')
       or (k <> 'id' and jsonb_typeof(p_datos -> k) not in ('string', 'null')) then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end loop;
  begin
    v_id := nullif(p_datos ->> 'id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'ERP_DATOS_INVALIDOS';
  end;

  if v_id is null then
    if not (public.tiene_permiso(p_negocio_id, 'vender') or public.tiene_permiso(p_negocio_id, 'editar_productos')) then
      raise exception 'ERP_SIN_PERMISO';
    end if;
  elsif not public.tiene_permiso(p_negocio_id, 'editar_productos') then
    raise exception 'ERP_SIN_PERMISO';
  end if;

  v_nombre := btrim(p_datos ->> 'nombre');
  v_doc := nullif(upper(regexp_replace(coalesce(p_datos ->> 'ci_nit', ''), '\s', '', 'g')), '');
  v_tel := nullif(btrim(p_datos ->> 'telefono'), '');
  v_dir := nullif(btrim(p_datos ->> 'direccion'), '');
  if v_nombre is null or v_nombre = '' or length(v_nombre) > 200
     or length(v_doc) > 30 or length(v_tel) > 30 or length(v_dir) > 300 then
    raise exception 'ERP_DATOS_INVALIDOS';
  end if;

  if v_id is null then
    insert into public.clientes (negocio_id, nombre, ci_nit, telefono, direccion)
    values (p_negocio_id, v_nombre, v_doc, v_tel, v_dir)
    returning id into v_id;
  else
    update public.clientes set nombre = v_nombre, ci_nit = v_doc, telefono = v_tel, direccion = v_dir
    where id = v_id and negocio_id = p_negocio_id;
    if not found then
      raise exception 'ERP_DATOS_INVALIDOS';
    end if;
  end if;
  return v_id;
exception
  -- Se relanza sin el DETAIL del índice, que trae el documento.
  when unique_violation then
    raise exception 'ERP_CLIENTE_DUPLICADO';
end;
$$;

revoke all on function public.guardar_cliente(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_cliente(uuid, jsonb) to authenticated;
