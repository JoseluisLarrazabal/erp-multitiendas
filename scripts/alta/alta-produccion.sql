-- Alta de los 3 negocios reales (tienda, lavandería, frial), sus ubicaciones y la membresía `dueno`
-- del primer dueño. Ninguna RPC lo hace; corre como postgres. No crea equipos, precios, tipo de cambio ni stock
-- (los equipos y el tope de descuento se cargan desde el panel).
--
-- `supabase db query` ejecuta UNA sola sentencia (protocolo extendido): por eso es un único bloque DO, atómico
-- (cualquier excepción deshace todo), y los parámetros entran como marcadores __X__ que alta-produccion.sh
-- reemplaza por variables de entorno. Los datos del cliente nunca viven en el repo.
-- Cumple RNF-12 (despliegue reproducible): el mismo script deja el mismo estado en local, CI y producción.
-- Invocación (desde cualquier directorio, con el dueño ya creado en el panel de Auth):
--   ALTA_DUENO_EMAIL=... ALTA_NEGOCIO_TIENDA=... ALTA_NEGOCIO_LAVANDERIA=... ALTA_NEGOCIO_FRIAL=... \
--     scripts/alta/alta-produccion.sh --linked      # o --local
-- Idempotente: negocio por (nombre, tipo), ubicación por (negocio, nombre), membresía por (usuario, negocio).
-- Los ids para `--negocio` del import salen de alta-reporte.sql, que el .sh corre al final.

do $alta$
declare
  v_email text := lower(btrim($p$__DUENO_EMAIL__$p$));
  v_dueno uuid;
  v_tipos text[] := array['tienda', 'lavanderia', 'frial'];
  v_nombres text[] := array[$p$__NOMBRE_TIENDA__$p$, $p$__NOMBRE_LAVANDERIA__$p$, $p$__NOMBRE_FRIAL__$p$];
  v_tipo text;
  v_nombre text;
  v_neg uuid;
  v_n int;
  v_ids uuid[];
  v_ub text[];
  v_ubs text[][];
  v_rol text;
begin
  -- Serializa corridas simultáneas: sin el lock, dos altas podrían crear el mismo negocio dos veces.
  perform pg_advisory_xact_lock(7260211);
  if v_email = '' then raise exception 'alta: falta el email del dueño'; end if;
  select id into v_dueno from auth.users where lower(email) = v_email;
  if v_dueno is null then
    raise exception 'alta: el dueño no existe en auth.users; crearlo antes en el panel de Auth';
  end if;
  if not exists (select 1 from public.perfiles where id = v_dueno) then
    raise exception 'alta: el dueño no tiene perfil (¿falta el trigger de perfil?)';
  end if;

  for i in 1 .. 3 loop
    v_tipo := v_tipos[i];
    v_nombre := btrim(coalesce(v_nombres[i], ''));
    if v_nombre = '' then raise exception 'alta: falta el nombre del negocio de tipo %', v_tipo; end if;

    select array_agg(id) into v_ids from public.negocios where nombre = v_nombre and tipo = v_tipo;
    if cardinality(v_ids) > 1 then
      raise exception 'alta: % negocios de tipo % con el mismo nombre', cardinality(v_ids), v_tipo;
    end if;
    v_neg := v_ids[1];
    if v_neg is null then
      insert into public.negocios (nombre, tipo) values (v_nombre, v_tipo) returning id into v_neg;
    end if;

    -- La importación busca estas ubicaciones por nombre exacto.
    v_ubs := case v_tipo
      when 'tienda' then array[array['Tienda', 'local'], array['Depósito', 'deposito']]
      else array[array['Local', 'local']] end;
    foreach v_ub slice 1 in array v_ubs loop
      select count(*) into v_n from public.ubicaciones where negocio_id = v_neg and nombre = v_ub[1];
      if v_n > 1 then raise exception 'alta: ubicación "%" duplicada', v_ub[1]; end if;
      if v_n = 0 then
        insert into public.ubicaciones (negocio_id, nombre, tipo) values (v_neg, v_ub[1], v_ub[2]);
      elsif not exists (select 1 from public.ubicaciones
                         where negocio_id = v_neg and nombre = v_ub[1] and tipo = v_ub[2]) then
        raise exception 'alta: la ubicación "%" existe con otro tipo', v_ub[1];
      end if;
    end loop;

    insert into public.usuario_negocio (usuario_id, negocio_id, rol)
    values (v_dueno, v_neg, 'dueno') on conflict (usuario_id, negocio_id) do nothing;
    select rol into v_rol from public.usuario_negocio where usuario_id = v_dueno and negocio_id = v_neg;
    if v_rol is distinct from 'dueno' then
      raise exception 'alta: el usuario ya tiene el rol % en un negocio (esperado dueno)', v_rol;
    end if;
  end loop;
end
$alta$;
