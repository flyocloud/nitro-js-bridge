# Flyo Nitro Js Bridge

This is can be used in backend and frontend projects eitherway to make the bridge between Flyo Cloud and your application.

## Installation
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

This will make the functions available globally as `window.nitroJsBridge.open`, `window.nitroJsBridge.highlightAndClick`, `window.nitroJsBridge.reload`, etc.

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
yarn dev
```

Visit `http://localhost:5174/demo/index.html` to see the demo page.
