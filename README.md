# Flyo Nitro Js Bridge

This is can be used in backend and frontend projects eitherway to make the bridge between Flyo Cloud and your application.

## Installation

```js
npm i @flyo/nitro-js-bridge
```

Discover on [npm.js.com/package/@flyo/nitro-js-bridge](https://www.npmjs.com/package/@flyo/nitro-js-bridge).

### CDN

For vanilla websites or quick prototyping, you can use the CDN:

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/index.js"></script>
```

This will make the functions available globally as `window.nitroJsBridge.open`, `window.nitroJsBridge.highlightAndClick`, etc.

## Usage

### Opening Flyo Blocks for Editing

The `open()` function allows you to trigger the editing interface for specific Flyo blocks when your website is embedded in Flyo's preview iframe.

#### Basic Usage

```js
import { open } from '@flyo/nitro-js-bridge';

// Open a specific block for editing
open('your-block-uid-here');
```

#### Implementation Examples

##### Vanilla HTML/JavaScript (for PHP/static websites)

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/index.js"></script>
<button onclick="window.nitroJsBridge.open('block-123')">Edit Content</button>
```

##### JavaScript (ES Modules)

```js
import { open } from '@flyo/nitro-js-bridge';

// Open a specific block for editing
open('your-block-uid-here');
```

### Enhanced Editing Experience with Visual Feedback

The `highlightAndClick()` function provides an enhanced editing experience by adding visual feedback when hovering over editable elements in Flyo's preview mode.

#### Basic Usage

```js
import { highlightAndClick } from '@flyo/nitro-js-bridge';

// Set up enhanced editing with hover effects
const element = document.querySelector('.editable-section');
const cleanup = highlightAndClick('your-block-uid', element);

// Call cleanup when component unmounts (optional)
// cleanup();
```

#### Implementation Examples

##### Vanilla HTML/JavaScript (for PHP/static websites)

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/index.js"></script>
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

##### JavaScript (ES Modules)

```js
import { highlightAndClick } from '@flyo/nitro-js-bridge';

// Set up enhanced editing with hover effects
const element = document.querySelector('.editable-section');
const cleanup = highlightAndClick('your-block-uid', element);

// Call cleanup when component unmounts (optional)
// cleanup();
```

#### Visual Feedback

When embedded in Flyo's preview iframe, `highlightAndClick()` provides:
- **Hover Effect**: A dashed blue border appears when hovering over editable elements
- **Cursor Change**: The cursor changes to a pointer to indicate clickability
- **Smooth Transitions**: Smooth CSS transitions for better user experience

The visual feedback only appears when the website is embedded in Flyo's preview iframe, ensuring it doesn't interfere with the normal user experience.

## Utility Functions

### isEmbedded()

Check if your website is currently embedded in Flyo's preview iframe:

```js
import { isEmbedded } from '@flyo/nitro-js-bridge';

if (isEmbedded()) {
  console.log('Website is embedded in Flyo preview');
  // Show edit controls or apply preview-specific styling
}
```

For vanilla JavaScript with CDN:

```html
<script src="https://unpkg.com/@flyo/nitro-js-bridge@1/dist/index.js"></script>
<script>
if (window.nitroJsBridge.isEmbedded()) {
  console.log('Website is embedded in Flyo preview');
  // Show edit controls or apply preview-specific styling
}
</script>
```

## WYSIWYG Custom Render

Since flyo uses ProseMirror/TipTap Json, we have built a custom renderer for you to use in your application in order to handle custom nodes and extend the default ones, for example image:

An example usage for common scenarios:

```js
const html = wysiwyg(model.content.json, {
  // image object with custom class
  image: ({ attrs }) => `<img src="${attrs.src}" alt="${attrs.alt}" title="${attrs.title}" class="my-super-duper-responsive-class" />`,
  // youtube video with custom width and height in order to make it responsive
  youtube: ({ attrs }) => `<iframe width="560" height="315" src="${attrs.src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
  // a custom flyo based node you like to style:
  accordion: ({ attrs }) => `<details><summary>${attrs.title}</summary>${attrs.text}</details>`,
})
```

By default the most common nodes are handled, but you can override them by passing a function to with the correct node name. See the src/wysiwyg.js file for more details and which nodes are handled by default.
