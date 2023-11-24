# Flyo Nitro Js Bridge

This is can be used in backend and frontend projects eitherway to make the bridge between Flyo Cloud and your application.

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