# contexto.md

> Documento maestro del proyecto. **Toda sesión de trabajo empieza leyendo este
> archivo** para identificar la fase actual y continuar exactamente desde ese punto.

---

## Estado actual del proyecto

**Fase actual: ✅ Proyecto completo — las 18 fases cerradas (2026-07-13)**

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
| Fase 11 — Facturación simulada | ✅ Completada (2026-07-07) |
| Fase 12 — Frontend público | ✅ Completada (2026-07-08) |
| Fase 13 — Frontend privado | ✅ Completada (2026-07-11) |
| Fase 14 — Testing | ✅ Completada (2026-07-12) |
| Fase 15 — Security review | ✅ Completada (2026-07-12) |
| Fase 16 — Code review final | ✅ Completada (2026-07-12) |
| Fase 17 — Optimización | ✅ Completada (2026-07-12) |
| Fase 18 — Preparación para producción | ✅ Completada (2026-07-13) |

Al completar una fase: actualizar esta tabla, el encabezado de "Fase actual" y
la sección "Registro de avance" al final del documento.

---

## Kickoff Fase 11 — Facturación simulada (✅ cerrada 2026-07-07)

> **Fase cerrada.** El resultado, las decisiones finales y la verificación están
> en el "Registro de avance" (final del documento). Lo que sigue es el brief de
> arranque original, conservado como referencia de diseño.

### Objetivo

Emitir una **factura simulada** al registrar un pago: serie + numeración
correlativa, generación de PDF e historial consultable. La arquitectura debe
quedar **desacoplada tras un puerto `InvoiceIssuer`** para reemplazar la
simulación por un emisor real (SUNAT u otro) sin tocar el dominio.

### Criterios de salida (definición de "hecho")

1. **Numeración correlativa sin huecos ni duplicados bajo concurrencia.**
2. **PDF descargable desde el historial.**

Ambos deben quedar cubiertos por tests de integración (e2e) y verificados en
vivo vía Docker, además de unit tests. Mantener lint + tsc limpios y cobertura
≥ 80% (mismo estándar que fases 9–10).

### La DB ya está lista (NO hay migración)

Las tablas `invoice_series` e `invoice` existen desde la Fase 1 y **ya codifican
los invariantes de correctitud** (ver `prisma/schema.prisma`):

- `InvoiceSeries`: `nextNumber Int @default(1)`, `@@unique([restaurantId, series])`.
  → el contador a incrementar de forma atómica; una serie por (restaurante, código).
- `Invoice`: `@@unique([seriesId, number])` → **la propia DB bloquea números
  duplicados** (red de seguridad del criterio #1).
- `Invoice.paymentId @unique` → **una factura por pago = guarda de idempotencia**
  incorporada (reintentos/dobles emisiones no duplican).
- `Invoice.status` (`ISSUED` | `VOIDED`), `Invoice.pdfUrl String?` (nullable →
  el PDF puede generarse on-demand), `Invoice.total Decimal(10,2)`.

### Punto de integración: `register-payment.usecase.ts`

La emisión debe engancharse **dentro de la transacción existente
`withLockedPension`**, justo después de `createConfirmedPayment`
(`src/modules/pensions/application/use-cases/register-payment.usecase.ts`, ~L111).
Motivo: el criterio #1 (sin huecos/duplicados bajo concurrencia) exige asignar
`nextNumber` de forma atómica **bajo el lock de la pensión**, no con un `count()`
(que sí produce carreras).

- **Mecanismo de numeración:** `UPDATE invoice_series SET next_number =
  next_number + 1 WHERE ... RETURNING next_number` (incremento atómico), con
  `@@unique([seriesId, number])` como red de seguridad. Un número basado en
  `count()` de facturas es incorrecto.
- **Los huecos importan:** al anular (`VOIDED`) **no se renumera ni se reutiliza**
  el número — así "sin huecos ni duplicados" se mantiene honesto.

### Requisito de arquitectura: puerto `InvoiceIssuer`

Definir el puerto en la capa de aplicación y un adaptador `SimulatedInvoiceIssuer`
que lo implemente ahora; el emisor real se enchufa después sin tocar el dominio.
**Plantilla ya probada en el repo:** el patrón puerto/adaptador de la Fase 9
(`NOTIFICATION_PUSHER` Symbol + `useExisting`/`useClass`, ver
`src/modules/communication/application/notification-pusher.port.ts` y su gateway).
Reutilizar ese estilo (Symbol de inyección + interfaz + `InputJson` para payload).

- El PDF simulado se genera con una librería local (p. ej. `pdfkit`); no hay
  almacenamiento de archivos aún.
- **Descarga (criterio #2):** endpoint que hace *stream* del PDF generado
  on-demand (dejar `pdfUrl` null) o persistirlo en el volumen Docker. Preferir
  on-demand para no introducir storage todavía.
- Nuevo bounded context sugerido: módulo `billing` (o `invoicing`) que depende de
  `pensions`/`catalog`, nunca al revés — mismo criterio de capas que `analytics`
  en Fase 10 (evitar ciclos).

### Decisiones a fijar al inicio

| Decisión | Nota / opción por defecto |
|----------|---------------------------|
| **¿Factura por pago o solo al activar?** | Esquema es 1:1 pago↔factura (`paymentId @unique`) → cada pago (incluso parcial) emite factura. Confirmar vs. emitir solo al completar el pago. |
| **Alta de la serie** | ¿Se crea la `InvoiceSeries` de forma perezosa en la 1ª factura, o al aprobar el restaurante? Definir código de serie por defecto (p. ej. `"F001"`). |
| **Anulación** | Si se anula un pago (`Payment.VOIDED`), ¿se anula su factura (`Invoice.VOIDED`)? El número **no** se reutiliza. |
| **Entrega del PDF** | On-demand (stream, sin storage) recomendado; alternativa: persistir en volumen y guardar `pdfUrl`. |

### Endpoints previstos (a confirmar en el diseño)

- Restaurante (dueño): historial de facturas emitidas por su restaurante
  (paginado) + descarga de PDF por factura.
- Cliente (pensionario): sus facturas (las de sus pagos) + descarga de PDF.
- La emisión NO es un endpoint propio: ocurre como efecto del registro de pago.
- Envelope estándar `{ success, data, error }`; `code`s en inglés, mensajes en
  español; RBAC en cada endpoint; `@Roles` explícito.

### Contexto de estado (dónde retomar)

- Rama `master`, commits por fase. Últimos: `d4ef8` (Fase 9), `53576` (Fase 10).
- Suite verde previa a la fase: **212 unit + 113 e2e**, lint/tsc limpios.
- Agentes de review (`code-reviewer`, `security-reviewer`) cayeron por límite de
  sesión en fases 9–10; la review se hizo inline. Re-ejecutarlos al cerrar F11.
- Windows + PowerShell 5.1 (sin `&&`); infra vía Docker Compose (rebuild del
  contenedor `api` para verificación en vivo).

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
| 2026-07-08 | Fase 12 | Frontend público. Scaffolding del SPA en `frontend/` (React 19 + TS + Vite + TailwindCSS v3 + primitivas estilo shadcn/ui, **pnpm**), tokens de diseño de [ui-ux.md](ui-ux.md) materializados en `styles/tokens.css` (light + dark, ambos AA) + `tailwind.config.ts`. Fuente Inter self-hosted (Fontsource, sin request externo). **Proxy de Vite** `/api → :3000` (el backend aún no habilita CORS → Fase 18). **Fundaciones**: `api-client` tipado sobre el envelope `{success,data,error}` con refresh silencioso single-flight ante 401 + rotación; TanStack Query (server state, sin duplicar en Zustand); Zustand para sesión (persistida) y tema (light/dark/system con anti-flash); RHF + Zod para formularios; tipos de API centralizados (DRY). **Sistema de diseño**: Button/Input/Label/Card/Badge/Skeleton/Spinner + Toaster (sonner), estados hover/focus-visible/active/disabled diseñados, motion compositor-friendly, `prefers-reduced-motion` respetado globalmente, iconos Lucide (nunca emojis). **Páginas**: Landing (hero + cómo funciona + destacados + CTA), Catálogo (cards premium con microinteracciones — lift + scale + reveal, paginación en URL, skeletons/empty/error), Detalle de restaurante (menú del día agrupado por curso, horarios con abierto/cerrado en vivo, contacto + ubicación con enlace a mapa, galería), Login y Registro (con selector de rol Cliente/Restaurante, validación on-blur, mapeo de errores de servidor, show/hide password, protección anti open-redirect), 404. **A11y**: skip-link, focus a `<main>` en cambio de ruta, labels visibles + `aria-invalid`/`role="alert"`, targets ≥44px, `CoverImage` con fallback de monograma (CLS-safe vía aspect-ratio). **Code-splitting** por ruta (landing ~109 kB vendor + 2.6 kB + 4.5 kB gzip, dentro del presupuesto <150 kB; RHF+zod+sonner solo en rutas de auth). Datos demo enriquecidos: 5 restaurantes APPROVED con portadas (Unsplash) + coordenadas + menús; 97 artefactos e2e ocultos del catálogo público vía soft-delete. Revisión propia inline (agentes no invocados sin petición explícita del usuario, por guía del harness). Verificación: `tsc -b` limpio, ESLint 0 errores (2 warnings react-refresh estándar de shadcn), 21 tests Vitest en verde, `pnpm build` OK; ruta de datos completa verificada en vivo a través del proxy (catálogo, detalle, menú, register→CLIENT, login, credenciales inválidas → mensaje en español). Verificación visual en navegador pendiente (extensión de Chrome no conectada). Cobertura ≥80% formal y E2E de flujos quedan para Fase 14. Fase actual pasa a Fase 13. |
| 2026-07-07 | Fase 11 | Facturación simulada. Nuevo bounded context `billing` (depende de pensions + catalog, nunca al revés). **Puerto `InvoiceIssuer`** definido en `pensions/application/ports` (lo posee el llamador) e implementado por `SimulatedInvoiceIssuer` en billing; `BillingModule` es `@Global` para que el flujo de pago inyecte el puerto sin que pensions importe billing (la flecha queda billing → pensions). **Decisiones fijadas**: factura emitida **solo al activar** (1 factura/pensión, `total` = precio, ligada al pago que activa); serie `F001` creada de forma **perezosa**; anular un pago anula su factura (número nunca reutilizado); PDF **on-demand** (`pdfUrl` queda null). **Numeración correlativa (criterio #1)**: asignada dentro del lock de la pensión, en la misma transacción, con un único `INSERT … ON CONFLICT (restaurant_id, series) DO UPDATE SET next_number = next_number + 1 RETURNING next_number - 1` (get-or-create + incremento atómico); `@@unique([seriesId, number])` y `paymentId @unique` como red de seguridad. Sin migración (tablas de Fase 1). **PDF (criterio #2)**: render con `pdfkit` a Buffer, stream vía `@Res()` (evita el interceptor de envelope); historial paginado para dueño (`restaurants/mine/invoices`) y cliente (`invoices`), acotado por ownership en la query (404 uniforme, sin filtrar existencia); `@Throttle` 30/min en las descargas. Revisiones **code-reviewer (APPROVE, 0 CRITICAL/HIGH)** + **security-reviewer (0 CRITICAL/HIGH)** re-ejecutadas: SQL 100% parametrizado, aislamiento multi-tenant e IDOR verificados, RBAC intacto en las rutas `@Res()`. MEDIUM de cobertura corregido (spec unitario de `ChangePensionStatusUseCase` + test de integración directo de `voidForPension`); MEDIUMs diferidos y documentados: headers de seguridad/`helmet` (Fase 18, ninguna ruta los tiene aún) y dinero como `number` (patrón preexistente en todo el repo; el cast `numeric(10,2)` redondea al persistir → ticket de seguimiento). Criterios de salida verificados: numeración sin huecos ni duplicados **bajo concurrencia** (e2e con activaciones en paralelo → `[3,4]`, secuencia `1..N` contigua en DB) y PDF descargable (magic `%PDF`, dueño y cliente). Tests: 220 unit + 127 e2e en verde; lint y tsc limpios; verificado en vivo vía Docker (smoke completo: activación emite `F001-000001`, PDF de 1841 bytes, aislamiento cross-tenant `INVOICE_NOT_FOUND`). Fase actual pasa a Fase 12. |
| 2026-07-11 | Fase 13 | Frontend privado — las tres superficies autenticadas del SPA, todas contra la API real (sin mock). Construido por hitos verificados (M0–M5). **M0 fundaciones:** `socket.io-client` + proxy WS de Vite (`/socket.io`), `useMe` sobre `/auth/me`, guards de ruta (`RequireAuth`/`RequireRole` → redirige rol incorrecto a su área, nunca callejón), shell privado `AppLayout` (sidebar + drawer móvil + topbar, focus a `<main>`), redirección post-login por rol. **M1 notificaciones + chat (consumidores del backend F8/F9, sin tocarlo):** campana con badge + push en vivo (toast) + marcar leído/todas + lectura de avisos en diálogo; chat lista + hilo con paginación keyset, envío/recepción/lectura en vivo por gateway `/chat` (emit-with-ack, eco `message:new`); capa de socket compartida (`useSocket`/`useChatSocket`), primitivas `Dialog`/`Popover`/`Textarea`. **M2 app cliente:** mi pensión (estado, días, progreso de pago, pagos), contratar (desde detalle público) y cancelar, reservar menú del día + cancelar, confirmar asistencia diaria, facturas + descarga PDF con bearer. **M3 dashboard restaurante:** métricas (reutiliza `/dashboard`), platos CRUD, constructor de menú diario (borrador→publicado, composición curso=categoría), pensionarios (registrar pago → activa + factura, suspender/reactivar/cancelar, vencimientos), reservas del día + proyección de producción, avisos (publicar + historial con lecturas), facturas emitidas, perfil del restaurante (crear/editar + horarios + galería), con onboarding "crea tu restaurante" cuando no existe. **M4 super admin:** aprobación/suspensión de restaurantes, gestión de usuarios (suspender/reactivar con guarda anti-autobloqueo), auditoría. DRY: `MenuCourseList` extraído y reutilizado (público + reserva), `InvoiceList`/`StatusBadge`/`ConfirmDialog`/`PageHeading`/`usePdfDownload`/`lib/status` compartidos; server state solo en TanStack Query. Code-splitting: entry pública 111 kB gzip (dentro de presupuesto); shell privado + socket.io/Radix en chunk lazy (15.7 kB gzip). Verificación: `tsc -b` limpio, ESLint 0 errores (2 warnings react-refresh preexistentes de shadcn), 29 tests Vitest en verde, `pnpm build` OK; rutas de datos verificadas en vivo por rol vía Docker — cadena WS real (auth ok, token malo rechazado, join/send/eco), y formas REST de cada superficie (cliente: pensión/facturas/asistencia PUT; restaurante: dashboard/perfil/pensiones/platos/proyección/facturas; super admin: 21 restaurantes/213 usuarios/553 auditoría) coinciden con los tipos del frontend. Cobertura ≥80% formal y E2E Playwright quedan para Fase 14 (mismo criterio que Fase 12). Fase actual pasa a Fase 14. |
| 2026-07-12 | Fase 15 | Security review. Auditoría del código contra `security.md` (amenazas A1–A14) y OWASP Top 10 (2021), producida en `docs/security-report.md`. **Veredicto: cero hallazgos CRITICAL/HIGH** (criterio de salida cumplido). Controles verificados inline: A1 (throttle register 3/login 5/refresh 10 por min + bcrypt 12 + error uniforme + hash equalizador de timing), A2 (refresh opaco SHA-256, rotación con claim atómico, revocación de familia ante reuso, `revokeAllForUser` en suspensión), A3/IDOR (ownership filtrado en DB en cada query, `getOwnRestaurantId` lanza si no hay restaurante, 404 uniforme), A4 (RBAC deny-by-default, `SUPER_ADMIN` no autoregistrable), A6 (9 sitios de SQL crudo, todos *tagged template literals* parametrizados, cero `$queryRawUnsafe`), A9 (gateways WS con handshake JWT + `WsRateLimiter` + `maxHttpBufferSize` + validación UUID), A10 (numeración atómica `ON CONFLICT`, facturas inmutables), A11 (filtro global no filtra stack ni mensajes de framework en producción), A14 (`.env` no versionado, validación de entorno fail-fast, `JWT_ACCESS_SECRET` ≥ 32 chars). **Tests E2E adversariales añadidos** (`tests/security-authz.spec.ts`, API-level contra el stack real, 11 aserciones): escalada vertical CLIENT→admin y RESTAURANT_ADMIN→admin (403), IDOR de facturas entre clientes (404 `INVOICE_NOT_FOUND`, no 403 ni el PDF; la dueña sí la descarga), tokens faltante/malformado/manipulado (401), y cap de paginación `limit>100` (400). Helpers reutilizables `accessTokenFromStorage`/`loginUser` en `tests/support/api.ts` (el spec corre en modo `serial` para gastar un solo login y no chocar con el rate limit de 5/min —que es en sí un control bajo prueba—). Hallazgos LOW registrados con fase objetivo: LOW-1 sanitización server-side de texto libre declarada pero no implementada (riesgo real bajo: React escapa + cero `dangerouslySetInnerHTML`; reconciliar doc en Fase 16), LOW-2 sin throttle propio en creación de reservas (Fase 16/17), LOW-3 sin purga de refresh tokens caducados (Fase 17/18). Diferidos y documentados (no son hallazgos abiertos): Helmet/CORS/CSP/HSTS y desconexión forzada de sockets → Fase 18. Verificación: 14/14 E2E en verde (3 setup + 11 authz, 10.6s) contra Docker + Postgres; agente `security-reviewer` no invocado para no agotar el límite de sesión del plan (revisión inline, mismo criterio que Fases 9–13). Fase actual pasa a Fase 16. |
| 2026-07-12 | Fase 14 | Testing — cierre del gate de calidad. **Decisión de alcance (entrevista):** *Logic-focused 80% + E2E*. La cobertura Vitest mide lógica de aplicación + componentes reutilizables (`lib/`, `hooks/`, `stores/`, `features/**/*.ts` = api+hooks+schemas, y componentes `shared`/`forms`/`brand`/`routing`); se excluyen del denominador los cascarones de página (`pages/`, `app/`, `components/layout/`), las primitivas `components/ui/` y los componentes presentacionales de feature (`features/**/components/`) — cubiertos por Playwright, no por unit tests. **Backend — cobertura combinada (`backend/scripts/coverage.mjs`, unit + e2e fusionados con nyc por ruta de archivo):** controllers, repos Prisma, guards, filtros y DTOs los ejercita la suite Supertest, no los specs unitarios, así que ninguna corrida sola refleja el total; el script corre ambas con salida JSON de Istanbul y las une. Resultado con `--check` (umbral 80/70): **statements 96.19%, branches 83.26%, functions 94.64%, lines 96.01%**; suite **220 unit + 127 e2e en verde**. **Frontend — Vitest v8 con el scope decidido (configurado en `frontend/vite.config.ts`):** **206 tests en verde**, **96.96% statements / 94.39% branches / 93.33% functions** sobre el denominador lógico. **E2E Playwright (`tests/`, 5 flujos críticos del roadmap + público/auth/routing, 17 tests en verde):** stack real Vite→Nest→Postgres; `globalSetup` re-siembra la BD demo (idempotente, date-relative) para determinismo y re-ejecutabilidad; proyecto `setup` autentica cada rol una vez y comparte sesión vía `storageState` (economiza el rate-limit de login 5/min); actores mutables se aprovisionan frescos por corrida vía API (cliente nuevo para *contratar pensión*; restaurant admin + restaurante PENDING para *aprobación del super admin*), inyectando la sesión en `localStorage` sin gastar login. Flujos: journey público (landing→catálogo→detalle), credenciales inválidas → error en español, guards de ruta (anónimo y rol cruzado), *contratar pensión*, *reservar menú del día*, *confirmar asistencia*, *chat* (Socket.IO con eco), dashboard restaurante, *aprobación de restaurante*. Selectores accesibles (roles/labels/IDs estables); mutaciones aseveradas contra la respuesta de red. Scripts añadidos: `frontend test:coverage`, raíz `test:e2e[:ui|:report]`. CI `.github/workflows/playwright.yml` reescrito (postgres service, migrate+grants+seed, build+start API, Playwright chromium). Verificación en vivo: **347 tests backend + 206 frontend + 17 E2E, todos en verde**; corrida E2E completa reproducible desde re-seed (16.2 s). Criterios de salida cumplidos: suite reproducible desde cero (BD efímera via seed idempotente) y cobertura global ≥80% con reporte generado (`coverage/combined`, `frontend/coverage`). Fase actual pasa a Fase 15. |
| 2026-07-12 | Fase 16 | Code review final. Revisión con agentes (`architect` ✅ PASS sólido; `react-reviewer` ✅; `typescript-reviewer` interrumpido 2× por límite de sesión del plan → revisión de backend inline, mismo criterio que Fases 9–10/15) + barrido de código muerto (`knip` + `ts-prune` + `depcheck`). Reportes: `docs/code-review.md` + `docs/architecture-review.md`. **Arquitectura: cero CRITICAL/HIGH** — hexagonal fiel, cero ciclos, dominio puro sin framework, puertos `InvoiceIssuer`/`NOTIFICATION_PUSHER` correctos, envelope/paginación/errores centralizados; 4 MEDIUM documentados (RestaurantsService shared-kernel de 5 consumidores por 2 lookups; inversión aplicación→DTO; Analytics como read-model CQRS; tipos Prisma en puertos —trade-off justificado del `TransactionClient` para numeración atómica). **Código: 1 CRITICAL** = tokens en `localStorage` (**trade-off de arquitectura documentado** en security.md A2/A8, no defecto; re-arquitectura a cookie httpOnly + CSRF elevada a Fase 18). **2 HIGH:** pérdida de ediciones sin guardar en `MenuEditor` (efecto de resync pisaba casillas no confirmadas ante cualquier invalidación de caché) → **corregido** con remonte `key={menuDate}` + init perezoso (patrón existente de `SchedulesEditor`); falta `eslint-plugin-jsx-a11y` → documentado para tooling de CI. **5 MEDIUM:** allowlist de esquema http(s) en URLs de imagen (`javascript:`/`data:`) → **corregido** con helper compartido `lib/image-url.ts` (`optionalImageUrl`, exception-safe en zod v4, +DRY sobre 3 usos duplicados, con test); `alt` de galería de dueño → **corregido**; forms semánticos + los 2 MEDIUM de arquitectura → documentados. **Código muerto:** inventario real de todo el repo = **1 export** (`MENU_DATE_PATTERN`, alias re-exportado sin uso) → eliminado; `ts-prune` confirma 0 muertos restantes (backend y frontend, fuera de primitivas shadcn). Falsos positivos verificados y conservados (specs e2e vía `jest-e2e.json`, devDeps de e2e/cobertura, `tsx` de seed, over-exports usados intra-archivo, token DI `PASSWORD_HASH_COST`). LOW-1 de seguridad **cerrado**: `security.md` A7/A03 reconciliado (anti-XSS = codificación en salida + prohibición de `dangerouslySetInnerHTML`, no sanitización de entrada; un sanitizador sería YAGNI). Type-safety de backend ejemplar: **0 `any`/`as any`/`@ts-ignore`/`eslint-disable`** en `src`, 1 aserción no-nula segura (guardada). Verificación: **347 backend (220 unit + 127 e2e) + 211 frontend (206 + 5 de `image-url`) + 28 E2E Playwright, todo en verde**; cobertura combinada backend 96.19% stmts / 83.26% branches / 94.84% funcs / 96.01% lines (gate 80/70 OK); lint y tsc limpios en ambos lados; verificado en vivo vía Docker. Fase actual pasa a Fase 17. |
| 2026-07-13 | Fase 18 | Preparación para producción — **proyecto completo**. **Auth → cookies httpOnly + CSRF (cierra C-1):** access/refresh/csrf en cookies (`core/auth/cookies.ts`); tokens ilegibles por JS (el `session-store` solo persiste `user`). `CsrfGuard` global de double-submit (header `X-CSRF-Token` == cookie `csrf_token`) en métodos mutantes; omite `@Public` (refresh es `SameSite=Strict`) y `Bearer`. `JwtAuthGuard` acepta cookie o `Bearer` con **precedencia del header explícito** (el navegador nunca envía `Bearer`; un cliente programático que lo pone no debe ser eclipsado por una cookie ambiental). `access_token` root-scope (viaja al handshake WS same-origin), `refresh_token` acotado a `/api/v1/auth`. Frontend: `api-client` con `credentials:'include'` + eco de CSRF, refresh sin body, `socket` con `withCredentials`, `usePdfDownload` por cookie. **WS forced-disconnect:** puerto `SESSION_TERMINATOR` (Identity, implementado por Communication) corta todos los sockets del usuario en logout y suspensión (rooms por usuario en ambos gateways) — cierra el trade-off de sockets de vida larga. **Infra:** `configure-app` con Helmet (HSTS, `X-Frame-Options: DENY`, nosniff, referrer) + `cookie-parser` + CORS por allow-list (`credentials:true`); logging estructurado JSON con `X-Request-Id` (`request-logger.middleware`). **Docker de producción:** `backend/Dockerfile.prod` multi-stage non-root (`prisma` movido a deps para migrar al arrancar; runner sin toolchain de dev), `frontend/Dockerfile` (build → nginx-unprivileged) + `nginx.conf` (SPA + reverse proxy `/api` y `/socket.io` same-origin + CSP estricta `script-src 'self'`), `docker-compose.prod.yml` (db/api sin puertos publicados, solo `web`; secretos por entorno) + `.env.prod.example`. **Tooling/gate:** `eslint-plugin-jsx-a11y` (H-2, 0 errores), `pnpm audit --prod` limpio en ambos (multer fijado ≥ 2.2.0), `express`/`prisma` declarados explícitos. README de portafolio. Docs reconciliados: `security.md §4/§6` (gate al 100%), `security-report.md §7`, `code-review.md` (C-1/H-2 cerrados). Verificación: backend **233 unit + 130 e2e** (incl. 3 nuevos de CSRF double-submit contra el stack real), cobertura combinada **95.4% stmts / 80.4% branches / 94.8% funcs / 95.2% lines** (gate 80/70); frontend **211 tests + build** OK, lint (jsx-a11y) limpio; **28 E2E Playwright** en verde sobre DB limpia (incl. bloque adversarial de autorización IDOR/escalada). Verificado en vivo vía Docker: `/health` up, register/login setean 3 cookies (`HttpOnly`/`SameSite`), headers de seguridad presentes, `/auth/me` e `/invoices` por cookie. Nota de proceso: las suites backend-e2e y Playwright comparten la DB local y colisionan en datos de maria (hoy) — en CI van en instancias Postgres separadas; localmente se corren con reset de volumen entre ambas. Fase actual: **proyecto completo (18/18)**. |
| 2026-07-12 | Fase 17 | Optimización. Reporte `docs/performance-report.md` (antes/después). Base ya mayormente optimizada → **medir → confirmar → corregir puntual**, no refactor amplio. **Frontend:** build de producción medido — ruta crítica de landing ≈ **111 kB JS + 8.3 kB CSS gzip, dentro de presupuesto** (<150/<30); code-splitting por ruta ya aísla lo pesado (Zod 29.5 kB solo en auth/formularios; socket.io+Radix solo en shell privado). Sin `manualChunks` de vendor (no reduce el total; sería especulativo — KISS/YAGNI). **Backend:** auditoría confirma 30 constraints/índices que cubren FKs + keyset parciales + compuestos de filtrado (sin índices faltantes); los 21 `findMany` son listados paginados con tope duro `MAX_PAGE_SIZE=100` o consultas acotadas por entidad (sin listado sin cota); sin N+1 (fan-out de conversaciones ya batcheado desde Fase 8). **Corregido (B-3, hallazgo de code review):** consulta sin cota en el dedupe del cron de vencimientos (traía todas las notifs `PENSION_EXPIRING` de siempre) → acotada con `createdAt >= today − DEDUPE_LOOKBACK_DAYS`, que hace efectivo el índice `[userId, createdAt]` (dedupe preservado). **Declinado (B-6):** micro-paralelismo en dashboard (marginal, re-resolvería el restaurante — documentado). **Cierre de LOW de seguridad:** LOW-2 → `@Throttle` 20/min en creación de reservas (`my-reservations.controller.ts`); LOW-3 → `RefreshTokenService.purgeExpired()` (idempotente) + cron diario 03:30 UTC `RefreshTokenPurgeJob` (patrón de jobs existentes, aislado de fallos), con unit tests. **Dinero como `number`:** limitación conocida aceptada (decisión del usuario, no refactor a centavos); mitigación confirmada — los caminos con lock convierten a centavos vía `toCents()` antes de comparar. Verificación: **350 backend (223 unit + 127 e2e) + 211 frontend + 28 E2E Playwright** en verde; cobertura combinada backend **96.05% stmts / 82.37% branches / 94.88% funcs / 95.86% lines** (gate 80/70 OK); lint/tsc limpios; **contenedor Docker `api` reconstruido** con los cambios y verificado en vivo (`/health` → `database: up`, 28 E2E contra el stack real). Fase actual pasa a Fase 18. |
