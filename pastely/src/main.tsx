import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/fredoka'
import './index.css'
import App from './App.tsx'

// #region agent log
fetch('http://127.0.0.1:7834/ingest/3d251863-5447-43b8-a393-d879be895c64',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'221c2c'},body:JSON.stringify({sessionId:'221c2c',location:'pastely/src/main.tsx',message:'app entry evaluated',data:{ok:true},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
// #endregion

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
