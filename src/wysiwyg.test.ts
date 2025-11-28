import wysiwyg from './wysiwyg';
import { expect, test } from 'vitest'

test('basicExample', () => {

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
    ]
  };

  const html = wysiwyg(sampleJSON)

  expect(html).toBe('<h1>ProseMirror JSON Render Example</h1><p>This is a paragraph with a line break:<br />After the line break.</p>');

  // Fügen Sie hier weitere Tests für andere Knoten- und Markierungstypen hinzu
});

test('xssTest', () => {
  const sampleJSON = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [
          {
            type: 'text',
            text: '<script>alert("XSS")</script>',
          },
        ],
      },
    ],
  };

  const html = wysiwyg(sampleJSON)

  expect(html).toBe('<h1>&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</h1>');
});

test('customElements', () => {
  const sampleJSON = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [
          {
            type: 'text',
            text: 'ProseMirror JSON Render Example',
          },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is a paragraph with a line break:',
          },
          {
            type: 'hard_break',
          },
          {
            type: 'text',
            text: 'After the line break.',
          },
        ],
      },
      {
        type: 'image',
        attrs: { src: 'image.jpg', alt: 'Image', title: 'Image' },
      },
      {
        type: 'youtube',
        attrs: { src: 'youtube.com' },
      },
      {
        type: 'accordion',
        attrs: { title: 'Accordion Title', text: 'Accordion Text' },
      },
      // ... additional node types
    ],
  };

  const html = wysiwyg(sampleJSON, {
    image: ({ attrs }: { attrs: any }) => `<img src="${attrs.src}" alt="${attrs.alt}" title="${attrs.title}" class="my-super-duper-responsive-class" />`,
    youtube: ({ attrs }: { attrs: any }) => `<iframe width="560" height="315" src="${attrs.src}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
    accordion: ({ attrs }: { attrs: any }) => `<details><summary>${attrs.title}</summary>${attrs.text}</details>`,
  })

  expect(html).toBe('<h1>ProseMirror JSON Render Example</h1><p>This is a paragraph with a line break:<div style="border:1px solid red">Node "hard_break" is not defined.</div>After the line break.</p><img src="image.jpg" alt="Image" title="Image" class="my-super-duper-responsive-class" /><iframe width="560" height="315" src="youtube.com" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><details><summary>Accordion Title</summary>Accordion Text</details>');
});

test('lists', () => {
  const sampleJSON = {
    type: 'doc',
    content: [
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Bullet Item 1'
                  }
                ]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Bullet Item 2'
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Ordered Item 1'
                  }
                ]
              }
            ]
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Ordered Item 2'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const html = wysiwyg(sampleJSON);
  
  expect(html).toBe('<ul><li>Bullet Item 1</li><li>Bullet Item 2</li></ul><ol><li>Ordered Item 1</li><li>Ordered Item 2</li></ol>');
});