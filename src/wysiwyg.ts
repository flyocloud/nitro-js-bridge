
/**
 * Renders a ProseMirror/TipTap JSON object into HTML.
 * 
 * This function traverses the JSON tree and converts each node into its corresponding HTML representation.
 * It supports custom renderers for both nodes (like paragraphs, headings) and marks (like bold, italic).
 * 
 * @param {any} json - The ProseMirror/TipTap JSON object to render. This can be the full document (type: 'doc') or a single node (e.g. type: 'paragraph').
 * @param {Object} [nodeRenderers] - Optional custom renderers for nodes. Keys are node types (e.g., 'paragraph', 'image'), and values are functions that return HTML strings.
 * @param {Object} [markRenderers] - Optional custom renderers for marks. Keys are mark types (e.g., 'bold', 'link'), and values are functions that take the text and mark object, returning an HTML string.
 * 
 * @returns {string} The rendered HTML string.
 * 
 * @example
 * // Render full document
 * const json = { type: 'doc', content: [...] };
 * const html = wysiwyg(json, {
 *   image: ({ attrs }) => `<img src="${attrs.src}" class="custom-image" />`
 * }, {
 *   bold: (text) => `<span class="bold">${text}</span>`
 * });
 * 
 * @example
 * // Render a single node
 * const node = { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] };
 * const html = wysiwyg(node); // <p>Hello</p>
 */
function wysiwyg(json: any, nodeRenderers?: any, markRenderers?: any) {

  // Default renderers for marks (inline styles like bold, italic, links)
  const defaultMarkRenderers: { [key: string]: (text: string, mark: any) => string } = {
    bold: (text) => `<strong>${text}</strong>`,
    italic: (text) => `<em>${text}</em>`,
    underline: (text) => `<u>${text}</u>`,
    strikethrough: (text) => `<del>${text}</del>`,
    link: (text, mark) => `<a href="${mark.attrs.href}" target="${mark.attrs.target}">${text}</a>`,
  };

  // Merge default mark renderers with any custom ones provided
  const combinedMarkRenderers = { ...defaultMarkRenderers, ...markRenderers };

  // Default renderers for nodes (block elements like paragraphs, headings, lists)
  const defaultNodeRenderers = {
    default: ({ type }: { type: any[] }) => `<div style="border:1px solid red">Node "${type}" is not defined.</div>`,
    doc: ({ content }: { content: any[] }, renderNode: any) => `${content.map(renderNode).join('')}`,
    heading: ({ content, attrs }: { content: any[], attrs: { level: number } }, renderNode: any) => `<h${attrs.level}>${content.map(renderNode).join('')}</h${attrs.level}>`,
    paragraph: ({ content }: { content: any[] }, renderNode: any) => `<p>${content.map(renderNode).join('')}</p>`,
    bulletList: ({ content }: { content: any[] }, renderNode: any) => `<ul>${content.map(child => `<li>${renderNode(child)}</li>`).join('')}</ul>`,
    orderedList: ({ content }: { content: any[] }, renderNode: any) => `<ol>${content.map(child => `<li>${renderNode(child)}</li>`).join('')}</ol>`,
    listItem: ({ content }: { content: any[] }, renderNode: any) => `${content.map(child => {
      if (child.type === 'paragraph') {
        return (child.content || []).map(renderNode).join('')
      }
      return renderNode(child)
    }).join('')}`,
    hardBreak: () => `<br />`,
    blockquote: ({ content }: { content: any[] }, renderNode: any) => `<blockquote>${content.map(child => renderNode(child)).join('')}</blockquote>`,
    image: ({ attrs }: { attrs: { src: string, alt: string, title: string } }) => `<img src="${attrs.src}" alt="${attrs.alt}" title="${attrs.title}" />`,
    youtube: ({ attrs }: { attrs: { src: string, start: string } }) => `<iframe width="560" height="315" src="${attrs.src}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
    text: ({ sanitizedText, marks }: { sanitizedText: string, marks: any[] }) => {
      let renderedText = sanitizedText;
      if (marks) {
        marks.forEach(mark => {
          const renderer = combinedMarkRenderers[mark.type];
          if (renderer) {
            renderedText = renderer(renderedText, mark);
          }
        });
      }
      return renderedText;
    },
  };

  // Merge default node renderers with any custom ones provided
  const combinedNodeRenderers = { ...defaultNodeRenderers, ...nodeRenderers };

  /**
   * Recursively renders a node and its children.
   * 
   * @param {any} node - The node to render.
   * @returns {string} The rendered HTML for the node.
   */
  function renderNode(node: any) {
    const renderer = combinedNodeRenderers[node.type] || combinedNodeRenderers.default;
    if (renderer) {
      if (!node.hasOwnProperty('content')) {
        // Ensure content property is always an array to prevent errors with empty nodes
        node.content = []
      }

      if (node.text && node.text.length > 0) {
        // Sanitize text content to prevent XSS attacks
        node.sanitizedText = escapeHtml(node.text)
      }

      return renderer(node, renderNode);
    }
    return ''; // Return an empty string if no renderer is found for the node type
  }

  /**
   * Escapes HTML special characters to prevent XSS.
   * 
   * @param {string} text - The text to escape.
   * @returns {string} The escaped text.
   */
  function escapeHtml(text: string) {
    var map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, function(m) { return map[m as keyof typeof map]; });
  }

  return renderNode(json);
}

export default wysiwyg;