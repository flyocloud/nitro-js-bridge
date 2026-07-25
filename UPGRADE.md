# Upgrade Guide

This document describes what integrators (and AI agents working on integrations) need to do when upgrading between versions of `@flyo/nitro-js-bridge`. When a version is not listed, there is nothing to do beyond updating the dependency.

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
