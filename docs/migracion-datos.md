# Migración de datos

El arranque carga los 597 productos de Lider con un script repetible, después de que el cliente entregue precios. Solo
la planilla de carga es fuente; lo que no pase las reglas va a un reporte de rechazos.

## Estado de las fuentes (2026-11-01)

| Negocio | Datos | Falta |
|---|---|---|
| Lider | 597 productos con stock y ubicación | Precios, costos, stock mínimo, series, clientes, usuarios, saldos de crédito |
| Lavandería | Solo respuestas del formulario | Hoja `Servicios` con precios, usuarios |
| Frial | Nada | Se carga cuando abra |

## Reglas de limpieza de `Productos`

Filas numeradas como en Sheets.

| Regla | Filas | Tratamiento |
|---|---|---|
| Ejemplos | 2, 3 | Excluir. También los 2 ejemplos de `Números de serie` |
| Fila suelta | 602, solo "598" | Excluir |
| Espacios | 28 descripciones, 11 con doble espacio, 6 categorías | `trim` y colapsar espacios |
| Marca o modelo "--" | 53 marcas, 132 modelos | Guardar vacío |
| Marca duplicada | "haochukang" y "hao chu kang" | Unir, con visto bueno del cliente |
| Categorías | 65 en lista, 53 en uso | Importar solo las usadas; `Hornos` no se usa |
| Categorías parecidas | plancha y plancha de cabello; jarra y jarra hervidora; utencilios | Mapa acordado con el cliente |
| Código interno | "1" a "597" | Conservar (P-05) |
| Texto en código de barras | 63 valores; "aro 20/29" en 61 a 64 | Mover a modelo o serie, según revisión |
| Notación científica | 582 | Rechazar hasta reescanear: falla el dígito verificador EAN-13 |
| Códigos cortos | 25, 35, 275, 432, 463, 597, 601 | Conservar como texto, con ceros iniciales |
| Código de barras repetido | 17 códigos, 38 filas | La restricción única no los admite: el cliente decide cuál conserva, o se deja vacío en los demás |
| Posibles duplicados | 44/47/52, 183/327, 185/325, 295/300 | Confirmar. Si son iguales, unir sumando stock |
| Mismo nombre, marca y modelo | 13 grupos, 26 filas | Revisar con el cliente; pueden ser variantes |
| Sin ubicación | 569 a 594, 86 unidades | Pedirla; por defecto, tienda |
| Fotos | 292 en filas 5 a 296 | Extraer del xlsx y subir a Storage |

`Código de barras` se lee como texto en toda la importación. Nunca como número.

## Lo que debe pedir el cliente antes

1. Precios: contado, crédito, mayorista, mínimo. Indicar qué productos van en USD.
2. Costos, aunque sean aproximados. Sin costo, ganancia y valor del stock no dan cifras útiles.
3. Stock mínimo, al menos por categoría.
4. Qué productos llevan serie, y las series en stock.
5. Decisiones sobre duplicados y categorías.
6. Usuarios de los 3 negocios.
7. Servicios y precios de lavandería.
8. Saldos de crédito activos (Entrega B).

## Proceso

Script en `scripts/importacion/` (se crea en la fase 1), ejecutado por el encargado técnico con `service_role`, nunca desde la app.

1. Leer el xlsx exportado.
2. Aplicar reglas y validar con Zod.
3. Generar reporte: aceptadas, corregidas, rechazadas.
4. Ejecutar en proyecto de prueba.
5. Revisar el reporte con el cliente.
6. Ejecutar en producción. Es idempotente por `(negocio_id, codigo)`.
7. Cargar stock con movimientos `inicial` y costo cuando exista.
8. Conciliar.

## Conciliación

| Control | Esperado |
|---|---|
| Productos importados más rechazados | 597 |
| Stock total | 2.633 menos lo rechazado, con diferencia explicada |
| Stock tienda y depósito | 934 y 1.613, más las 86 unidades sin ubicación ya asignadas |
| `stock` = suma de movimientos | Sin diferencias |
| Fotos | 292 asociadas |

## Arranque

1. Conteo físico cerca de la fecha de salida (P-17). Sus diferencias entran como ajustes.
2. Crear usuarios, dispositivos y cajas.
3. Operar en paralelo con el cuaderno 3 días.
4. Comparar ventas, caja y stock contra el cuaderno.
5. Dejar el cuaderno y firmar el acta.

Plan de vuelta atrás: hasta el fin del paralelo, el cuaderno sigue siendo el registro oficial.

## Datos personales

- Las planillas tienen hoy acceso "Cualquier persona con el enlace". Pasarlas a Restringido cuando termine la carga.
- Los exportados de trabajo no se suben al repo.
- `scripts/importacion/` no contiene datos reales.
