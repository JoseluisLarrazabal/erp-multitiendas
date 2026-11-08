-- guardar_producto con movimientos: ERP_PRODUCTO_CON_MOVIMIENTOS.
begin;
select plan(8);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T tienda, L lavandería. U1 y U2 en T, UL en L.
-- d: dueño de T y L · v: vendedor de T · c: contador de T · x: encargado de L (ajeno a T)
select pg_temp.crear_usuario(('99999999-3000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'c'), ('4', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-3000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'dueno'),
  ('99999999-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000002', 'dueno'),
  ('99999999-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'vendedor'),
  ('99999999-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000001', 'contador'),
  ('99999999-3000-0000-0000-000000000004', 'aaaaaaaa-3000-0000-0000-000000000002', 'encargado');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'U1', 'local'),
  ('bbbbbbbb-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'U2', 'deposito'),
  ('bbbbbbbb-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000002', 'UL', 'local');
-- P1 unidad · PK kg · PS unidad con serie · PL servicio (L) · PI insumo (L)
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie, stock_minimo) values
  ('eeeeeeee-3000-0000-0000-000000000001', 'aaaaaaaa-3000-0000-0000-000000000001', 'P1', 'P1', 'producto', 'unidad', false, 20),
  ('eeeeeeee-3000-0000-0000-000000000002', 'aaaaaaaa-3000-0000-0000-000000000001', 'PK', 'PK', 'producto', 'kg', false, null),
  ('eeeeeeee-3000-0000-0000-000000000003', 'aaaaaaaa-3000-0000-0000-000000000001', 'PS', 'PS', 'producto', 'unidad', true, null),
  ('eeeeeeee-3000-0000-0000-000000000004', 'aaaaaaaa-3000-0000-0000-000000000002', 'PL', 'PL', 'servicio', 'unidad', false, null),
  ('eeeeeeee-3000-0000-0000-000000000005', 'aaaaaaaa-3000-0000-0000-000000000002', 'PI', 'PI', 'insumo', 'unidad', false, null);
-- Atajo de ids: T, L (negocios) · U1, U2, UL (ubicaciones) · P1, PK, PS, PL, PI (productos) · d, v, c, x (usuarios) · O<n> operaciones · S<n> series
create function pg_temp.i(n text) returns uuid language sql as $$
  select (case
    when n = 'T' then 'aaaaaaaa-3000-0000-0000-000000000001'
    when n = 'L' then 'aaaaaaaa-3000-0000-0000-000000000002'
    when n = 'U1' then 'bbbbbbbb-3000-0000-0000-000000000001'
    when n = 'U2' then 'bbbbbbbb-3000-0000-0000-000000000002'
    when n = 'UL' then 'bbbbbbbb-3000-0000-0000-000000000003'
    when n = 'P1' then 'eeeeeeee-3000-0000-0000-000000000001'
    when n = 'PK' then 'eeeeeeee-3000-0000-0000-000000000002'
    when n = 'PS' then 'eeeeeeee-3000-0000-0000-000000000003'
    when n = 'PL' then 'eeeeeeee-3000-0000-0000-000000000004'
    when n = 'PI' then 'eeeeeeee-3000-0000-0000-000000000005'
    when n = 'd' then '99999999-3000-0000-0000-000000000001'
    when n = 'v' then '99999999-3000-0000-0000-000000000002'
    when n = 'c' then '99999999-3000-0000-0000-000000000003'
    when n = 'x' then '99999999-3000-0000-0000-000000000004'
    when n like 'O%' then 'cccccccc-3000-0000-0000-' || lpad(substr(n, 2), 12, '0')
    when n like 'S%' then 'dddddddd-3000-0000-0000-' || lpad(substr(n, 2), 12, '0')
  end)::uuid
$$;

select pg_temp.como(pg_temp.i('d'));
-- Sin movimientos todo se puede cambiar
select lives_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('P1')::text, 'codigo', 'P1', 'nombre', 'P1', 'tipo', 'producto', 'unidad', 'kg', 'controla_serie', true))$$, 'sin movimientos: cambia unidad y activa series');
select lives_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('P1')::text, 'codigo', 'P1', 'nombre', 'P1', 'tipo', 'producto', 'unidad', 'unidad'))$$, 'sin movimientos: desactiva series');
select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 5, 1, null);
select public.registrar_entrada(pg_temp.i('O2'), pg_temp.i('T'), pg_temp.i('PS'), pg_temp.i('U1'), 5, 1, null);

-- Con movimientos
select throws_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('P1')::text, 'codigo', 'P1', 'nombre', 'P1', 'tipo', 'producto', 'unidad', 'kg'))$$, 'P0001', 'ERP_PRODUCTO_CON_MOVIMIENTOS', 'con movimientos: no cambia la unidad');
select throws_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('PS')::text, 'codigo', 'PS', 'nombre', 'PS', 'tipo', 'producto', 'controla_serie', false))$$, 'P0001', 'ERP_PRODUCTO_CON_MOVIMIENTOS', 'con movimientos: no deja de controlar series');
select throws_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('P1')::text, 'codigo', 'P1', 'nombre', 'P1 renombrado', 'tipo', 'producto', 'controla_serie', true))$$, 'P0001', 'ERP_SERIE_CON_STOCK', 'con stock: no puede empezar a controlar series (quedaría invendible)');
select lives_ok($$select public.guardar_producto(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('PS')::text, 'codigo', 'PS', 'nombre', 'PS 2', 'tipo', 'producto', 'controla_serie', true, 'stock_minimo', 2))$$, 'con movimientos: edita nombre y stock mínimo');
select is((select nombre from public.productos where id = pg_temp.i('PS')), 'PS 2', 'con movimientos: el cambio permitido se guarda');

-- El tipo no cambia con movimientos: un insumo de lavandería no pasa a servicio
select public.registrar_entrada(pg_temp.i('O3'), pg_temp.i('L'), pg_temp.i('PI'), pg_temp.i('UL'), 2, 1, null);
select throws_ok($$select public.guardar_producto(pg_temp.i('L'), jsonb_build_object('id', pg_temp.i('PI')::text, 'codigo', 'PI', 'nombre', 'PI', 'tipo', 'servicio'))$$, 'P0001', 'ERP_PRODUCTO_CON_MOVIMIENTOS', 'con movimientos: no cambia el tipo');

select * from finish();
rollback;
