# Reader App — Agent Guide

Vanilla HTML/CSS/JS e-reader optimized for the **Kindle Oasis experimental browser**. Targets old WebKit (no flexbox `gap`, no CSS variables at runtime, no ES modules, possibly no `Proxy`). Ships as a single concatenated `main.js` (IIFE-wrapped).

## Hard Constraints

Code that violates any of these will break on the actual device. Do not relax them without testing on hardware.

### JavaScript (`reader/src/*.js`)
- **ES5 only.** No arrow functions, no `const`/`let`, no template literals, no destructuring, no `for...of`, no default params, no `Object.assign`.
- **`var` and `function` only.** This is deliberate, not legacy.
- **XHR, not `fetch`.** Old WebKit's `fetch` is unreliable.
- **`ecmaVersion: 5`** is enforced by ESLint (see `eslint.config.js`). The build will fail otherwise.
- **No ES module syntax** (`import`/`export`). Files are concatenated by `scripts/build-reader.mjs` in a fixed order (`MODULE_ORDER`) and share one IIFE scope.
- **Global scope is shared** — prefix private helpers with `_` and check for name collisions when adding functions.
- **Avoid `Object.keys` on arrays** and other ES5+-on-arrays edge cases; iterate with index loops.
- **`hasOwnProperty` checks** on `for...in` are required (see `unwrap`, `request`).

### CSS (`reader/styles.css`)
- **No `gap` on flexbox.** Old WebKit ignores it. Use `margin-left` on children with `:first-child { margin-left: 0 }`.
- **No CSS variables** (`var(--x)`). The runtime lookup is slow and partially unsupported. Use hardcoded values per `[data-theme="..."]` selector.
- **No `:hover` rules.** Kindle is touch-only; hover states get stuck.
- **No `cursor` property.** No mouse.
- **`-webkit-font-smoothing: none`** on body — e-ink needs sharp edges, not anti-aliasing.
- **`text-rendering: optimizeSpeed`** — weak CPU.
- **`-webkit-tap-highlight-color`** belongs on the `*` selector.
- **Sans-serif stack** (Arial/Helvetica) for e-ink legibility.

### HTML (`reader/index.html`)
- **`defer` on every `<script>`** — parallel download, non-blocking parse. The build script injects `defer` into the production `main.js` tag too.
- **`format-detection: telephone=no`** meta — prevents old WebKit from mis-parsing numbers as tel: links.
- **Dev uses separate `<script>` tags** (one per module, in `MODULE_ORDER`); production swaps them for one `main.js` via the `@reader-modules-start`/`@reader-modules-end` markers. Do not remove those markers.

## Architecture

### Module order (load order matters)
`core.js` → `api.js` → `dict.js` → `library.js` → `viewer.js` → `settings.js` → `lookup.js` → `init.js`

All functions live in one shared IIFE scope after concatenation. There are no modules — this is intentional.

### State
Single global `state` object in `core.js`. Persisted fields read from `localStorage` at init. Do not add module-private state without a strong reason; prefer extending `state`.

### Caching pattern (critical for Kindle memory)
- **Modals** (`settings.js`, `lookup.js`, `viewer.js`): build once into a module-private `_xxxModal` var, then hide/show via `style.display`. Rebuild only if detached from DOM (`!_modal.parentNode`).
- **Library shell** (`_libShell` in `library.js`): detach before opening viewer, re-attach on return. Do not `innerHTML = ''` it away.
- **Dict word count** (`d.cachedCount`): scan once, never rescan the 2.3MB dict text.
- **TOC** (`state.tocFlat`): lazy-flatten on first TOC open, not at book load.

Use `overlayVisible(id)` (not `getElementById(id) !== null`) to check modal visibility — cached modals exist in the DOM even when hidden.

### Dictionary (`dict.js`)
- `DICTS` registry: each entry has `key`, `label` (`'En-En'` / `'Fr-En'`), `url`, `cacheKey`, plus runtime fields `data` (parsed entries), `norm` (accent-normalized words, French only), `cachedCount`.
- `DICT_LIST` in `settings.js` is the UI-facing array (subset of fields).
- Active dict is `state.activeDict` (`'eng'` | `'fre'`), persisted in localStorage. Double-tap lookup and Settings lookup both use the active dict only — no auto-detection.
- **Manual download only.** Never auto-download dicts; user must tap Download.
- Old cache key `__dictionary__` is transparently migrated to `__dict_eng__` on first access.
- `_parseDict` uses offset-based scanning (no intermediate `split('\n')` array) to halve peak memory.

### Navigation
- Hash router in `init.js` (`#/library`, `#/book/:id`).
- **PageUp/PageDown are configurable**: default swapped (PageUp = forward), toggle via Settings → nav swap. `state.navSwap` persisted.
- Arrow keys use `keyCode` fallback (`37`/`39`) — `e.key` may be undefined on old WebKit.

### Firebase
- REST API only (no Firebase SDK in the reader bundle — too heavy).
- Auth: `signInWithPassword` → store `token`, `refreshToken`, `uid`, `tokenExpiry` in localStorage. Refresh via `securetoken.googleapis.com`.
- `list` endpoint + client-side filtering (`runQuery` returns 403 PERMISSION_DENIED — do not try to "fix" this).
- Storage: `firebasestorage.googleapis.com` (prod) / `/fs-proxy/...` (dev, via Vite).

## Build & Deploy
- `npm run build:reader` → `scripts/build-reader.mjs` → `dist-reader/` (concatenated `main.js`, transformed `index.html`, copied `styles.css`, `vendor/`, `data/`).
- `npm run deploy` → `scripts/deploy.sh` → pushes `dist/` + `dist-reader/` to `gh-pages` branch.
- Production URL: `https://nkhanhtrn.github.io/chat/reader/`.
- Dict URLs are relative (`./data/eng-eng.txt`) in prod, `/reader/data/eng-eng.txt` in dev (see `IS_DEV` in `core.js`).

## Testing
- `npx vitest run reader/__tests__/` — 194 tests across 12 files.
- Tests load source files via `__tests__/helper.js` (`loadDict`, `loadViews`, `loadInit`) into a `happy-dom` window.
- Cached-modals changed tests from null-checks to visibility-checks — keep using `overlayVisible()` patterns in tests too.

## Lint
- `npm run lint:reader` — ESLint flat config (`eslint.config.js`), `ecmaVersion: 5`, scoped to `reader/src/`.
- CI runs lint on every PR (`.github/workflows/ci.yml`).

## Benchmarking
- Chrome DevTools → Performance tab → CPU throttling 4x–6x, Network → Slow 3G.
- Or `console.time`/`console.timeEnd` on actual Kindle hardware (remove before commit).

## Things That Look Wrong But Aren't
- **No CSS variables** — intentional, see above.
- **`var` everywhere** — intentional, see above.
- **XHR with `onreadystatechange`** — intentional, not legacy.
- **Margin-left + `:first-child` for flex spacing** — Kindle can't do `gap`.
- **`runQuery` 403 + client-side filter** — Firebase rules limitation, not a bug.
- **`state.currentRendition.destroy()` on back button** — frees epub.js iframe memory; Kindle OOMs otherwise.
