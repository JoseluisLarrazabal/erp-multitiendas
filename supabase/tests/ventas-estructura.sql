-- Estructura de ventas: RLS, privilegios, triggers y columna de costo oculta. Revisa el catálogo, no datos.
begin;
select plan(13);
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('ventas', 'venta_items', 'venta_pagos', 'devoluciones', 'devolucion_items') and c.relrowsecurity), 5::bigint, 'RLS activo en las 5 tablas');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('ventas', 'venta_items', 'venta_pagos', 'devoluciones', 'devolucion_items')
    and (has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE') or has_table_privilege('anon', c.oid, 'SELECT'))), 0::bigint, 'authenticated solo lee; anon nada');
select ok(not has_column_privilege('authenticated', 'public.venta_items', 'costo_unitario', 'SELECT'), 'venta_items.costo_unitario sin select');
select ok(has_column_privilege('authenticated', 'public.venta_items', 'precio_unitario', 'SELECT'), 'el resto de venta_items se lee');
select ok(not has_column_privilege('authenticated', 'public.ventas', 'huella', 'SELECT')
  and not has_column_privilege('authenticated', 'public.devoluciones', 'huella', 'SELECT')
  and has_column_privilege('authenticated', 'public.ventas', 'total', 'SELECT'), 'huella sin select; el resto de ventas se lee');
select ok(has_function_privilege('authenticated', 'public.registrar_venta(jsonb, jsonb)', 'EXECUTE'), 'registrar_venta ejecutable');
select ok(not has_function_privilege('authenticated', 'public.payload_claves(jsonb, text[])', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.bloquear_stock(uuid, uuid, uuid[])', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.total_qr_sesion(uuid)', 'EXECUTE'), 'helpers privados');
select is((select count(*) from pg_trigger where tgrelid in ('public.ventas'::regclass, 'public.venta_items'::regclass,
  'public.venta_pagos'::regclass, 'public.devoluciones'::regclass, 'public.devolucion_items'::regclass) and not tgisinternal), 10::bigint, 'triggers de inmutabilidad (2 por tabla)');
select ok(exists (select 1 from pg_constraint where conname = 'ventas_numero_uq'), 'unique (negocio_id, numero)');
select col_default_is('public', 'dispositivos', 'ultimo_numero', '0', 'dispositivos.ultimo_numero default 0');
select ok(has_column_privilege('authenticated', 'public.ventas', 'motivos_revision', 'SELECT')
  and has_column_privilege('authenticated', 'public.ventas', 'revisada_por', 'SELECT')
  and has_column_privilege('authenticated', 'public.ventas', 'revisada_en', 'SELECT')
  and not has_table_privilege('authenticated', 'public.ventas', 'UPDATE'), 'marcas de revisión legibles, no escribibles');
select ok(exists (select 1 from pg_attribute where attrelid = 'public.venta_items'::regclass and attname = 'precio_lista_servidor' and not attnotnull),
  'venta_items.precio_lista_servidor admite null (venta offline sin precio)');
select ok(exists (select 1 from pg_constraint where conname = 'venta_pagos_verificado_ck')
  and exists (select 1 from pg_constraint where conname = 'ventas_revision_ck')
  and has_column_privilege('authenticated', 'public.venta_pagos', 'verificado_por', 'SELECT'), 'checks de quién y cuándo de la revisión y la verificación');
select * from finish();
rollback;
