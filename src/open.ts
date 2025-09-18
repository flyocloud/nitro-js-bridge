import { resolveWindow } from './utils';

function open(blockUid: String) {
    var win = resolveWindow()
    if (!win) {
        return
    }
   
    win.postMessage({
        action: 'openEdit',
        data: JSON.parse(JSON.stringify({item:{uid: blockUid}}))
    }, 'https://flyo.cloud')
}

export default open;