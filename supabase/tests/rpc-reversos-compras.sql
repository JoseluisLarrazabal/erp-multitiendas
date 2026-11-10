-- M-2: anular_compra, anular_pago_proveedor y ultimo_pago_proveedor (reversos por contraasiento).
begin;
select plan(119);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t9700' || n)::uuid $$;
-- d dueño de T (tienda) y F (frial) · e encargado de T · v vendedor de T (sin anular ni gestionar_compras) · x dueño de T2
insert into auth.users (id, email, raw_user_meta_data)
  select pg_temp.i(n), n || '@test.local', jsonb_build_object('nombre', n) from (values ('d'), ('e'), ('v'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo) values
  (pg_temp.i('T'), 'T', 'tienda'), (pg_temp.i('T2'), 'T2', 'tienda'), (pg_temp.i('F'), 'F', 'frial');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('d'), pg_temp.i('F'), 'dueno'),
  (pg_temp.i('e'), pg_temp.i('T'), 'encargado'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('x'), pg_temp.i('T2'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U'), pg_temp.i('T'), 'U', 'local'), (pg_temp.i('UF'), pg_temp.i('F'), 'UF', 'local');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false),
  (pg_temp.i('PS'), pg_temp.i('T'), 'PS', 'PS', 'producto', 'unidad', true),
  (pg_temp.i('PF'), pg_temp.i('F'), 'PF', 'PF', 'producto', 'unidad', false),
  (pg_temp.i('P2'), pg_temp.i('T'), 'P2', 'P2', 'producto', 'unidad', false),
  (pg_temp.i('P3'), pg_temp.i('T'), 'P3', 'P3', 'producto', 'unidad', false);
insert into public.proveedores (id, negocio_id, nombre) values
  (pg_temp.i('V1'), pg_temp.i('T'), 'V1'), (pg_temp.i('V2'), pg_temp.i('T'), 'V2'),
  (pg_temp.i('V3'), pg_temp.i('T'), 'V3'), (pg_temp.i('V4'), pg_temp.i('T'), 'V4'),
  (pg_temp.i('V5'), pg_temp.i('T'), 'V5'), (pg_temp.i('V6'), pg_temp.i('T'), 'V6'),
  (pg_temp.i('VF'), pg_temp.i('F'), 'VF');

create function pg_temp.compra(o text, prov text, cond text, prod text, cant numeric, costo numeric, medio text default null,
  neg text default 'T', ubic text default 'U', extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('id', pg_temp.i(o), 'negocio_id', pg_temp.i(neg),
    'proveedor_id', pg_temp.i(prov), 'ubicacion_id', pg_temp.i(ubic), 'condicion', cond, 'medio', medio,
    'total', round(cant * costo, 2),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i(prod), 'cantidad', cant, 'costo_unitario', costo) || extra)))
$$;
create function pg_temp.pago(o text, prov text, monto numeric, compra text default null) returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('id', pg_temp.i(o), 'negocio_id', pg_temp.i('T'), 'proveedor_id', pg_temp.i(prov),
    'monto', monto, 'medio', 'efectivo', 'compra_id', case when compra is null then null else pg_temp.i(compra) end))
$$;
create function pg_temp.deuda(p text) returns numeric language sql as $$
  select deuda from public.deudas_proveedores(pg_temp.i('T')) where proveedor_id = pg_temp.i(p)
$$;
create function pg_temp.stock(p text, u text default 'U') returns numeric language sql as $$
  select cantidad from public.stock where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i(u)
$$;
create function pg_temp.promedio(p text) returns numeric language sql as $$
  select costo_promedio from public.costos_stock(pg_temp.i('T'), array[pg_temp.i(p)]) where ubicacion_id = pg_temp.i('U')
$$;
create function pg_temp.nmov(p text, u text default 'U') returns bigint language sql as $$
  select count(*) from public.movimientos_inventario where producto_id = pg_temp.i(p) and ubicacion_id = pg_temp.i(u)
$$;
create function pg_temp.anular(o text, c text, motivo text default 'error de carga') returns jsonb language sql as $$
  select public.anular_compra(pg_temp.i(o), pg_temp.i(c), motivo)
$$;
create function pg_temp.anular_pago(o text, p text, motivo text default 'error de carga') returns jsonb language sql as $$
  select public.anular_pago_proveedor(pg_temp.i(o), pg_temp.i(p), motivo)
$$;
-- Pago vivo ligado a una compra (id aleatorio: el automático del contado no tiene nombre).
create function pg_temp.pago_de(c text) returns uuid language sql as $$
  select id from public.proveedor_pagos p where compra_id = pg_temp.i(c) and anula_id is null
    and not exists (select 1 from public.proveedor_pagos r where r.anula_id = p.id)
$$;

-- Grants
select ok(has_function_privilege('authenticated', 'public.anular_compra(uuid, uuid, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.anular_pago_proveedor(uuid, uuid, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.ultimo_pago_proveedor(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.anular_compra(uuid, uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.anular_pago_proveedor(uuid, uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.ultimo_pago_proveedor(uuid)', 'EXECUTE'), 'solo authenticated ejecuta los reversos');
select ok(not has_column_privilege('authenticated', 'public.proveedor_pagos', 'monto', 'SELECT')
  and has_column_privilege('authenticated', 'public.proveedor_pagos', 'anula_id', 'SELECT')
  and has_column_privilege('authenticated', 'public.proveedor_pagos', 'motivo', 'SELECT')
  and not has_column_privilege('authenticated', 'public.proveedor_pagos', 'seq', 'SELECT'), 'proveedor_pagos: monto sigue oculto; anula_id y motivo se leen');
select ok(has_table_privilege('authenticated', 'public.compra_anulaciones', 'SELECT')
  and not has_table_privilege('authenticated', 'public.compra_anulaciones', 'INSERT')
  and not has_table_privilege('authenticated', 'public.compra_anulaciones', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.compra_anulaciones', 'DELETE')
  and not has_table_privilege('authenticated', 'public.compra_anulaciones', 'TRUNCATE'), 'compra_anulaciones: solo lectura directa');

-- 1. Compra a crédito 10 u a 1000 sobre stock 10 a 10: promedio 505; anular lo deja en 10
select pg_temp.como(pg_temp.i('d'));
select public.registrar_entrada(pg_temp.i('E1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U'), 10, 10, null);
select public.registrar_compra(pg_temp.compra('C1', 'V1', 'credito', 'P1', 10, 1000));
select is(pg_temp.promedio('P1'), 505::numeric, 'antes de anular: promedio 505');
select is(pg_temp.deuda('V1'), 10000::numeric, 'antes de anular: deuda 10000');
select set_config('t.a1', pg_temp.anular('A1', 'C1')::text, true);
select is(current_setting('t.a1')::jsonb ->> 'estado', 'anulada', 'anular_compra: estado anulada');
select is(pg_temp.stock('P1'), 10::numeric, 'anular_compra: el stock vuelve a 10');
select is(pg_temp.promedio('P1'), 10::numeric, 'anular_compra: el promedio vuelve a 10');
select is(pg_temp.deuda('V1'), 0::numeric, 'anular_compra: la deuda del proveedor vuelve a 0');
select results_eq($$select tipo, cantidad, ref_tipo, ref_id, usuario_id, motivo from public.movimientos_inventario
    where ref_id = pg_temp.i('C1') and tipo = 'anulacion_compra'$$,
  $$values ('anulacion_compra', -10.000::numeric, 'compra', pg_temp.i('C1'), pg_temp.i('d'), 'error de carga')$$,
  'anular_compra: movimiento anulacion_compra negativo con referencia a la compra');
select results_eq($$select motivo, usuario_id, operacion_id from public.compra_anulaciones where compra_id = pg_temp.i('C1')$$,
  $$values ('error de carga', pg_temp.i('d'), pg_temp.i('A1'))$$, 'anular_compra: queda en compra_anulaciones');
select is((select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P1') and ubicacion_id = pg_temp.i('U')),
  pg_temp.stock('P1'), 'stock = suma del kardex tras anular');
-- Idempotencia
select is(pg_temp.anular('A1', 'C1')::text, current_setting('t.a1'), 'idempotencia: misma operación, mismo resultado');
select is(pg_temp.nmov('P1'), 4::bigint, 'idempotencia: no duplica movimientos (entrada, compra, anulación, ajuste de costo)');
select throws_ok($$select pg_temp.anular('A1', 'C1', 'otro motivo')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: misma operación con otro motivo');
select is(pg_temp.anular('A2', 'C1') ->> 'estado', 'ya_anulada', 'otra operación sobre una compra anulada: ya_anulada');
select is(pg_temp.nmov('P1'), 4::bigint, 'ya_anulada: no escribe');
select is((select count(compra_id) from public.compra_anulaciones where negocio_id = pg_temp.i('T')), 1::bigint, 'ya_anulada: sigue habiendo una sola anulación');

-- 2. Vendido en parte: stock insuficiente sin escribir nada
select public.registrar_compra(pg_temp.compra('C2', 'V1', 'credito', 'P1', 10, 10));
select public.ajustar_inventario(pg_temp.i('J1'), pg_temp.i('T'), pg_temp.i('P1'), pg_temp.i('U'), 'danado', -15, 'merma de prueba');
select is(pg_temp.stock('P1'), 5::numeric, 'preparación: quedan 5 de los 10 de la compra');
select set_config('t.n2', pg_temp.nmov('P1')::text, true);
select throws_ok($$select pg_temp.anular('A3', 'C2')$$, 'P0001', 'ERP_STOCK_INSUFICIENTE', 'stock menor que lo comprado: ERP_STOCK_INSUFICIENTE');
select is(pg_temp.nmov('P1')::text, current_setting('t.n2'), 'ERP_STOCK_INSUFICIENTE: ningún movimiento nuevo');
select is((select count(compra_id) from public.compra_anulaciones where compra_id = pg_temp.i('C2')), 0::bigint, 'ERP_STOCK_INSUFICIENTE: no se registró la anulación');
select is(pg_temp.deuda('V1'), 100::numeric, 'ERP_STOCK_INSUFICIENTE: la deuda no cambia');

-- 3. Contado: la deuda no cambia y el pago automático queda revertido
select public.registrar_compra(pg_temp.compra('C3', 'V2', 'contado', 'P1', 3, 10, 'qr'));
select is(pg_temp.stock('P1'), 8::numeric, 'preparación: contado suma 3');
select is(pg_temp.anular('A4', 'C3') ->> 'estado', 'anulada', 'anular compra al contado');
select is(pg_temp.stock('P1'), 5::numeric, 'contado anulado: el stock vuelve');
select is(pg_temp.deuda('V2'), 0::numeric, 'contado anulado: la deuda sigue en 0');
select results_eq($$select (anula_id is not null), medio, motivo from public.proveedor_pagos where proveedor_id = pg_temp.i('V2') order by (anula_id is not null)$$,
  $$values (false, 'qr', null), (true, 'qr', 'error de carga')$$, 'contado anulado: el pago automático tiene su reverso (mismo medio, con motivo)');
select is((select total_compras from public.deudas_proveedores(pg_temp.i('T')) where proveedor_id = pg_temp.i('V2')), 0::numeric, 'deudas_proveedores: la compra anulada no suma');
select is((select total_pagos from public.deudas_proveedores(pg_temp.i('T')) where proveedor_id = pg_temp.i('V2')), 0::numeric, 'deudas_proveedores: pago y reverso suman 0');
-- El pago automático de un contado vivo no se revierte por anular_pago_proveedor
select public.registrar_compra(pg_temp.compra('C4', 'V2', 'contado', 'P1', 2, 10, 'efectivo'));
select throws_ok($$select public.anular_pago_proveedor(pg_temp.i('B0'), pg_temp.pago_de('C4'), 'x')$$, 'P0001', 'ERP_PAGO_AUTOMATICO',
  'el pago automático del contado solo se revierte anulando la compra');
select is(public.ultimo_pago_proveedor(pg_temp.i('V2')), null::jsonb, 'ultimo_pago_proveedor no devuelve el pago automático del contado');

-- 4. Crédito con un pago ligado
select public.registrar_compra(pg_temp.compra('C5', 'V1', 'credito', 'P1', 4, 10));
select public.pagar_proveedor(pg_temp.pago('G1', 'V1', 10, 'C5'));
select throws_ok($$select pg_temp.anular('A5', 'C5')$$, 'P0001', 'ERP_COMPRA_CON_PAGOS', 'crédito con pago ligado: ERP_COMPRA_CON_PAGOS');
select is((select count(compra_id) from public.compra_anulaciones where compra_id = pg_temp.i('C5')), 0::bigint, 'ERP_COMPRA_CON_PAGOS: no anula');
-- Pago suelto que dejaría la deuda negativa
select public.registrar_compra(pg_temp.compra('C6', 'V3', 'credito', 'P1', 3, 10));
select public.registrar_compra(pg_temp.compra('C7', 'V3', 'credito', 'P1', 2, 10));
select public.pagar_proveedor(pg_temp.pago('G2', 'V3', 40));
select is(pg_temp.deuda('V3'), 10::numeric, 'preparación: V3 debe 10 tras pagar 40 sin referencia');
select throws_ok($$select pg_temp.anular('A6', 'C6')$$, 'P0001', 'ERP_COMPRA_CON_PAGOS', 'pago suelto: la deuda quedaría negativa');
select is(pg_temp.deuda('V3'), 10::numeric, 'deuda negativa rechazada: la deuda no cambia');
-- Con deuda suficiente sí se anula
select public.registrar_compra(pg_temp.compra('C8', 'V3', 'credito', 'P1', 1, 100));
select is(pg_temp.anular('A7', 'C8') ->> 'estado', 'anulada', 'con deuda suficiente, una compra a crédito se anula aunque haya pagos sueltos');
select is(pg_temp.deuda('V3'), 10::numeric, 'esa anulación deja la deuda en 10');

-- 5. Series
select public.registrar_compra(pg_temp.compra('C9', 'V3', 'credito', 'PS', 1, 10));
select throws_ok($$select pg_temp.anular('A8', 'C9')$$, 'P0001', 'ERP_COMPRA_CON_SERIES', 'compra de un producto con serie: ERP_COMPRA_CON_SERIES');

-- 6. Frial: el lote anulado desaparece de Por vencer y el viejo conserva su saldo
select public.registrar_entrada_lote(pg_temp.i('EF1'), pg_temp.i('F'), pg_temp.i('PF'), pg_temp.i('UF'), 5, 10, null, 'VIEJO',
  ((now() at time zone 'America/La_Paz')::date) + 30);
select public.registrar_compra(jsonb_build_object('id', pg_temp.i('CF'), 'negocio_id', pg_temp.i('F'), 'proveedor_id', pg_temp.i('VF'),
  'ubicacion_id', pg_temp.i('UF'), 'condicion', 'credito', 'total', 50, 'items', jsonb_build_array(jsonb_build_object(
    'producto_id', pg_temp.i('PF'), 'cantidad', 5, 'costo_unitario', 10, 'lote', 'NUEVO',
    'vence', (((now() at time zone 'America/La_Paz')::date) + 10)::text))));
create function pg_temp.lotes() returns table (codigo text, saldo numeric) language sql as $$
  select e ->> 'codigo', (e ->> 'saldo')::numeric from jsonb_array_elements(public.lotes_por_vencer(pg_temp.i('F'), 60)) e order by 1
$$;
select results_eq($$select * from pg_temp.lotes()$$, $$values ('NUEVO', 5.000::numeric), ('VIEJO', 5.000::numeric)$$, 'frial: antes de anular, ambos lotes');
select is(pg_temp.anular('AF', 'CF') ->> 'estado', 'anulada', 'frial: anular la compra con lote');
select results_eq($$select * from pg_temp.lotes()$$, $$values ('VIEJO', 5.000::numeric)$$, 'frial: el lote anulado desaparece y el viejo conserva su saldo');
select is((select cantidad from public.stock where producto_id = pg_temp.i('PF')), 5::numeric, 'frial: el stock vuelve a 5');
select is((select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('PF')),
  (select cantidad from public.stock where producto_id = pg_temp.i('PF')), 'frial: stock = suma del kardex');

-- 7. anular_pago_proveedor: V4 con dos compras y tres pagos
select public.registrar_compra(pg_temp.compra('D1', 'V4', 'credito', 'P1', 10, 10));
select public.registrar_compra(pg_temp.compra('D2', 'V4', 'credito', 'P1', 10, 10));
select public.pagar_proveedor(pg_temp.pago('Q1', 'V4', 30));
select public.pagar_proveedor(pg_temp.pago('Q2', 'V4', 20));
select public.pagar_proveedor(pg_temp.pago('Q3', 'V4', 10));
select is(pg_temp.deuda('V4'), 140::numeric, 'preparación: V4 debe 140');
select results_eq($$select (u ->> 'id')::uuid, (u ->> 'monto')::numeric
    from (select public.ultimo_pago_proveedor(pg_temp.i('V4')) u) t$$,
  $$values (pg_temp.i('Q3'), 10::numeric)$$, 'ultimo_pago_proveedor: Q3, monto 10');
select throws_ok($$select pg_temp.anular_pago('R0', 'Q1')$$, 'P0001', 'ERP_PAGO_NO_ES_ULTIMO', 'no es el último pago: ERP_PAGO_NO_ES_ULTIMO');
select throws_ok($$select pg_temp.anular_pago('R0', 'Q2')$$, 'P0001', 'ERP_PAGO_NO_ES_ULTIMO', 'el penúltimo tampoco');
select throws_ok($$select pg_temp.anular_pago('R0', 'Q3', '   ')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo vacío');
select throws_ok($$select pg_temp.anular_pago('R0', 'Q3', repeat('x', 201))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'motivo de más de 200 caracteres');
select set_config('t.r1', pg_temp.anular_pago('R1', 'Q3')::text, true);
select is(current_setting('t.r1')::jsonb ->> 'estado', 'anulado', 'anular el último pago');
select is(pg_temp.deuda('V4'), 150::numeric, 'la deuda se restaura (+10)');
select results_eq($$select anula_id, motivo, compra_id, medio from public.proveedor_pagos where anula_id is not null and proveedor_id = pg_temp.i('V4')$$,
  $$values (pg_temp.i('Q3'), 'error de carga', null::uuid, 'efectivo')$$, 'el reverso apunta al pago y guarda el motivo');
select is(pg_temp.anular_pago('R1', 'Q3')::text, current_setting('t.r1'), 'idempotencia: misma operación, mismo resultado');
select throws_ok($$select pg_temp.anular_pago('R1', 'Q3', 'otro')$$, 'P0001', 'ERP_OPERACION_REPETIDA', 'idempotencia: otro motivo');
select is(pg_temp.anular_pago('R2', 'Q3') ->> 'estado', 'ya_anulado', 'otra operación sobre un pago ya revertido: ya_anulado');
select is(pg_temp.deuda('V4'), 150::numeric, 'ya_anulado: la deuda no cambia');
select is((public.ultimo_pago_proveedor(pg_temp.i('V4')) ->> 'id')::uuid, pg_temp.i('Q2'), 'el pago anterior pasa a ser el último');
select throws_ok($$select public.anular_pago_proveedor(pg_temp.i('R3'), (select id from public.proveedor_pagos where anula_id = pg_temp.i('Q3')), 'x')$$,
  'P0001', 'ERP_DATOS_INVALIDOS', 'un reverso no se anula');
select is(pg_temp.anular_pago('R4', 'Q2') ->> 'estado', 'anulado', 'el anterior ahora es anulable');
select is(pg_temp.anular_pago('R5', 'Q1') ->> 'estado', 'anulado', 'y el primero también');
select is(pg_temp.deuda('V4'), 200::numeric, 'deuda restaurada a 200');
select is(public.ultimo_pago_proveedor(pg_temp.i('V4')), null::jsonb, 'sin pagos vivos: ultimo_pago_proveedor devuelve null');
select is((select count(id) from public.proveedor_pagos where proveedor_id = pg_temp.i('V4')), 6::bigint, 'nada se borró: 3 pagos y 3 reversos');
select lives_ok($$select public.pagar_proveedor(pg_temp.pago('Q4', 'V4', 200))$$, 'se puede pagar de nuevo tras revertir');

-- 7b. Un pago automático de contado posterior no impide anular un pago manual
select public.registrar_compra(pg_temp.compra('K1', 'V5', 'credito', 'P1', 4, 10));
select public.pagar_proveedor(pg_temp.pago('M1', 'V5', 15));
select public.registrar_compra(pg_temp.compra('K2', 'V5', 'contado', 'P1', 2, 10, 'efectivo'));
select is(pg_temp.deuda('V5'), 25::numeric, 'preparación: V5 debe 25 (el contado no suma deuda)');
select is((public.ultimo_pago_proveedor(pg_temp.i('V5')) ->> 'id')::uuid, pg_temp.i('M1'), 'ultimo_pago_proveedor devuelve el manual aunque haya un contado posterior');
select is(pg_temp.anular_pago('N1', 'M1') ->> 'estado', 'anulado', 'el pago manual se anula con un contado posterior');
select is(pg_temp.deuda('V5'), 40::numeric, 'la deuda se restaura tras anular el manual');
select throws_ok($$select public.anular_pago_proveedor(pg_temp.i('N0'), pg_temp.pago_de('K2'), 'x')$$, 'P0001', 'ERP_PAGO_AUTOMATICO',
  'el pago automático pasado por id sigue dando ERP_PAGO_AUTOMATICO');
-- Crédito con pago ligado y un contado posterior: se anula el pago y luego la compra
select public.registrar_compra(pg_temp.compra('K3', 'V5', 'credito', 'P1', 3, 10));
select public.pagar_proveedor(pg_temp.pago('M2', 'V5', 10, 'K3'));
select public.registrar_compra(pg_temp.compra('K4', 'V5', 'contado', 'P1', 1, 10, 'qr'));
select is((public.ultimo_pago_proveedor(pg_temp.i('V5')) ->> 'id')::uuid, pg_temp.i('M2'), 'último pago vivo: el ligado a crédito, no el automático posterior');
select throws_ok($$select pg_temp.anular('N2', 'K3')$$, 'P0001', 'ERP_COMPRA_CON_PAGOS', 'K3 con su pago vivo: ERP_COMPRA_CON_PAGOS');
select is(pg_temp.anular_pago('N3', 'M2') ->> 'estado', 'anulado', 'el pago ligado se anula pese al contado posterior');
select is(pg_temp.anular('N4', 'K3') ->> 'estado', 'anulada', 'ahora la compra a crédito se anula');
select is(pg_temp.deuda('V5'), 40::numeric, 'deuda final de V5: solo K1');

-- 7c. Costo promedio al anular: Q - q = 0 (no hay ajuste) y promedio resultante negativo (no se ajusta)
select public.registrar_compra(pg_temp.compra('W1', 'V6', 'credito', 'P2', 5, 10));
select is(pg_temp.anular('W2', 'W1') ->> 'estado', 'anulada', 'Q - q = 0: la compra se anula');
select is((select count(*) from public.movimientos_inventario where producto_id = pg_temp.i('P2') and tipo = 'ajuste_costo'), 0::bigint,
  'Q - q = 0: no se inserta ajuste_costo');
select is(pg_temp.promedio('P2'), 10::numeric, 'Q - q = 0: el promedio queda como estaba');
select is(pg_temp.stock('P2'), (select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P2')), 'Q - q = 0: stock = suma del kardex');
select public.registrar_entrada(pg_temp.i('E3'), pg_temp.i('T'), pg_temp.i('P3'), pg_temp.i('U'), 10, 10, null);
select public.registrar_compra(pg_temp.compra('W3', 'V6', 'credito', 'P3', 10, 100));
select public.fijar_costos(pg_temp.i('T'), jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P3'), 'costo', 5)), 'costo bajo');
select set_config('t.aj', (select count(*) from public.movimientos_inventario where producto_id = pg_temp.i('P3') and tipo = 'ajuste_costo')::text, true);
select is(pg_temp.anular('W4', 'W3') ->> 'estado', 'anulada', 'promedio negativo: la compra se anula');
select is((select count(*) from public.movimientos_inventario where producto_id = pg_temp.i('P3') and tipo = 'ajuste_costo')::text, current_setting('t.aj'),
  'promedio negativo: no se inserta ajuste_costo');
select is(pg_temp.promedio('P3'), 5::numeric, 'promedio negativo: el promedio queda como estaba');
select is(pg_temp.stock('P3'), (select sum(cantidad) from public.movimientos_inventario where producto_id = pg_temp.i('P3')), 'promedio negativo: stock = suma del kardex');

-- 8. Permisos y aislamiento, sin efectos
select public.registrar_compra(pg_temp.compra('H1', 'V2', 'credito', 'P1', 1, 10));
select public.pagar_proveedor(pg_temp.pago('Q5', 'V2', 5));
select set_config('t.n_anul', (select count(compra_id) from public.compra_anulaciones)::text, true);
select set_config('t.n_pagos', (select count(id) from public.proveedor_pagos)::text, true);
select set_config('t.n_mov', (select count(id) from public.movimientos_inventario)::text, true);
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.anular('S1', 'H1')$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor (sin anular ni gestionar_compras): anular_compra rechazada');
select throws_ok($$select pg_temp.anular_pago('S2', 'Q5')$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor: anular_pago_proveedor rechazada');
select throws_ok($$select public.ultimo_pago_proveedor(pg_temp.i('V2'))$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor: ultimo_pago_proveedor rechazada');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select pg_temp.anular('S3', 'H1')$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio: anular_compra rechazada');
select throws_ok($$select pg_temp.anular_pago('S4', 'Q5')$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio: anular_pago_proveedor rechazada');
select throws_ok($$select public.ultimo_pago_proveedor(pg_temp.i('V2'))$$, 'P0001', 'ERP_SIN_PERMISO', 'otro negocio: ultimo_pago_proveedor rechazada');
select is((select count(compra_id) from public.compra_anulaciones), 0::bigint, 'RLS: otro negocio no lee compra_anulaciones');
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$select pg_temp.anular('S5', 'ZZ')$$, 'P0001', 'ERP_SIN_PERMISO', 'compra inexistente: ERP_SIN_PERMISO');
select throws_ok($$select pg_temp.anular_pago('S6', 'ZZ')$$, 'P0001', 'ERP_SIN_PERMISO', 'pago inexistente: ERP_SIN_PERMISO');
select throws_ok($$select pg_temp.anular('S7', 'H1', '')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'anular_compra: motivo vacío');
select throws_ok($$select pg_temp.anular('S7', 'H1', repeat('x', 201))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'anular_compra: motivo de más de 200 caracteres');
select throws_ok($$select public.anular_compra(null, pg_temp.i('H1'), 'x')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'anular_compra: operación nula');
-- Encargado: tiene gestionar_compras y anular; sin anular queda rechazado
select pg_temp.como(pg_temp.i('e'));
select is(pg_temp.anular_pago('S8', 'Q5') ->> 'estado', 'anulado', 'encargado (gestionar_compras + anular): puede anular un pago');
-- anular sin gestionar_compras: aísla el chequeo de gestionar_compras
reset role;
delete from public.rol_permisos where tipo_negocio = 'tienda' and rol = 'encargado' and permiso = 'gestionar_compras';
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select pg_temp.anular('S13', 'H1')$$, 'P0001', 'ERP_SIN_PERMISO', 'anular sin gestionar_compras: anular_compra rechazada');
select throws_ok($$select pg_temp.anular_pago('S14', 'Q5')$$, 'P0001', 'ERP_SIN_PERMISO', 'anular sin gestionar_compras: anular_pago_proveedor rechazada');
reset role;
insert into public.rol_permisos (tipo_negocio, rol, permiso) values ('tienda', 'encargado', 'gestionar_compras');
delete from public.rol_permisos where tipo_negocio = 'tienda' and rol = 'encargado' and permiso = 'anular';
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select pg_temp.anular('S9', 'H1')$$, 'P0001', 'ERP_SIN_PERMISO', 'gestionar_compras sin anular: anular_compra rechazada');
select throws_ok($$select pg_temp.anular_pago('S10', 'Q5')$$, 'P0001', 'ERP_SIN_PERMISO', 'gestionar_compras sin anular: anular_pago_proveedor rechazada');
select pg_temp.como(pg_temp.i('d'));
select is((select count(compra_id) from public.compra_anulaciones)::text, current_setting('t.n_anul'), 'rechazos: ninguna anulación nueva');
select is((select count(id) from public.proveedor_pagos)::text, (current_setting('t.n_pagos')::int + 1)::text, 'rechazos: el único reverso nuevo es el del encargado autorizado');
select is((select count(id) from public.movimientos_inventario)::text, current_setting('t.n_mov'), 'rechazos: ningún movimiento nuevo');
-- anon
reset role;
select set_config('role', 'anon', true);
select throws_ok($$select pg_temp.anular('S11', 'H1')$$, '42501', null, 'anon: anular_compra rechazada');
select throws_ok($$select pg_temp.anular_pago('S12', 'Q5')$$, '42501', null, 'anon: anular_pago_proveedor rechazada');
select throws_ok($$select public.ultimo_pago_proveedor(pg_temp.i('V2'))$$, '42501', null, 'anon: ultimo_pago_proveedor rechazada');

-- 9. Tablas append-only
select pg_temp.como(pg_temp.i('d'));
select throws_ok($$insert into public.compra_anulaciones (compra_id, negocio_id, operacion_id, motivo, usuario_id)
  values (pg_temp.i('H1'), pg_temp.i('T'), gen_random_uuid(), 'x', pg_temp.i('d'))$$, '42501', null, 'authenticated no inserta en compra_anulaciones');
select throws_ok($$update public.compra_anulaciones set motivo = 'x'$$, '42501', null, 'authenticated no actualiza compra_anulaciones');
select throws_ok($$delete from public.compra_anulaciones$$, '42501', null, 'authenticated no borra compra_anulaciones');
select throws_ok($$select monto from public.proveedor_pagos$$, '42501', null, 'proveedor_pagos.monto sigue sin leerse por columna');
reset role;
select throws_ok($$update public.compra_anulaciones set motivo = 'x'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'compra_anulaciones: UPDATE rechazado');
select throws_ok($$delete from public.compra_anulaciones$$, 'P0001', 'ERP_SOLO_AGREGAR', 'compra_anulaciones: DELETE rechazado');
select throws_ok($$truncate public.compra_anulaciones$$, 'P0001', 'ERP_SOLO_AGREGAR', 'compra_anulaciones: TRUNCATE rechazado');
select throws_ok($$update public.proveedor_pagos set motivo = 'x'$$, 'P0001', 'ERP_SOLO_AGREGAR', 'proveedor_pagos: UPDATE rechazado');
select throws_ok($$insert into public.proveedor_pagos (id, negocio_id, proveedor_id, monto, medio)
  values (gen_random_uuid(), pg_temp.i('T'), pg_temp.i('V1'), -5, 'efectivo')$$, '23514', null, 'check: un pago negativo exige anula_id');
select throws_ok($$insert into public.proveedor_pagos (id, negocio_id, proveedor_id, monto, medio, anula_id)
  values (gen_random_uuid(), pg_temp.i('T'), pg_temp.i('V1'), 5, 'efectivo', pg_temp.i('Q1'))$$, '23514', null, 'check: un reverso exige monto negativo');
select throws_ok($$insert into public.proveedor_pagos (id, negocio_id, proveedor_id, monto, medio, anula_id)
  values (gen_random_uuid(), pg_temp.i('T'), pg_temp.i('V4'), -10, 'efectivo', pg_temp.i('Q3'))$$, '23505', null, 'un pago no se revierte dos veces (índice único)');

-- 10. Reconciliación global stock = suma del kardex
select is((select count(*) from public.stock s where s.negocio_id in (pg_temp.i('T'), pg_temp.i('F'))
  and s.cantidad <> (select coalesce(sum(m.cantidad), 0) from public.movimientos_inventario m
                     where m.producto_id = s.producto_id and m.ubicacion_id = s.ubicacion_id)), 0::bigint,
  'stock = suma del kardex en todos los productos de la prueba');

select * from finish();
rollback;
