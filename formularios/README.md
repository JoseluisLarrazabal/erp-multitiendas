# Formularios de relevamiento: Lider, lavandería y frial

Cada función crea de una sola vez el formulario para el cliente, la planilla de carga de datos y la planilla donde caen las respuestas. Los tres negocios salen del mismo archivo.

1. Entre a [script.google.com](https://script.google.com) con su cuenta de Google y presione **Nuevo proyecto**.
2. Borre el código de ejemplo y pegue todo el contenido de `formularios/apps-script/relevamiento.gs`. Guarde con el ícono del disquete.
3. Arriba, en el selector de funciones, elija `crearTodoLavanderia` o `crearTodoFrial` (la que corresponda) y presione **Ejecutar**.
4. La primera vez Google pide permisos (Formularios, Hojas de cálculo). Presione **Revisar permisos**, elija su cuenta, **Avanzado**, **Ir a (proyecto)** y **Permitir**. Vuelva a ejecutar si hace falta.
5. Abra **Registro de ejecución** (abajo) y copie las 4 URLs: editar el formulario, link para el cliente, planilla de carga y planilla de respuestas.
6. Comparta la planilla de carga con el correo del cliente como **Editor** y mándele por WhatsApp el link del formulario. El plazo del contrato corre desde que lo devuelva completo.

Notas:

- Ejecute cada función una sola vez: cada ejecución crea archivos nuevos. `crearTodoLider_YA_EJECUTADO` ya se ejecutó: no la vuelva a correr.
- El logo no se puede pedir en el formulario (Google no lo permite por script): pídaselo al cliente por WhatsApp.
- Autochequeo local del script: `node formularios/apps-script/test-mock.mjs`.
- Versión Excel offline de la planilla de carga (para mandar por WhatsApp): `formularios/plantillas/Multitienda-Lider-Datos-iniciales.xlsx`. Si cambian columnas en el `.gs`, regenerarla con `generar_plantilla_lider.py` (requiere openpyxl).
- Excel offline de lavandería o frial: se baja desde la Google Sheet de carga con Archivo > Descargar > Microsoft Excel (.xlsx). No hay generador Python para esos dos.
