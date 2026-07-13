# architecture-review.md

> Fase 16 — Revisión de arquitectura del backend. Generado con el agente
> `architect` sobre el árbol de trabajo, contrastado con
> [arquitectura.md](arquitectura.md) y el reporte de grafo de conocimiento.
> Fecha: 2026-07-12.

## Veredicto: ✅ APROBADO (sólido)

La arquitectura hexagonal de monolito modular descrita en `arquitectura.md` está
implementada con fidelidad, **no de forma aspiracional**. Las direcciones de
dependencia entre bounded contexts son correctas y sin ciclos, las capas de
dominio están libres de framework, y los dos puertos de salida (`InvoiceIssuer`,
`NOTIFICATION_PUSHER`) están cableados exactamente como se diseñaron. La
maquinaria transversal (envelope / paginación / errores) es única y consistente.
**Cero hallazgos CRITICAL/HIGH.** Los hallazgos son refinamientos, no bloqueos.

## 1. Dirección de dependencias entre contextos — CONFIRMADO LIMPIO

Verificado cada import cruzado en `backend/src/modules`. Sin aristas invertidas
ni cíclicas:

- **Billing → Pensions** (nunca al revés): `billing.module.ts` inyecta
  `INVOICE_ISSUER` (definido en `pensions/application/ports/invoice-issuer.port.ts`)
  y provee `SimulatedInvoiceIssuer`. Pensions nunca importa Billing; el
  `@Global()` de `BillingModule` es lo que permite a `RegisterPaymentUseCase`
  inyectar el puerto sin arista de vuelta. Flecha correcta.
- **Analytics → Catalog + Reservations** (solo lectura): `analytics.module.ts`
  importa solo esos dos; nada depende de Analytics.
- Catalog→(nada), Menu→Catalog, Pensions→Catalog, Reservations→Catalog,
  Communication→Catalog — coinciden con el diagrama §3.
- **Ningún módulo importa `presentation/`, `infrastructure/` ni `domain/` de otro
  módulo** (grep = 0). El acoplamiento cruzado es exclusivamente vía servicios de
  aplicación exportados y puertos DI — la costura correcta.

El resultado "cero ciclos de import" del grafo de conocimiento se mantiene.

## 2. Pureza de capas — mayormente limpia, una inversión

- **Dominio puro.** Grep de `@nestjs` / `@prisma` dentro de `**/domain/**` = 0.
  `pension.ts`, `pension-status.machine.ts`, `conversation-access.ts`,
  `production-projection.ts` son testeables en aislamiento.
- **MEDIUM (A-2) — la capa de aplicación importa DTOs de presentación.** Ver la
  tabla de hallazgos.

## 3. Puerto/adaptador — correcto

Ambos puertos siguen el patrón documentado: puerto propiedad del contexto
consumidor, adaptador provisto por el implementador, resuelto solo en el módulo
(`useExisting`). `RegisterPaymentUseCase` depende solo de la interfaz
`InvoiceIssuer`; cambiar el emisor simulado por uno real toca solo
`simulated-invoice-issuer.ts`.

## 4. God-objects — mayormente esperados, uno real

- **PrismaService / AuthUser — no son god-objects.** Alto fan-in inherente y
  correcto (adaptador de persistencia único; interfaz de principal de 2 campos).
  Sin acción.
- **MEDIUM (A-1) — `RestaurantsService` es un shared-kernel/god-object leve.** Ver tabla.
- **MEDIUM (A-3) — Analytics lee tablas de Pensions/Payments directo por Prisma.** Ver tabla.

## 5. Envelope / paginación / errores — sólido

- Fuente única del envelope (`core/http/api-envelope.ts`): `apiSuccess`/`apiError`,
  `ApiResponse<T>` discriminado, guard `isApiResponse`; `transform.interceptor.ts`
  envuelve los retornos — los controladores no fabrican envelopes a mano.
- Paginación centralizada (`core/http/pagination/`): todos los servicios paginados
  usan el mismo `paginated()` + `PaginationQueryDto` — sin deriva.
- Errores por `all-exceptions.filter.ts`: errores de dominio `{code,message}`
  pasan intactos (code inglés estable, mensaje español), `VALIDATION_ERROR`
  normalizado, y fallback por status con ocultación de mensaje en producción.

## Hallazgos priorizados

| # | Sev. | Hallazgo | Ubicación | Remediación | Estado |
|---|------|----------|-----------|-------------|--------|
| A-1 | MEDIUM | `RestaurantsService` (516 líneas, ~13 métodos) es un shared-kernel; 5 contextos lo importan solo por 2 métodos de lookup (`getOwnRestaurantId`, `findContractableRestaurant`) | `catalog/application/restaurants.service.ts` | Extraer un servicio/puerto `RestaurantLookup` de 2 métodos para los consumidores cruzados; dejar el CRUD/admin en Catalog | **Documentado.** Refactor de amplio radio (DI en 5 módulos); se difiere para no desestabilizar la suite verde antes de producción. Bajo el tope de 800 líneas hoy. |
| A-2 | MEDIUM | Servicios de aplicación importan DTOs de presentación (inversión de capa) | `catalog/application/restaurants.service.ts`, `identity/application/auth.service.ts` | Definir interfaces de entrada propias de `application/`; mapear DTO→input en los controladores | **Documentado.** Inversión intra-módulo (no crea ciclo de contexto). Candidato de limpieza para Fase 17/18. |
| A-3 | MEDIUM | Analytics lee tablas de Pensions/Payments directo por Prisma | `analytics/application/dashboard.service.ts` | Mantener como read-model (patrón CQRS de lectura); registrar como consumidor afectado ante cambios de esquema de Pensions | **Documentado como decisión intencional** (read-model de reporting). |
| A-4 | MEDIUM | Los puertos de salida exponen tipos de Prisma en el contrato de aplicación | `pensions/.../invoice-issuer.port.ts`, `communication/.../notification-pusher.port.ts` | `InvoiceIssuer`: mantener (el `TransactionClient` compartido es lo que hace atómica la numeración bajo el lock — trade-off justificado y documentado). `NotificationPusher`: sustituir `Prisma.JsonValue` por un tipo `JsonValue` propio a costo casi nulo | **`InvoiceIssuer` documentado como trade-off aceptado.** `NotificationPusher` diferido (bajo valor). |
| A-5 | LOW | `@Global()` en `BillingModule` amplía la visibilidad de `INVOICE_ISSUER` a toda la app para invertir una dependencia | `billing/billing.module.ts` | Aceptable; alternativa: exportar el puerto e importar Billing donde se necesite | Sin acción. |

## Conclusión

La arquitectura pretendida es real y está enforced. Se aprueba la Fase 16 desde
el punto de vista arquitectónico. Los dos seguimientos con mejor relación
valor/costo son extraer la costura `RestaurantLookup` (A-1) y remover la
inversión aplicación→DTO (A-2); ambos son baratos y tensarían un diseño ya
limpio. Se difieren conscientemente para no introducir riesgo de regresión de
amplio radio inmediatamente antes de la preparación para producción (Fase 18);
quedan registrados aquí como deuda técnica priorizada.
