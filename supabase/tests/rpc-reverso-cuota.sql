-- Reverso del último pago de cuota (M-2) y marcar documentos del crédito (M-6): permisos, solo el último pago vivo, pago mixto,
-- arqueo (efectivo esperado y QR) en la caja elegida sin tocar el arqueo cerrado, idempotencia, caja cerrada, efectivo
-- insuficiente, crédito pagado que vuelve a activo, checks del contraasiento y auditoría de documentos.
begin;
select plan(89);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t1202' || n)::uuid $$;
create function pg_temp.crear_usuario(p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (pg_temp.i(p_nombre), p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
-- d dueño de T · e encargado de T · v vendedor de T · c contador de T · y dueño de T2
select pg_temp.crear_usuario(n) from (values ('d'), ('e'), ('v'), ('c'), ('y')) u (n);
insert into public.negocios (id, nombre, tipo, tope_descuento) values
  (pg_temp.i('T'), 'T', 'tienda', 10), (pg_temp.i('T2'), 'T2', 'tienda', 10);
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('e'), pg_temp.i('T'), 'encargado'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'),
  (pg_temp.i('c'), pg_temp.i('T'), 'contador'), (pg_temp.i('y'), pg_temp.i('T2'), 'dueno');
insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  (pg_temp.i('U1'), pg_temp.i('T'), 'U1', 'local'), (pg_temp.i('UX'), pg_temp.i('T2'), 'UX', 'local');
insert into public.dispositivos (id, negocio_id, ubicacion_id, nombre, prefijo) values
  (pg_temp.i('D1'), pg_temp.i('T'), pg_temp.i('U1'), 'D1', 'C1'), (pg_temp.i('D2'), pg_temp.i('T'), pg_temp.i('U1'), 'D2', 'C2'),
  (pg_temp.i('D3'), pg_temp.i('T'), pg_temp.i('U1'), 'D3', 'C3'), (pg_temp.i('D5'), pg_temp.i('T'), pg_temp.i('U1'), 'D5', 'C5'),
  (pg_temp.i('D6'), pg_temp.i('T'), pg_temp.i('U1'), 'D6', 'C6'), (pg_temp.i('D7'), pg_temp.i('T'), pg_temp.i('U1'), 'D7', 'C7'),
  (pg_temp.i('DX'), pg_temp.i('T2'), pg_temp.i('UX'), 'DX', 'X1');
-- S1 (inicial 100) · S2 (inicial 0) · S5 (inicial 5) · S6 (inicial 100, recibe un reverso sin cuotas propias) · S7 (cobra y se cierra) abiertas · SC cerrada (D3) · SX de otro negocio
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial) values
  (pg_temp.i('S1'), pg_temp.i('T'), pg_temp.i('D1'), pg_temp.i('d'), 100), (pg_temp.i('S2'), pg_temp.i('T'), pg_temp.i('D2'), pg_temp.i('d'), 0),
  (pg_temp.i('S5'), pg_temp.i('T'), pg_temp.i('D5'), pg_temp.i('d'), 5), (pg_temp.i('SX'), pg_temp.i('T2'), pg_temp.i('DX'), pg_temp.i('y'), 0),
  (pg_temp.i('S6'), pg_temp.i('T'), pg_temp.i('D6'), pg_temp.i('d'), 100), (pg_temp.i('S7'), pg_temp.i('T'), pg_temp.i('D7'), pg_temp.i('d'), 0);
insert into public.caja_sesiones (id, negocio_id, dispositivo_id, usuario_apertura, monto_inicial, cerrada_en, usuario_cierre,
  monto_contado, monto_esperado, diferencia) values
  (pg_temp.i('SC'), pg_temp.i('T'), pg_temp.i('D3'), pg_temp.i('d'), 0, now(), pg_temp.i('d'), 0, 0, 0);
insert into public.clientes (id, negocio_id, nombre) values (pg_temp.i('CL'), pg_temp.i('T'), 'Cliente');
insert into public.productos (id, negocio_id, codigo, nombre, tipo, unidad, controla_serie) values
  (pg_temp.i('P1'), pg_temp.i('T'), 'P1', 'P1', 'producto', 'unidad', false);
insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  (pg_temp.i('T'), pg_temp.i('P1'), 'contado', 10, 'BOB'), (pg_temp.i('T'), pg_temp.i('P1'), 'credito', 12, 'BOB');
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario) values
  (pg_temp.i('T'), pg_temp.i('U1'), pg_temp.i('P1'), 'inicial', 100, 4);

-- Venta a crédito en D1/S1: 10 de P1 a 12 = 120, inicial 60 en efectivo, 3 cuotas, documentos CI y pagaré.
create function pg_temp.vc(p_id text, p_num text) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.i(p_id), 'dispositivo_id', pg_temp.i('D1'), 'caja_sesion_id', pg_temp.i('S1'), 'numero', p_num,
    'creada_en_cliente', now(), 'cliente_id', pg_temp.i('CL'), 'total', 120,
    'condicion', 'credito', 'credito', jsonb_build_object('cuotas', 3, 'docs_ci', true, 'docs_domicilio', false, 'docs_pagare', true),
    'items', jsonb_build_array(jsonb_build_object('producto_id', pg_temp.i('P1'), 'lista', 'credito', 'cantidad', 10, 'precio_unitario', 12)),
    'pagos', jsonb_build_array(jsonb_build_object('medio', 'efectivo', 'monto', 60)))
$$;
create function pg_temp.cred(p_venta text) returns uuid language sql security definer as $$
  select id from public.creditos where venta_id = pg_temp.i(p_venta)
$$;
create function pg_temp.esp(p_ses text) returns numeric language sql security definer as $$
  select public.efectivo_esperado(pg_temp.i(p_ses))
$$;
create function pg_temp.qr(p_ses text) returns numeric language sql security definer as $$
  select public.total_qr_sesion(pg_temp.i(p_ses))
$$;
create function pg_temp.saldo(p_cred uuid) returns numeric language sql security definer as $$
  select (public.detalle_credito(p_cred) ->> 'saldo')::numeric
$$;
create function pg_temp.filas(p_cred uuid) returns bigint language sql security definer as $$
  select count(*) from public.credito_pagos where credito_id = p_cred
$$;
create function pg_temp.aud(p_cred uuid) returns bigint language sql security definer as $$
  select count(*) from public.auditoria where tabla = 'creditos' and registro_id = p_cred::text
$$;
create function pg_temp.ap(p_op text, p_pago text, p_ses text, p_disp text, p_motivo text default 'cobro por error') returns jsonb
language sql as $$
  select public.anular_pago_cuota(pg_temp.i(p_op), pg_temp.i(p_pago), pg_temp.i(p_ses), pg_temp.i(p_disp), p_motivo)
$$;
create function pg_temp.pc(p_id text, p_cred uuid, p_ses text, p_disp text, p_ef numeric, p_qr numeric) returns jsonb language sql as $$
  select public.pagar_cuota(jsonb_build_object('id', pg_temp.i(p_id), 'credito_id', p_cred, 'dispositivo_id', pg_temp.i(p_disp),
    'caja_sesion_id', pg_temp.i(p_ses), 'efectivo', p_ef, 'qr', p_qr))
$$;

-- Todo el archivo corre en una transacción: los pagos comparten now(). Para fijar el orden "último pago" se le da a cada cobro una
-- hora propia (el trigger append-only se apaga solo dentro de este helper de prueba).
create function pg_temp.hora(p_op text, p_horas integer) returns void language plpgsql security definer as $$
begin
  alter table public.credito_pagos disable trigger credito_pagos_solo_agregar;
  update public.credito_pagos set created_at = now() - make_interval(hours => p_horas) where operacion_id = pg_temp.i(p_op);
  alter table public.credito_pagos enable trigger credito_pagos_solo_agregar;
end;
$$;

select ok(has_function_privilege('authenticated', 'public.anular_pago_cuota(uuid, uuid, uuid, uuid, text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.marcar_documentos_credito(uuid, boolean, boolean, boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.anular_pago_cuota(uuid, uuid, uuid, uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.marcar_documentos_credito(uuid, boolean, boolean, boolean)', 'EXECUTE'),
  'solo authenticated ejecuta las dos; anon no');
select ok(not exists (select 1 from pg_proc p where p.proname in ('detalle_credito', 'anular_pago_cuota', 'marcar_documentos_credito')
    and p.pronamespace = 'public'::regnamespace group by p.proname having count(*) > 1), 'sin sobrecargas');

-- V1: saldo 63,02 (cuotas 21,01 / 21,01 / 21,00).
select pg_temp.como(pg_temp.i('e'));
select lives_ok($$select public.registrar_venta(pg_temp.vc('V1', 'C1-000001'))$$, 'V1: venta a crédito');
select is(pg_temp.saldo(pg_temp.cred('V1')), 63.02, 'V1: saldo inicial 63,02');
-- Q1 mixto (10 efectivo + 5 QR) en S2; Q2 de 20 en efectivo en S1.
select is((pg_temp.pc('Q1', pg_temp.cred('V1'), 'S2', 'D2', 10, 5)) ->> 'saldo', '48.02', 'Q1 mixto en S2');
select is((pg_temp.pc('Q2', pg_temp.cred('V1'), 'S1', 'D1', 20, 0)) ->> 'saldo', '28.02', 'Q2 en S1');
select pg_temp.hora('Q1', 3), pg_temp.hora('Q2', 2);
select is(pg_temp.filas(pg_temp.cred('V1')), 3::bigint, '3 filas de pago (Q1 dos medios, Q2)');
select is(public.detalle_credito(pg_temp.cred('V1')) ->> 'ultimo_pago_id', pg_temp.i('Q2')::text, 'ultimo_pago_id es Q2');

-- Permisos: ninguno escribe nada.
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'S1', 'D1')$$, 'ERP_SIN_PERMISO', 'vendedor no anula el pago');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'S1', 'D1')$$, 'ERP_SIN_PERMISO', 'contador no anula el pago');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'S1', 'D1')$$, 'ERP_SIN_PERMISO', 'dueño de otro negocio no anula el pago');
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'SX', 'DX')$$, 'ERP_SIN_PERMISO', 'ni con la caja de su negocio (el pago es ajeno)');
select pg_temp.como(pg_temp.i('e'));
select throws_ok($$select pg_temp.ap('R1', 'NOEXISTE', 'S1', 'D1')$$, 'ERP_SIN_PERMISO', 'pago inexistente: mismo error que ajeno');
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'S1', 'D2')$$, 'ERP_SIN_PERMISO', 'caja que no es de ese equipo');
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'SX', 'DX')$$, 'ERP_SIN_PERMISO', 'caja de otro negocio');
select is(pg_temp.filas(pg_temp.cred('V1')), 3::bigint, 'los rechazos no escribieron');
select is(pg_temp.saldo(pg_temp.cred('V1')), 28.02, 'el saldo no cambió');

-- Validaciones.
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'S1', 'D1', '   ')$$, 'ERP_DATOS_INVALIDOS', 'motivo vacío');
select throws_ok($$select pg_temp.ap('R1', 'Q2', 'S1', 'D1', repeat('x', 201))$$, 'ERP_DATOS_INVALIDOS', 'motivo de más de 200');
select lives_ok($$select pg_temp.ap('R0', 'Q2', 'S1', 'D1', repeat('x', 200))$$, 'motivo de exactamente 200 vale');
-- R0 anuló Q2: el resto de la prueba parte de Q2 anulada y Q1 como último pago.
select is(public.detalle_credito(pg_temp.cred('V1')) ->> 'ultimo_pago_id', pg_temp.i('Q1')::text, 'tras anular Q2, Q1 pasa a ser el último');
select is(pg_temp.saldo(pg_temp.cred('V1')), 48.02, 'saldo tras anular Q2');
select throws_ok($$select pg_temp.ap('R1', 'R0', 'S1', 'D1')$$, 'ERP_DATOS_INVALIDOS', 'apuntar a un reverso es inválido');
select is((select count(*) from public.credito_pagos where credito_id = pg_temp.cred('V1') and anula_operacion_id is not null), 1::bigint, 'una fila de reverso (Q2 era de un medio)');

-- Idempotencia.
select is(pg_temp.ap('R0', 'Q2', 'S1', 'D1', repeat('x', 200)), jsonb_build_object('id', pg_temp.i('R0'), 'saldo', 48.02), 'reintento idéntico: misma respuesta');
select is(pg_temp.filas(pg_temp.cred('V1')), 4::bigint, 'el reintento no escribe');
select throws_ok($$select pg_temp.ap('R0', 'Q2', 'S1', 'D1', 'otro motivo')$$, 'ERP_OPERACION_REPETIDA', 'misma operación con otro motivo');
select is(pg_temp.ap('R9', 'Q2', 'S1', 'D1', 'otra pestaña'), jsonb_build_object('id', pg_temp.i('R9'), 'saldo', 48.02, 'ya_anulado', true),
  'otra operación sobre un pago ya anulado: ya_anulado');
select is(pg_temp.filas(pg_temp.cred('V1')), 4::bigint, 'ya_anulado no escribe');

-- Q1 es el último vivo. Q3 nuevo pago encima: Q1 deja de ser el último.
select is((pg_temp.pc('Q3', pg_temp.cred('V1'), 'S1', 'D1', 8, 0)) ->> 'saldo', '40.02', 'Q3 en S1');
select pg_temp.hora('Q3', 1);
select throws_ok($$select pg_temp.ap('R1', 'Q1', 'S1', 'D1')$$, 'ERP_PAGO_NO_ES_ULTIMO', 'Q1 ya no es el último: ERP_PAGO_NO_ES_ULTIMO');
select is(pg_temp.filas(pg_temp.cred('V1')), 5::bigint, 'el rechazo no escribió');
select lives_ok($$select pg_temp.ap('R3', 'Q3', 'S1', 'D1', 'error de caja')$$, 'se anula Q3 y Q1 vuelve a ser el último');
select is(public.detalle_credito(pg_temp.cred('V1')) ->> 'ultimo_pago_id', pg_temp.i('Q1')::text, 'Q1 es otra vez el último');

-- Efectivo insuficiente: Q1 tiene 10 en efectivo; S5 tiene 5. Caja cerrada: SC.
select throws_ok($$select pg_temp.ap('R1', 'Q1', 'S5', 'D5')$$, 'ERP_EFECTIVO_INSUFICIENTE', 'efectivo mayor que el esperado de la caja elegida');
select throws_ok($$select pg_temp.ap('R1', 'Q1', 'SC', 'D3')$$, 'ERP_CAJA_CERRADA', 'una sesión cerrada no recibe el reverso');
select is(pg_temp.filas(pg_temp.cred('V1')), 6::bigint, 'ningún rechazo escribió (Q1 x2, Q2, R0, Q3, R3)');

-- Reverso mixto en OTRA caja, con la caja original (S2) ya cerrada.
select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.cerrar_caja(pg_temp.i('S2'), 10)$$, 'se cierra S2, la caja del cobro Q1');
select is((select monto_esperado from public.caja_sesiones where id = pg_temp.i('S2')), 10.00, 'S2 cerró esperando 10 de efectivo');
select throws_ok($$select pg_temp.ap('R1', 'Q1', 'S2', 'D2')$$, 'ERP_CAJA_CERRADA', 'el reverso no se escribe en la caja cerrada del cobro');
select pg_temp.como(pg_temp.i('e'));
create temp table antes as select pg_temp.esp('S1') as e1, pg_temp.qr('S1') as q1, pg_temp.esp('S2') as e2, pg_temp.qr('S2') as q2;
select is(pg_temp.ap('R1', 'Q1', 'S1', 'D1', 'cobro duplicado') ->> 'saldo', '63.02', 'reverso de Q1 en S1: saldo vuelve a 63,02');
select is(pg_temp.esp('S1'), (select e1 from antes) - 10, 'el efectivo esperado de S1 baja lo del efectivo (10)');
select is(pg_temp.qr('S1'), (select q1 from antes) - 5, 'el total QR de S1 baja lo del QR (5)');
select is(pg_temp.esp('S2'), (select e2 from antes), 'el efectivo esperado de S2 (cerrada) no cambia');
select is(pg_temp.qr('S2'), (select q2 from antes), 'el QR de S2 (cerrada) no cambia');
select is((select monto_esperado from public.caja_sesiones where id = pg_temp.i('S2')), 10.00, 'el arqueo guardado de S2 no cambia');
select is((select count(*) from public.credito_pagos where operacion_id = pg_temp.i('R1') and caja_sesion_id = pg_temp.i('S1') and monto < 0), 2::bigint,
  'el reverso mixto escribe una fila negativa por medio');
select is((select sum(monto) from public.credito_pagos where operacion_id = pg_temp.i('R1') and medio = 'qr'), -5.00, 'la fila QR es -5');
select is(public.detalle_credito(pg_temp.cred('V1')) ->> 'ultimo_pago_id', null, 'sin pagos vivos: ultimo_pago_id nulo');
select is(public.detalle_credito(pg_temp.cred('V1')) ->> 'estado', 'activo', 'V1 sigue activo');
select is((select sum(pagado) from jsonb_to_recordset(public.detalle_credito(pg_temp.cred('V1')) -> 'cuotas') as q (pagado numeric)), 0.00,
  'cuotas (FIFO) iguales a antes de cobrar: nada pagado');
select is((public.detalle_credito(pg_temp.cred('V1')) -> 'cuotas' -> 0 ->> 'pendiente')::numeric, 21.01, 'cuota 1 pendiente completa');
select is(jsonb_array_length(public.detalle_credito(pg_temp.cred('V1')) -> 'pagos'), 8, 'el detalle lista cobros y reversos');
select is((select count(*) from jsonb_array_elements(public.detalle_credito(pg_temp.cred('V1')) -> 'pagos') p where p ->> 'anula_operacion_id' is not null
  and p ->> 'motivo' is not null and (p ->> 'monto')::numeric < 0), 4::bigint, 'cada reverso trae anula_operacion_id, motivo y monto negativo');

-- Crédito pagado vuelve a activo y admite pagar otra vez (V2).
select lives_ok($$select public.registrar_venta(pg_temp.vc('V2', 'C1-000002'))$$, 'V2: otra venta a crédito');
select is((pg_temp.pc('P1', pg_temp.cred('V2'), 'S1', 'D1', 63.02, 0)) ->> 'saldo', '0.00', 'V2: se paga completo');
select pg_temp.hora('P1', 2);
select is((select estado from public.creditos where id = pg_temp.cred('V2')), 'pagado', 'V2: pagado');
select lives_ok($$select pg_temp.ap('RV2', 'P1', 'S1', 'D1', 'se cobró a otro cliente')$$, 'V2: se anula el pago final');
select is((select estado from public.creditos where id = pg_temp.cred('V2')), 'activo', 'V2: vuelve a activo');
select is(pg_temp.saldo(pg_temp.cred('V2')), 63.02, 'V2: saldo restaurado');
select is((pg_temp.pc('P2', pg_temp.cred('V2'), 'S1', 'D1', 10, 0)) ->> 'saldo', '53.02', 'V2: admite pagar_cuota otra vez');

-- resumen_caja: el reverso sale de S6 (sin cuotas cobradas) en negativo y la sesión cerrada del cobro (S7) no cambia.
select pg_temp.hora('P2', 1);
select is((pg_temp.pc('P3', pg_temp.cred('V2'), 'S7', 'D7', 10, 0)) ->> 'saldo', '43.02', 'V2: P3 de 10 en efectivo en S7');
select lives_ok($$select public.cerrar_caja(pg_temp.i('S7'), 10)$$, 'se cierra S7, la caja del cobro P3');
create temp table antes7 as select public.resumen_caja(pg_temp.i('S7')) as r;
select is(pg_temp.ap('RV3', 'P3', 'S6', 'D6', 'cobro en la caja equivocada') ->> 'saldo', '53.02', 'reverso de P3 en S6');
select is((public.resumen_caja(pg_temp.i('S6')) ->> 'cuotas_efectivo')::numeric, -10.00, 'resumen_caja S6: cuotas en efectivo en negativo por lo revertido');
select is((public.resumen_caja(pg_temp.i('S6')) ->> 'esperado')::numeric, 90.00, 'resumen_caja S6: esperado = inicial 100 menos el reverso');
select is((public.resumen_caja(pg_temp.i('S6')) ->> 'esperado')::numeric, pg_temp.esp('S6'), 'resumen_caja S6: esperado coincide con efectivo_esperado');
select is((public.resumen_caja(pg_temp.i('S7')) ->> 'cuotas_efectivo')::numeric, 10.00, 'resumen_caja S7 (cerrada): las cuotas cobradas no cambian');
select is(public.resumen_caja(pg_temp.i('S7')), (select r from antes7), 'resumen_caja S7 (cerrada): el resumen completo no cambia');

-- Checks del contraasiento y unicidad (como superusuario: authenticated no escribe en la tabla).
reset role;
select throws_ok($$insert into public.credito_pagos (negocio_id, credito_id, operacion_id, monto, medio, caja_sesion_id)
  values (pg_temp.i('T'), pg_temp.cred('V2'), pg_temp.i('X1'), -1, 'efectivo', pg_temp.i('S1'))$$, '23514', null, 'check: fila negativa sin anula_operacion_id');
select throws_ok($$insert into public.credito_pagos (negocio_id, credito_id, operacion_id, monto, medio, caja_sesion_id, anula_operacion_id, motivo)
  values (pg_temp.i('T'), pg_temp.cred('V2'), pg_temp.i('X2'), 1, 'efectivo', pg_temp.i('S1'), pg_temp.i('P2'), 'm')$$, '23514', null, 'check: fila positiva con anula_operacion_id');
select throws_ok($$insert into public.credito_pagos (negocio_id, credito_id, operacion_id, monto, medio, caja_sesion_id, anula_operacion_id)
  values (pg_temp.i('T'), pg_temp.cred('V2'), pg_temp.i('X3'), -1, 'efectivo', pg_temp.i('S1'), pg_temp.i('P2'))$$, '23514', null, 'check: reverso sin motivo');
select throws_ok($$insert into public.credito_pagos (negocio_id, credito_id, operacion_id, monto, medio, caja_sesion_id, anula_operacion_id, motivo)
  values (pg_temp.i('T'), pg_temp.cred('V2'), pg_temp.i('X4'), -63.02, 'efectivo', pg_temp.i('S1'), pg_temp.i('P1'), 'otra vez')$$, '23505', null, 'índice único: un pago no se revierte dos veces');
select throws_ok($$update public.credito_pagos set motivo = 'x'$$, null, null, 'credito_pagos sigue siendo append-only');

-- M-6: documentos (V1 nace con CI y pagaré).
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.marcar_documentos_credito(pg_temp.cred('V1'), true, true, true)$$, 'ERP_SIN_PERMISO', 'vendedor no marca documentos');
select pg_temp.como(pg_temp.i('c'));
select throws_ok($$select public.marcar_documentos_credito(pg_temp.cred('V1'), true, true, true)$$, 'ERP_SIN_PERMISO', 'contador no marca documentos');
select pg_temp.como(pg_temp.i('y'));
select throws_ok($$select public.marcar_documentos_credito(pg_temp.cred('V1'), true, true, true)$$, 'ERP_SIN_PERMISO', 'dueño de otro negocio no marca documentos');
select pg_temp.como(pg_temp.i('e'));
select is(pg_temp.aud(pg_temp.cred('V1')), 0::bigint, 'sin auditoría antes de marcar');
select lives_ok($$select public.marcar_documentos_credito(pg_temp.cred('V1'), true, true, true)$$, 'encargado marca el domicilio');
select is((select docs_domicilio from public.creditos where id = pg_temp.cred('V1')), true, 'domicilio marcado');
select is(pg_temp.aud(pg_temp.cred('V1')), 1::bigint, 'queda una fila de auditoría');
select lives_ok($$select public.marcar_documentos_credito(pg_temp.cred('V1'), true, true, true)$$, 'repetir lo mismo no falla');
select is(pg_temp.aud(pg_temp.cred('V1')), 1::bigint, 'sin cambios no audita');
select lives_ok($$select public.marcar_documentos_credito(pg_temp.cred('V1'), false, false, false)$$, 'se desmarcan todos');
select is((select docs_ci or docs_domicilio or docs_pagare from public.creditos where id = pg_temp.cred('V1')), false, 'desmarcados');
select is(pg_temp.aud(pg_temp.cred('V1')), 2::bigint, 'desmarcar también audita');
select throws_ok($$select public.marcar_documentos_credito(pg_temp.cred('V1'), null, true, true)$$, 'ERP_DATOS_INVALIDOS', 'nulo es inválido');
select lives_ok($$select public.crear_credito_inicial(pg_temp.i('CI1'), pg_temp.i('T'), pg_temp.i('CL'), 100, 2, current_date)$$, 'saldo inicial');
select throws_ok($$select public.marcar_documentos_credito(pg_temp.i('CI1'), true, true, true)$$, 'ERP_DATOS_INVALIDOS', 'un saldo inicial no lleva documentos');

select * from finish();
rollback;
