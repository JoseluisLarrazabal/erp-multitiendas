-- M-12: sin_tildes y los campos calculados `busqueda`; anon no ejecuta ninguno.
begin;
select plan(8);
select is(public.sin_tildes('María José ÑANDÚ'), 'Maria Jose NANDU', 'sin_tildes quita tildes y la virgulilla');
insert into public.negocios (id, nombre, tipo) values ('aaaaaaaa-3100-0000-0000-000000000001', 'T', 'tienda');
insert into public.productos (id, negocio_id, codigo, codigo_barras, nombre, marca, modelo, tipo) values
  ('eeeeeeee-3100-0000-0000-000000000001', 'aaaaaaaa-3100-0000-0000-000000000001', 'CÓD1', '123', 'Café molido', 'Ñandú', 'Año', 'producto');
insert into public.clientes (id, negocio_id, nombre) values
  ('cccccccc-3100-0000-0000-000000000001', 'aaaaaaaa-3100-0000-0000-000000000001', 'María Pérez');
select is((select public.busqueda(p) from public.productos_lista p where p.id = 'eeeeeeee-3100-0000-0000-000000000001'),
  'COD1 123 Cafe molido Nandu Ano', 'busqueda de productos_lista');
select is((select public.busqueda(i) from public.inventario_lista i where i.id = 'eeeeeeee-3100-0000-0000-000000000001'),
  'COD1 123 Cafe molido Nandu', 'busqueda de inventario_lista');
select is((select public.busqueda(c) from public.clientes c where c.id = 'cccccccc-3100-0000-0000-000000000001'), 'Maria Perez', 'busqueda de clientes');
select hasnt_function('public', 'busqueda', array['ordenes'], 'no hay busqueda(ordenes): la fila entera exige huella');
select ok(not has_function_privilege('anon', 'public.sin_tildes(text)', 'execute'), 'anon no ejecuta sin_tildes');
select ok(not has_function_privilege('anon', 'public.busqueda(public.clientes)', 'execute'), 'anon no ejecuta busqueda(clientes)');
select ok(has_function_privilege('authenticated', 'public.busqueda(public.productos_lista)', 'execute'), 'authenticated ejecuta busqueda(productos_lista)');
select * from finish();
rollback;
