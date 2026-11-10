import { z } from "zod";

export const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email()),
  contrasena: z.string().min(1).max(128),
});

// Misma política que [auth] de config.toml y que admin-usuarios.
export const claveSchema = z
  .string()
  .min(8)
  .max(72)
  .regex(/[A-Za-z]/)
  .regex(/\d/);

// guid y no uuid: z.uuid() exige versión RFC y los IDs del seed no la cumplen.
const id = z.guid();
const rol = z.enum(["dueno", "encargado", "contador", "vendedor", "empleado"]);

export const crearUsuarioSchema = z.object({
  negocioId: id,
  rol,
  correo: z.string().trim().toLowerCase().pipe(z.email()),
  nombre: z.string().trim().min(1).max(120),
  clave: claveSchema,
});
export const asignarUsuarioSchema = z.object({ negocioId: id, usuarioId: id, rol });
export const quitarUsuarioSchema = z.object({ negocioId: id, usuarioId: id });
export const estadoCuentaSchema = z.object({ usuarioId: id });
export const restablecerClaveSchema = z.object({ usuarioId: id, clave: claveSchema });
export const registrarDispositivoSchema = z.object({
  negocioId: id,
  ubicacionId: id,
  nombre: z.string().trim().min(1).max(60),
  prefijo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][0-9]{1,2}$/),
});
