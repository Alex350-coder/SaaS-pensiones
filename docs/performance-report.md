# performance-report.md

> Fase 17 — Optimización. Mediciones antes/después, auditoría de consultas e
> índices, y los ajustes aplicados. Fecha: 2026-07-12.

## Resumen

La base de código llegó a la Fase 17 **ya mayormente optimizada** (code-splitting
por ruta, batching con `Promise.all`, 30 constraints/índices que cubren FKs y
patrones de consulta). El trabajo de esta fase fue, por diseño, **medir →
confirmar → corregir puntualmente**, no un refactor amplio. Se cerraron 3
consultas/rutas de riesgo (1 hallazgo de review + 2 LOW de seguridad) y se
confirmó el cumplimiento de presupuestos con evidencia. Sin regresiones: 350
backend + 211 frontend + 28 E2E en verde.

## 1. Frontend — presupuesto de bundle

Build de producción (`pnpm build`, gzip). Presupuesto de landing (ui-ux.md):
**JS < 150 kB, CSS < 30 kB gzip**.

| Artefacto (chunk) | Raw | gzip | Nota |
|---|---|---|---|
| `index-*.js` (entry) | 350.8 kB | **111.0 kB** | React + Router + TanStack Query + Zustand + core. Ruta crítica de landing. |
| `index-*.css` | 37.8 kB | **8.3 kB** | CSS global + tokens. |
| `schemas-*.js` (Zod) | 99.6 kB | 29.5 kB | Split a rutas de auth/formularios (no en landing). |
| `AppLayout-*.js` | 43.0 kB | 15.6 kB | Shell privado (socket.io/Radix), solo tras login. |
| `dialog-*.js` (Radix) | 32.6 kB | 11.3 kB | Lazy, solo donde se usa. |

**Ruta crítica de landing ≈ 111 kB JS + 8.3 kB CSS gzip → dentro de presupuesto**
(< 150 / < 30). El code-splitting por ruta ya aísla lo pesado: Zod (29.5 kB) solo
carga en auth/formularios; socket.io + Radix solo en el shell privado.

**Decisión (KISS/YAGNI):** **no** se añaden `manualChunks` de vendor. La landing
cumple presupuesto y partir el vendor no reduce el total transferido (solo cambia
el particionado de caché) — sería optimización especulativa. Sin cambios de
frontend en esta fase.

## 2. Backend — auditoría de consultas e índices

**Índices (antes y ahora):** `schema.prisma` ya define **30 constraints/índices**
que cubren todas las FKs y los patrones de consulta calientes, incluidos índices
de orden parcial para paginación keyset (`conversationId, createdAt Desc, id Desc`;
`userId, createdAt Desc`; `restaurantId, publishedAt Desc`) y compuestos de
filtrado (`restaurantId, status`; `status, endDate`; `restaurantId, attendanceDate,
status`). **Sin índices faltantes detectados.**

**Paginación:** los 21 `findMany` se reparten en (a) listados de usuario que pasan
por el helper `paginated()` + `PaginationQueryDto` con tope duro `MAX_PAGE_SIZE =
100` (verificado por el E2E "rejects a limit above the server maximum") y (b)
consultas acotadas por entidad (horarios ≤7, platos de un menú, pagos de una
pensión, ventanas de cron). **Sin listado de usuario sin cota.**

**N+1:** no se hallaron bucles con consultas por fila. El fan-out de listas de
conversaciones ya está batcheado (DISTINCT ON + groupBy, 4 consultas por página —
fix de Fase 8). `Promise.all` en los caminos independientes (queries de pensión,
dashboard).

### Corregido — consulta sin cota (B-3)

`expiring-pensions-notifier.service.ts`: el dedupe del cron de vencimientos traía
**todas** las notificaciones `PENSION_EXPIRING` de cada cliente, para siempre, en
cada corrida diaria. Se acotó con `createdAt >= today - DEDUPE_LOOKBACK_DAYS`
(ventana de aviso + colchón por corridas perdidas), que además hace efectivo el
índice `[userId, createdAt]`. Comportamiento de dedupe preservado (una pensión
está en ventana ≤ `EXPIRING_WINDOW_DAYS + 1` barridos).

### Declinado — micro-oportunidad de paralelismo (B-6)

`dashboard.service.ts` resuelve `getOwnRestaurantId` y `projection.getForDay`
secuencialmente. Paralelizar es marginal y las llamadas re-resuelven el
restaurante internamente (podría duplicar el lookup). Se documenta y no se cambia
(KISS/YAGNI).

## 3. Endurecimiento de rutas (cierre de LOW de seguridad)

- **LOW-2 — throttle en creación de reservas.** `@Throttle` 20/min en
  `POST /reservations` (`my-reservations.controller.ts`), mismo patrón que los
  endpoints de auth/PDF. Un pensionario reserva a lo sumo un menú por día, así que
  20/min corta abuso sin afectar el uso normal. (Deshabilitado en entorno de test,
  como el resto de throttles.)
- **LOW-3 — purga de refresh tokens caducados.** `RefreshTokenService.purgeExpired()`
  (`deleteMany` sobre `expiresAt <= now`, idempotente) + cron diario 03:30 UTC
  `RefreshTokenPurgeJob` (patrón de los jobs existentes, aislado de fallos). Un
  token caducado ya es inservible (`rotate` lo rechaza), así que borrarlo no
  debilita la detección de reuso (que solo importa para tokens revocados-pero-vivos).
  Cubierto por unit tests (`purgeExpired` + `run`).

Ambos cierran los hallazgos LOW-2/LOW-3 de `security-report.md`.

## 4. Limitación conocida aceptada — dinero como `number`

Los importes se almacenan como `number` (cast a `numeric(10,2)` al persistir).
Decisión del usuario en esta fase: **mantener** (funciona y redondea correctamente
al persistir); **no** se refactoriza a centavos en todo el repo. Mitigación ya
presente y confirmada en la review: los caminos monetarios críticos con lock
(`register-payment.usecase.ts`) convierten a **centavos enteros** vía `toCents()`
antes de comparar/sumar, evitando errores de igualdad float en el borde de
comparación. El refactor completo a centavos/Decimal queda como mejora futura
opcional.

## Verificación

- Frontend: `pnpm build` OK; ruta crítica dentro de presupuesto.
- Backend: `tsc` + `lint` limpios; **350 tests (223 unit + 127 e2e)** en verde;
  cobertura combinada **96.05% stmts / 82.37% branches / 94.88% funcs / 95.86%
  lines** (gate 80/70 OK).
- E2E: **28 Playwright** en verde contra el contenedor Docker **reconstruido** con
  los cambios; API sana (`/health` → `database: up`).
