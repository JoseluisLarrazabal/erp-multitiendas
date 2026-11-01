-- Helpers de tenencia (RF-TR-03, RF-TR-05) y reglas de cuentas desactivadas / administrables (reglas 3 y 4).
begin;
select plan(31);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T tienda, L lavandería.
-- d: dueño de T y L · dl: dueño solo de L · enc_l: encargado de L · emp_l: empleado de L
-- enc_t: encargado de T · v: vendedor de T · m: vendedor en T y empleado en L · x: sin negocio
select pg_temp.crear_usuario(('44444444-0000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'd'), ('2', 'dl'), ('3', 'enc_l'), ('4', 'emp_l'), ('5', 'enc_t'), ('6', 'v'), ('7', 'm'), ('8', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('55555555-0000-0000-0000-000000000001', 'T', 'tienda'),
  ('55555555-0000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001', 'dueno'),
  ('44444444-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000002', 'dueno'),
  ('44444444-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002', 'dueno'),
  ('44444444-0000-0000-0000-000000000003', '55555555-0000-0000-0000-000000000002', 'encargado'),
  ('44444444-0000-0000-0000-000000000004', '55555555-0000-0000-0000-000000000002', 'empleado'),
  ('44444444-0000-0000-0000-000000000005', '55555555-0000-0000-0000-000000000001', 'encargado'),
  ('44444444-0000-0000-0000-000000000006', '55555555-0000-0000-0000-000000000001', 'vendedor'),
  ('44444444-0000-0000-0000-000000000007', '55555555-0000-0000-0000-000000000001', 'vendedor'),
  ('44444444-0000-0000-0000-000000000007', '55555555-0000-0000-0000-000000000002', 'empleado');

-- mis_negocios
select pg_temp.como('44444444-0000-0000-0000-000000000001');
select is((select count(*) from public.mis_negocios()), 2::bigint, 'mis_negocios: el dueño de T y L ve 2');
select pg_temp.como('44444444-0000-0000-0000-000000000006');
select results_eq('select * from public.mis_negocios()', $$values ('55555555-0000-0000-0000-000000000001'::uuid)$$, 'mis_negocios: el vendedor de T ve solo T');
select pg_temp.como('44444444-0000-0000-0000-000000000008');
select is((select count(*) from public.mis_negocios()), 0::bigint, 'mis_negocios: sin negocio, vacío');
select set_config('request.jwt.claims', '', true);
select is((select count(*) from public.mis_negocios()), 0::bigint, 'mis_negocios: sin sub en el JWT, vacío');

-- tiene_permiso
select pg_temp.como('44444444-0000-0000-0000-000000000001');
select ok(public.tiene_permiso('55555555-0000-0000-0000-000000000001', 'usuarios'), 'tiene_permiso: dueño tiene usuarios en T');
select pg_temp.como('44444444-0000-0000-0000-000000000006');
select ok(public.tiene_permiso('55555555-0000-0000-0000-000000000001', 'vender'), 'tiene_permiso: vendedor vende en T');
select ok(not public.tiene_permiso('55555555-0000-0000-0000-000000000001', 'usuarios'), 'tiene_permiso: vendedor no tiene usuarios');
select ok(not public.tiene_permiso('55555555-0000-0000-0000-000000000002', 'vender'), 'tiene_permiso: vendedor de T no vende en L');
select ok(not public.tiene_permiso('55555555-0000-0000-0000-000000000001', 'inexistente'), 'tiene_permiso: permiso desconocido es falso');
select ok(not public.tiene_permiso('99999999-0000-0000-0000-000000000001', 'vender'), 'tiene_permiso: negocio inexistente es falso');
select pg_temp.como('44444444-0000-0000-0000-000000000007');
select ok(public.tiene_permiso('55555555-0000-0000-0000-000000000002', 'cambiar_estado_orden'), 'tiene_permiso: el multinegocio usa el rol de cada negocio (empleado en L)');
select ok(not public.tiene_permiso('55555555-0000-0000-0000-000000000001', 'cambiar_estado_orden'), 'tiene_permiso: ...y vendedor en T no lo tiene');

-- comparte_negocio
select pg_temp.como('44444444-0000-0000-0000-000000000006');
select ok(public.comparte_negocio('44444444-0000-0000-0000-000000000001'), 'comparte_negocio: v comparte T con d');
select ok(public.comparte_negocio('44444444-0000-0000-0000-000000000007'), 'comparte_negocio: v comparte T con m');
select ok(not public.comparte_negocio('44444444-0000-0000-0000-000000000003'), 'comparte_negocio: v no comparte con enc_l');
select ok(not public.comparte_negocio('44444444-0000-0000-0000-000000000008'), 'comparte_negocio: nadie comparte con x');

-- puede_administrar_cuenta
select pg_temp.como('44444444-0000-0000-0000-000000000001');
select ok(public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000006'), 'puede_administrar: d sobre v (solo T)');
select ok(public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000007'), 'puede_administrar: d sobre m (T y L, usuarios en ambos)');
select ok(public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000002'), 'puede_administrar: dueño sobre otro dueño de un negocio propio');
select ok(not public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000001'), 'puede_administrar: nunca sobre sí mismo');
select ok(not public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000008'), 'puede_administrar: falso si el objetivo no tiene negocios');
select pg_temp.como('44444444-0000-0000-0000-000000000003');
select ok(public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000004'), 'puede_administrar: enc_l sobre emp_l (solo L)');
select ok(not public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000007'), 'puede_administrar: enc_l sobre m, que tiene T donde no tiene usuarios');
select ok(not public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000002'), 'puede_administrar: enc_l sobre un dueño de L');
select ok(not public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000001'), 'puede_administrar: enc_l sobre d (dueño, y con T)');
select set_config('request.jwt.claims', '', true);
select ok(not public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000006'), 'puede_administrar: sin sesión es falso');

-- Cuenta baneada en Auth (el trigger baja perfiles.activo): el mismo JWT deja de servir.
reset role;
update auth.users set banned_until = now() + interval '100 years' where id = '44444444-0000-0000-0000-000000000001';
select pg_temp.como('44444444-0000-0000-0000-000000000001');
select is((select count(*) from public.mis_negocios()), 0::bigint, 'desactivada: mis_negocios vacío con el mismo JWT');
select ok(not public.tiene_permiso('55555555-0000-0000-0000-000000000001', 'usuarios'), 'desactivada: tiene_permiso falso con el mismo JWT');
select ok(not public.puede_administrar_cuenta('44444444-0000-0000-0000-000000000006'), 'desactivada: puede_administrar falso');
select is((select count(*) from public.negocios), 0::bigint, 'desactivada: RLS de negocios no devuelve nada');
reset role;
update auth.users set banned_until = null where id = '44444444-0000-0000-0000-000000000001';
select pg_temp.como('44444444-0000-0000-0000-000000000001');
select is((select count(*) from public.mis_negocios()), 2::bigint, 'reactivada: vuelve a ver sus negocios');

select * from finish();
rollback;
