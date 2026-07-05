# ui-ux.md

> Design system de la plataforma. Fuente de verdad visual: estos tokens se
> materializan en `frontend/src/styles/tokens.css` y en la config de Tailwind
> (Fase 12). Generado con apoyo del skill `ui-ux-pro-max`.

---

## 1. Dirección de estilo

**"Calma premium"** — SaaS moderno con profundidad dimensional y glassmorphism
sutil. La paleta (verdes-azulados y salvias) transmite confianza, frescura y
comida saludable; el estilo la acompaña con capas, elevación y
microinteracciones — nunca plano-genérico ni template por defecto.

Reglas anti-template (obligatorias):

- Nada de grids de cards uniformes sin jerarquía: la vista de restaurantes usa
  jerarquía de escala (card destacada, bento donde aporte).
- Nada de gris-sobre-blanco con un acento decorativo: el color se usa
  **semánticamente** (estados de pensión, pagos, asistencia).
- Hover/focus/active diseñados en todos los elementos interactivos.
- Iconos SVG (Lucide) — **nunca emojis como iconos**.
- Dark mode diseñado a la par del light, no invertido automáticamente.

## 2. Paleta

### Base (obligatoria)

| Token | Hex | Rol |
|-------|-----|-----|
| `ink` | `#1F363D` | Texto principal, superficies oscuras, dark mode base |
| `primary` | `#40798C` | Acciones primarias, links, foco de marca |
| `secondary` | `#70A9A1` | Acentos secundarios, estados informativos |
| `accent` | `#9EC1A3` | Éxito, asistencia confirmada, acentos positivos |
| `mist` | `#CFE0C3` | Fondos suaves, superficies destacadas claras |

### Escala derivada (tonalidades + estados)

| Token | Light | Uso |
|-------|-------|-----|
| `--color-primary` | `#40798C` | Botón primario, links |
| `--color-primary-hover` | `#366678` | Hover (≈10% más oscuro) |
| `--color-primary-active` | `#2D5565` | Active/pressed |
| `--color-primary-soft` | `#E8F0F3` | Fondos de chips, filas seleccionadas |
| `--color-secondary` | `#70A9A1` / hover `#5E948C` / active `#4E7F78` | |
| `--color-success` | `#5B9463` | Derivado de accent con contraste AA sobre blanco |
| `--color-success-soft` | `#EAF3EB` | Fondos de badges de éxito |
| `--color-warning` | `#B07D2A` | Pagos por vencer |
| `--color-danger` | `#B3452E` | Errores, vencidos, acciones destructivas |
| `--color-background` | `#FAFBF8` | Fondo de página (blanco cálido, no #FFF puro) |
| `--color-surface` | `#FFFFFF` | Cards |
| `--color-surface-raised` | `#F3F7F0` | Superficies destacadas (derivado de `mist`) |
| `--color-text` | `#1F363D` | Texto principal |
| `--color-text-muted` | `#5A6E74` | Texto secundario (mantiene 4.5:1 sobre fondo) |
| `--color-border` | `#DCE5E0` | Bordes y divisores |

**Disabled (regla global):** opacidad `0.45` + `cursor: not-allowed` + atributo
semántico `disabled` — no un gris hardcodeado por componente.

### Dark mode (diseñado, no invertido)

| Token | Dark | Nota |
|-------|------|------|
| `--color-background` | `#14242A` | Más profundo que `ink`, no negro puro |
| `--color-surface` | `#1F363D` | `ink` como superficie de card |
| `--color-surface-raised` | `#28444D` | |
| `--color-primary` | `#6FA5B8` | Primario aclarado y desaturado (AA sobre surface) |
| `--color-accent` | `#A9CBAE` | |
| `--color-text` | `#E9F0EC` | |
| `--color-text-muted` | `#9FB4B0` | |
| `--color-border` | `#33505A` | Divisores visibles también en dark |

Implementación: variables CSS en `:root` / `.dark`, mapeadas a Tailwind. Los
componentes usan **solo tokens semánticos** — prohibido hex crudo en JSX.
Contraste verificado por token en la Fase 12 (herramienta de contraste, AA:
4.5:1 texto normal, 3:1 texto grande y componentes UI).

## 3. Tipografía

**Familia única: Plus Jakarta Sans** (Google Fonts, `font-display: swap`).
Una sola familia bien usada > dos familias sin criterio; moderna, amigable y
excelente en dashboards. Números tabulares (`font-variant-numeric: tabular-nums`)
en precios, contadores y tablas.

| Rol | Tamaño / peso | Uso |
|-----|---------------|-----|
| `display` | `clamp(2.25rem, 1.5rem + 3vw, 3.5rem)` / 800 | Hero del sitio público |
| `h1` | 2rem / 700 | Título de página |
| `h2` | 1.5rem / 700 | Sección |
| `h3` | 1.25rem / 600 | Card titles |
| `body` | 1rem (16px) / 400, line-height 1.6 | Texto base — nunca menor a 16px en móvil |
| `small` | 0.875rem / 500 | Metadatos, labels |
| `caption` | 0.75rem / 500 | Solo apoyo, nunca contenido esencial |

Longitud de línea: 60–75 caracteres en desktop (`max-w-prose` en textos largos).

## 4. Espaciado, radios y elevación

- **Escala de espaciado:** sistema 4/8px de Tailwind. Ritmo vertical por
  jerarquía: 16 (intra-componente) / 24 (entre componentes) / 48 (entre
  bloques) / `clamp(4rem, 3rem + 4vw, 7rem)` (entre secciones del sitio público).
  El espaciado **no es uniforme en todas partes**: agrupa lo relacionado.
- **Radios:** `--radius-sm: 8px` (inputs, chips) · `--radius-md: 12px` (botones,
  cards internas) · `--radius-lg: 16px` (cards de restaurante, modales) ·
  `--radius-full` (pills, avatares). Consistentes por nivel, nunca aleatorios.
- **Elevación (4 niveles, tintada con `ink`, no negro):**

```css
--elevation-1: 0 1px 3px rgb(31 54 61 / 0.08);
--elevation-2: 0 4px 10px rgb(31 54 61 / 0.10);
--elevation-3: 0 10px 24px rgb(31 54 61 / 0.12);
--elevation-4: 0 20px 44px rgb(31 54 61 / 0.16);
```

- **Glass (sutil, con propósito):** se reserva para superficies flotantes —
  navbar sticky, overlays de card de restaurante, sheets.

```css
--glass-bg: rgb(255 255 255 / 0.65);          /* dark: rgb(31 54 61 / 0.55) */
--glass-border: 1px solid rgb(255 255 255 / 0.35);
--glass-blur: blur(14px);                      /* backdrop-filter */
```

Regla: el texto sobre glass mantiene 4.5:1 — si el fondo lo compromete, se
sube la opacidad del panel, no se sacrifica contraste.

## 5. Motion

| Token | Valor |
|-------|-------|
| `--duration-fast` | 150ms — hover, toggles |
| `--duration-normal` | 250ms — reveals, expansión de cards |
| `--duration-slow` | 400ms — máximo absoluto (modales, page transitions) |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) para entradas; ease-in para salidas; salida ≈ 70% de la duración de entrada |

Reglas:

- Animar **solo** `transform`, `opacity`, `clip-path` (compositor-friendly).
  Nunca `width/height/top/left`.
- Stagger en listas/grids: 30–50ms por ítem, máximo ~8 ítems con stagger.
- Feedback de press: `scale(0.98)` en cards/botones tappables.
- 1–2 elementos animados protagonistas por vista, no todo a la vez.
- `prefers-reduced-motion: reduce` ⇒ desactivar transforms decorativos,
  conservar solo fades funcionales. Obligatorio desde el primer componente.

## 6. Componentes clave

Base: **shadcn/ui** como primitivas (accesibilidad resuelta) + wrappers propios
que aplican los tokens. Nunca estilos por defecto de librería sin adaptar.

### 6.1 Card de restaurante (pieza central del catálogo)

Estados diseñados:

1. **Reposo:** imagen principal con overlay de gradiente `ink` inferior, logo,
   nombre, badge de estado (abierto/cerrado según horario), precio de pensión.
   `--elevation-1`, `--radius-lg`.
2. **Hover:** elevación a `--elevation-3` + `translateY(-4px)` + `scale(1.01)`
   de la imagen (250ms); revela fila de metadatos (distancia, horario de hoy).
3. **Click → expansión:** la card se expande in-place (o abre sheet en móvil)
   con panel glass sobre la imagen: **menú del día, horarios, ubicación
   (mini-mapa), disponibilidad**. Transición con continuidad espacial (la
   imagen es el elemento compartido), interrumpible, cerrable con Escape y
   con affordance visible de cierre.
4. **Focus-visible:** ring de 2px `--color-primary` con offset — misma
   experiencia por teclado que por hover.

### 6.2 Dashboard administrativo

- **Métricas (stat tiles):** pensionarios activos · pagos pendientes ·
  reservas del día · asistencia proyectada · ingresos estimados. Cada tile:
  valor grande (tabular, 700), delta vs. período anterior con icono + color
  semántico (**nunca color solo**: siempre icono/texto), sparkline sutil.
- **Grid bento:** métricas arriba (jerarquía: la métrica del día más grande),
  luego reservas/asistencia de hoy, luego actividad.
- **Charts** (Recharts): tendencia → línea; comparación → barras; ejes con
  unidades; grid `--color-border` sutil; tooltips accesibles; estado
  vacío/cargando (skeleton) diseñados; animación de entrada respeta
  reduced-motion.

### 6.3 Estados del sistema (semánticos)

| Estado | Color | Badge |
|--------|-------|-------|
| Pensión activa | success | `Activa` + días restantes |
| Por vencer (≤5 días) | warning | `Vence pronto` |
| Vencida / pago pendiente | danger | `Vencida` / `Pago pendiente` |
| Restaurante pendiente | secondary | `En revisión` |
| Asistencia confirmada | success soft | `Asistiré` |

### 6.4 Formularios

- Label visible siempre (nunca placeholder-only); helper text persistente en
  campos complejos; error debajo del campo con causa + cómo corregir.
- Validación on-blur (no por tecla); tras submit con errores, foco al primer
  campo inválido; errores anunciados con `role="alert"`.
- Inputs táctiles ≥ 44px de alto; `inputmode`/`type` semánticos (tel, email).
- Submit: loading en el botón (spinner + disabled) → éxito/error visible.
- Confirmación antes de acciones destructivas; toasts auto-dismiss 4s con
  `aria-live="polite"`, con Undo donde aplique (cancelar reserva).

### 6.5 Chat y notificaciones

- Chat: burbujas propias en `--color-primary-soft`, ajenas en surface; hora y
  estado de leído; scroll anclado abajo con paginación hacia arriba; input
  fijo respetando safe-area en móvil.
- Campana de notificaciones con badge de no-leídas; panel con agrupación por
  día; estado vacío diseñado ("Sin novedades") con ilustración ligera.

## 7. Layout y responsive

- **Mobile-first.** Breakpoints: 375 / 768 / 1024 / 1440. Test también en 320.
- Contenedor público: `max-w-7xl`; app privada: sidebar fija ≥1024px,
  bottom-nav (≤5 ítems, icono + label) en móvil para la app de cliente.
- Navegación: ubicación consistente en todas las páginas; ítem activo marcado
  (color + indicador, no color solo); breadcrumbs en el panel admin a partir
  de 3 niveles. Filtros/tab/paginación viven en la URL.
- Sin scroll horizontal nunca; tablas anchas scrollean dentro de su contenedor.
- `min-h-dvh` (no `100vh`) en móvil; imágenes con `width/height` explícitos o
  `aspect-ratio` (CLS < 0.1).

## 8. Accesibilidad (WCAG 2.2 AA — no negociable)

- Contraste: 4.5:1 texto normal, 3:1 texto grande y componentes UI — verificado
  por token en **ambos temas**.
- Teclado completo: orden de tab = orden visual, focus-visible en todo
  interactivo, skip-link al contenido, Escape cierra modales/sheets (con
  confirmación si hay cambios sin guardar).
- Targets táctiles ≥ 44×44px con ≥ 8px de separación.
- `aria-label` en botones de solo-icono; jerarquía de headings sin saltos;
  `alt` descriptivo en imágenes con significado.
- La información nunca depende solo del color (icono/texto siempre).
- Focus al contenido principal tras cambio de ruta (SPA).

## 9. Performance visual (presupuestos)

| Superficie | JS (gzip) | Objetivo |
|------------|-----------|----------|
| Sitio público | < 150 kb | LCP < 2.5s, CLS < 0.1, INP < 200ms |
| App privada | < 300 kb | Code-splitting por ruta y por rol |

- Imágenes AVIF/WebP con dimensiones explícitas; hero `fetchpriority="high"`,
  resto lazy. Una sola familia tipográfica, subset latin, preload del peso crítico.
- Charts y mapa cargados con `import()` dinámico.

## 10. Checklist de entrega por componente

- [ ] ¿Evita parecer template por defecto de Tailwind/shadcn?
- [ ] ¿Hover, focus-visible, active y disabled diseñados?
- [ ] ¿Jerarquía real (escala/espaciado), no énfasis uniforme?
- [ ] ¿Funciona y se ve intencional en light **y** dark?
- [ ] ¿Solo tokens semánticos (cero hex crudo en componentes)?
- [ ] ¿Reduced-motion respetado y contraste AA verificado?
- [ ] ¿Creíble en un screenshot de producto real?
