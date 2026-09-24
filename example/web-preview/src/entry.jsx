import { createRoot } from 'react-dom/client'

import CameraDemo from '../../react/src/App.tsx'

createRoot(document.getElementById('phone')).render(
  <CameraDemo uploadPhoto={() => new Promise((resolve) => setTimeout(resolve, 700))} />,
)
