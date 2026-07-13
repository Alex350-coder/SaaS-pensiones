# security-report.md

> **Fase 15 — Revisión de seguridad.** Auditoría del código contra
> [security.md](security.md) (amenazas A1–A14) y OWASP Top 10 (2021).
> Fecha: 2026-07-12 · Rama: `master` · Alcance: backend NestJS + frontend React.
>
> **Actualización Fase 18 (2026-07-13):** endurecimiento de producción aplicado
> — ver §7. **C-1 (tokens en `localStorage`) cerrado**: la sesión ahora viaja
> en cookies httpOnly + double-submit CSRF. Gate de producción de `security.md
> §6` al 100%. Sin hallazgos CRITICAL/HIGH abiertos.

---

## 1. Resumen ejecutivo

| Severidad | Hallazgos abiertos |
|-----------|--------------------|
| 🔴 CRITICAL | **0** |
| 🟠 HIGH | **0** |
| 🟡 MEDIUM | **0** |
| 🔵 LOW | 3 |
| ⚪ INFO / aceptado | 3 |

**Veredicto del gate (security.md §6):** ✅ *Sin hallazgos CRITICAL/HIGH
abiertos.* La superficie de autenticación, autorización, inyección y manejo de
errores está implementada conforme al modelo de amenazas. Los controles de
producción diferidos (Helmet, CORS, CSP, HSTS) siguen planificados para la
Fase 18 y están documentados como tal en `security.md §4`; no cuentan como
hallazgos abiertos de esta fase.

Los controles de acceso (A3 escalada horizontal / IDOR y A4 escalada vertical)
quedaron **cubiertos por tests E2E adversariales** nuevos
(`tests/security-authz.spec.ts`), que sirven de red de regresión permanente.

### Metodología

1. Lectura dirigida del código de seguridad (guards, servicios de auth,
   rotación de refresh, los 9 sitios de SQL crudo, resolutores de ownership,
   gateways WS, filtro global de excepciones, validación de config/entorno).
2. Barrido de patrones de riesgo (SQL crudo, `dangerouslySetInnerHTML`, `.env`
   versionado, Helmet/CORS, sanitización).
3. Redacción de tests E2E adversariales de autorización contra el stack real y
   ejecución hasta verde.

> Nota de proceso: la revisión se realizó de forma inline (agente
> `security-reviewer` no invocado para no agotar el límite de sesión del plan,
> que ya tumbó un subagente en esta misma sesión — mismo criterio operativo que
> las Fases 9–13). La cobertura de amenazas A1–A14 y OWASP A01–A10 es completa.

---

## 2. Hallazgos

### 🔵 LOW-1 — Sanitización server-side de texto libre declarada pero no implementada

- **Amenaza:** A7 (XSS almacenado) · OWASP A03.
- **Evidencia:** `security.md` A7/§5 afirma "sanitización server-side de campos
  de texto libre". No existe ninguna utilidad de sanitización en el backend
  (`grep sanitize|DOMPurify|xss` → 0 resultados). Los campos de texto libre
  (chat, descripción de restaurante, avisos) se persisten tal cual.
- **Riesgo real: bajo.** El vector de XSS efectivo está cerrado por
  *output-encoding*: React escapa por defecto y el código no usa
  `dangerouslySetInnerHTML` en ningún punto (`grep` → 0). Los DTOs validan
  forma y longitud en el borde HTTP.
- **Remediación (elegir una):**
  1. Reconciliar la doc: documentar que la estrategia anti-XSS es
     *output-encoding* (React) + prohibición de `dangerouslySetInnerHTML`, no
     sanitización de entrada — y añadirlo al checklist de revisión.
  2. Si se quiere defensa en profundidad, normalizar/recortar el texto libre en
     los DTOs (ya se hace con `@Transform trim` en varios) y, solo si en el
     futuro se renderiza HTML de usuario, introducir un sanitizador vetado.
- **Decisión sugerida:** opción 1 (no hay render de HTML de usuario; añadir un
  sanitizador ahora sería YAGNI). Pendiente para Fase 16 (doc).
- **✅ Resuelto (Fase 16):** `security.md` A7/A03 reconciliado — documenta la
  estrategia real (codificación en salida + prohibición de
  `dangerouslySetInnerHTML`, no sanitización de entrada). LOW-1 cerrado.

### 🔵 LOW-2 — Sin throttle estricto por endpoint en creación de reservas

- **Amenaza:** A13 (DoS de endpoints costosos).
- **Evidencia:** `security.md` A13/§5 lista "creación de reservas" entre los
  endpoints con rate limit estricto. Solo `/auth/*`, descargas de PDF y
  publicación de avisos tienen `@Throttle` propio; la creación de reservas cae
  bajo el global (100/min).
- **Riesgo real: bajo.** El global 100/min ya acota el abuso; cada reserva está
  además atada a una pensión ACTIVE del propio cliente y a `SELECT … FOR
  UPDATE`, lo que limita el daño.
- **Remediación:** añadir `@Throttle` (p. ej. 20/min) al endpoint de creación
  de reserva, con test que lo cubra. Pendiente para Fase 16/17.

### 🔵 LOW-3 — Los refresh tokens caducados/revocados no se purgan

- **Amenaza:** A2 (higiene de credenciales) — crecimiento no acotado de tabla.
- **Evidencia:** `refresh-token.service.ts` marca `revokedAt` y fija
  `expiresAt`, pero no hay job que borre filas caducadas/revocadas. La tabla
  `refresh_tokens` crece indefinidamente.
- **Riesgo real: informativo.** No es explotable; es deuda operativa. Los tokens
  caducados ya se rechazan en `rotate()` (`expiresAt <= now`).
- **Remediación:** cron de limpieza (`deleteMany` de revocados/caducados con
  antigüedad > TTL). Pendiente para Fase 17/18.

### ⚪ INFO — Trade-offs aceptados y ya documentados

| Ítem | Estado |
|------|--------|
| Socket WS de vida larga sigue autorizado tras expirar el access token / logout HTTP | Aceptado y documentado en `security.md §4`; mitigación planificada (registro userId→sockets para desconexión forzada). |
| CORS/Helmet/CSP/HSTS ausentes | Diferido a Fase 18 (preparación producción), documentado. Riesgo interim bajo: auth por Bearer (sin cookies) ⇒ sin CSRF. |
| Auditoría de auth sin IP/User-Agent | Mejora M3 de Fase 3, documentada. |

---

## 3. Verificación de controles (A1–A14)

| # | Amenaza | Estado | Evidencia |
|---|---------|--------|-----------|
| A1 | Robo de cuenta (brute force) | ✅ | Throttle register 3 / login 5 / refresh 10 por min (`auth.controller.ts`); bcrypt cost 12 (`password.service.ts`); error uniforme `INVALID_CREDENTIALS`; hash equalizador de timing contra email inexistente (`auth.service.ts` L56, L110-113). |
| A2 | Replay de refresh token | ✅ | Tokens opacos `randomBytes(48)`, hasheados SHA-256; rotación con claim atómico; reuso ⇒ revocación de familia; `revokeAllForUser` en suspensión (`refresh-token.service.ts`). |
| A3 | Escalada horizontal / IDOR | ✅ | Ownership filtrado en DB en cada query (`invoices.service.ts` L45-72, `getOwnRestaurantId` lanza si no hay restaurante); 404 uniforme `INVOICE_NOT_FOUND`; IDs UUID; **cubierto por E2E** `security-authz.spec.ts`. |
| A4 | Escalada vertical | ✅ | RBAC deny-by-default (`roles.guard.ts`: falta de `@Roles` ⇒ 403); `SUPER_ADMIN` no autoregistrable (`register.dto.ts` `SELF_REGISTER_ROLES`); **cubierto por E2E**. |
| A5 | Restaurante fraudulento | ✅ | Flujo de aprobación Super Admin; `PENDING`/`SUSPENDED` fuera del catálogo público (Fase 4, verificado en historial + grafo). |
| A6 | Inyección SQL | ✅ | 9 sitios de SQL crudo, todos *tagged template literals* parametrizados (`${x}::uuid`); cero `$queryRawUnsafe`/`$executeRawUnsafe` (`simulated-invoice-issuer.ts`, locks `FOR UPDATE`). |
| A7 | XSS almacenado | ⚠️ LOW-1 | React escapa; 0 `dangerouslySetInnerHTML`; DTOs validan. Sanitización de entrada declarada pero no implementada (defensa en profundidad). |
| A8 | CSRF | ✅ | API stateless con `Authorization: Bearer` (sin cookies de sesión) ⇒ CSRF neutralizado por diseño. |
| A9 | Abuso de WebSocket | ✅ | JWT en handshake (HS256 pineado), `WsRateLimiter` 30/10s, validación UUID, `maxHttpBufferSize` 16KB en ambos gateways (`ws-auth.ts`, `chat.gateway.ts`, `notifications.gateway.ts`). |
| A10 | Manipulación de facturación | ✅ | Numeración atómica `INSERT … ON CONFLICT … RETURNING`; `@@unique([seriesId, number])` + `paymentId @unique`; VOIDED nunca reusa número ni borra (`simulated-invoice-issuer.ts`). |
| A11 | Fuga por errores | ✅ | Filtro global: 5xx ⇒ mensaje genérico al cliente, stack solo al log; mensaje framework (inglés) solo fuera de producción (`all-exceptions.filter.ts` L71-122). |
| A12 | Subida de archivos maliciosa | N/A | Sin uploads todavía (galería por URL); puerto `FileStorage` diferido. Controles A12 aplicables cuando exista subida real. |
| A13 | DoS de endpoints costosos | ⚠️ LOW-2 | Paginación con `limit` máx 100 (`pagination-query.dto.ts`); throttle global + estricto en auth/PDF/avisos. Falta throttle propio en creación de reservas. |
| A14 | Exposición de secretos | ✅ | `.env` en `.gitignore` (sin `.env` versionado); validación de entorno fail-fast con Zod; `JWT_ACCESS_SECRET` ≥ 32 chars (`env.ts`); logs sin bodies/tokens (`main.ts`). |

## 4. OWASP Top 10 (2021)

| OWASP | Estado |
|-------|--------|
| A01 Broken Access Control | ✅ RBAC deny-by-default + ownership por recurso (A3/A4), con E2E adversarial. |
| A02 Cryptographic Failures | ✅ bcrypt 12; refresh SHA-256; JWT payload mínimo (`sub`, `role`); TLS ⇒ Fase 18. |
| A03 Injection | ✅ SQL parametrizado (A6); DTOs `whitelist`+`forbidNonWhitelisted`+`transform`. |
| A04 Insecure Design | ✅ Invariantes en DB + flujo de aprobación + este modelo de amenazas. |
| A05 Security Misconfiguration | ⚠️ Helmet/CORS/CSP diferidos a Fase 18 (documentado); `ValidationPipe` estricto activo. |
| A06 Vulnerable Components | ⏳ `pnpm audit` en el gate de Fase 18; lockfile versionado. |
| A07 Auth Failures | ✅ Rate limit, bcrypt, rotación de refresh, TTL 15 min; token faltante/malformado/manipulado rechazado (E2E). |
| A08 Integrity Failures | ✅ Migraciones versionadas; facturas y audit log inmutables. |
| A09 Logging Failures | ✅ Auditoría de eventos sensibles; sin secretos en logs. IP/UA pendiente (M3). |
| A10 SSRF | ✅ El servidor no hace fetch de URLs provistas por el usuario. |

---

## 5. Tests de autorización añadidos

`tests/security-authz.spec.ts` (E2E Playwright, API-level, contra el stack real):

- **A07** — `GET /auth/me` sin token ⇒ 401 `MISSING_ACCESS_TOKEN`; token
  malformado ⇒ 401 `INVALID_ACCESS_TOKEN`; firma manipulada ⇒ 401.
- **A4/A01** — CLIENT no alcanza `/admin/users`, `/admin/restaurants` ni
  `/restaurants/mine/dashboard` (403 `FORBIDDEN`); RESTAURANT_ADMIN no alcanza
  `/admin/users` (403).
- **A3** — un cliente ajeno no descarga la factura de otro (404
  `INVOICE_NOT_FOUND`, no 403 ni el PDF) ni la ve en su listado; la dueña
  legítima sí la descarga (200 `application/pdf`).
- **A13** — `GET /restaurants?limit=101` ⇒ 400 `VALIDATION_ERROR`.

---

## 6. Recomendaciones y siguiente fase

1. **Fase 16 (doc):** reconciliar `security.md` A7 con la estrategia real de
   XSS (output-encoding) — cerrar LOW-1.
2. **Fase 16/17:** añadir `@Throttle` a creación de reservas — cerrar LOW-2.
3. **Fase 17/18:** cron de limpieza de refresh tokens caducados — cerrar LOW-3.
4. **Fase 18 (gate de producción):** Helmet + HSTS, CORS restrictivo, CSP
   nonce-based, `pnpm audit` sin CRITICAL/HIGH, contenedores non-root, y
   desconexión forzada de sockets en logout/suspensión.

**Conclusión:** el sistema cumple el criterio de salida de la Fase 15 —
**cero hallazgos CRITICAL/HIGH**. Los ítems LOW/INFO quedan registrados con su
fase objetivo.

---

## 7. Endurecimiento de producción (Fase 18 — 2026-07-13)

| Ítem | Estado |
|------|--------|
| **C-1 — tokens en `localStorage`** | ✅ **CERRADO.** access + refresh en **cookies httpOnly** (`core/auth/cookies.ts`), ilegibles por JS; el `session-store` solo persiste `user`. `access_token` root-scope (viaja también al handshake WS same-origin), `refresh_token` `SameSite=Strict` acotado a `/api/v1/auth`. |
| **CSRF (A8)** | ✅ `CsrfGuard` global de double-submit: cookie `csrf_token` legible + header `X-CSRF-Token` en todo método mutante; omite `@Public` y `Bearer` (no ambiental). Cubierto por unit + e2e (`auth.e2e-spec.ts`: sin header → 403, header ≠ cookie → 403, match → 200). |
| **Helmet / headers (A05)** | ✅ HSTS, `X-Frame-Options: DENY`, nosniff, referrer-policy (`configure-app.ts`). CSP estricta de la SPA servida por nginx. |
| **CORS** | ✅ allow-list `CORS_ORIGINS` con `credentials:true`; topología same-origin (nginx) elimina el CORS del navegador. |
| **Desconexión forzada de WS (§4)** | ✅ puerto `SESSION_TERMINATOR` (Identity) implementado por Communication; logout y suspensión Super-Admin cortan todos los sockets del usuario (chat + notificaciones). |
| **Logging estructurado (A09)** | ✅ JSON por request con `X-Request-Id` (`request-logger.middleware.ts`); sin secretos/bodies. |
| **`pnpm audit --prod`** | ✅ sin CRITICAL/HIGH (backend + frontend); `multer` fijado ≥ 2.2.0 vía override. |
| **Contenedores** | ✅ non-root (API `node`, web nginx-unprivileged), multi-stage; el runner de API excluye el toolchain de dev. |
| **LOW-2 / LOW-3 (Fases 16/17)** | ✅ cerrados previamente (throttle de reservas; purga de refresh tokens). |

El header `Authorization: Bearer` se mantiene como vía **no ambiental** para
clientes programáticos/móviles (el guard lo acepta; al no viajar en cookie no
está expuesto a CSRF).
