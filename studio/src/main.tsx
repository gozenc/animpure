import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { runSvgJsSpike } from './svgjs-spike.ts'

if (import.meta.env.DEV) runSvgJsSpike()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
