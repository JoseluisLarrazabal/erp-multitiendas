# ERP Multitiendas

Sistema web y PWA para 3 negocios. Estado actual: `docs/handoff.md`.

Antes de implementar, leer lo que aplique:

- Qué construir: `docs/srs.md` (cada cambio cita su RF).
- Cómo está diseñado: `docs/arquitectura.md`, `docs/plan-modelo-datos.md`.
- Cómo escribir código: `docs/estandares-codigo.md`.
- Cómo probar: `docs/plan-pruebas.md`.
- Qué sigue: `docs/roadmap.md`.

Reglas no negociables: toda escritura contable va por RPC, toda tabla lleva RLS, el kardex es append-only.
`service_role` nunca entra en `web/`. Datos reales del cliente nunca entran al repo.
`sistema-de-gestion-multinacional/` es solo referencia visual: no se desarrolla ahí.
