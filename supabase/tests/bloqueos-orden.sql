-- Orden de bloqueos de bloquear_stock y registrar_conteo, probado de verdad con dos conexiones (dblink).
-- La prueba toma Y con for update; otra conexión pide [Y, X] (X < Y por uuid) y queda esperando en Y. Si ya tomó X, ordenó:
-- el nowait sobre X da 55P03. Sin el order by esperaría en Y sin tener X y el nowait pasaría (la prueba falla).
-- No espera un tiempo fijo: consulta pg_stat_activity hasta ver a la otra conexión esperando un bloqueo (tope 5 s).
-- Usa los productos del seed (la otra conexión solo ve lo confirmado). Nada se confirma: al final se cancela y desconecta.
begin;
select plan(5);
create extension if not exists dblink with schema extensions;

create temp table pids (nombre text primary key, pid integer);
-- Guarda el pid del backend remoto (dblink no lo expone): se pregunta antes de mandar la consulta larga.
create function pg_temp.conectar(p_nombre text) returns void language plpgsql as $$
begin
  perform extensions.dblink_connect(p_nombre, format('host=%s port=%s dbname=%s user=postgres password=postgres',
    host(inet_server_addr()), current_setting('port'), current_database()));
  insert into pids select p_nombre, t.pid from extensions.dblink(p_nombre, 'select pg_backend_pid()') as t(pid integer);
end
$$;
create function pg_temp.esperando(p_nombre text) returns boolean language plpgsql as $$
begin
  for i in 1..100 loop
    perform pg_stat_clear_snapshot(); -- dentro de una transacción pg_stat_activity se queda con la primera lectura
    if exists (select 1 from pg_stat_activity a join pids p on p.pid = a.pid
               where p.nombre = p_nombre and a.wait_event_type = 'Lock') then
      return true;
    end if;
    perform pg_sleep(0.05);
  end loop;
  return false;
end
$$;
create function pg_temp.desconectar(p_nombre text) returns void language plpgsql as $$
begin
  perform extensions.dblink_cancel_query(p_nombre);
  perform extensions.dblink_disconnect(p_nombre);
end
$$;
-- X = e...01 < Y = e...02, ambos con fila de stock en la Tienda del seed (la crea el kardex del seed).
select lives_ok($$select pg_temp.conectar('c1')$$, 'dblink conecta a la base local');
-- Sin order by, el for update bloquea en el orden en que el plan lee la tabla (con el índice saldría ordenado por casualidad).
-- La otra conexión lee en el orden físico (sin índices) y un UPDATE sin cambios, confirmado, manda la fila de X después
-- de la de Y: así quitar el order by sí hace fallar la prueba. No cambia ningún dato.
select extensions.dblink_exec('c1', $q$update public.stock set cantidad = cantidad
  where ubicacion_id = 'b0000000-0000-0000-0000-000000000001' and producto_id = 'e0000000-0000-0000-0000-000000000001'$q$);
select 1 from public.stock
  where ubicacion_id = 'b0000000-0000-0000-0000-000000000001' and producto_id = 'e0000000-0000-0000-0000-000000000002' for update;

-- bloquear_stock(T, U, [Y, X])
select extensions.dblink_send_query('c1', $q$set enable_indexscan = off; set enable_bitmapscan = off;
  select public.bloquear_stock('a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001', array['e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001']::uuid[])$q$);
select ok(pg_temp.esperando('c1'), 'bloquear_stock: la otra conexión espera un bloqueo');
select throws_ok($$select 1 from public.stock where ubicacion_id = 'b0000000-0000-0000-0000-000000000001'
  and producto_id = 'e0000000-0000-0000-0000-000000000001' for update nowait$$, '55P03', null,
  'bloquear_stock: ya tenía X cuando esperaba Y (ordena por producto_id)');
select pg_temp.desconectar('c1');

-- registrar_conteo(T, U, [Y, X]) como el dueño del seed
select pg_temp.conectar('c2');
select extensions.dblink_send_query('c2', $q$
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  select public.registrar_conteo(gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('producto_id', 'e0000000-0000-0000-0000-000000000002', 'cantidad_contada', 1),
                      jsonb_build_object('producto_id', 'e0000000-0000-0000-0000-000000000001', 'cantidad_contada', 1)), 'orden')$q$);
select ok(pg_temp.esperando('c2'), 'registrar_conteo: la otra conexión espera un bloqueo');
select throws_ok($$select 1 from public.stock where ubicacion_id = 'b0000000-0000-0000-0000-000000000001'
  and producto_id = 'e0000000-0000-0000-0000-000000000001' for update nowait$$, '55P03', null,
  'registrar_conteo: ya tenía X cuando esperaba Y (ordena por producto_id)');
select pg_temp.desconectar('c2');

select * from finish();
rollback;
