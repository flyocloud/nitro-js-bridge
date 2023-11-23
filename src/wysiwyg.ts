import StarterKit from '@tiptap/starter-kit'
import Youtube from '@tiptap/extension-youtube'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { generateHTML } from '@tiptap/html'

function wysiwyg(json: any, extensions?: any) {
    try {
        return generateHTML(json, [... [StarterKit, Youtube, Image, Link], ...extensions])
    } catch (e) {
        console.error(e)
        return ""
    }
}

export default wysiwyg;