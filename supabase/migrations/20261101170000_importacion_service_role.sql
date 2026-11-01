-- scripts/importacion/ corre con service_role fuera de la app. Las tablas creadas por migración no le dan privilegios
-- de DML (solo REFERENCES, TRIGGER, TRUNCATE...), y las RPC exigen auth.uid(), que una clave de servicio no tiene.
-- Se le da lo mínimo: leer lo que concilia, y escribir categorías, productos y stock inicial (movimientos).
-- `stock` y `auditoria` los escriben los triggers (security definer): service_role solo los lee.
-- negocios y ubicaciones: el alta se hace por script y seed (docs/plan-fase-1.md).

grant select on public.negocios, public.ubicaciones, public.categorias, public.productos,
  public.movimientos_inventario, public.stock, public.auditoria to service_role;
grant insert on public.negocios, public.ubicaciones, public.categorias, public.productos,
  public.movimientos_inventario to service_role;
