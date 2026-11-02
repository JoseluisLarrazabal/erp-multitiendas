-- Estructura de la lavandería (fase 4): RLS, privilegios, huella oculta, triggers y grants de las RPC. Revisa el catálogo.
begin;
select plan(8);
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('ordenes', 'orden_eventos') and c.relrowsecurity), 2::bigint, 'RLS activo en ordenes y orden_eventos');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('ordenes', 'orden_eventos')
    and (has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('anon', c.oid, 'SELECT'))), 0::bigint, 'authenticated solo lee; anon nada');
select ok(not has_column_privilege('authenticated', 'public.ordenes', 'huella', 'SELECT')
  and has_column_privilege('authenticated', 'public.ordenes', 'estado', 'SELECT')
  and has_column_privilege('authenticated', 'public.ordenes', 'cliente_nombre', 'SELECT'), 'huella sin select; el resto se lee');
select is((select count(*) from pg_trigger where tgrelid = 'public.orden_eventos'::regclass and not tgisinternal), 2::bigint, 'orden_eventos append-only (fila y truncate)');
select is((select count(*) from pg_trigger where tgrelid = 'public.ordenes'::regclass and not tgisinternal), 2::bigint, 'ordenes: inmutabilidad y sin truncate');
select ok(has_function_privilege('authenticated', 'public.crear_orden(jsonb, jsonb, jsonb)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.cambiar_estado_orden(uuid, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.entregar_orden(uuid, text, text, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.anular_orden(uuid, text)', 'EXECUTE'), 'RPC de orden ejecutables');
select ok(not has_function_privilege('anon', 'public.crear_orden(jsonb, jsonb, jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.anular_orden(uuid, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.orden_inmutable()', 'EXECUTE'), 'anon no ejecuta; el trigger no es llamable');
select ok(exists (select 1 from pg_constraint where conname = 'ordenes_entrega_ck')
  and exists (select 1 from pg_constraint where conname = 'ordenes_anulacion_ck'), 'checks de entrega y anulación');
select * from finish();
rollback;
