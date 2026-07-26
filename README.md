# Flyo Nitro Js Bridge

This library provides a small bridge that lets a website integrate with Flyo's preview iframe. It works in both backend and frontend projects and also supports a CDN build for quick prototyping.

## Installation

```bash
npm i @flyo/nitro-js-bridge
```

Discover on [npm.js.com/package/@flyo/nitro-js-bridge](https://www.npmjs.com/package/@flyo/nitro-js-bridge).

### CDN

For vanilla websites or quick prototyping, you can use the CDN UMD build:

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/nitro-js-bridge.umd.cjs"></script>
```

This will make the functions available globally as `window.nitroJsBridge.open`, `window.nitroJsBridge.highlightAndClick`, `window.nitroJsBridge.reload`, `window.nitroJsBridge.scrollTo`, etc.

## Usage

### Opening Flyo Blocks for Editing

The `open()` function allows you to trigger the editing interface for specific Flyo blocks when your website is embedded in Flyo's preview iframe.

#### ESM (modern JS)

```js
import { open } from '@flyo/nitro-js-bridge';

// Open a specific block for editing
open('your-block-uid-here');
```

#### Vanilla HTML/JavaScript (CDN)

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/nitro-js-bridge.umd.cjs"></script>
<button onclick="window.nitroJsBridge.open('block-123')">Edit Content</button>
```

### Enhanced Editing Experience with Visual Feedback

The `highlightAndClick()` function adds visual hover/click feedback to editable elements in Flyo's preview mode.

#### ESM

```js
import { highlightAndClick } from '@flyo/nitro-js-bridge';

const element = document.querySelector('.editable-section');
const cleanup = highlightAndClick('your-block-uid', element);

// Call cleanup when component unmounts (optional)
// cleanup();
```

#### CDN

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/nitro-js-bridge.umd.cjs"></script>
<div class="content-block" data-flyo-uid="block-123">
  <h2>Editable Content</h2>
  <p>This content can be edited in Flyo.</p>
</div>

<script>
document.querySelectorAll('[data-flyo-uid]').forEach(element => {
  const blockUid = element.dataset.flyoUid;
  window.nitroJsBridge.highlightAndClick(blockUid, element);
});
</script>
```

#### Visual Feedback

When embedded in Flyo's preview iframe, `highlightAndClick()` provides:
- Hover effect (dashed blue border)
- Cursor change to pointer
- Smooth transitions for better UX

The visual feedback only appears when the website is embedded in Flyo's preview iframe.

### reload()

The `reload()` helper registers a message listener that will reload the page when Flyo sends a `pageRefresh` message. This is useful to enable live preview reloads when embedded.

#### ESM

```js
import { reload } from '@flyo/nitro-js-bridge';

// Register the reload listener (only activates when embedded)
reload();
```

#### CDN

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/nitro-js-bridge.umd.cjs"></script>
<script>
if (window.nitroJsBridge.reload) {
  // Register the reload listener (only activates when embedded)
  window.nitroJsBridge.reload();
}
</script>
```

### scrollTo()

The `scrollTo()` helper registers a message listener that will scroll to a specific block on the page when Flyo's preview frame sends a `scrollTo` message. The target block is identified by its uid via the `data-flyo-uid` attribute.

#### ESM

```js
import { scrollTo } from '@flyo/nitro-js-bridge';

// Register the scrollTo listener (only activates when embedded)
scrollTo();
```

#### CDN

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/nitro-js-bridge.umd.cjs"></script>
<script>
if (window.nitroJsBridge.scrollTo) {
  // Register the scrollTo listener (only activates when embedded)
  window.nitroJsBridge.scrollTo();
}
</script>
```

Make sure your block elements have the `data-flyo-uid` attribute set to the block's uid so the scroll target can be resolved:

```html
<div data-flyo-uid="block-123">
  <h2>Block Content</h2>
</div>
```

## Editor Connection Handshake (since 1.4.0)

When the website runs inside the Flyo editor iframe, the bridge announces itself to the editor and answers its connection probes:

- On boot it sends `{ action: 'liveEditReady' }` to the embedding window.
- It answers the editor's `{ action: 'liveEditPing' }` probe with `liveEditReady` (only when the probe comes from the embedding window; its `event.origin` is also remembered as the exact targetOrigin for all later outbound messages, so click-to-edit works on any editor host).

The editor uses this to distinguish a working live-edit preview from a blocked frame or a page without live edit. Without the handshake, the editor shows a dismissible "no connection" hint with troubleshooting guidance.

**You normally do not need to do anything**: the handshake registers automatically (at most once per document) when `reload()` is called — the canonical live-edit boot function every integration should register anyway. Only a custom setup that does not use `reload()` should register it explicitly:

```js
import { registerEditorHandshake } from '@flyo/nitro-js-bridge';

registerEditorHandshake();
```

## Utility Functions

### isEmbedded()

Check if your website is currently embedded in Flyo's preview iframe:

#### ESM

```js
import { isEmbedded } from '@flyo/nitro-js-bridge';

if (isEmbedded()) {
  console.log('Website is embedded in Flyo preview');
  // Show edit controls or apply preview-specific styling
}
```

#### CDN

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/nitro-js-bridge.umd.cjs"></script>
<script>
if (window.nitroJsBridge.isEmbedded()) {
  console.log('Website is embedded in Flyo preview');
  // Show edit controls or apply preview-specific styling
}
</script>
```

## WYSIWYG Custom Render

Since Flyo uses ProseMirror/TipTap JSON, the `wysiwyg` helper renders that JSON to HTML and lets you override node and mark renderers.

The function accepts three arguments:
1. `json`: The ProseMirror/TipTap JSON object.
2. `nodeRenderers` (optional): An object to override node renderers (e.g. paragraph, heading, image).
3. `markRenderers` (optional): An object to override mark renderers (e.g. bold, italic, link).

Example:

```js
import { wysiwyg } from '@flyo/nitro-js-bridge';

const html = wysiwyg(model.content.json, {
  image: ({ attrs }) => `<img src="${attrs.src}" alt="${attrs.alt}" title="${attrs.title}" class="responsive" />`,
  youtube: ({ attrs }) => `<iframe width="560" height="315" src="${attrs.src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
  accordion: ({ attrs }) => `<details><summary>${attrs.title}</summary>${attrs.text}</details>`,
}, {
  bold: (text) => `<b class="bold">${text}</b>`,
  link: (text, mark) => `<a href="${mark.attrs.href}" target="_blank">${text}</a>`,
});
```

By default the most common nodes and marks are handled, but you can override them by passing a function with the node or mark name. See `src/wysiwyg.ts` for details.

### Rendering Single Nodes

If you are iterating over the JSON nodes yourself (e.g. using another library), you can use `wysiwyg` to render individual nodes:

```js
import { wysiwyg } from '@flyo/nitro-js-bridge';

const nodes = model.content.json.content;
nodes.forEach(node => {
  const html = wysiwyg(node);
  console.log(html);
});
```

# Development

```bash
npm run preview
```

This starts the dev server on `http://localhost:5174` and opens the demo. (`npm run dev` does the same without opening a browser.)

The demo is a fake Flyo editor: the left side is an iframe running a website that uses the bridge straight from `src/`, the right side is the editor panel. It lets you test the full message flow without a Flyo account:

- **Connection** — shows green once the page answers the `liveEditPing` handshake with `liveEditReady` (see `registerEditorHandshake()`). "Send liveEditPing" probes again.
- **Send pageRefresh** — triggers `reload()` in the embedded page.
- **scrollTo** — pick a block uid and send a `scrollTo` message; the preview scrolls to that block.
- **Messages** — logs every `postMessage` in both directions, including the `openEdit` payload sent when you hover a block and click its pencil button.

Every element in `demo/iframe.html` with a `data-flyo-uid` attribute gets `highlightAndClick()` attached. The demo page deliberately includes awkward cases — tiny elements, rotated and scaled parents, clipped and scrollable containers — to check the overlay positioning.

Edits in `src/` are picked up on reload, the demo imports the TypeScript sources directly.
