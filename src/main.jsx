import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import Requisicao from './Requisicao.jsx'
import DevPage from './DevPanel.jsx'
import Wiki from './Wiki.jsx'

import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<App />} />
        <Route path="/requisicao" element={<Requisicao />} />
        <Route path="/dev"        element={<DevPage />} />
        <Route path="/wiki"       element={<Wiki />} />
        <Route path="/cursos"     element={<Navigate to="/wiki" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)