-- Datos de desarrollo local. Todo ficticio; nunca datos reales del cliente.
-- Contraseña de todos los usuarios de prueba: Prueba-ERP-2026
-- Correos @erp.test. Los perfiles los crea el trigger sobre auth.users.

insert into public.negocios (id, nombre, tipo) values
  ('a0000000-0000-0000-0000-000000000001', 'Tienda Demo', 'tienda'),
  ('a0000000-0000-0000-0000-000000000002', 'Lavandería Demo', 'lavanderia'),
  ('a0000000-0000-0000-0000-000000000003', 'Frial Demo', 'frial');

insert into public.ubicaciones (id, negocio_id, nombre, tipo) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Tienda', 'local'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Depósito', 'deposito'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'Local', 'local'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'Local', 'local');

-- GoTrue falla si los campos de token son NULL: van como cadena vacía.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Prueba-ERP-2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('nombre', u.nombre), now(), now(),
  '', '', '', ''
from (values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'dueno@erp.test', 'Dueño Demo'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'encargado.tienda@erp.test', 'Encargado Tienda'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'contador.tienda@erp.test', 'Contador Tienda'),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'vendedor.tienda@erp.test', 'Vendedor Tienda'),
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'empleado.lavanderia@erp.test', 'Empleado Lavandería'),
  ('c0000000-0000-0000-0000-000000000006'::uuid, 'encargado.lavanderia@erp.test', 'Encargado Lavandería'),
  ('c0000000-0000-0000-0000-000000000007'::uuid, 'multi@erp.test', 'Multinegocio Demo')
) as u (id, email, nombre);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@erp.test';

insert into public.usuario_negocio (usuario_id, negocio_id, rol) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'dueno'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'dueno'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'dueno'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'encargado'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'contador'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'vendedor'),
  ('c0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'empleado'),
  ('c0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'encargado'),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'vendedor'),
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'empleado');

insert into public.dispositivos (negocio_id, ubicacion_id, nombre, prefijo) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Caja 1', 'C1');
