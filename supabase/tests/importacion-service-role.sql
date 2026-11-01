-- Privilegios mínimos de service_role para scripts/importacion/. El kardex sigue append-only y stock lo escribe el trigger.
begin;
select plan(4);

select ok(
  has_table_privilege('service_role', 'public.productos', 'INSERT')
    and has_table_privilege('service_role', 'public.movimientos_inventario', 'INSERT')
    and has_table_privilege('service_role', 'public.categorias', 'INSERT'),
  'service_role inserta productos, categorías y movimientos'
);
select ok(
  not has_table_privilege('service_role', 'public.stock', 'INSERT')
    and not has_table_privilege('service_role', 'public.stock', 'UPDATE')
    and not has_table_privilege('service_role', 'public.auditoria', 'INSERT'),
  'service_role no escribe stock ni auditoria: lo hacen los triggers'
);
select ok(
  not has_table_privilege('service_role', 'public.productos', 'UPDATE')
    and not has_table_privilege('service_role', 'public.productos', 'DELETE')
    and not has_table_privilege('service_role', 'public.movimientos_inventario', 'UPDATE')
    and not has_table_privilege('service_role', 'public.movimientos_inventario', 'DELETE'),
  'service_role no modifica ni borra productos ni kardex'
);
select ok(
  not has_table_privilege('service_role', 'public.producto_precios', 'INSERT')
    and not has_table_privilege('service_role', 'public.tipos_cambio', 'INSERT'),
  'service_role no escribe precios ni tipos de cambio'
);

select * from finish();
rollback;
