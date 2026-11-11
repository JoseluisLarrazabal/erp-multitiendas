// Segunda entrada del módulo, solo para páginas de /panel. Arrastra las server actions: si estuviera en
// index.ts, /pos y /login (precacheados) cargarían sus referencias aunque no las usen. Verificado en el build.
export { exigirAlgunPermiso, exigirPanel, exigirPermiso } from "./contexto";
export { obtenerContexto, type Contexto } from "./servidor";
export {
  codigoDeMensaje,
  detalleDeError,
  falla,
  mensajeDeError,
  validar,
  type Resultado,
} from "./domain";
export { UsuariosTabla } from "./components/usuarios-tabla";
export { FormUsuarioNuevo } from "./components/form-usuario-nuevo";
export { FormPersonaExistente } from "./components/form-persona-existente";
export { FormDispositivo } from "./components/form-dispositivo";
export {
  listarDispositivos,
  listarPersonasDeOtrosNegocios,
  listarUbicaciones,
  listarUsuariosDelNegocio,
  rolesDelTipo,
} from "./queries";
export { rolesOfrecidos } from "./domain";
