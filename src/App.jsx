import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <Tldraw persistenceKey="pizarra-limpia-v2" />
    </div>
  );
}