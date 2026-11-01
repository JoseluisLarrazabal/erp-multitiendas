begin;
select plan(1);

select is(
  (select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0::bigint,
  'toda tabla de public tiene RLS activo'
);

select * from finish();
rollback;
