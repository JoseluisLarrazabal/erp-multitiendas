-- RPC de compras: guardar_proveedor, registrar_compra, pagar_proveedor, deudas_proveedores, totales_compras (DB-25).
begin;
select plan(106);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y T2 tiendas. d: dueño de T · v: vendedor de T · c: contador de T · x: dueño de T2
select pg_temp.crear_usuario(('99999999-9000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'v'), ('3', 'c'), ('4', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-9000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-9000-0000-0000-000000000002', 'T2', 'tienda');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-9000-0000-0000-000000000001', 'aaaaaaaa-9000-0000-0000-000000000001', 'dueno'),
  ('99999999-9000-0000-0000-000000000002', 'aaaaaaaa-9000-0000-0000-000000000001', 'vendedor'),
  ('99999999-9000-0000-0000-000000000003', 'aaaaaaaa-9000-0000-0000-000000000001', 'contador'),
  ('99999999-9000-0000-0000-000000000004', 'aaaaaaaa-9000-0000-0000-000000000002', 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('bbbbbbbb-9000-0000-0000-000000000001', 'aaaaaaaa-9000-0000-0000-000000000001', 'U1', 'local'),
  ('bbbbbbbb-9000-0000-0000-000000000002', 'aaaaaaaa-9000-0000-0000-000000000002', 'U2', 'local');
-- P1 unidad · PK kg · PS servicio · PN inactivo (T) · PX producto de T2
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, activo) values
  ('eeeeeeee-9000-0000-0000-000000000001', 'aaaaaaaa-9000-0000-0000-000000000001', 'P1', 'P1', 'producto', 'unidad', true),
  ('eeeeeeee-9000-0000-0000-000000000002', 'aaaaaaaa-9000-0000-0000-000000000001', 'PK', 'PK', 'producto', 'kg', true),
  ('eeeeeeee-9000-0000-0000-000000000003', 'aaaaaaaa-9000-0000-0000-000000000001', 'PS', 'PS', 'servicio', 'unidad', true),
  ('eeeeeeee-9000-0000-0000-000000000004', 'aaaaaaaa-9000-0000-0000-000000000001', 'PN', 'PN', 'producto', 'unidad', false),
  ('eeeeeeee-9000-0000-0000-000000000005', 'aaaaaaaa-9000-0000-0000-000000000002', 'PX', 'PX', 'producto', 'unidad', true);
-- PV1, PV2 proveedores de T · PVX de T2
insert into public.proveedores (id, negocio_id, nombre) values
  ('ffffffff-9000-0000-0000-000000000001', 'aaaaaaaa-9000-0000-0000-000000000001', 'PV1'),
  ('ffffffff-9000-0000-0000-000000000002', 'aaaaaaaa-9000-0000-0000-000000000001', 'PV2'),
  ('ffffffff-9000-0000-0000-000000000003', 'aaaaaaaa-9000-0000-0000-000000000002', 'PVX');
create function pg_temp.i(n text) returns uuid language sql as $$
  select (case
    when n = 'T' then 'aaaaaaaa-9000-0000-0000-000000000001'
    when n = 'T2' then 'aaaaaaaa-9000-0000-0000-000000000002'
    when n = 'U1' then 'bbbbbbbb-9000-0000-0000-000000000001'
    when n = 'U2' then 'bbbbbbbb-9000-0000-0000-000000000002'
    when n = 'P1' then 'eeeeeeee-9000-0000-0000-000000000001'
    when n = 'PK' then 'eeeeeeee-9000-0000-0000-000000000002'
    when n = 'PS' then 'eeeeeeee-9000-0000-0000-000000000003'
    when n = 'PN' then 'eeeeeeee-9000-0000-0000-000000000004'
    when n = 'PX' then 'eeeeeeee-9000-0000-0000-000000000005'
    when n = 'PV1' then 'ffffffff-9000-0000-0000-000000000001'
    when n = 'PV2' then 'ffffffff-9000-0000-0000-000000000002'
    when n = 'PVX' then 'ffffffff-9000-0000-0000-000000000003'
    when n = 'd' then '99999999-9000-0000-0000-000000000001'
    when n = 'v' then '99999999-9000-0000-0000-000000000002'
    when n = 'c' then '99999999-9000-0000-0000-000000000003'
    when n = 'x' then '99999999-9000-0000-0000-000000000004'
    when n like 'O%' then 'cccccccc-9000-0000-0000-' || lpad(substr(n, 2), 12, '0')
  end)::uuid
$$;
create function pg_temp.it(p text, c numeric, k numeric) returns jsonb language sql as $$
  select jsonb_build_object('producto_id', pg_temp.i(p), 'cantidad', c, 'costo_unitario', k)
$$;
create function pg_temp.compra(o text, prov text, cond text, total numeric, items jsonb, medio text default null,
  neg text default 'T', ubic text default 'U1') returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('id', pg_temp.i(o), 'negocio_id', pg_temp.i(neg),
    'proveedor_id', pg_temp.i(prov), 'ubicacion_id', pg_temp.i(ubic), 'condicion', cond, 'medio', medio,
    'total', total, 'items', items))
$$;
create function pg_temp.pago(o text, prov text, monto numeric, medio text default 'efectivo', neg text default 'T')
returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(o), 'negocio_id', pg_temp.i(neg), 'proveedor_id', pg_temp.i(prov),
    'monto', monto, 'medio', medio)
$$;
create function pg_temp.deuda(p text) returns numeric language sql as $$
  select deuda from public.deudas_proveedores(pg_temp.i('T')) where proveedor_id = pg_temp.i(p)
$$;

select ok(has_function_privilege('authenticated', 'public.registrar_compra(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.registrar_compra(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pagar_proveedor(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.deudas_proveedores(uuid)', 'EXECUTE'), 'solo authenticated ejecuta');
select ok(not has_function_privilege('authenticated', 'public.deuda_proveedor(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.deuda_proveedor(uuid)', 'EXECUTE'), 'deuda_proveedor es privada');

-- guardar_proveedor
select pg_temp.como(pg_temp.i('d'));
create temp table r (k text primary key, id uuid);
grant all on r to authenticated;
insert into r select 'p', public.guardar_proveedor(pg_temp.i('T'), '{"nombre": " Distribuidora Sur ", "contacto": "Ana 700"}');
select results_eq($$select nombre, contacto, activo from public.proveedores where id = (select id from r where k = 'p')$$,
  $$values ('Distribuidora Sur', 'Ana 700', true)$$, 'guardar_proveedor: alta con nombre recortado');
select lives_ok($$select public.guardar_proveedor(pg_temp.i('T'), jsonb_build_object('id', (select id from r where k = 'p'), 'nombre', 'Sur 2', 'activo', false))$$,
  'guardar_proveedor: edición');
select results_eq($$select nombre, contacto, activo from public.proveedores where id = (select id from r where k = 'p')$$,
  $$values ('Sur 2', null, false)$$, 'guardar_proveedor: la edición reemplaza los campos');
select throws_ok($$select public.guardar_proveedor(pg_temp.i('T'), '{"nombre": "  "}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'guardar_proveedor: nombre vacío');
select throws_ok($$select public.guardar_proveedor(pg_temp.i('T'), '{"nombre": "A", "otro": 1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'guardar_proveedor: clave desconocida');
select throws_ok($$select public.guardar_proveedor(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('PVX'), 'nombre', 'X'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'guardar_proveedor: no edita un proveedor de otro negocio');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.guardar_proveedor(pg_temp.i('T'), '{"nombre": "A"}')$$, 'P0001', 'ERP_SIN_PERMISO', 'guardar_proveedor: el vendedor no gestiona compras');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.guardar_proveedor(pg_temp.i('T'), '{"nombre": "A"}')$$, 'P0001', 'ERP_SIN_PERMISO', 'guardar_proveedor: usuario de otro negocio');

-- Stock 10 @ 5, luego compra a crédito 10 @ 7
select pg_temp.como(pg_temp.i('d'));
select public.registrar_entrada(pg_temp.i('O1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U1'), 10, 5, null);
select set_config('t.r1', public.registrar_compra(pg_temp.compra('O10', 'PV1', 'credito', 70, jsonb_build_array(pg_temp.it('P1', 10, 7))))::text, true);
select is((current_setting('t.r1')::jsonb ->> 'total')::numeric, 70::numeric, 'registrar_compra: devuelve id, total y condición');
select is(pg_temp.deuda('PV1'), 70::numeric, 'DB-25: la compra a crédito aumenta la deuda');
select is((select count(*) from public.proveedor_pagos where proveedor_id = pg_temp.i('PV1')), 0::bigint, 'compra a crédito: no genera pago');
select is((select costo_promedio from public.costos_stock(pg_temp.i('T'), array[pg_temp.i('P1')]) where ubicacion_id = pg_temp.i('U1')),
  6::numeric, 'costo promedio recalculado: 10 @ 5 + 10 @ 7 = 6');
select results_eq($$select tipo, cantidad, ref_tipo, ref_id, usuario_id from public.movimientos_inventario where ref_id = pg_temp.i('O10')$$,
  $$values ('compra', 10.000::numeric, 'compra', pg_temp.i('O10'), pg_temp.i('d'))$$, 'compra: movimiento de kardex con referencia a la compra');
select is(pg_temp.deuda('PV2'), 0::numeric, 'deuda de otro proveedor intacta');

select lives_ok($$select public.pagar_proveedor(pg_temp.pago('O20', 'PV1', 30))$$, 'pagar_proveedor: pago parcial');
select is(pg_temp.deuda('PV1'), 40::numeric, 'DB-25: el pago reduce la deuda');
select is(public.pagar_proveedor(pg_temp.pago('O20', 'PV1', 30)), pg_temp.i('O20'), 'pagar_proveedor: repetir el mismo pago devuelve el mismo id');
select is(pg_temp.deuda('PV1'), 40::numeric, 'pagar_proveedor: repetir no descuenta dos veces');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O20', 'PV1', 31))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'pagar_proveedor: mismo id con otro monto');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O21', 'PV1', 41))$$, 'P0001', 'ERP_PAGO_EXCEDE_DEUDA', 'DB-25: pago mayor a la deuda rechazado');
select is(pg_temp.deuda('PV1'), 40::numeric, 'pago rechazado: la deuda no cambia');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O21', 'PV2', 1))$$, 'P0001', 'ERP_PAGO_EXCEDE_DEUDA', 'proveedor sin deuda: no se le paga');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O22', 'PV1', 0))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: monto 0');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O22', 'PV1', -5))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: monto negativo');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O22', 'PV1', 1.005))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: más de 2 decimales');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O22', 'PV1', 1, 'cheque'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: medio desconocido');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O22', 'PVX', 1))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: proveedor de otro negocio');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O22', 'PV1', 1, 'efectivo', 'T2'))$$, 'P0001', 'ERP_SIN_PERMISO', 'pagar_proveedor: negocio ajeno sin permiso');
select lives_ok($$select public.pagar_proveedor(pg_temp.pago('O23', 'PV1', 40, 'transferencia') || jsonb_build_object('compra_id', pg_temp.i('O10')))$$, 'pagar_proveedor: salda con referencia a la compra');
select is(pg_temp.deuda('PV1'), 0::numeric, 'pagar_proveedor: deuda saldada');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O24', 'PV2', 1) || jsonb_build_object('compra_id', pg_temp.i('O10')))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: la compra es de otro proveedor');

-- Contado: deuda 0 y un pago por el total
select lives_ok($$select public.registrar_compra(pg_temp.compra('O11', 'PV2', 'contado', 14, jsonb_build_array(pg_temp.it('P1', 2, 7)), 'qr'))$$, 'registrar_compra: contado');
select is(pg_temp.deuda('PV2'), 0::numeric, 'compra al contado deja deuda 0');
select results_eq($$select medio, compra_id from public.proveedor_pagos where proveedor_id = pg_temp.i('PV2')$$,
  $$values ('qr', pg_temp.i('O11'))$$, 'contado: un pago ligado a la compra con el medio');
select is((select total_compras from public.deudas_proveedores(pg_temp.i('T')) where proveedor_id = pg_temp.i('PV2')), 14::numeric, 'deudas_proveedores: total de compras');
select is((select total_pagos from public.deudas_proveedores(pg_temp.i('T')) where proveedor_id = pg_temp.i('PV2')), 14::numeric, 'deudas_proveedores: total de pagos');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')),
  (select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')),
  'stock = suma del kardex tras compras');
select is((select cantidad from public.stock where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U1')), 22.000::numeric, 'stock: 10 + 10 + 2');

-- Varios ítems, kg con decimales, redondeo por línea
select lives_ok($$select public.registrar_compra(pg_temp.compra('O12', 'PV1', 'credito', 3.81,
  jsonb_build_array(pg_temp.it('PK', 1.5, 2.5), pg_temp.it('P1', 1, 0.0600))))$$, 'registrar_compra: varios ítems, suma de líneas redondeadas');
select is(pg_temp.deuda('PV1'), 3.81::numeric, 'deuda con varios ítems');

-- Idempotencia
select is(public.registrar_compra(pg_temp.compra('O10', 'PV1', 'credito', 70, jsonb_build_array(pg_temp.it('P1', 10, 7))))::text, current_setting('t.r1'), 'idempotencia: repetir devuelve el mismo resultado');
select is((select count(*) from public.movimientos_inventario where ref_id = pg_temp.i('O10')), 1::bigint, 'idempotencia: no duplica el kardex');
select is((select count(*) from public.compras where id = pg_temp.i('O10')), 1::bigint, 'idempotencia: no duplica la compra');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O10', 'PV1', 'credito', 77, jsonb_build_array(pg_temp.it('P1', 10, 7.7))))$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: mismo id con otro payload');

-- Redondeo por línea: 3 × 1,005 = 3,015 -> 3,02 (mitad hacia arriba, igual que lineaCentavos en el dominio TS)
select throws_ok($$select public.registrar_compra(pg_temp.compra('O13', 'PV2', 'credito', 3.01, jsonb_build_array(pg_temp.it('P1', 3, 1.005))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'redondeo: 3 × 1,005 no suma 3,01');
select lives_ok($$select public.registrar_compra(pg_temp.compra('O13', 'PV2', 'credito', 3.02, jsonb_build_array(pg_temp.it('P1', 3, 1.005))))$$, 'redondeo: 3 × 1,005 suma 3,02');
select is(pg_temp.deuda('PV2'), 3.02::numeric, 'redondeo: la deuda es 3,02');

-- Un proveedor desactivado no recibe compras nuevas, pero se le puede pagar lo que ya se le debe (intencional).
select lives_ok($$select public.guardar_proveedor(pg_temp.i('T'), jsonb_build_object('id', pg_temp.i('PV2'), 'nombre', 'PV2', 'activo', false))$$, 'proveedor: desactivar');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O14', 'PV2', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'proveedor inactivo: no recibe compras');
select lives_ok($$select public.pagar_proveedor(pg_temp.pago('O25', 'PV2', 3.02))$$, 'proveedor inactivo: se le paga la deuda que quedó');
select is(pg_temp.deuda('PV2'), 0::numeric, 'proveedor inactivo: deuda saldada');

-- Datos inválidos
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 0, jsonb_build_array(pg_temp.it('P1', 0, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: cantidad 0');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 0, jsonb_build_array(pg_temp.it('P1', -1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: cantidad negativa');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 0, jsonb_build_array(pg_temp.it('P1', 1, -7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: costo negativo');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 69, jsonb_build_array(pg_temp.it('P1', 10, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: el total no coincide');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 14, jsonb_build_array(pg_temp.it('P1', 1, 7), pg_temp.it('P1', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: producto repetido');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 0, '[]'::jsonb))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: sin ítems');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'contado', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: contado sin medio');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7)), 'qr'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: crédito con medio');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'plazos', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: condición desconocida');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1.5, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: decimal en producto por unidad');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('PS', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: un servicio no se compra');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('PN', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: producto inactivo');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))) || '{"extra": 1}')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: clave desconocida');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O30', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))) - 'id')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: sin id');
select throws_ok($$select public.registrar_compra(null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'inválido: payload nulo');
select is((select count(*) from public.compras where id = pg_temp.i('O30')), 0::bigint, 'rechazos: no dejan compra');

-- Otro negocio
select throws_ok($$select public.registrar_compra(pg_temp.compra('O31', 'PVX', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cross-negocio: proveedor de otro negocio');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O31', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('PX', 1, 7))))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cross-negocio: producto de otro negocio');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O31', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7)), null, 'T', 'U2'))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'cross-negocio: ubicación de otro negocio');
select throws_ok($$select public.registrar_compra(pg_temp.compra('O31', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7)), null, 'T2'))$$, 'P0001', 'ERP_SIN_PERMISO', 'cross-negocio: negocio donde no se tiene permiso');
select throws_ok($$insert into public.compras (id, negocio_id, proveedor_id, ubicacion_id, total, condicion)
  values (gen_random_uuid(), pg_temp.i('T'), pg_temp.i('PVX'), pg_temp.i('U1'), 0, 'credito')$$, '42501', null, 'authenticated no inserta directo');

-- Sin permiso
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.registrar_compra(pg_temp.compra('O40', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))))$$, 'P0001', 'ERP_SIN_PERMISO', 'registrar_compra: el vendedor no gestiona compras');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O41', 'PV1', 1))$$, 'P0001', 'ERP_SIN_PERMISO', 'pagar_proveedor: el vendedor no gestiona compras');
select throws_ok($$select * from public.deudas_proveedores(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'deudas_proveedores: el vendedor no gestiona compras');
select throws_ok($$select * from public.totales_compras(pg_temp.i('T'), array[pg_temp.i('O10')])$$, 'P0001', 'ERP_SIN_PERMISO', 'totales_compras: sin ver_costos');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.registrar_compra(pg_temp.compra('O40', 'PV1', 'credito', 7, jsonb_build_array(pg_temp.it('P1', 1, 7))))$$, 'P0001', 'ERP_SIN_PERMISO', 'registrar_compra: el contador no gestiona compras');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O41', 'PV1', 1))$$, 'P0001', 'ERP_SIN_PERMISO', 'pagar_proveedor: el contador no gestiona compras');
select is((select total from public.totales_compras(pg_temp.i('T'), array[pg_temp.i('O10')])), 70::numeric, 'totales_compras: el contador (ver_costos) lee el total');

-- Costos ocultos por columna, RLS
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select total from public.compras$$, '42501', null, 'compras.total no se lee por columna');
select throws_ok($$select costo_unitario from public.compra_items$$, '42501', null, 'compra_items.costo_unitario no se lee por columna');
select throws_ok($$select monto from public.proveedor_pagos$$, '42501', null, 'proveedor_pagos.monto no se lee por columna');
select is((select count(*) from public.compras where negocio_id = pg_temp.i('T')), 4::bigint, 'el dueño lee las compras de su negocio');
select is((select count(*) from public.compra_items where negocio_id = pg_temp.i('T')), 5::bigint, 'el dueño lee los ítems de su negocio');
select pg_temp.como(pg_temp.i('x'));
select is((select count(*) from public.proveedores where negocio_id = pg_temp.i('T')), 0::bigint, 'RLS: otro negocio no lee proveedores');
select is((select count(*) from public.compras where negocio_id = pg_temp.i('T')), 0::bigint, 'RLS: otro negocio no lee compras');
select is((select count(*) from public.compra_items where negocio_id = pg_temp.i('T')), 0::bigint, 'RLS: otro negocio no lee ítems');
select is((select count(*) from public.proveedor_pagos where negocio_id = pg_temp.i('T')), 0::bigint, 'RLS: otro negocio no lee pagos');
select throws_ok($$select * from public.deudas_proveedores(pg_temp.i('T'))$$, 'P0001', 'ERP_SIN_PERMISO', 'deudas_proveedores: otro negocio');

-- Append-only
reset role;
select throws_ok($$update public.compras set condicion = 'contado'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'compras: UPDATE rechazado');
select throws_ok($$delete from public.compras$$, 'P0001', 'ERP_SOLO_AGREGAR', 'compras: DELETE rechazado');
select throws_ok($$update public.compra_items set cantidad = 1$$, 'P0001', 'ERP_SOLO_AGREGAR', 'compra_items: UPDATE rechazado');
select throws_ok($$delete from public.compra_items$$, 'P0001', 'ERP_SOLO_AGREGAR', 'compra_items: DELETE rechazado');
select throws_ok($$update public.proveedor_pagos set medio = 'qr'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'proveedor_pagos: UPDATE rechazado');
select throws_ok($$delete from public.proveedor_pagos$$, 'P0001', 'ERP_SOLO_AGREGAR', 'proveedor_pagos: DELETE rechazado');
select throws_ok($$truncate public.proveedor_pagos$$, 'P0001', 'ERP_SOLO_AGREGAR', 'proveedor_pagos: TRUNCATE rechazado');
select throws_ok($$insert into public.compras (id, negocio_id, proveedor_id, ubicacion_id, total, condicion)
  values (gen_random_uuid(), pg_temp.i('T'), pg_temp.i('PVX'), pg_temp.i('U1'), 0, 'credito')$$, '23503', null, 'FK compuesta: una compra no referencia el proveedor de otro negocio');

-- Arrastres del PR 2: compra_id de pagar_proveedor solo acepta compras a crédito y no anuladas (todo con PV1, que sí tiene deuda)
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.registrar_compra(pg_temp.compra('O66', 'PV1', 'contado', 3, jsonb_build_array(pg_temp.it('P1', 3, 1)), 'efectivo'))$$, 'compra al contado O66');
select lives_ok($$select public.registrar_compra(pg_temp.compra('O61', 'PV1', 'credito', 10, jsonb_build_array(pg_temp.it('P1', 10, 1))))$$, 'compra a crédito O61');
select lives_ok($$select public.registrar_compra(pg_temp.compra('O64', 'PV1', 'credito', 5, jsonb_build_array(pg_temp.it('P1', 5, 1))))$$, 'compra a crédito O64');
select lives_ok($$select public.anular_compra(pg_temp.i('O62'), pg_temp.i('O61'), 'error de carga')$$, 'anular O61');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O60', 'PV1', 1) || jsonb_build_object('compra_id', pg_temp.i('O66')))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: compra_id de una compra al contado');
select throws_ok($$select public.pagar_proveedor(pg_temp.pago('O63', 'PV1', 1) || jsonb_build_object('compra_id', pg_temp.i('O61')))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'pagar_proveedor: compra_id de una compra anulada');
select lives_ok($$select public.pagar_proveedor(pg_temp.pago('O65', 'PV1', 1) || jsonb_build_object('compra_id', pg_temp.i('O64')))$$, 'pagar_proveedor: compra a crédito vigente pasa');

select * from finish();
rollback;
