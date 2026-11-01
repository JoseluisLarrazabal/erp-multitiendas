-- Policies del bucket `productos`: leer con mis_negocios(), escribir con editar_productos, por negocio de la ruta.
begin;
select plan(11);
-- preámbulo común (se copia en cada test)
create function pg_temp.como(p_uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.crear_usuario(p_id uuid, p_nombre text) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (p_id, p_nombre || '@test.local', jsonb_build_object('nombre', p_nombre))
$$;

-- T y L. e: encargado de T · v: vendedor de T · x: dueño de L
select pg_temp.crear_usuario(('99999999-6000-0000-0000-00000000000' || n)::uuid, nombre)
  from (values ('1', 'e'), ('2', 'v'), ('3', 'x')) u (n, nombre);
insert into public.negocios (id, nombre, tipo) values
  ('aaaaaaaa-6000-0000-0000-000000000001', 'T', 'tienda'),
  ('aaaaaaaa-6000-0000-0000-000000000002', 'L', 'lavanderia');
insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('99999999-6000-0000-0000-000000000001', 'aaaaaaaa-6000-0000-0000-000000000001', 'encargado'),
  ('99999999-6000-0000-0000-000000000002', 'aaaaaaaa-6000-0000-0000-000000000001', 'vendedor'),
  ('99999999-6000-0000-0000-000000000003', 'aaaaaaaa-6000-0000-0000-000000000002', 'dueno');

select is((select file_size_limit from storage.buckets where id = 'productos'), 5242880::bigint, 'bucket: 5 MB');
select is((select public from storage.buckets where id = 'productos'), false, 'bucket: privado');
select is((select allowed_mime_types from storage.buckets where id = 'productos'),
  array['image/jpeg', 'image/png', 'image/webp'], 'bucket: solo JPEG, PNG y WebP');

-- El encargado de T sube a la carpeta de T.
select pg_temp.como('99999999-6000-0000-0000-000000000001');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('productos', 'aaaaaaaa-6000-0000-0000-000000000001/bbbbbbbb-6000-0000-0000-000000000001.jpg', '99999999-6000-0000-0000-000000000001')$$,
  'editar_productos sube a la carpeta de su negocio');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('productos', 'aaaaaaaa-6000-0000-0000-000000000002/bbbbbbbb-6000-0000-0000-000000000002.jpg', '99999999-6000-0000-0000-000000000001')$$,
  '42501', null, 'no sube a la carpeta de otro negocio');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('productos', 'no-es-uuid/x.jpg', '99999999-6000-0000-0000-000000000001')$$,
  '42501', null, 'ruta sin uuid: rechazada sin error de cast');

-- El vendedor de T lee, no escribe. (El borrado directo lo bloquea storage.protect_delete: solo por la API.)
select pg_temp.como('99999999-6000-0000-0000-000000000002');
select is((select count(*) from storage.objects where bucket_id = 'productos'), 1::bigint, 'el vendedor lee las fotos de su negocio');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('productos', 'aaaaaaaa-6000-0000-0000-000000000001/bbbbbbbb-6000-0000-0000-000000000003.png', '99999999-6000-0000-0000-000000000002')$$,
  '42501', null, 'el vendedor no sube');
update storage.objects set metadata = '{"x":1}' where bucket_id = 'productos';
select is((select count(*) from storage.objects where bucket_id = 'productos' and name like 'aaaaaaaa-6000-%' and metadata is not null), 0::bigint, 'el vendedor no modifica');

-- Otro negocio: no lee ni borra.
select pg_temp.como('99999999-6000-0000-0000-000000000003');
select is((select count(*) from storage.objects where bucket_id = 'productos'), 0::bigint, 'otro negocio no lee');
update storage.objects set metadata = '{"x":1}' where bucket_id = 'productos';
reset role;
select is((select count(*) from storage.objects where bucket_id = 'productos' and name like 'aaaaaaaa-6000-%' and metadata is not null), 0::bigint, 'otro negocio no modifica');

select * from finish();
rollback;
