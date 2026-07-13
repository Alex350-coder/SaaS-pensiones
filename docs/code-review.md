# code-review.md

> Fase 16 — Revisión de código final (pre-producción). Revisión con agentes
> (`react-reviewer`, `typescript-reviewer`, `architect`) sobre el árbol de
> trabajo + barrido de código muerto (`knip`, `ts-prune`, `depcheck`) + revisión
> inline de correctitud de backend. La revisión de arquitectura vive en
> [architecture-review.md](architecture-review.md); la de seguridad en
> [security-report.md](security-report.md). Fecha: 2026-07-12.

## Resumen ejecutivo

Base de código **madura y de grado producción**. Frontend: TanStack Query como
única fuente de estado de servidor (sin duplicación en Zustand), limpieza de
sockets por handlers vía ref, `safeRedirect` contra open-redirects, foco/skip-links
sólidos. Backend: type-safety ejemplar (**0 `any`, 0 `as any`, 0 `@ts-ignore`,
0 `eslint-disable`** en `src`), envelope/paginación/errores centralizados, dominio
puro sin framework. Suite base **347 backend + 206 frontend + 17 E2E** en verde.

**Veredicto:** 1 CRITICAL (decisión de arquitectura documentada, no defecto); 3
HIGH (2 corregidos, 1 documentado); 7 MEDIUM (4 corregidos, 3 documentados); LOW
de endurecimiento. Sin defectos de corrección abiertos que bloqueen la fase.

> Nota de proceso: `typescript-reviewer` cayó 2× por el límite de sesión del plan
> y completó al reintentar. Sus hallazgos de backend (sección "Backend") se
> aplicaron/documentaron **después** del primer commit de la Fase 16, en un commit
> de seguimiento; el fix HIGH se verificó con la suite completa.

## Hallazgos

### 🔴 CRITICAL

**C-1 — Tokens de sesión (access + refresh) persistidos en `localStorage`.**
`frontend/src/stores/session-store.ts` persiste `tokens` (incl. refresh de 7 días)
vía `persist` (default `localStorage`), leído por `api-client.ts` para el header
`Authorization: Bearer` y el POST de refresh. `localStorage` es legible por
cualquier script del origen: un gadget XSS podría exfiltrar el refresh token.

**Análisis / decisión:** es un **trade-off de arquitectura consciente y
documentado**, no un descuido. `security.md` A2 ya modela exactamente esta amenaza
("Robo/replay de refresh token · XSS, filtración de storage") y su mitigación:
rotación con `family_id` + revocación de familia ante reuso + hash en DB + TTL de
access token corto (15 min); A8 documenta la elección deliberada de Bearer
(sin cookies) para neutralizar CSRF por diseño. La alternativa (cookie httpOnly)
reintroduce CSRF y exige tokens anti-CSRF + manejo de cookies + CORS con
credenciales — un cambio de arquitectura de amplio radio. La Fase 15 (security
review) aceptó conscientemente esta postura.

**Estado: documentado como trade-off aceptado; decisión de re-arquitectura elevada
al usuario.** Recomendación: evaluar la migración a cookie httpOnly + protección
CSRF en la **Fase 18** (endurecimiento de producción, donde ya se abordan
Helmet/CORS/CSP/HSTS). Mitigación interina ya vigente: XSS cerrado por
output-encoding de React + prohibición de `dangerouslySetInnerHTML` (0 usos, ver
LOW-1 de security-report) + rotación/revocación de familia + access TTL 15 min.

### 🟠 HIGH

**H-1 — Pérdida silenciosa de ediciones sin guardar en `MenuEditor`.** ✅ **CORREGIDO.**
El `useEffect` de resync (`MenuEditor.tsx`) re-sincronizaba `selected`/`price`
desde el estado de servidor en **cada** invalidación de caché (todas las
mutaciones llaman `invalidateQueries({queryKey: menuKeys.all})`), de modo que
guardar el precio pisaba los cambios no confirmados de casillas de platos. Se
eliminó el efecto y se remonta el componente con `key={menu.data.menuDate}` en
`MenusPage.tsx` (mismo patrón que `SchedulesEditor` con `key={own.data.id}`); el
estado ya se inicializaba de forma perezosa desde `menu`.

**H-2 — Falta `eslint-plugin-jsx-a11y` en la config de ESLint.** La disciplina de
a11y actual es buena pero nada la enforce en CI; una regresión futura pasaría el
lint. **Estado: documentado.** Añadir el plugin implica una devDependency nueva +
posible oleada de hallazgos existentes que expandiría el alcance. Recomendado como
tarea de tooling para Fase 17/18 (junto con el resto del endurecimiento de CI).

### 🟡 MEDIUM

| # | Hallazgo | Ubicación | Estado |
|---|----------|-----------|--------|
| M-1 | Validación de URL de imagen sin allowlist de esquema (acepta `javascript:`/`data:`) | `dishes/.../DishFormDialog.tsx`, `restaurant-profile/.../RestaurantForm.tsx` | ✅ **CORREGIDO.** Nuevo helper compartido `lib/image-url.ts` (`optionalImageUrl`) con allowlist http(s) exception-safe; reemplaza 3 usos duplicados (además DRY). Test `image-url.test.ts` añadido. |
| M-2 | `alt=""` en la galería del panel de dueño (imágenes de contenido marcadas como decorativas) | `dashboard/RestaurantProfilePage.tsx` (GalleryManager) | ✅ **CORREGIDO.** `alt={`Foto de la galería ${i+1}`}`, alineado con la galería pública. |
| M-3 | Formularios de mutación simple sin `<form>` semántico (se pierde submit-con-Enter) | `ReservationsPage.tsx`, `MenuEditor.tsx`, `RestaurantProfilePage.tsx` | **Documentado.** Mejora de UX/a11y sin riesgo de corrección; se difiere para no ampliar el diff. |
| M-4 (=A-1) | `RestaurantsService` shared-kernel de 13 métodos usado por 5 contextos solo por 2 lookups | `catalog/application/restaurants.service.ts` | **Documentado** (ver architecture-review A-1). Refactor de amplio radio diferido. |
| M-5 (=A-2) | Servicios de aplicación importan DTOs de presentación (inversión de capa) | `catalog`, `identity` application | **Documentado** (ver architecture-review A-2). |

### 🔵 LOW / Notas

- **L-1 — Aserción no-nula `pension!.id`** (`reservations.service.ts`): ✅
  **corregido** (ver B-5) — guard explícito `NO_ACTIVE_PENSION`. Era el único `!`
  del backend.
- **Dinero como `number`** (cast a `numeric(10,2)` al persistir): patrón
  preexistente en todo el repo, redondea correctamente al persistir. **Limitación
  conocida aceptada** (decisión del usuario en Fase 16/17); ver
  [performance-report.md](performance-report.md). No se refactoriza a centavos.
- **Higiene verificada:** 0 `dangerouslySetInnerHTML`; único `target="_blank"` con
  `rel="noreferrer"`; `key={index}` solo en skeletons de conteo fijo; ciclo de
  vida de sockets (`useSocket`, `useChatSocket`) es implementación de referencia;
  refresh single-flight en `api-client.ts`.

## Backend (typescript-reviewer)

`tsc --noEmit` limpio; `no-floating-promises` / `no-misused-promises` /
`no-explicit-any` enforced y en verde. Type-safety ejemplar: **0 `any`/`as any`**,
1 aserción no-nula (ahora eliminada). Zonas críticas confirmadas correctas:
`withLockedPension` + los 3 `SELECT … FOR UPDATE` (check-then-write bajo el mismo
lock con re-chequeo), numeración atómica `ON CONFLICT … RETURNING` de facturas,
claim single-winner de `RefreshTokenService.rotate`, `AllExceptionsFilter` sin
fuga de stack en producción, DTOs con caps de array/longitud/rango y
`PaginationQueryDto` con `MAX_PAGE_SIZE = 100` en todo listado.

| # | Sev. | Hallazgo | Ubicación | Estado |
|---|------|----------|-----------|--------|
| B-1 | HIGH | Cast `as` que descarta el `\| null`: `refetch: () => Promise<unknown>` + `(await refetch()) as …` podía lanzar `TypeError` crudo en vez de un 404 de dominio | `pensions/.../change-pension-status.usecase.ts` | ✅ **CORREGIDO.** `refetch` tipado con `\| null`, sin cast, guard explícito `if (!fresh) throw pensionNotFoundError()`. |
| B-2 | MEDIUM | Refetch post-transacción con aserciones no-nulas en vez de guard explícito | `register-payment.usecase.ts`, `contract-pension.usecase.ts` | ✅ **CORREGIDO.** Guards explícitos `PENSION_NOT_FOUND`. |
| B-3 | MEDIUM | Scan histórico sin cota en el dedupe del cron de vencimientos (traía todas las notifs `PENSION_EXPIRING` de siempre) | `communication/.../expiring-pensions-notifier.service.ts` | ✅ **CORREGIDO en Fase 17** con cota `createdAt >= today - DEDUPE_LOOKBACK_DAYS` (usa el índice `[userId, createdAt]`). |
| B-4 | MEDIUM | Mapeo por `message.includes('uq_…')` de violaciones de índice único parcial (frágil ante upgrade de driver) | `catalog/restaurants.service.ts`, `identity/auth.service.ts` | **Documentado.** Intencional (los uniques parciales de SQL crudo no emiten `P2002` usable). Recomendado test de regresión que fije la forma del error del driver en CI. |
| B-5 | LOW | Aserción `pension!.id` apoyada en invariante cross-función | `reservations/.../reservations.service.ts` | ✅ **CORREGIDO.** Guard explícito `NO_ACTIVE_PENSION` (elimina la última aserción no-nula del backend). |
| B-6 | LOW | Micro-oportunidad secuencial→paralelo en el dashboard | `analytics/.../dashboard.service.ts` | **Declinado (documentado).** Marginal; las llamadas re-resuelven el restaurante internamente, así que paralelizar podría duplicar el lookup — evitar optimización especulativa (KISS/YAGNI). |

**Dinero:** confirmado que las comparaciones/sumas monetarias en los flujos con
lock (`register-payment.usecase.ts`) convierten a centavos enteros vía `toCents()`
antes de comparar — sin aritmética float insegura en los caminos críticos. Sólida
mitigación del trade-off documentado; sin acción.

## Barrido de código muerto (`knip` + `ts-prune` + `depcheck`)

Resultado: **la base de código está excepcionalmente limpia**. Inventario real de
código muerto en todo el repo = **1 export**:

- ✅ **Eliminado:** alias re-exportado sin uso `MENU_DATE_PATTERN`
  (`menu/application/menu-date.ts`). `ts-prune` confirma 0 exports muertos
  restantes en backend; 0 en frontend (fuera de las primitivas shadcn `ui/**`,
  superficie de diseño intencional).

Falsos positivos verificados y **conservados** (no son código muerto):

- 10 "archivos sin usar" (`test/*.e2e-spec.ts`) → entradas vía `test/jest-e2e.json`.
- 5 "devDeps sin usar" (`@nestjs/testing`, `supertest`, `@types/supertest`, `nyc`,
  `socket.io-client`) → usadas por la suite e2e y `scripts/coverage.mjs`.
- `tsx` → script de seed de Prisma; `@nestjs/schematics` → Nest CLI.
- Frontend `@vitest/coverage-v8`, `autoprefixer`, `postcss` → runner de cobertura
  y plugins de PostCSS/Tailwind (depcheck no los ve).
- Constantes/tipos "sin usar" reportados por knip → usados **dentro de su propio
  archivo** (over-export), o superficie intencional: token DI `PASSWORD_HASH_COST`,
  constante documentada `BCRYPT_COST`, primitivas shadcn, tipos base
  estructurales (`NoticeView` ← `OwnerNoticeView`/`ClientNoticeView`).

Correctitud de dependencias (LOW): `express` se importa directamente (tipos
`Request`/`Response`) pero no está declarado (satisfecho transitivamente por
`@nestjs/platform-express`). Recomendado declararlo explícito en **Fase 18** al
formalizar dependencias; sin riesgo funcional hoy.

## Verificación

- Backend: `tsc --noEmit` limpio, `lint` limpio, **220 unit** en verde tras la
  eliminación de código muerto.
- Frontend: `typecheck` limpio, `lint` limpio (2 warnings react-refresh
  preexistentes de shadcn), **211 tests** en verde (206 previos + 5 de
  `image-url`).
- E2E backend (Docker) + Playwright + cobertura combinada: ejecutados al cierre de
  la fase (ver `contexto.md`).
