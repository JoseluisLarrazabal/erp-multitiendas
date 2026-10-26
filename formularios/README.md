# Formulario de relevamiento: Multitienda Lider

Crea de una sola vez el formulario para el cliente, la planilla de carga de datos y la planilla donde caen las respuestas.

1. Entre a [script.google.com](https://script.google.com) con su cuenta de Google y presione **Nuevo proyecto**.
2. Borre el código de ejemplo y pegue todo el contenido de `formularios/apps-script/formulario-lider.gs`. Guarde con el ícono del disquete.
3. Arriba, en el selector de funciones, elija `crearTodoLider` y presione **Ejecutar**.
4. La primera vez Google pide permisos (Formularios, Hojas de cálculo). Presione **Revisar permisos**, elija su cuenta, **Avanzado**, **Ir a (proyecto)** y **Permitir**. Vuelva a ejecutar si hace falta.
5. Abra **Registro de ejecución** (abajo) y copie las 4 URLs: editar el formulario, link para el cliente, planilla de carga y planilla de respuestas.
6. Comparta la planilla de carga con el correo del cliente como **Editor** y mándele por WhatsApp el link del formulario. El plazo del contrato corre desde que lo devuelva completo.

Notas:

- Ejecute `crearTodoLider` una sola vez: cada ejecución crea archivos nuevos.
- El logo no se puede pedir en el formulario (Google no lo permite por script): pídaselo al cliente por WhatsApp.
- Autochequeo local del script: `node formularios/apps-script/test-mock.mjs`.
- Versión Excel offline de la planilla de carga (para mandar por WhatsApp): `formularios/plantillas/Multitienda-Lider-Datos-iniciales.xlsx`. Si cambian columnas en el `.gs`, regenerarla con `generar_plantilla_lider.py` (requiere openpyxl).
- Para lavandería o frial: copie `SECCIONES_LIDER` como base, cambie las preguntas y llame a `crearFormulario(...)` con `SECCIONES_COMUNES` más su propio arreglo.
