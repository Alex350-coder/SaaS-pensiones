# contexto.md

> Documento maestro del proyecto. **Toda sesión de trabajo empieza leyendo este
> archivo** para identificar la fase actual y continuar exactamente desde ese punto.

---

## Estado actual del proyecto

**Fase actual: Fase 4 — Gestión de restaurantes**

| Hito | Estado |
|------|--------|
| Fase 0 — Planificación y documentación estratégica | ✅ Completada (2026-07-04) |
| Fase 1 — Diseño de base de datos | ✅ Completada (2026-07-05) |
| Fase 2 — Backend core | ✅ Completada (2026-07-05) |
| Fase 3 — Autenticación | ✅ Completada (2026-07-05) |
| Fase 4 — Gestión de restaurantes | 🔵 En curso |
| Fases 5–18 | ⚪ Pendientes |

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
