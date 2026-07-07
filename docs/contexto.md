# contexto.md

> Documento maestro del proyecto. **Toda sesión de trabajo empieza leyendo este
> archivo** para identificar la fase actual y continuar exactamente desde ese punto.

---

## Estado actual del proyecto

**Fase actual: Fase 11 — Facturación simulada**

| Hito | Estado |
|------|--------|
| Fase 0 — Planificación y documentación estratégica | ✅ Completada (2026-07-04) |
| Fase 1 — Diseño de base de datos | ✅ Completada (2026-07-05) |
| Fase 2 — Backend core | ✅ Completada (2026-07-05) |
| Fase 3 — Autenticación | ✅ Completada (2026-07-05) |
| Fase 4 — Gestión de restaurantes | ✅ Completada (2026-07-05) |
| Fase 5 — Gestión de menús | ✅ Completada (2026-07-05) |
| Fase 6 — Sistema de pensiones | ✅ Completada (2026-07-06) |
| Fase 7 — Sistema de reservas | ✅ Completada (2026-07-06) |
| Fase 8 — Chat tiempo real | ✅ Completada (2026-07-06) |
| Fase 9 — Notificaciones | ✅ Completada (2026-07-07) |
| Fase 10 — Panel administrativo | ✅ Completada (2026-07-07) |
| Fase 11 — Facturación simulada | 🔵 En curso |
| Fases 12–18 | ⚪ Pendientes |

Al completar una fase: actualizar esta tabla, el encabezado de "Fase actual" y
la sección "Registro de avance" al final del documento.

---

## Visión general

**Pensiones** es una plataforma SaaS que digitaliza el modelo tradicional de
"pensión de restaurante": un cliente contrata con un restaurante un plan de
comidas de 30 días (la pensión), y durante ese período reserva su menú diario,
confirma asistencia y se comunica con el restaurante.

El sistema conecta tres actores:

- **Clientes (pensionarios)** que buscan comer a diario en un restaurante de
  confianza a precio de plan mensual.
- **Restaurantes** que necesitan ingresos predecibles, proyección de producción
  diaria y gestión ordenada de sus pensionarios.
- **La plataforma (Super Admin)** que cura la oferta: aprueba, supervisa y
  suspende restaurantes.

Es un **proyecto de portafolio profesional**: el objetivo es demostrar
arquitectura realista, escalable y mantenible con estándares de producción.

## Objetivos

1. Sistema completo y funcional de punta a punta (DB → API → frontend).
2. Arquitectura limpia/hexagonal con bounded contexts claros y documentados.
3. Seguridad implementada desde el día uno (JWT, RBAC, validación, OWASP).
4. UI/UX de nivel premium SaaS (prioridad extremadamente alta).
5. Cobertura de tests ≥ 80% (unit + integration + E2E).
6. Documentación exhaustiva y siempre sincronizada con el código.

## Alcance

### Incluido

- Registro y aprobación de restaurantes (flujo Super Admin).
- Catálogo público de restaurantes: perfil, galería, horarios, ubicación, contacto.
- Menú diario (entrada, plato principal, bebida, postre, precio).
- Contratación de pensiones de 30 días: inicio, fin, días restantes, estado, pagos.
- Reserva de menú diario con hora estimada de llegada y cancelación.
- Confirmación de asistencia diaria (asistiré / no asistiré) → proyección de producción.
- Chat en tiempo real pensionario ↔ administrador de restaurante.
- Sistema de avisos restaurante → pensionarios (cambios de menú, horario, promos, cierres).
- Notificaciones in-app.
- Panel administrativo con métricas (pensionarios activos, pagos pendientes,
  reservas del día, asistencia proyectada, ingresos estimados).
- Facturación **simulada**, con arquitectura preparada para emisión real
  (numeración, PDF, historial).

### Excluido (por ahora)

- Pasarela de pagos real (los pagos se registran manualmente / se simulan).
- Facturación electrónica legal real.
- Apps móviles nativas (el frontend es web responsive).
- Multi-tenancy con aislamiento físico de datos (un solo esquema, aislamiento lógico).
- Internacionalización (la UI es solo en español).

## Stack tecnológico (obligatorio)

| Capa | Tecnología |
|------|------------|
| Frontend | React + TypeScript + Vite, TailwindCSS, shadcn/ui, TanStack Query, React Hook Form + Zod, Zustand |
| Backend | NestJS + TypeScript, JWT (access + refresh con rotación), RBAC |
| Base de datos | PostgreSQL 16 (Prisma ORM) |
| Realtime | WebSockets (Socket.IO sobre gateway de NestJS) |
| Infraestructura | Docker + Docker Compose |
| Gestor de paquetes | pnpm |

## Arquitectura (resumen)

Monolito modular en NestJS con arquitectura hexagonal por bounded context.
Detalle completo en [arquitectura.md](arquitectura.md).

Bounded contexts: **Identity & Access**, **Restaurant Catalog**, **Menu
Management**, **Pensions**, **Reservations & Attendance**, **Communication**
(chat + avisos + notificaciones), **Billing** (simulada), **Platform Admin**.

Frontend en tres superficies sobre una misma SPA: sitio público, app de
cliente, dashboard de restaurante + panel super admin.

## Restricciones

- Orden de construcción estricto: **base de datos → backend → frontend**. No se
  salta ninguna fase del [roadmap.md](roadmap.md).
- Stack no negociable (ver tabla anterior).
- Principios obligatorios: SOLID, DRY, KISS, Clean/Hexagonal Architecture,
  Separation of Concerns, DI, composición sobre herencia, DDD donde aporte.
- Política DRY: antes de crear cualquier componente/servicio/hook/DTO/utilidad,
  buscar una implementación reutilizable existente.
- Seguridad desde el inicio, no como fase de parcheo (ver [security.md](security.md)).
- Copy de UI en español; código, comentarios y commits en inglés.
- Máquina de desarrollo Windows + PowerShell 5.1 (sin `&&`).

## Roadmap

18 fases, detalladas en [roadmap.md](roadmap.md):

1. Diseño de base de datos → 2. Backend core → 3. Autenticación →
4. Gestión de restaurantes → 5. Gestión de menús → 6. Sistema de pensiones →
7. Sistema de reservas → 8. Chat tiempo real → 9. Notificaciones →
10. Panel administrativo → 11. Facturación simulada → 12. Frontend público →
13. Frontend privado → 14. Testing → 15. Security review →
16. Code review final → 17. Optimización → 18. Preparación para producción.

## Documentos del proyecto

| Documento | Contenido |
|-----------|-----------|
| [contexto.md](contexto.md) | Este archivo: visión, alcance, estado y fase actual |
| [roadmap.md](roadmap.md) | Las 18 fases con entregables y criterios de salida |
| [arquitectura.md](arquitectura.md) | Arquitectura, bounded contexts, diagramas, flujos |
| [database-design.md](database-design.md) | Entidades, relaciones, índices, constraints, migraciones |
| [security.md](security.md) | Amenazas, mitigaciones, OWASP Top 10, authn/authz |
| [ui-ux.md](ui-ux.md) | Design system, paleta, tipografía, componentes, accesibilidad |

## Registro de avance

| Fecha | Fase | Nota |
|-------|------|------|
| 2026-07-04 | Fase 0 | Documentación estratégica creada (los 6 documentos). Fase actual pasa a Fase 1. |
| 2026-07-05 | Fase 1 | Schema Prisma (20 tablas), migración inicial con invariantes hand-written (uniques parciales, FKs compuestas, CHECKs), PostgreSQL 16 en Docker, seed idempotente. Revisión con agente database-reviewer: 1 CRITICAL + 3 HIGH corregidos en la migración init (uniques parciales para soft delete, 7 índices FK, FKs compuestas de consistencia, CHECK de 30 días). Verificado: replay desde cero, seed doble sin duplicados, violaciones rechazadas por la DB. Pendientes documentados: rol de DB de runtime (Fase 2), UUIDv7 (optimización). Fase actual pasa a Fase 2. |
| 2026-07-05 | Fase 2 | Backend core NestJS: módulo `core` transversal (envelope `{success,data,error}`, filtro global de excepciones con codes en inglés y mensajes en español, interceptor de envelope, `ValidationPipe` global whitelist+forbid+transform, paginación estándar `{items, meta}`), config tipada con Zod (`APP_DATABASE_URL` separada de `DATABASE_URL`), Prisma como adaptador (`PrismaService` conecta con rol de runtime), healthcheck `/api/v1/health`, endpoint de ejemplo paginado (temporal, se elimina en Fase 4). Rol `pensiones_app` de mínimo privilegio (`prisma/sql/runtime-role.sql`, `pnpm db:grants`, re-ejecutar tras cada migración): sin DDL, `audit_logs` append-only, `_prisma_migrations` inaccesible — verificado en vivo. Dockerfile dev + servicio `api` en compose (migrate deploy + grants + start). Tests: 21 unit + 5 e2e en verde; lint y `tsc --noEmit` limpios (corregido type error preexistente en `seed.ts`). Revisión con agente code-reviewer: Approve, 0 CRITICAL/HIGH. Pendiente anotado: mover `bcryptjs` a dependencies cuando Fase 3 lo use en runtime. Fase actual pasa a Fase 3. |
| 2026-07-05 | Fase 3 | Autenticación completa (módulo `identity`, hexagonal): register (solo CLIENT/RESTAURANT_ADMIN), login, refresh con rotación y revocación de familia ante reuso (claim atómico anti-race), logout por familia, `GET /auth/me`, `GET /auth/audit-events` (SUPER_ADMIN). Guards globales deny-by-default (`JwtAuthGuard` + `RolesGuard`: ruta sin `@Roles` ni `@Public` se rechaza), `@CurrentUser`, throttling (global 100/min; register 3, login 5, refresh 10/min; off en test). JWT HS256 15 min payload mínimo (algoritmo pineado), refresh opaco 7 días hasheado SHA-256, bcrypt cost 12, `bcryptjs` movido a dependencies. Auditoría: register/login/login_failed(wrong_password|suspended)/logout/refresh_reuse_detected con dedupe. Revisión security-reviewer: Warn → HIGH corregido (oráculo de timing en login: verify contra hash dummy con email inexistente) + M2/M4/L1/L2 corregidos; M3 (IP/UA en auditoría) y trade-off de refresh concurrente documentados en security.md. Tests: 53 unit + 17 e2e en verde (flujo completo, revocación de familia, rechazo por rol); lint y tsc limpios; verificado en vivo vía Docker Compose. Fase actual pasa a Fase 4. |
| 2026-07-05 | Fase 4 | Módulo `catalog` (CRUD colapsado, ADR #2): catálogo público solo APPROVED+vivos (listado y detalle por slug, sin exponer status/ownerId), superficie de dueño `/restaurants/mine` (crear como PENDING, perfil PATCH, horarios PUT con reemplazo transaccional, galería por URL máx. 12 — upload real con puerto FileStorage en fase posterior), panel `/admin/restaurants` (SUPER_ADMIN: listado con filtro por estado + transiciones PENDING→APPROVED⇄SUSPENDED auditadas). Ownership estructural: toda operación de dueño resuelve el restaurante desde el JWT, nunca por id del cliente. Slug estable generado con reintento ante colisión (uniques parciales live). Endpoint ejemplo de Fase 2 eliminado. Revisión code-reviewer: Warn → HIGH corregido (PATCH con `null` explícito saltaba validación: `skipNullProperties: false`) + MEDIUM (race de sortOrder en galería → 409 reintentable) + LOW (detección P2002 alineada). Tests: 73 unit + 32 e2e en verde (criterios de salida cubiertos); lint y tsc limpios; verificado en vivo. Fase actual pasa a Fase 5. |
| 2026-07-05 | Fase 5 | Módulo `menu` (CRUD colapsado, depende de Catalog vía `getOwnRestaurantId`): CRUD de platos por categoría con precio individual y flag `isActive` (DELETE mapea FK RESTRICT → 409 DISH_IN_USE, desactivar en su lugar); menú diario por fecha (`/restaurants/mine/menus/:date`, fechas UTC-midnight validadas con guard de rollover); composición con validación plato-propio-activo y curso=categoría (invariante #2, COURSE_MISMATCH); ciclo DRAFT⇄PUBLISHED (publicar exige ≥1 plato; edición/borrado solo en DRAFT); unicidad restaurante+fecha en DB (P2002 → 409). Consulta pública `GET /restaurants/:slug/menu?date=` (hoy por defecto): solo PUBLISHED de restaurantes APPROVED. Revisión code-reviewer: Warn → HIGH corregido (`isActive: null` saltaba validación: campo excluido de PartialType y redeclarado con ValidateIf) + 2 MEDIUM corregidos (TOCTOU publish-vs-edición resuelto con `SELECT … FOR UPDATE` y re-chequeo dentro de la transacción; spec unitario de DishesService añadido). Tests: 99 unit + 46 e2e en verde; lint y tsc limpios; verificado en vivo. Fase actual pasa a Fase 6. |
| 2026-07-06 | Fase 6 | Módulo `pensions` — primer contexto hexagonal completo (dominio puro sin Nest/Prisma, puertos `PensionRepository`+`Clock`, casos de uso, adaptador Prisma, cron): contratación CLIENT→PENDING_PAYMENT con snapshot de precio (solo restaurantes APPROVED); pagos parciales acumulados en centavos bajo `SELECT … FOR UPDATE` (activación exacta al completar el precio: start=hoy UTC, end=+30, doble activación imposible); máquina de estados actor-aware (cliente solo cancela PENDING; restaurante suspende/reactiva/cancela; suspensión NO extiende el período); cancelación de prepago anula pagos CONFIRMED→VOIDED en la misma transacción (trazabilidad de reembolso); vista de vencimientos `expiring?days=`; cron diario 00:05 UTC idempotente y aislado de fallos; `paidAt` acotado a la línea temporal de la pensión. Helpers de fecha UTC extraídos a `core/dates` (menu los reutiliza). Criterios de salida verificados: doble pensión viva rechazada por el unique parcial de DB; expiración/días restantes consistentes en UTC (e2e con backdating + sweep idempotente). Revisión code-reviewer: **Approve** (0 CRITICAL/HIGH) → 2 MEDIUM + 2 LOW corregidos igualmente (void de pagos en cancelación, e2e cross-tenant, bounds de paidAt, lectura de reloj dentro del lock). Tests: 126 unit + 63 e2e; lint y tsc limpios; verificado en vivo. Fase actual pasa a Fase 7. |
| 2026-07-06 | Fase 7 | Módulo `reservations` — contexto Reservations & Attendance (hexagonal ligero, ADR #2: reglas ricas como funciones puras en `domain/`, servicios sobre Prisma como catalog/menu): reserva del menú del día por pensionario con pensión ACTIVE que cubra la fecha (menú PUBLISHED de restaurante APPROVED bajo `SELECT … FOR UPDATE` — invariante #3 sin TOCTOU; el unique parcial `uq_live_reservation_per_client_menu` en DB es el criterio de salida 1; cancelar libera el slot), regla de corte decidida: reservar/modificar/cancelar solo hoy o futuro y solo CONFIRMED (transiciones atómicas con guard de status en el WHERE); PATCH con patrón anti-null-bypass (`ValidateIf` en `estimatedArrival`, `notes` nullable a propósito). Asistencia: upsert `PUT /attendance` (UNIQUE pensión+fecha) con lock de la pensión y re-chequeo de invariantes #1/#4 (solo ACTIVE, fecha dentro del período, no pasado). Vistas de restaurante: reservas del día ordenadas por llegada y `production-projection` (partición exacta: asistiré + no asistiré + sin respuesta = pensionarios activos que cubren el día; respuestas de pensiones luego suspendidas/canceladas excluidas de todos los buckets; `projectedAttendance` = asistiré + sin respuesta). El menú público ahora expone `id` (necesario para reservar). Revisión code-reviewer: **Approve** (0 CRITICAL/HIGH) → MEDIUM corregido (update de reserva ahora atómico con guard CONFIRMED, misma técnica que cancel) + LOW corregido (e2e de respuestas obsoletas tras suspensión). Tests: 154 unit + 82 e2e en verde; lint y tsc limpios; verificado en vivo vía Docker (flujo completo con curl/fetch). Fase actual pasa a Fase 8. |
| 2026-07-06 | Fase 8 | Módulo `communication` — chat 1-a-1 pensionario ↔ admin (hexagonal ligero; REST y gateway Socket.IO como dos adaptadores de presentación sobre los mismos servicios, autorización NUNCA duplicada: única puerta `getAccess()`): conversación por pensión (UNIQUE pension_id, get-or-create idempotente con resolución de carrera P2002; participantes = cliente de la pensión + dueño del restaurante; escribible solo con pensión viva PENDING_PAYMENT/ACTIVE/SUSPENDED, luego solo-lectura con historial intacto; no-participantes reciben el mismo 404 sin filtrar existencia); historial keyset-paginado por `(created_at,id)` sobre el índice dedicado; indicador de leído (read_at, `POST :id/read` y evento WS con broadcast); gateway `/chat` con JWT en handshake (HS256 pineado, sockets sin auth desconectados), rooms por conversación, `message:new`/`message:read`, ack con envelope `{success,data,error}`. Deps nuevas: @nestjs/websockets, platform-socket.io, socket.io(-client). Revisiones en paralelo code-reviewer + security-reviewer: **Warn** → los 2 HIGH corregidos (guards/pipes globales NO cubren gateways en Nest 11 —verificado empíricamente—: se añadió `WsRateLimiter` por usuario 30 ev/10 s off en test, validación UUID en gateway y `maxHttpBufferSize` 16 KB; N+1 en listMine → batch DISTINCT ON + groupBy, 4 queries fijas por página) + MEDIUM (código `NOT_AUTHENTICATED` para la carrera del handshake; trade-offs WS documentados en security.md §4: vida del socket vs TTL 15 min, CORS a Fase 18) + LOW (fixture e2e a beforeAll). Tests: 178 unit + 93 e2e en verde (criterios de salida: join ajeno rechazado por WS, historial persistente y paginado); lint y tsc limpios; verificado en vivo vía Docker con sockets reales. Fase actual pasa a Fase 9. |
| 2026-07-07 | Fase 9 | Módulo `communication` extendido con avisos + notificaciones in-app (tablas `notices`/`notice_reads`/`notifications` ya existían desde Fase 1). **Notificaciones (campana):** `NotificationsService` con puerto `NOTIFICATION_PUSHER` (la capa de aplicación crea, la presentación entrega) — implementado por un gateway Socket.IO `/notifications` push-only (rooms por usuario, JWT en handshake, sin eventos entrantes); REST `GET /notifications` (paginado, `?unread=`), `unread-count` sobre el índice parcial de no leídas, `POST :id/read` (ownership en el WHERE → 404 sin filtrar existencia, idempotente), `read-all`. `createMany`/`dispatch` separados a propósito: los productores dentro de una transacción solo despachan por WS tras el commit (un rollback nunca anuncia una fila inexistente). **Avisos restaurante → pensionarios:** `publish` materializa notificaciones NOTICE para los pensionarios ACTIVE del restaurante emisor **en la misma transacción** (contratos posteriores no reciben avisos viejos; suspender el restaurante no los retira); lista de dueño con `readCount`; `GET /notices/:id` sella `notice_read` + limpia la campana del destinatario (no-destinatario recibe el mismo 404). **Mensajes:** cada `message:send` genera una entrada NEW_MESSAGE deduplicada por conversación mientras esté no leída (una ráfaga no inunda la campana); leer la conversación limpia su entrada. **Vencimientos:** `ExpiringPensionsNotifierService` + cron diario 00:15 UTC (tras el barrido de expiración) avisa una vez por pensión ACTIVE dentro de la ventana de 3 días; idempotente vía dedupe por `pensionId`. DRY: `authenticateSocket`/`socketUser` extraídos a `ws-auth.ts` (chat y notificaciones comparten el handshake). Revisión propia (agentes code/security-reviewer cayeron por límite de sesión del plan — pendiente re-ejecutar reportes formales): corregido acoplamiento de capas (application importaba DTO de presentation → `listMine` toma `PaginationQueryDto` de core + flag `unread`), añadido `@Throttle` 10/min en publish (anti-amplificación de fan-out). Tests: 203 unit + 102 e2e en verde (criterios de salida: aviso llega solo a pensionarios del restaurante emisor —verificado contra pensionario de otro restaurante y contra pensionario PENDING del mismo—; contador de no leídas consistente tras marcar leído, idempotente y con `read-all`); lint y tsc limpios; verificado en vivo vía Docker (10/10 checks: scoping, campana, sellado de lectura, dedupe, 404 de privacidad). Fase actual pasa a Fase 10. |
| 2026-07-07 | Fase 10 | Panel administrativo (backend). **Dashboard del restaurante:** nuevo módulo `analytics` (contexto de reporting de solo lectura que depende de catalog + reservations, nunca al revés) con `DashboardService` → `GET /restaurants/mine/dashboard` (RESTAURANT_ADMIN). Reutiliza `ProjectionService` (exportado) para pensionarios activos + reservas de hoy + asistencia proyectada, y añade pagos pendientes (pensiones en PENDING_PAYMENT con saldo = precio − pagos confirmados; los pagos solo se crean CONFIRMED, así que se calcula el saldo, no se cuenta una fila PENDING inexistente) e ingresos estimados (suma de precios de pensiones ACTIVE). Cada cifra deriva de las filas crudas, así que cuadra por construcción y queda acotada por restaurante vía `getOwnRestaurantId`. **Gestión de usuarios Super Admin:** `AdminUsersService` + `AdminUsersController` (SUPER_ADMIN, `admin/users`): listado con filtros role/status, suspender/reactivar con máquina de transiciones (ACTIVE↔SUSPENDED), guard anti-autobloqueo (`CANNOT_MODIFY_SELF`), y auditoría de toda acción (`user.status_changed` con metadata from/to/revokedSessions). Suspender revoca **todas** las sesiones (`RefreshTokenService.revokeAllForUser`), cerrando la ventana del refresh token: el login ya rechaza no-ACTIVE (`USER_SUSPENDED`) y el refresh revocado no rota → la cuenta muere en ≤15 min (TTL del access token). La aprobación/suspensión de restaurantes ya existía y auditada desde la Fase 2. Revisión propia inline (agentes formales pendientes de re-ejecutar): límites de capas correctos (analytics → contextos, sin ciclos), sin fugas de PII (la vista de usuario excluye passwordHash), RBAC en cada endpoint, sin secretos. Tests: 212 unit + 113 e2e en verde (criterios de salida: métricas cuadran contra los datos crudos y acotadas por restaurante —verificado con un restaurante vacío que ve solo ceros y recomputando en vivo tras pagar—; toda acción de Super Admin auditada —verificado leyendo audit_logs— y suspensión revoca sesiones); lint y tsc limpios; verificado en vivo vía Docker (15/15 checks). Fase actual pasa a Fase 11. |
