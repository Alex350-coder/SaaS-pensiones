# security.md

> Modelo de amenazas y controles de seguridad. La seguridad se implementa
> **desde la Fase 2/3**, no como parche final. La Fase 15 audita contra este
> documento y produce `security-report.md`.

---

## 1. Activos a proteger

| Activo | Sensibilidad |
|--------|--------------|
| Credenciales (hashes de contraseña, refresh tokens) | Crítica |
| Datos personales (nombre, email, teléfono) | Alta |
| Datos comerciales del restaurante (pagos, pensionarios, ingresos) | Alta |
| Mensajes de chat | Alta (privados entre dos partes) |
| Integridad de facturas y numeración | Alta |
| Disponibilidad del catálogo público | Media |

## 2. Amenazas identificadas y mitigaciones

| # | Amenaza | Vector | Mitigación |
|---|---------|--------|------------|
| A1 | Robo de cuenta | Credential stuffing / brute force en login | Rate limiting agresivo en `/auth/*`, bcrypt (cost ≥ 12), bloqueo progresivo, mensajes de error que no revelan si el email existe |
| A2 | Robo/replay de refresh token | XSS, filtración de storage | Rotación con `family_id`: reutilización de un token ya rotado ⇒ revocación de la familia completa; tokens hasheados en DB |
| A3 | Escalada horizontal | Cliente A accede a pensión/chat/facturas del cliente B manipulando IDs | **Ownership check en cada caso de uso** (no solo el guard de rol); IDs UUID no enumerables; tests de autorización por recurso |
| A4 | Escalada vertical | CLIENT invoca endpoints de admin | RBAC con guards por defecto **deny**: todo endpoint exige rol explícito; el super admin es el único que muta estados de restaurante |
| A5 | Restaurante fraudulento | Alta de restaurante falso que capta pagos | Flujo de aprobación por Super Admin (`PENDING` no es visible ni contratable); suspensión inmediata con efecto en catálogo y contratación |
| A6 | Inyección SQL | Inputs en filtros/búsquedas | Prisma parametriza todo; prohibido `$queryRawUnsafe`; `$queryRaw` solo con template literals parametrizados y revisión |
| A7 | XSS almacenado | Chat, descripciones de restaurante, avisos | Estrategia anti-XSS = **codificación en salida (output-encoding)**: React escapa por defecto y **`dangerouslySetInnerHTML` está prohibido** (cero usos) — no se renderiza HTML de usuario. Los DTOs validan y recortan el texto libre en el borde. CSP en producción. No se sanitiza la entrada porque no hay render de HTML de usuario (un sanitizador sería YAGNI; ver `security-report.md` LOW-1) |
| A8 | CSRF | Acciones con sesión implícita | API stateless con `Authorization: Bearer` (sin cookies de sesión) ⇒ CSRF neutralizado por diseño; CORS restrictivo al origen del frontend |
| A9 | Abuso de WebSocket | Conexión sin auth, join a rooms ajenos, flood | JWT verificado en handshake; autorización de room contra la pensión en DB; rate limit de mensajes por conexión; límite de tamaño (2000 chars) |
| A10 | Manipulación de facturación | Duplicar/alterar numeración | Numeración con `SELECT ... FOR UPDATE`; facturas inmutables (`VOIDED`, nunca DELETE/UPDATE de montos); auditoría |
| A11 | Fuga por errores | Stack traces / mensajes internos al cliente | Filtro global de excepciones: el cliente recibe `{ code, message }` genérico; el detalle va al log del servidor |
| A12 | Subida de archivos maliciosa | Logos/galería | Validar content-type real (magic bytes), límite de tamaño, re-encode de imágenes, nombres aleatorios, servir desde ruta sin ejecución |
| A13 | DoS de endpoints costosos | Listados sin límite, métricas | Paginación obligatoria con `limit` máximo, throttling global + estricto por endpoint sensible, timeouts de query |
| A14 | Exposición de secretos | Commit de `.env`, logs con tokens | `.env` en `.gitignore` desde el commit 0, `.env.example` sin valores, validación de config al arranque, redacción de campos sensibles en logs |

## 3. OWASP Top 10 (2021) — cobertura

| OWASP | Aplicación en este proyecto |
|-------|------------------------------|
| A01 Broken Access Control | RBAC deny-by-default + ownership checks por recurso (amenazas A3/A4). Tests de autorización obligatorios por endpoint |
| A02 Cryptographic Failures | bcrypt para contraseñas; refresh tokens hasheados; TLS en producción; sin datos sensibles en JWT payload |
| A03 Injection | Prisma parametrizado (A6); validación/recorte de DTOs; anti-XSS por codificación en salida (A7) |
| A04 Insecure Design | Este documento + invariantes en DB (constraints) + flujo de aprobación de restaurantes |
| A05 Security Misconfiguration | Helmet (headers), CORS restrictivo, `ValidationPipe` con `forbidNonWhitelisted`, sin endpoints de debug en producción, contenedores non-root |
| A06 Vulnerable Components | `pnpm audit` en CI local; lockfile versionado; dependencias mínimas |
| A07 Auth Failures | A1/A2: rate limit, bcrypt, rotación de refresh, expiración corta de access token (15 min) |
| A08 Integrity Failures | Migraciones versionadas; facturas y audit log inmutables; lockfile |
| A09 Logging Failures | Logging estructurado con request-id; auditoría de eventos sensibles (§5); sin secretos en logs |
| A10 SSRF | El servidor no hace fetch de URLs provistas por usuarios (las imágenes se suben, no se referencian) |

## 4. Autenticación y autorización (diseño)

### Autenticación

- **Access token JWT**: vida 15 min, payload mínimo (`sub`, `role`), firmado
  con secreto fuerte de entorno (HS256 en v1).
- **Refresh token**: vida 7 días, opaco, hasheado en DB, **rotación en cada
  uso** con detección de reuso por `family_id` (ver A2).
- Contraseñas: bcrypt cost ≥ 12; política mínima (longitud ≥ 8) validada con Zod
  en frontend y class-validator en backend. Máximo 72 **bytes** (límite real
  de bcrypt), validado por bytes y no por caracteres.
- Logout: revoca la familia de refresh tokens del dispositivo.
- Anti-enumeración en login: mismo `code`/mensaje para email inexistente y
  contraseña incorrecta, **y** verificación bcrypt contra un hash dummy de
  igual costo cuando el email no existe (sin oráculo de timing).

**Trade-offs registrados (Fase 3):**

- Dos refresh concurrentes legítimos con el mismo token (retry de red, dos
  pestañas): el perdedor dispara la revocación de la familia ⇒ logout total.
  Fail-closed deliberado: se prioriza detección de robo sobre esa esquina de UX.
- Los eventos de auditoría de auth aún no capturan IP/user-agent; se añadirá
  contexto de request al `AuditService` en una fase posterior (mejora M3 de la
  revisión de seguridad de Fase 3).

**Trade-offs registrados (Fase 8 — WebSocket):**

- **Sockets de vida larga vs TTL del access token (15 min):** el JWT se
  verifica una sola vez en el handshake (HS256 pineado, expiración exigida);
  un socket abierto sigue autorizado tras expirar el token e incluso tras un
  logout HTTP. Aceptado por ahora (el daño está acotado: solo eventos de chat
  de conversaciones propias). Mitigación planificada: registro userId→sockets
  para desconexión forzada en logout/suspensión, o edad máxima de conexión.
- **Guards globales no cubren gateways:** en esta versión de
  `@nestjs/websockets` los `APP_GUARD`/`APP_PIPE` globales **no** se ejecutan
  para `@SubscribeMessage` (verificado empíricamente en la revisión de Fase 8).
  Por eso el gateway implementa por sí mismo: auth de handshake, rate limit
  por usuario (`WsRateLimiter`, 30 eventos/10 s, off en test como el throttler
  HTTP), validación de forma UUID de los ids y `maxHttpBufferSize` de 16 KB
  (el default de Socket.IO es 1 MB). Regla de revisión: todo gateway nuevo
  replica este preámbulo; nunca asumir que los guards globales lo protegen.
- **CORS (HTTP y WS):** sin allow-list de origen todavía; llega con Helmet en
  la Fase 18 (preparación para producción), cuando exista el origen real del
  frontend. El riesgo interim es bajo: auth por Bearer/handshake (no cookies),
  sin CSRF posible.

### Autorización (RBAC + ownership)

```text
Petición → JwtAuthGuard (¿token válido?)
        → RolesGuard (¿rol permitido en este endpoint?)         ← deny by default
        → Caso de uso: ownership check (¿este recurso es tuyo?) ← SIEMPRE
```

| Regla | Detalle |
|-------|---------|
| CLIENT | Solo sus pensiones, reservas, asistencias, conversaciones, notificaciones y facturas |
| RESTAURANT_ADMIN | Solo recursos de **su** restaurante (`restaurant.owner_id = user.id`) |
| SUPER_ADMIN | Gestión de plataforma; sus acciones siempre auditadas |
| WebSocket | Mismo pipeline: JWT en handshake + autorización de room por pensión |

## 5. Controles transversales

- **Validación de entrada:** DTOs con class-validator en el borde HTTP
  (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`);
  schemas Zod espejo en frontend. Nunca confiar en validación de cliente.
- **Rate limiting:** `@nestjs/throttler` — global moderado; estricto en
  `/auth/*`, envío de mensajes y creación de reservas.
- **Headers (producción):** Helmet — HSTS, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`;
  CSP nonce-based servida con el frontend.
- **Auditoría (`audit_logs`):** login/logout/refresh-reuse, cambios de estado
  de restaurante y pensión, pagos, emisión/anulación de facturas, acciones de
  Super Admin. Append-only.
- **Secretos:** solo variables de entorno; validación al arranque (la app no
  levanta si falta un secreto); rotación documentada en README de producción.

## 6. Checklist de seguridad por fase

**En cada PR / cambio (siempre):**

- [ ] Sin secretos hardcodeados
- [ ] Inputs validados en DTO (whitelist)
- [ ] Ownership check presente en el caso de uso
- [ ] Errores devueltos vía envelope, sin detalle interno
- [ ] Sin `console.log` con datos sensibles

**Gate de producción (Fase 18):**

- [ ] HTTPS + HSTS activos
- [ ] CSP nonce-based configurada
- [ ] CORS restringido al dominio del frontend
- [ ] Rate limits verificados con test de carga ligero
- [ ] `pnpm audit` sin CRITICAL/HIGH
- [ ] Contenedores non-root, imágenes multi-stage sin devDependencies
- [ ] `security-report.md` (Fase 15) sin hallazgos CRITICAL/HIGH abiertos
