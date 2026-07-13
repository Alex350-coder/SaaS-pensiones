# roadmap.md

> Plan de fases del proyecto. Cada fase tiene entregables y criterios de salida.
> **No se avanza a la fase siguiente sin cumplir los criterios de salida y sin
> actualizar [contexto.md](contexto.md).** Orden estricto: DB → backend → frontend.

---

## Fase 1 — Diseño de base de datos

**Entregables**

- `database-design.md` validado (entidades, relaciones, índices, constraints).
- Schema de Prisma (`schema.prisma`) completo y migración inicial generada.
- `docker-compose.yml` con PostgreSQL 16 levantando en local.
- Script de seed con datos de demo (restaurantes, menús, usuarios de cada rol).

**Criterios de salida**

- `prisma migrate dev` corre limpio desde cero.
- Todas las invariantes de negocio críticas tienen constraint en DB
  (unicidades, checks, FKs con política de borrado explícita).
- Seed reproducible e idempotente.

---

## Fase 2 — Backend core

**Entregables**

- Proyecto NestJS con estructura hexagonal por bounded context.
- Módulo `core`: envelope de respuesta `{ success, data, error }`, filtro global
  de excepciones, interceptor de serialización, paginación estándar, logging.
- `ValidationPipe` global (whitelist + forbidNonWhitelisted + transform).
- Configuración tipada por entorno (`@nestjs/config` + validación con Zod/Joi).
- Prisma integrado como adaptador de persistencia.
- Rol de DB de mínimo privilegio para el runtime (sin DDL; `audit_logs` solo
  `SELECT/INSERT`), con credencial separada de la de migraciones.
- Healthcheck (`/api/v1/health`).

**Criterios de salida**

- API arranca con Docker Compose (app + DB).
- Un endpoint de ejemplo devuelve el envelope estándar con paginación.
- Tests de humo del módulo core en verde.

---

## Fase 3 — Autenticación

**Entregables**

- Registro e inicio de sesión por email/contraseña (bcrypt).
- JWT access (corto) + refresh token (rotación + revocación por familia).
- RBAC: roles `CLIENT`, `RESTAURANT_ADMIN`, `SUPER_ADMIN`; guards y decoradores
  (`@Roles`, `@CurrentUser`).
- Rate limiting en endpoints de auth. Auditoría de eventos de auth.

**Criterios de salida**

- Flujo completo registro → login → refresh → logout testeado (integration).
- Un token robado ya rotado invalida la familia completa.
- Endpoints protegidos rechazan rol incorrecto con error estándar.

---

## Fase 4 — Gestión de restaurantes

**Entregables**

- CRUD de restaurante (perfil, logo, imagen principal, galería, descripción,
  dirección, ubicación, horarios, contacto).
- Ciclo de estado: `PENDING → APPROVED → SUSPENDED` (transiciones solo Super Admin).
- Catálogo público: listado y detalle de restaurantes aprobados.

**Criterios de salida**

- Un restaurante `PENDING` o `SUSPENDED` nunca aparece en el catálogo público.
- Un `RESTAURANT_ADMIN` solo puede editar su propio restaurante.

---

## Fase 5 — Gestión de menús

**Entregables**

- CRUD de platos (entradas, principales, bebidas, postres) con precio individual.
- Menú diario por fecha: composición de platos + precio del menú.
- Publicación/borrador del menú diario. Consulta pública del menú del día.

**Criterios de salida**

- Unicidad `restaurante + fecha` para el menú diario garantizada en DB.
- Solo menús publicados son visibles para clientes.

---

## Fase 6 — Sistema de pensiones

**Entregables**

- Contratación de pensión de 30 días (inicio, fin, días restantes, estado).
- Estados: `PENDING_PAYMENT → ACTIVE → EXPIRED / CANCELLED / SUSPENDED`.
- Registro de pagos asociados a la pensión; vista de vencimientos para el restaurante.
- Job/cron de expiración automática de pensiones vencidas.

**Criterios de salida**

- Un cliente no puede tener dos pensiones activas en el mismo restaurante
  (constraint parcial en DB, no solo lógica de aplicación).
- Días restantes y expiración son consistentes ante cambios de fecha del servidor (UTC).

---

## Fase 7 — Sistema de reservas

**Entregables**

- Reserva de menú diario con hora estimada de llegada; cancelación.
- Confirmación de asistencia diaria (asistiré / no asistiré) por pensionario.
- Vista de restaurante: reservas del día + asistencia proyectada.

**Criterios de salida**

- Una reserva por cliente por menú diario (constraint en DB).
- Solo pensionarios con pensión activa pueden confirmar asistencia.
- La proyección de producción agrega correctamente reservas + confirmaciones.

---

## Fase 8 — Chat tiempo real

**Entregables**

- Gateway WebSocket autenticado (JWT en handshake).
- Conversaciones 1-a-1 pensionario ↔ admin del restaurante (solo con pensión vigente).
- Historial persistente, indicador de leído, entrega en tiempo real.

**Criterios de salida**

- Un usuario no puede unirse a una conversación ajena (test de autorización WS).
- Mensajes persisten y se recuperan paginados.

---

## Fase 9 — Notificaciones

**Entregables**

- Avisos restaurante → pensionarios (cambio de menú, horario, promos, cierres).
- Notificaciones in-app por usuario (campana): avisos, vencimientos, mensajes.
- Marcado de leído; push por WebSocket cuando el usuario está conectado.

**Criterios de salida**

- Un aviso llega solo a pensionarios del restaurante emisor.
- El contador de no leídas es consistente tras marcar como leído.

---

## Fase 10 — Panel administrativo

**Entregables**

- API de métricas del restaurante: pensionarios activos, pagos pendientes,
  reservas del día, asistencia proyectada, ingresos estimados.
- Panel Super Admin: aprobación/suspensión de restaurantes, gestión de usuarios.

**Criterios de salida**

- Las métricas cuadran contra los datos crudos en tests de integración.
- Todas las acciones de Super Admin quedan auditadas.

---

## Fase 11 — Facturación simulada

**Entregables**

- Emisión simulada de factura al registrar pago: serie + numeración correlativa,
  generación de PDF, historial consultable.
- Arquitectura desacoplada (puerto `InvoiceIssuer`) para reemplazar la
  simulación por un emisor real sin tocar el dominio.

**Criterios de salida**

- Numeración correlativa sin huecos ni duplicados bajo concurrencia.
- PDF descargable desde el historial.

---

## Fase 12 — Frontend público

**Entregables**

- Scaffolding React + Vite + Tailwind + shadcn/ui con design tokens de [ui-ux.md](ui-ux.md).
- Landing, catálogo de restaurantes (cards premium con microinteracciones),
  detalle de restaurante (menú del día, horarios, ubicación, galería).
- Registro / login.

**Criterios de salida**

- Responsive 320→1920, dark mode funcional, sin CLS perceptible.
- Cumple presupuesto de performance de landing (ver ui-ux.md).

---

## Fase 13 — Frontend privado

**Entregables**

- **App cliente:** mi pensión (días restantes, estado, pagos), reservar menú,
  confirmar asistencia, chat, notificaciones.
- **Dashboard restaurante:** métricas, menús, platos, pensionarios, pagos,
  vencimientos, reservas, asistencia, avisos, chat, facturas.
- **Panel Super Admin:** aprobaciones, usuarios.

**Criterios de salida**

- Rutas protegidas por rol; estados de carga/vacío/error diseñados en todas las vistas.
- Flujos E2E manuales completos por rol sin callejones sin salida.

---

## Fase 14 — Testing

**Entregables**

- Unit + integration (backend: Jest + Supertest; frontend: Vitest + Testing Library).
- E2E de flujos críticos (Playwright): contratar pensión, reservar, confirmar
  asistencia, chat, aprobación de restaurante.
- Cobertura ≥ 80% verificada en CI local.

**Criterios de salida**

- Suite completa en verde y reproducible desde cero (DB efímera).
- Cobertura global ≥ 80% con reporte generado.

---

## Fase 15 — Security review

**Entregables**

- Auditoría contra [security.md](security.md) y OWASP Top 10 con agente de seguridad.
- `security-report.md` con hallazgos, severidad y remediación.
- Correcciones de todos los hallazgos CRITICAL/HIGH.

---

## Fase 16 — Code review final

**Entregables**

- Revisión completa con agentes de code review (TS/React/NestJS) y de arquitectura.
- `code-review.md` + `architecture-review.md`.
- Correcciones CRITICAL/HIGH aplicadas; MEDIUM documentadas o corregidas.
- Remove all dead code, unused modules, obsolete files, unused assets, mock data, commented-out code, and any functionality that is no longer referenced or has no effect on the application. Ensure that no active features are broken and update imports, exports, and dependencies accordingly.

---

## Fase 17 — Optimización

**Entregables**

- Backend: N+1, índices faltantes, paginación en todo listado, caching donde aporte.
- Frontend: code-splitting, presupuesto de bundle, Core Web Vitals (ver ui-ux.md).
- `performance-report.md` con mediciones antes/después.

---

## Fase 18 — Preparación para producción

**Entregables**

- Dockerfiles multi-stage de producción + compose de producción.
- Variables de entorno documentadas (`.env.example`), secretos fuera del repo.
- Headers de seguridad, CORS restrictivo, logs estructurados.
- README de portafolio: screenshots, arquitectura, decisiones, cómo correrlo.

**Criterios de salida**

- `docker compose -f docker-compose.prod.yml up` levanta el sistema completo.
- Checklist de seguridad de producción de [security.md](security.md) al 100%.
