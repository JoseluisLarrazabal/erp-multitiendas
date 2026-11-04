# Plan: referencia del dólar paralelo (RF-CAT-12)

Pedido del CTO (2026-11-04): una tarjeta chica, siempre visible, con el dólar paralelo de paralelo.bo, sin quitar la
carga manual del tipo de cambio. Funcionalidad nueva fuera del contrato: va a la lista de extras de D-01.

## Fuente (verificado con curl, 2026-11-04)

- `GET https://paralelo.bo/api/v1/rate`, sin clave. Respuesta: `{"timestamp","buy","sell","median","spreadPct",
  "sourceCount","methodologyVersion"}`. Se usa solo `median`: `buy` y `sell` venían invertidos (buy > sell) y su
  significado no está documentado.
- Límite 60 pedidos por minuto, caché propia de 60 s. Licencia CC-BY 4.0: hay que mostrar "paralelo.bo" con enlace.
- CORS abierto, pero la CSP (`web/next.config.ts:18`) solo deja `connect-src 'self'` y Supabase. Por eso se consulta
  desde el servidor y la CSP no cambia.
- No hay SLA ni términos de uso. Si la API cae o cambia de forma, la app sigue igual y la tarjeta dice "sin datos".

## Diseño

1. **Ruta `GET /api/dolar-paralelo`** (route handler). Hace `fetch` a paralelo.bo con `next: { revalidate: 60 }` y
   timeout de 3 s, y valida con Zod que `median` sea un número > 0 y `timestamp` una fecha. Responde
   `{ disponible: true, valor, leidoEn }` o `{ disponible: false }`. Nunca lanza 500 por una falla de paralelo.bo.
   Exige sesión, igual que el resto de la app, para no ser un proxy público.
2. **Componente cliente `DolarParalelo`.** Pide la ruta al montar y cada 5 minutos. Muestra
   "Paralelo Bs 12,03 · paralelo.bo" con la hora de lectura y enlace a la fuente. Si `leidoEn` tiene más de 15 minutos
   dice "desactualizado"; si falla o no hay red, "sin datos". Nunca bloquea nada.
3. **Dónde va:** el header del panel (`web/src/components/panel/panel-shell.tsx:112-127`) y el punto de venta
   (`web/src/app/(pos)/pos/pos-app.tsx`). El POS es estático y offline: solo un fetch cliente, que puede fallar sin
   efecto.
4. **"Usar este valor"** en `/panel/tipo-cambio`, junto al formulario existente: llena el campo de `FormTipoCambio`
   con la mediana redondeada a 2 decimales. Guardar sigue el flujo de hoy: confirmación si varía más de 20 % y el RPC
   `registrar_tipo_cambio` con permiso `editar_productos`. La tarjeta nunca escribe en `tipos_cambio`.

## Fuera

Sin tabla nueva, sin migración y sin cron. Sin aplicar el valor automáticamente. Sin historial del paralelo.

## Trampas

- Formato de los números en es-BO: usar el helper que ya existe (`web/src/lib/format/`).
- CI no tiene que depender de la red: los tests mockean `fetch`.
- El valor que guarda una venta sigue siendo el tipo de cambio vigente del negocio (RN-02), no el paralelo.

## Verificación

- Vitest de la ruta: con respuesta válida, con forma inválida, con timeout y con HTTP 500 (en los tres últimos casos,
  `disponible: false`).
- `tsc`, lint, build y la suite E2E existente en CI.
- Playwright sobre producción tras el merge: la tarjeta se ve en el panel y en el POS, el enlace va a paralelo.bo, sin
  errores de CSP, y "Usar este valor" llena el campo sin guardar.
