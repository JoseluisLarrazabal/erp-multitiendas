-- Matriz de permisos inicial (docs/srs.md, sección 4). Es dato de producción, no de prueba.
-- D dueño, E encargado, C contador, V vendedor y empleado. Tienda y frial usan la misma grilla.

with grilla (permiso, tienda_frial, lavanderia) as (values
  ('vender',               'DEV', 'DEV'),
  ('ver_costos',           'DEC', 'DEC'),
  ('descontar',            'DE',  'DEV'),
  ('anular',               'DEV', 'DEV'),
  ('devolver_fuera_plazo', 'DE',  'DE'),
  ('ajustar_inventario',   'DE',  'DE'),
  ('editar_productos',     'DE',  'DE'),
  ('ver_reportes',         'DEC', 'DEC'),
  ('caja',                 'DEV', 'DEV'),
  ('usuarios',             'D',   'DE'),
  ('cambiar_estado_orden', '',    'DEV'),
  ('gestionar_credito',    'DE',  ''),
  ('gestionar_reservas',   'DEV', ''),
  ('gestionar_compras',    'DE',  'DE')
),
roles (letra, rol) as (values
  ('D', 'dueno'), ('E', 'encargado'), ('C', 'contador'), ('V', 'vendedor'), ('V', 'empleado')
)
insert into public.rol_permisos (tipo_negocio, rol, permiso)
select t.tipo, r.rol, g.permiso
from grilla g
cross join lateral (values
  ('tienda', g.tienda_frial), ('frial', g.tienda_frial), ('lavanderia', g.lavanderia)
) as t (tipo, letras)
join roles r on position(r.letra in t.letras) > 0;
