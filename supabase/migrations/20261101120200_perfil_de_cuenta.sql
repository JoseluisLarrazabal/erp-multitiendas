-- Cuenta y perfil nacen juntos: un trigger sobre auth.users crea el perfil.
-- perfiles.activo no se escribe a mano: otro trigger lo deriva de auth.users.banned_until,
-- así el baneo de Auth (que corta el login) y el flag (que corta el JWT vivo) no se desincronizan.

create function public.crear_perfil_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nombre'), ''), new.email, 'Sin nombre')
  );
  return new;
end;
$$;

create function public.sincronizar_activo_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.perfiles
  set activo = (new.banned_until is null or new.banned_until <= now())
  where id = new.id;
  return new;
end;
$$;

-- Solo las disparan los triggers: nadie las llama por RPC.
revoke all on function public.crear_perfil_de_cuenta() from public, anon, authenticated, service_role;
revoke all on function public.sincronizar_activo_de_cuenta() from public, anon, authenticated, service_role;

create trigger crear_perfil_de_cuenta
  after insert on auth.users
  for each row execute function public.crear_perfil_de_cuenta();

create trigger sincronizar_activo_de_cuenta
  after update of banned_until on auth.users
  for each row
  when (old.banned_until is distinct from new.banned_until)
  execute function public.sincronizar_activo_de_cuenta();
