import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

function handleMount(editor) {
  editor.user.updateUserPreferences({ colorScheme: 'light' })
}

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw onMount={handleMount} />
    </div>
  )
}
