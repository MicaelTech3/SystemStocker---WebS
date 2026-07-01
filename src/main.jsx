import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Requisicao from './Requisicao.jsx'
import Caixa from './Caixa.jsx'
import { Analytics } from './Analytics.jsx'

import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<App />} />
        <Route path="/requisicao" element={<Requisicao />} />
        <Route path="/caixa"      element={<Caixa />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)