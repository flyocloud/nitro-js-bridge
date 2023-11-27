
// Rendering logic for the updated ProseMirror JSON
function wysiwyg(json: any, nodeRenderers?: any) {

  const defaultNodeRenderers = {
    default: ({ type }: { type: any[] }) => `<div style="border:1px solid red">Node "${type}" is not defined.</div>`,
    doc: ({ content }: { content: any[] }, renderNode: any) => `${content.map(renderNode).join('')}`,
    heading: ({ content, attrs }: { content: any[], attrs: { level: number } }, renderNode: any) => `<h${attrs.level}>${content.map(renderNode).join('')}</h${attrs.level}>`,
    paragraph: ({ content }: { content: any[] }, renderNode: any) => `<p>${content.map(renderNode).join('')}</p>`,
    bulletList: ({ content }: { content: any[] }, renderNode: any) => `<ul>${content.map(child => `<li>${renderNode(child)}</li>`).join('')}</ul>`,
    orderedList: ({ content }: { content: any[] }, renderNode: any) => `<ol>${content.map(child => `<li>${renderNode(child)}</li>`).join('')}</ol>`,
    listItem: ({ content }: { content: any[] }, renderNode: any) => `${content.map(child => renderNode(child)).join('')}`,
    hardBreak: () => `<br />`,
    blockquote: ({ content }: { content: any[] }, renderNode: any) => `<blockquote>${content.map(child => renderNode(child)).join('')}</blockquote>`,
    image: ({ attrs }: { attrs: { src: string, alt: string, title: string } }) => `<img src="${attrs.src}" alt="${attrs.alt}" title="${attrs.title}" />`,
    youtube: ({ attrs }: { attrs: { src: string, start: string } }) => `<iframe width="560" height="315" src="${attrs.src}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`,
    text: ({ sanitizedText, marks }: { sanitizedText: string, marks: any[] }) => {
      let renderedText = sanitizedText;
      if (marks) {
        marks.forEach(mark => {
          if (mark.type === "bold") {
            renderedText = `<strong>${renderedText}</strong>`;
          } else if (mark.type === "italic") {
            renderedText = `<em>${renderedText}</em>`;
          } else if (mark.type === "underline") {
            renderedText = `<u>${renderedText}</u>`;
          } else if (mark.type === "strikethrough") {
            renderedText = `<del>${renderedText}</del>`;
          } else if (mark.type === "link") {
            renderedText = `<a href="${mark.attrs.href}" target="${mark.attrs.target}">${renderedText}</a>`;
          }
          // Add more conditions for other mark types (underline, strikethrough, etc.) if needed
        });
      }
      return renderedText;
    },
  };

  const combinedNodeRenderers = { ...defaultNodeRenderers, ...nodeRenderers };

  function renderNode(node: any) {
    const renderer = combinedNodeRenderers[node.type] || combinedNodeRenderers.default;
    if (renderer) {
      if (!node.hasOwnProperty('content')) {
        // this ensures that the content property is always an array which can be a problem with empty paragraphs
        node.content = []
      }

      if (node.text && node.text.length > 0) {
        node.sanitizedText = escapeHtml(node.text)
      }

      return renderer(node, renderNode);
    }
    return ''; // Return an empty string if no renderer is found for the node type
  }

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

// Define rendering callbacks for each node type
/*
const nodeRenderers = {
  default: ({ content }) => `<div style="border:1px solid red">${content.map(renderNode).join('')}</div>`,
  doc: ({ content }) => `<div>${content.map(renderNode).join('')}</div>`,
  heading: ({ content, attrs }) => `<h${attrs.level}>${content.map(renderNode).join('')}</h${attrs.level}>`,
  paragraph: ({ content }) => `<p>${content.map(renderNode).join('')}</p>`,
  text: ({ text, marks }) => {
    let renderedText = text;
    if (marks) {
      marks.forEach(mark => {
        if (mark.type === "bold") {
          renderedText = `<strong>${renderedText}</strong>`;
        } else if (mark.type === "italic") {
          renderedText = `<em>${renderedText}</em>`;
        }
        // Add more conditions for other mark types (underline, strikethrough, etc.) if needed
      });
    }
    return renderedText;
  }
  // Add more node types and their rendering callbacks as needed
};
*/

export default wysiwyg;