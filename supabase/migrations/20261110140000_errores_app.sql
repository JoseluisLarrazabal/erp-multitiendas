-- RNF-16: errores inesperados de la web. Sin políticas: nadie la lee ni la escribe desde la web, se consulta desde el panel de Supabase.
create table public.errores_app (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  negocio_id uuid references public.negocios (id),
  usuario_id uuid not null,
  origen text not null check (origen in ('rpc', 'cola', 'accion', 'js')),
  codigo text,
  mensaje text not null,
  contexto jsonb
);
create index errores_app_usuario_fecha_idx on public.errores_app (usuario_id, created_at);
alter table public.errores_app enable row level security;
revoke all on table public.errores_app from public, anon, authenticated;
revoke all on sequence public.errores_app_id_seq from public, anon, authenticated;

-- Nunca lanza por datos de entrada: un registro de errores que falla no sirve.
-- shortcut: sin purga, tope de 60 filas por usuario y hora; purgar si la tabla pasa de ~50.000 filas
create function public.registrar_error(p_origen text, p_codigo text, p_mensaje text, p_contexto jsonb default null, p_negocio_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_mensaje text;
begin
  if v_uid is null or p_origen is null or p_origen not in ('rpc', 'cola', 'accion', 'js') or nullif(btrim(p_mensaje), '') is null then
    return;
  end if;
  -- Serializa por usuario: sin esto, llamadas concurrentes pasan todas el conteo y rebasan el tope.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));
  if (select count(*) from public.errores_app where usuario_id = v_uid and created_at > now() - interval '1 hour') >= 60 then
    return;
  end if;
  -- Saneo, en este orden: corta lo citado tras ':' o ',' (comilla doble o simple: Postgres y JSON.parse), enmascara
  -- correos, teléfonos con separadores y números de 5+ dígitos (carnets), y acota el largo.
  -- Límite: no cubre nombres en texto libre sin comillas ni números cortos.
  v_mensaje := p_mensaje;
  v_mensaje := regexp_replace(v_mensaje, '([:,])\s*["''].*$', '\1 "…"');
  v_mensaje := regexp_replace(v_mensaje, '\S+@\S+', '@', 'g');
  v_mensaje := regexp_replace(v_mensaje, '\d[\d\s.-]{5,}\d', '#', 'g');
  v_mensaje := left(regexp_replace(v_mensaje, '\d{5,}', '#', 'g'), 300);
  insert into public.errores_app (negocio_id, usuario_id, origen, codigo, mensaje, contexto)
  values (
    case when p_negocio_id in (select public.mis_negocios()) then p_negocio_id end,
    v_uid, p_origen, left(p_codigo, 40), v_mensaje,
    case when pg_column_size(p_contexto) > 1024 then null else p_contexto end
  );
end;
$$;

revoke all on function public.registrar_error(text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.registrar_error(text, text, text, jsonb, uuid) to authenticated;
