# Upgrade Guide

This document describes what integrators (and AI agents working on integrations) need to do when upgrading between versions of `@flyo/nitro-js-bridge`. When a version is not listed, there is nothing to do beyond updating the dependency.

## 1.4.x → 1.5.0

**No breaking changes to the API.** `highlightAndClick(blockUid, element?)` keeps its signature and its return contract (a cleanup function inside the editor iframe, the plain `open()` click handler outside of it). Its implementation and its appearance changed substantially, and it is now guaranteed not to interfere with the website it runs in.

### What's new

1. **The live-edit hover affordance was rebuilt.** Hovering an editable block now fades in a highlight ring around the block plus the pencil button on its top-left edge; both fade out again when you leave, with a grace period so you can travel from the block to the pencil. Previously there was no highlight at all (despite the function's name and the old README), the button appeared and disappeared instantly, and its "hover pad" for small elements was dead code that could never fire.

2. **One overlay per page instead of two nodes per block.** All registered blocks share a single ring and a single button. Nested editable blocks therefore no longer produce overlapping buttons that fight each other — the innermost block under the pointer wins — and a page with 500 blocks adds one DOM node instead of 1000.

3. **The overlay cannot disturb the website any more.** It is a single `<flyo-edit-overlay>` element mounted on `<html>` (not `<body>`, so `body > :last-child` keeps matching what the site's CSS expects), holding a shadow root, `position: fixed` with a zero-size box. Concretely:
   - no style, class, attribute, listener or child node is ever put on your elements,
   - your CSS cannot restyle the overlay (not even `button { display: none !important }`) and no stylesheet of ours is injected into your page, so a strict `style-src` CSP stays quiet,
   - page layout, scroll height and scrollbars are untouched,
   - the ring is `pointer-events: none` and all listeners are passive and read-only (no `preventDefault()`, no `stopPropagation()` on your events), so hovers, clicks, cursors and scrolling performance stay exactly as they were,
   - the pencil stays out of your tab order, is hidden in print, and skips its fades when the visitor prefers reduced motion.

4. **The overlay stays where the block actually is.** It re-reads the block every frame while visible, so it follows scrolling, resizing, `:hover` transitions on the block itself (including padding-only growth and `transform` shifts) and any reflow around it. It hides itself when the block is scrolled out of an `overflow` container, clipped away, detached from the DOM or off-screen — previously it could float over unrelated content in those cases. The ring is clipped to the part of the block that is really visible.

5. **Verified against the awkward cases.** Tiny, nested, clipped, scrolled-out, sticky, fixed, scaled, rotated, zero-height, table-cell, SVG and shadow-DOM blocks, blocks under a maximum-`z-index` site layer, and blocks that resize, move or vanish under the pointer — driven with a real mouse in Chromium, Firefox and WebKit (`npm run test:e2e`, new `browser-tests` CI job), plus the demo under `demo/` and 74 unit tests.

### What integrations need to do

**Nothing but update the dependency** — no code changes in any integration, and the editor side needs no coordination. The table from 1.4.0 applies unchanged: npm-based integrations (`@flyo/nitro-next`, `@flyo/nitro-vue3`, `@flyo/nitro-nuxt`, `@flyo/nitro-astro`) update the dependency and redeploy, CDN-based ones (`flyo/nitro-laravel`, `flyo/nitro-yii2`, custom `@1` script tags) pick 1.5.0 up automatically once the CDN cache refreshes.

### Behavior notes during rollout

- **The pencil no longer appears instantly.** A block has to stay hovered for ~0.6s before ring and pencil fade in. This is deliberate (it stops the overlay flickering while the mouse crosses the page) and is the one difference an editor will notice immediately. All timings live in the `TIMING` constant at the top of `src/highlightAndClick.ts`.
- **If you styled the old pencil button from your site's CSS, that no longer works.** The button used to be a plain `<button>` in `<body>`; it now lives in a closed-off shadow tree by design, and the appearance is configured in the bridge's `LOOK` constant instead.
- Blocks no longer receive `mouseenter`/`mouseleave` listeners; hover is resolved from one passive, capturing `pointerover` listener on `document`. Integrations that removed those listeners themselves (none do) have nothing left to remove.
- Blocks whose element is destroyed without calling `cleanup()` no longer leak overlay nodes — the shared overlay hides itself and is reused.
- Requires shadow DOM (`attachShadow`), i.e. any current Chrome, Firefox, Safari or Edge. There is a plain fallback if it is missing, and outside the editor iframe `highlightAndClick()` still touches nothing at all.

## 1.3.x → 1.4.0

**No breaking changes.** All existing functions keep their signatures and behavior. Updating is recommended for every live-edit integration because the Flyo editor now probes the preview connection.

### What's new

1. **Editor connection handshake.** The bridge announces itself to the embedding Flyo editor (`{action: 'liveEditReady'}` on boot) and answers the editor's connection probe (`{action: 'liveEditPing'}` → `liveEditReady`). The editor uses this to tell a working live-edit preview apart from a blocked frame (e.g. third-party cookies, X-Frame-Options) or a wrong preview URL (e.g. a production build without live edit), and shows troubleshooting guidance instead of a silent white screen. The handshake registers automatically — at most once per document, and only inside the editor iframe — when `reload()` is called, the canonical live-edit boot function every integration registers. There is also an explicit `registerEditorHandshake()` export for custom setups that do not use `reload()`.

2. **`openEdit` targetOrigin fix.** Outbound messages (click-to-edit pencil) no longer hardcode `https://flyo.cloud` as targetOrigin. The bridge now resolves the editor origin reliably (learned from the editor's probe, `ancestorOrigins`, cross-origin referrer, with `https://flyo.cloud` as final fallback), so click-to-edit also works when the editor runs on a different host (staging, local development).

### What integrations need to do

| Integration | Loads the bridge via | Action required |
|---|---|---|
| `@flyo/nitro-next` (Next.js) | npm dependency `^1.3.0` | Update the dependency (`npm update @flyo/nitro-js-bridge` or refresh the lockfile) and redeploy the live-edit deployment. **No code changes** — `FlyoClientWrapper` already calls `reload()`/`scrollTo()`. |
| `@flyo/nitro-vue3` (Vue 3) | npm dependency `^1.3.0` | Update the dependency and redeploy. **No code changes** — `useFlyoLiveEdit()` already calls `reload()`/`scrollTo()`. |
| `@flyo/nitro-nuxt` (Nuxt 3) | transitively through `@flyo/nitro-vue3` | Update dependencies (so the transitive bridge resolves to 1.4.0) and redeploy. **No code changes.** |
| `@flyo/nitro-astro` (Astro) | npm dependency `^1.2.0` | Update the dependency and redeploy. **No code changes** — the integration injects `reload()`/`scrollTo()` when `liveEdit` is enabled. |
| `flyo/nitro-laravel` (Laravel) | unpkg CDN `@1` at runtime | **Nothing to do.** The `@1` range resolves to the latest 1.x automatically once the CDN cache refreshes; the injected script already calls `reload()`/`scrollTo()` in live-edit mode. |
| `flyo/nitro-yii2` (Yii2) | unpkg CDN `@1` at runtime | Update `flyo/nitro-yii2`: the `Editable` widget historically never called `reload()`, so Yii2 sites had no `pageRefresh` live-reload and (since 1.4.0) no handshake. The fixed widget calls `bridge.reload()` in `Editable::ensureAssets()`; the bridge itself arrives automatically via the CDN. |
| Custom / vanilla CDN integrations | `<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/...">` | **Nothing to do** if you call `reload()` (as the README recommends for live edit). If you deliberately do not use `reload()`, call `window.nitroJsBridge.registerEditorHandshake()` once so the editor can detect the connection. |

### Behavior notes during rollout

Bridge and editor can be released **independently, in any order** — no coordination is required:

- **Bridge first, editor later**: websites on 1.4.0 behave exactly as before against the current editor. The handshake listener idles (the old editor never sends `liveEditPing`), the one-time `liveEditReady` boot announcement is ignored by the old editor, and reload/scrollTo/click-to-edit are unchanged. Once the editor update ships, it starts probing and simply picks up the connection.
- **Editor first, bridge later**: until a site serves bridge >= 1.4.0, the Flyo editor shows a dismissible «Keine Verbindung zur Live-Vorschau» hint even when the preview renders correctly. That is the expected rollout state — updating the dependency (or waiting for the CDN to refresh) makes it disappear.
- The handshake messages carry no data beyond the action name. Probes are only answered when they come from the embedding window (`event.source === window.parent`).
- `isEmbedded()` is unchanged and stays a pure check without side effects — the handshake is deliberately **not** wired into it, since integrations also call `isEmbedded()` in contexts where registering message listeners would be wrong (e.g. production builds that only use it for gating).
