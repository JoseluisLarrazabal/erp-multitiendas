-- Ids para --negocio del import y conteos. Sin emails. Mismos marcadores que alta-produccion.sql.
select n.id as negocio_id, n.tipo,
       (select count(*) from public.ubicaciones u where u.negocio_id = n.id) as ubicaciones,
       (select count(*) from public.usuario_negocio un where un.negocio_id = n.id and un.rol = 'dueno') as duenos
from public.negocios n
where (n.nombre, n.tipo) in (($p$__NOMBRE_TIENDA__$p$, 'tienda'), ($p$__NOMBRE_LAVANDERIA__$p$, 'lavanderia'),
                             ($p$__NOMBRE_FRIAL__$p$, 'frial'))
order by n.tipo
