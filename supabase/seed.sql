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
  ('c0000000-0000-0000-0000-000000000007'::uuid, 'multi@erp.test', 'Multinegocio Demo'),
  ('c0000000-0000-0000-0000-000000000008'::uuid, 'baneable@erp.test', 'Cuenta Baneable')
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
  ('c0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'empleado'),
  ('c0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'empleado');

insert into public.dispositivos (negocio_id, ubicacion_id, nombre, prefijo) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Caja 1', 'C1');

-- Catálogo de desarrollo: Tienda (2 productos en USD, 1 sin precio), Frial (cortes en kg), Lavandería (servicios).
insert into public.categorias (id, negocio_id, nombre) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Celulares'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Accesorios'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Cortes'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Lavado');

insert into public.productos (id, negocio_id, codigo, codigo_barras, nombre, marca, categoria_id, tipo, unidad) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'CEL-001', '7770000000011', 'Celular Demo A', 'Marca X', 'd0000000-0000-0000-0000-000000000001', 'producto', 'unidad'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'CEL-002', '7770000000028', 'Celular Demo B', 'Marca X', 'd0000000-0000-0000-0000-000000000001', 'producto', 'unidad'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'ACC-001', '7770000000035', 'Funda Demo', 'Marca Y', 'd0000000-0000-0000-0000-000000000002', 'producto', 'unidad'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'ACC-002', '7770000000042', 'Cargador Demo', 'Marca Y', 'd0000000-0000-0000-0000-000000000002', 'producto', 'unidad'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'ACC-003', null, 'Cable Demo', 'Marca Y', 'd0000000-0000-0000-0000-000000000002', 'producto', 'unidad'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'ACC-004', null, 'Audífono Demo sin precio', null, 'd0000000-0000-0000-0000-000000000002', 'producto', 'unidad'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'COR-001', null, 'Corte Demo A', null, 'd0000000-0000-0000-0000-000000000003', 'producto', 'kg'),
  ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000003', 'COR-002', null, 'Corte Demo B', null, 'd0000000-0000-0000-0000-000000000003', 'producto', 'kg'),
  ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'SRV-001', null, 'Lavado de prenda', null, 'd0000000-0000-0000-0000-000000000004', 'servicio', 'unidad'),
  ('e0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000002', 'SRV-002', null, 'Planchado', null, 'd0000000-0000-0000-0000-000000000004', 'servicio', 'unidad');

insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda)
select p.negocio_id, p.producto_id, l.lista, round(p.base * l.factor, 2), p.moneda
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, 200::numeric, 'USD'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000002'::uuid, 350::numeric, 'USD'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000003'::uuid, 40::numeric, 'BOB'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000004'::uuid, 80::numeric, 'BOB'),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid, 25::numeric, 'BOB'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'e0000000-0000-0000-0000-000000000007'::uuid, 60::numeric, 'BOB'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'e0000000-0000-0000-0000-000000000008'::uuid, 45::numeric, 'BOB')
) as p (negocio_id, producto_id, base, moneda)
cross join (values ('contado', 1::numeric), ('credito', 1.1::numeric), ('mayorista', 0.9::numeric), ('minimo', 0.8::numeric)) as l (lista, factor);

insert into public.producto_precios (negocio_id, producto_id, lista, monto, moneda) values
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000009', 'normal', 15, 'BOB'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000009', 'express', 25, 'BOB'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-00000000000a', 'normal', 10, 'BOB'),
  ('a0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-00000000000a', 'express', 18, 'BOB');

insert into public.tipos_cambio (negocio_id, valor) values ('a0000000-0000-0000-0000-000000000001', 6.96);

-- Stock inicial por kardex (el trigger arma `stock`). Tienda Demo: Tienda y Depósito. Frial: kg con decimales.
insert into public.movimientos_inventario (negocio_id, ubicacion_id, producto_id, tipo, cantidad, costo_unitario, ref_tipo, motivo)
select p.negocio_id, p.ubicacion_id, p.producto_id, 'inicial', p.cantidad, p.costo, 'seed', 'Stock inicial de desarrollo'
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, 5::numeric, 1200::numeric),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000001'::uuid, 10::numeric, 1200::numeric),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000002'::uuid, 3::numeric, 2100::numeric),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000003'::uuid, 40::numeric, 12.5::numeric),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000003'::uuid, 60::numeric, 12.5::numeric),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000004'::uuid, 25::numeric, 35::numeric),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid, 'e0000000-0000-0000-0000-000000000005'::uuid, 80::numeric, 8::numeric),
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'e0000000-0000-0000-0000-000000000006'::uuid, 12::numeric, 20::numeric),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'e0000000-0000-0000-0000-000000000007'::uuid, 35.250::numeric, 38.4::numeric),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'b0000000-0000-0000-0000-000000000004'::uuid, 'e0000000-0000-0000-0000-000000000008'::uuid, 18.5::numeric, 27::numeric)
) as p (negocio_id, ubicacion_id, producto_id, cantidad, costo);

-- Clientes de prueba (ficticios), uno por negocio de tienda.
insert into public.clientes (id, negocio_id, nombre, ci_nit, telefono, direccion) values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Cliente Demo', '0000001', '70000001', 'Calle Ficticia 1');
