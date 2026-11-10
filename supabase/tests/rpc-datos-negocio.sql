-- guardar_datos_negocio: permiso, normalización, límites y auditoría. Cubre RF-VEN-05 y RF-LAV-03.
begin;
select plan(13);
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.i(n text) returns uuid language sql as $$ select md5('t8100' || n)::uuid $$;
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.i(n), n || '@test.local', jsonb_build_object('nombre', n) from (values ('d'), ('v'), ('x')) u (n);
insert into public.negocios (id, nombre, tipo) values (pg_temp.i('T'), 'T', 'tienda'), (pg_temp.i('L'), 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  (pg_temp.i('d'), pg_temp.i('T'), 'dueno'), (pg_temp.i('v'), pg_temp.i('T'), 'vendedor'), (pg_temp.i('x'), pg_temp.i('L'), 'dueno');

select pg_temp.como(pg_temp.i('d'));
select lives_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), '  1234567 ', E'  Av. Siempre Viva 123\r\nTel. 7000000  ')$$, 'el dueño guarda');
select is((select nit || '|' || datos_nota from public.negocios where id = pg_temp.i('T')), E'1234567|Av. Siempre Viva 123\nTel. 7000000', 'se lee normalizado (btrim y CRLF a LF)');
select is((select count(*) from public.auditoria where tabla = 'negocios' and negocio_id = pg_temp.i('T'))::integer, 1, 'el cambio audita una fila');
select is((select antes::text || '/' || (despues ->> 'nit') from public.auditoria where tabla = 'negocios' and negocio_id = pg_temp.i('T')), '{"nit": null, "datos_nota": null}/1234567', 'antes y después');
select public.guardar_datos_negocio(pg_temp.i('T'), '1234567', E'Av. Siempre Viva 123\nTel. 7000000');
select is((select count(*) from public.auditoria where tabla = 'negocios' and negocio_id = pg_temp.i('T'))::integer, 1, 'guardar lo mismo no audita');
select throws_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), repeat('9', 21), null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'NIT de 21 caracteres');
select throws_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), E'12\n34', null)$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'NIT con salto de línea');
select throws_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), null, repeat('a', 301))$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'nota de 301 caracteres');
select throws_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), null, E'1\n2\n3\n4\n5\n6\n7')$$, 'P0001', 'ERP_DATOS_INVALIDOS', 'nota de 7 líneas');
select lives_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), '   ', E' \n ')$$, 'vacío se acepta');
select is((select nit is null and datos_nota is null from public.negocios where id = pg_temp.i('T')), true, 'vacío guarda null');
select pg_temp.como(pg_temp.i('v'));
select throws_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), '1', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'vendedor sin permiso');
select pg_temp.como(pg_temp.i('x'));
select throws_ok($$select public.guardar_datos_negocio(pg_temp.i('T'), '1', null)$$, 'P0001', 'ERP_SIN_PERMISO', 'dueño de otro negocio');
select * from finish();
rollback;
