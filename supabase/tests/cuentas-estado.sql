-- Estado de la cuenta: perfiles.activo sigue a auth.users.banned_until (trigger); regla 3 vía puede_administrar_cuenta;
-- última pertenencia y reactivación.
begin;
select plan(22);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;
create function pg_temp.activo_de(p_usuario uuid) returns boolean language sql as $$
  select activo from public.perfiles where id = p_usuario
$$;

-- T tienda, L lavandería.
-- d: dueño de T y L · enc_l: encargado de L · emp_l: empleado de L · v: vendedor de T · m: vendedor en T y empleado en L
select pg_temp.crear_usuario(('99999999-2000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'enc_l'), ('3', 'emp_l'), ('4', 'v'), ('5', 'm')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-2000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-2000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-2000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000001', 'dueno'),
  ('99999999-2000-0000-0000-000000000001', 'aaaaaaaa-2000-0000-0000-000000000002', 'dueno'),
  ('99999999-2000-0000-0000-000000000002', 'aaaaaaaa-2000-0000-0000-000000000002', 'encargado'),
  ('99999999-2000-0000-0000-000000000003', 'aaaaaaaa-2000-0000-0000-000000000002', 'empleado'),
  ('99999999-2000-0000-0000-000000000004', 'aaaaaaaa-2000-0000-0000-000000000001', 'vendedor'),
  ('99999999-2000-0000-0000-000000000005', 'aaaaaaaa-2000-0000-0000-000000000001', 'vendedor'),
  ('99999999-2000-0000-0000-000000000005', 'aaaaaaaa-2000-0000-0000-000000000002', 'empleado');

-- Trigger: el baneo baja el flag; el mismo JWT deja de servir; quitar el baneo lo reactiva.
select is(pg_temp.activo_de('99999999-2000-0000-0000-000000000005'), true, 'baneo: m nace activa');
update auth.users set banned_until = now() + interval '100 years' where id = '99999999-2000-0000-0000-000000000005';
select is(pg_temp.activo_de('99999999-2000-0000-0000-000000000005'), false, 'baneo: m queda inactiva');
select pg_temp.como('99999999-2000-0000-0000-000000000005');
select is((select count(*) from public.mis_negocios()), 0::bigint, 'baneo: mis_negocios vacío con el mismo JWT');
select ok(not public.tiene_permiso('aaaaaaaa-2000-0000-0000-000000000001', 'vender'), 'baneo: tiene_permiso falso con el mismo JWT');
reset role;
update auth.users set banned_until = null where id = '99999999-2000-0000-0000-000000000005';
select is(pg_temp.activo_de('99999999-2000-0000-0000-000000000005'), true, 'baneo: quitar el ban reactiva');
select pg_temp.como('99999999-2000-0000-0000-000000000005');
select is((select count(*) from public.mis_negocios()), 2::bigint, 'baneo: m vuelve a ver sus negocios');
reset role;
update auth.users set banned_until = now() - interval '1 hour' where id = '99999999-2000-0000-0000-000000000005';
select is(pg_temp.activo_de('99999999-2000-0000-0000-000000000005'), true, 'baneo: un ban ya vencido no desactiva');
update auth.users set banned_until = now() + interval '1 day' where id = '99999999-2000-0000-0000-000000000005';
update public.perfiles set activo = true where id = '99999999-2000-0000-0000-000000000005';
update auth.users set email = 'm2@test.local' where id = '99999999-2000-0000-0000-000000000005';
select is(pg_temp.activo_de('99999999-2000-0000-0000-000000000005'), true, 'baneo: el trigger solo reacciona si banned_until cambió');
update auth.users set banned_until = null where id = '99999999-2000-0000-0000-000000000005';

-- authenticated no toca perfiles: el estado solo cambia por Auth.
select pg_temp.como('99999999-2000-0000-0000-000000000001');
select throws_ok($$update public.perfiles set activo = false where id = '99999999-2000-0000-0000-000000000004'$$, '42501', null, 'perfiles: authenticated no puede UPDATE');
select throws_ok($$insert into public.perfiles (id, nombre) values (gen_random_uuid(), 'x')$$, '42501', null, 'perfiles: authenticated no puede INSERT');
select throws_ok($$delete from public.perfiles where id = '99999999-2000-0000-0000-000000000004'$$, '42501', null, 'perfiles: authenticated no puede DELETE');
select ok(not has_function_privilege('authenticated', 'public.es_dueno(uuid)', 'EXECUTE'), 'es_dueno: authenticated no la ejecuta');
select ok(not has_function_privilege('authenticated', 'public.sincronizar_activo_de_cuenta()', 'EXECUTE'), 'trigger de estado: authenticated no lo ejecuta');

-- Regla 3 vía puede_administrar_cuenta (la consulta la Edge Function antes de banear).
select ok(public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000005'), 'regla 3: d administra a m (usuarios en T y L)');
select pg_temp.como('99999999-2000-0000-0000-000000000004');
select ok(not public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000003'), 'regla 3: el vendedor no administra cuentas');
select pg_temp.como('99999999-2000-0000-0000-000000000002');
select ok(not public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000004'), 'regla 3: enc_l no toca una cuenta solo de T');
select ok(not public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000005'), 'regla 3: enc_l no administra a m, que tiene un negocio sin usuarios');
select ok(not public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000001'), 'regla 3: enc_l no administra a un dueño');
select ok(not public.puede_administrar_cuenta('88888888-2000-0000-0000-000000000001'), 'regla 3: cuenta inexistente');
select ok(public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000003'), 'regla 3: enc_l administra a emp_l (solo L)');
select ok(not public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000002'), 'regla 2: nadie se administra a sí mismo');

-- Una cuenta desactivada conserva su negocio (quitar_usuario rechaza el último): sigue administrable para reactivarla.
reset role;
update auth.users set banned_until = now() + interval '100 years' where id = '99999999-2000-0000-0000-000000000003';
select pg_temp.como('99999999-2000-0000-0000-000000000002');
select ok(public.puede_administrar_cuenta('99999999-2000-0000-0000-000000000003'), 'reactivar: la cuenta desactivada sigue administrable');

select * from finish();
rollback;
