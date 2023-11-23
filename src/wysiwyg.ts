import StarterKit from '@tiptap/starter-kit'
import { generateHTML } from '@tiptap/html'

function wysiwyg(json: any) {
    //generateHTML(json, [...[StarterKit], ...extensions])
    return generateHTML(json, [StarterKit])
}

export default wysiwyg;