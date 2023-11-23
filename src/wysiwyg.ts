import StarterKit from '@tiptap/starter-kit'
import { generateHTML } from '@tiptap/html'

function wysiwyg(json: any, extensions: Array<any>) {
    generateHTML(json, [...[StarterKit], ...extensions])
}

export default wysiwyg;