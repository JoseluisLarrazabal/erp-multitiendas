-- Revisa el catálogo, no tablas concretas: una tabla o función nueva con privilegios de más hace fallar el test.
begin;
select plan(5);

select is(
  (select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0::bigint,
  'toda tabla de public tiene RLS activo'
);

select is(
  (select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE'))),
  0::bigint,
  'anon no puede escribir en ninguna tabla de public'
);

select is(
  (select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE')
        or has_table_privilege('authenticated', c.oid, 'DELETE')
        or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))),
  0::bigint,
  'authenticated no puede escribir directo en ninguna tabla de public'
);

select is(
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0::bigint,
  'anon no ejecuta ninguna función propia de public'
);

select is(
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not coalesce(p.proconfig, '{}') && array['search_path=""']),
  0::bigint,
  'toda función security definer de public fija search_path vacío'
);

select * from finish();
rollback;
