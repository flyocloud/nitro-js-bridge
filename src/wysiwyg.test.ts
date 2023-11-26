import wysiwyg from './wysiwyg';
import { expect, test } from 'vitest'

test('defaultNodeRenderers', () => {

  const sampleJSON = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [
          {
            type: "text",
            text: "ProseMirror JSON Render Example"
          }
        ]
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This is a paragraph with a line break:"
          },
          {
            type: "hardBreak"
          },
          {
            type: "text",
            text: "After the line break."
          }
        ]
      }
      // ... additional node types
    ]
  };

  const html = wysiwyg(sampleJSON, {
    // image object with custom class
    image: ({ attrs }: { attrs: any }) => `<img src="${attrs.src}" alt="${attrs.alt}" title="${attrs.title}" class="my-super-duper-responsive-class" />`,
    // youtube video with custom width and height in order to make it responsive
    youtube: ({ attrs }: { attrs: any }) => `<iframe width="560" height="315" src="${attrs.src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
    // a custom flyo based node you like to style:
    accordion: ({ attrs }: { attrs: any }) => `<details><summary>${attrs.title}</summary>${attrs.text}</details>`,
  })

  expect(html).toBe('<h1>ProseMirror JSON Render Example</h1><p>This is a paragraph with a line break:<br />After the line break.</p>');

  // Fügen Sie hier weitere Tests für andere Knoten- und Markierungstypen hinzu
});