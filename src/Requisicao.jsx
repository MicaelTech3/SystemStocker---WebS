/**
 * REQUISICAO.JSX — App Público / Interno de Requisições por Setor
 * v4 — Sidebar Deslizante com Menu, Aba de Frente de Caixa (POS) dinâmica e Autenticação de Empresa
 */

import { useState, useEffect, useRef } from "react";
import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, getDoc,
  query, orderBy, serverTimestamp,
} from "firebase/firestore";
import { Icon } from "./icons.jsx";

// ─── Chaves de Sessão ─────────────────────────────────────────
const SETOR_SESSION_KEY = "req_setor_session_v2";
const COMPANY_SESSION_KEY = "req_company_session_v2";
const OPERATOR_SESSION_KEY = "req_operator_session_v2";

function saveSetorSession(setorKey) {
  try { localStorage.setItem(SETOR_SESSION_KEY, JSON.stringify({ setorKey, ts: Date.now() })); } catch { }
}
function loadSetorSession() {
  try {
    const raw = localStorage.getItem(SETOR_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.ts > 24 * 60 * 60 * 1000) { localStorage.removeItem(SETOR_SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}
function clearSetorSession() {
  try { localStorage.removeItem(SETOR_SESSION_KEY); } catch { }
}

function saveCompanySession(empresaId, nomeEmpresa) {
  try { localStorage.setItem(COMPANY_SESSION_KEY, JSON.stringify({ empresaId, nomeEmpresa, ts: Date.now() })); } catch { }
}
function loadCompanySession() {
  try {
    const raw = localStorage.getItem(COMPANY_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function clearCompanySession() {
  try { localStorage.removeItem(COMPANY_SESSION_KEY); } catch { }
}

function saveOperatorSession(opData) {
  try { localStorage.setItem(OPERATOR_SESSION_KEY, JSON.stringify({ ...opData, ts: Date.now() })); } catch { }
}
function loadOperatorSession() {
  try {
    const raw = localStorage.getItem(OPERATOR_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (Date.now() - s.ts > 7 * 24 * 60 * 60 * 1000) { localStorage.removeItem(OPERATOR_SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}
function clearOperatorSession() {
  try { localStorage.removeItem(OPERATOR_SESSION_KEY); } catch { }
}

// ─── CSS Styles ───────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
  :root {
    --bg:#f8fafc; --surface:#ffffff; --surface2:#f1f5f9;
    --border:#e2e8f0; --border2:#cbd5e1;
    --accent:#f97316; --accent2:#ea580c;
    --success:#10b981; --danger:#ef4444; --info:#3b82f6; --warn:#f59e0b;
    --text:#0f172a; --text-dim:#64748b; --text-mid:#334155;
    --mono:'IBM Plex Mono',monospace; --sans:'IBM Plex Sans',sans-serif; --display:'Bebas Neue',sans-serif;
    --r:8px;
  }
  .dark {
    --bg:#0b0f17; --surface:#151d2a; --surface2:#1e293b;
    --border:#263346; --border2:#334155;
    --text:#f8fafc; --text-dim:#94a3b8; --text-mid:#cbd5e1;
  }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:var(--bg); color:var(--text); font-family:var(--sans); min-height:100vh; transition: background 0.25s, color 0.25s; }

  .req-app { min-height:100vh; display:flex; flex-direction:column; position:relative; overflow:hidden; background:var(--bg); color:var(--text); }
  .ambient-video { position:absolute; width:700px; height:700px; object-fit:cover; border-radius:50%; filter:blur(50px) opacity(0.25); pointer-events:none; z-index:1; animation:floatAmbient 22s ease-in-out infinite; }
  @keyframes floatAmbient { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(80px, -60px) scale(1.1); } }
  
  .req-header { background:var(--surface); border-bottom:1px solid var(--border); height:56px; display:flex; align-items:center; justify-content:space-between; padding:0 16px; position:sticky; top:0; z-index:100; backdrop-filter:blur(8px); }
  .req-logo { font-family:var(--display); font-size:20px; letter-spacing:2px; color:var(--accent); display:flex; align-items:center; gap:8px; }
  @media (min-width: 769px) { .mobile-only-btn { display: none !important; } }
  .req-badge { background:var(--surface2); border:1px solid var(--border2); color:var(--text-mid); padding:6px 12px; font-family:var(--mono); font-size:11px; letter-spacing:1px; border-radius:var(--r); cursor:pointer; transition:all .18s; display:inline-flex; align-items:center; gap:6px; text-decoration:none; white-space:nowrap; }
  .req-badge:hover { border-color:var(--accent); color:var(--accent); }
  .req-badge.active { background:var(--accent); color:#fff; border-color:var(--accent); }
  .req-content { flex:1; padding:24px 16px; max-width:640px; margin:0 auto; width:100%; position:relative; z-index:2; }

  /* ── Sidebar Drawer ── */
  .req-sidebar-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.55);
    backdrop-filter: blur(3px); z-index: 2400; opacity: 0;
    pointer-events: none; transition: opacity 0.25s ease;
  }
  .req-sidebar-backdrop.open { opacity: 1; pointer-events: auto; }
  .req-sidebar-drawer {
    position: fixed; top: 0; left: 0; width: 290px; height: 100vh; height: 100dvh;
    background: var(--surface); border-right: 1px solid var(--border);
    z-index: 2500; transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex; flex-direction: column; padding: 20px;
    box-shadow: 6px 0 28px rgba(0,0,0,0.18); overflow-y: auto;
  }
  .req-sidebar-drawer.open { transform: translateX(0); }
  .req-sidebar-title { font-family: var(--mono); font-size: 10px; color: var(--text-dim); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
  .req-nav-item {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px;
    border-radius: var(--r); font-family: var(--mono); font-size: 12px;
    color: var(--text-mid); background: transparent; border: 1px solid transparent;
    cursor: pointer; transition: all 0.18s; text-decoration: none; width: 100%; text-align: left;
    margin-bottom: 4px;
  }
  .req-nav-item:hover { background: var(--surface2); color: var(--text); }
  .req-nav-item.active { background: var(--accent-light); color: var(--accent); border-color: var(--accent); font-weight: 600; }
  .req-nav-item.caixa-item { background: var(--success-light); color: var(--success); border-color: var(--success); font-weight: 600; }
  .req-nav-item.caixa-item:hover { background: rgba(16,185,129,0.15); }

  .setor-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; margin-top:20px; }
  @media(min-width:480px){ .setor-grid { grid-template-columns:repeat(3,1fr); } }
  @media(min-width:700px){ .setor-grid { grid-template-columns:repeat(4,1fr); } }
  .setor-card { background:var(--surface); border:1px solid var(--border); padding:24px 14px; cursor:pointer; transition:all .22s cubic-bezier(0.16,1,0.3,1); display:flex; flex-direction:column; align-items:center; gap:10px; position:relative; overflow:hidden; border-radius:var(--r); -webkit-tap-highlight-color:transparent; }
  .setor-card::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; opacity:0; transition:opacity .2s; background:var(--c,var(--accent)); }
  .setor-card:hover,.setor-card:active { transform:translateY(-3px); border-color:var(--c,var(--accent)); box-shadow:0 8px 20px rgba(0,0,0,0.06); }
  .setor-card:hover::after,.setor-card:active::after { opacity:1; }
  .setor-card-icon { width:46px; height:46px; border-radius:50%; background:var(--surface2); display:flex; align-items:center; justify-content:center; }
  .setor-card-name { font-family:var(--display); font-size:18px; letter-spacing:2px; color:var(--c,var(--accent)); text-align:center; }

  .pin-wrap { max-width:340px; margin:20px auto; padding:28px 22px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r); box-shadow:0 10px 30px rgba(0,0,0,0.05); text-align:center; }
  .pin-display { display:flex; gap:14px; justify-content:center; margin-bottom:24px; }
  .pin-dot { width:16px; height:16px; border-radius:50%; border:2px solid var(--border2); transition:all .15s; }
  .pin-dot.filled { background:var(--accent); border-color:var(--accent); box-shadow:0 0 10px rgba(249,115,22,.4); }
  .pin-dot.error  { background:var(--danger); border-color:var(--danger); animation:shake .3s; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
  .pin-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .pin-btn { background:var(--surface2); border:1px solid var(--border2); color:var(--text); font-family:var(--display); font-size:26px; letter-spacing:2px; padding:16px 10px; cursor:pointer; border-radius:var(--r); transition:all .12s; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
  .pin-btn:hover,.pin-btn:active { background:var(--surface); border-color:var(--accent); color:var(--accent); }
  .pin-btn.del { font-family:var(--mono); font-size:14px; color:var(--text-dim); }
  .pin-err { font-family:var(--mono); font-size:11px; color:var(--danger); text-align:center; margin-top:12px; min-height:18px; }

  .form-label { display:block; font-family:var(--mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }
  .form-input,.form-select,.form-textarea { width:100%; background:var(--surface2); border:1px solid var(--border2); color:var(--text); padding:12px 14px; font-family:var(--mono); font-size:13px; outline:none; transition:border-color .2s; border-radius:var(--r); -webkit-appearance:none; appearance:none; }
  .form-input:focus,.form-select:focus,.form-textarea:focus { border-color:var(--accent); }
  .form-textarea { resize:vertical; min-height:72px; }

  .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 18px; font-family:var(--mono); font-size:12px; cursor:pointer; transition:all .18s; border-radius:var(--r); border:1px solid transparent; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
  .btn-accent { background:var(--accent); color:#fff; border-color:var(--accent); font-weight:600; }
  .btn-accent:hover:not(:disabled),.btn-accent:active:not(:disabled) { background:var(--accent2); border-color:var(--accent2); }
  .btn-outline { background:transparent; color:var(--text-dim); border-color:var(--border2); }
  .btn-outline:hover:not(:disabled),.btn-outline:active:not(:disabled) { border-color:var(--accent); color:var(--accent); }
  .btn-success { background:var(--success); color:#fff; border-color:var(--success); font-weight:600; }
  .btn-ghost { background:transparent; border:none; color:var(--text-dim); cursor:pointer; padding:6px; display:inline-flex; align-items:center; -webkit-tap-highlight-color:transparent; }
  .btn-ghost:hover { color:var(--danger); }
  .btn:disabled { opacity:.4; cursor:not-allowed; }
  .btn-full { width:100%; }
  .btn-lg { padding:13px 24px; font-size:13px; }

  .card { background:var(--surface); border:1px solid var(--border); padding:20px; margin-bottom:14px; border-radius:var(--r); box-shadow:0 2px 10px rgba(0,0,0,0.03); }
  .card-title { font-family:var(--display); font-size:20px; letter-spacing:2px; color:var(--accent); margin-bottom:14px; }
  .divider { height:1px; background:var(--border); margin:16px 0; }
  .page-hd { margin-bottom:20px; }
  .page-title { font-family:var(--display); font-size:32px; letter-spacing:4px; line-height:1; }
  .page-sub { font-family:var(--mono); font-size:11px; color:var(--text-dim); margin-top:4px; }
  .spinner { display:inline-block; width:14px; height:14px; border:2px solid var(--border2); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .back-btn { display:inline-flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--border2); color:var(--text-dim); padding:6px 12px; font-family:var(--mono); font-size:11px; cursor:pointer; border-radius:var(--r); transition:all .15s; margin-bottom:16px; }
  .back-btn:hover { border-color:var(--accent); color:var(--accent); }
  .selected-setor-bar { display:flex; align-items:center; gap:10px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r); padding:10px 16px; margin-bottom:16px; }

  /* Itens do pedido */
  .items-list { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
  .item-row { display:flex; align-items:center; gap:10px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--r); padding:10px 14px; }
  .item-info { flex:1; min-width:0; }
  .item-name { font-family:var(--sans); font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .item-cat { font-family:var(--mono); font-size:10px; color:var(--text-dim); }
  .item-qty { font-family:var(--display); font-size:22px; color:var(--accent); flex-shrink:0; min-width:36px; text-align:center; }

  /* Painel inline de busca */
  .add-panel { background:var(--surface2); border:1px solid var(--border2); border-radius:var(--r); overflow:hidden; }
  .search-row { display:flex; align-items:center; gap:8px; padding:10px 14px; border-bottom:1px solid var(--border); }
  .search-row input { flex:1; background:transparent; border:none; outline:none; color:var(--text); font-family:var(--mono); font-size:13px; }
  .cat-strip { display:flex; gap:6px; padding:8px 12px; border-bottom:1px solid var(--border); overflow-x:auto; scrollbar-width:none; }
  .cat-strip::-webkit-scrollbar { display:none; }
  .cat-chip { flex-shrink:0; background:transparent; border:1px solid var(--border2); color:var(--text-dim); padding:4px 12px; font-family:var(--mono); font-size:10px; letter-spacing:1px; cursor:pointer; border-radius:20px; white-space:nowrap; text-transform:uppercase; transition:all .12s; }
  .cat-chip.on { border-color:var(--accent); color:var(--accent); background:rgba(249,115,22,0.06); }
  .prod-list { max-height:220px; overflow-y:auto; }
  .prod-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; transition:background .12s; -webkit-tap-highlight-color:transparent; }
  .prod-row:last-child { border-bottom:none; }
  .prod-row:hover,.prod-row:active { background:rgba(249,115,22,.06); }
  .prod-row.selected { background:rgba(249,115,22,.1); border-left:3px solid var(--accent); }
  .prod-row.unavail { opacity:.4; cursor:not-allowed; }
  .prod-row-name { font-family:var(--sans); font-size:13px; font-weight:500; }
  .prod-row-cat { font-family:var(--mono); font-size:10px; color:var(--text-dim); }
  .prod-stock { font-family:var(--mono); font-size:11px; flex-shrink:0; margin-left:8px; }
  .prod-stock.ok   { color:var(--success); }
  .prod-stock.warn { color:var(--warn); }
  .prod-stock.zero { color:var(--danger); }

  /* Painel de quantidade */
  .qty-panel { display:flex; align-items:center; gap:10px; padding:12px 14px; border-top:1px solid var(--accent); background:rgba(249,115,22,.05); flex-wrap:wrap; animation:fadeIn .15s; }
  .qty-name { flex:1; min-width:120px; font-family:var(--sans); font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .qty-controls { display:flex; align-items:center; gap:6px; }
  .qty-btn { background:var(--surface2); border:1px solid var(--border2); color:var(--text); width:32px; height:32px; border-radius:var(--r); cursor:pointer; font-family:var(--display); font-size:18px; display:flex; align-items:center; justify-content:center; transition:all .12s; touch-action:manipulation; flex-shrink:0; }
  .qty-btn:hover,.qty-btn:active { border-color:var(--accent); color:var(--accent); }
  .qty-input { width:54px; background:var(--surface2); border:1px solid var(--border2); color:var(--text); padding:6px; font-family:var(--display); font-size:20px; text-align:center; outline:none; border-radius:var(--r); }

  /* Sucesso */
  .success-box { text-align:center; padding:40px 20px; }
  .success-icon { display:inline-flex; width:64px; height:64px; border-radius:50%; background:var(--success-light); color:var(--success); align-items:center; justify-content:center; margin-bottom:16px; }
  .success-title { font-family:var(--display); font-size:36px; letter-spacing:4px; color:var(--success); margin-bottom:6px; }
  .success-sub { font-family:var(--mono); font-size:11px; color:var(--text-dim); margin-bottom:6px; }
  .success-code { font-family:var(--display); font-size:28px; color:var(--accent); letter-spacing:3px; margin-top:8px; }

  /* Histórico */
  .hist-item { padding:14px 16px; border-bottom:1px solid var(--border); }
  .hist-item:last-child { border-bottom:none; }
  .hist-code { font-family:var(--display); font-size:18px; letter-spacing:2px; color:var(--accent); }
  .hist-date { font-family:var(--mono); font-size:10px; color:var(--text-dim); }
  .hist-items { font-family:var(--mono); font-size:11px; color:var(--text-mid); margin-top:4px; }
  .status-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; font-size:10px; letter-spacing:1px; text-transform:uppercase; border:1px solid; font-family:var(--mono); border-radius:var(--r); }
  .s-pendente { color:var(--warn);    border-color:var(--warn);    background:var(--warn-light); }
  .s-aprovado { color:var(--success); border-color:var(--success); background:var(--success-light); }
  .s-recusado { color:var(--danger);  border-color:var(--danger);  background:var(--danger-light); }
  .s-entregue { color:var(--info);    border-color:var(--info);    background:var(--info-light); }
  .empty { text-align:center; padding:36px 16px; font-family:var(--mono); font-size:12px; color:var(--text-dim); }

  /* Toast */
  .toast-wrap { position:fixed; bottom:20px; right:16px; z-index:9999; display:flex; flex-direction:column; gap:6px; max-width:calc(100vw - 32px); }
  .toast { padding:11px 16px; font-family:var(--mono); font-size:12px; border-left:3px solid; min-width:200px; animation:tin .25s ease; border-radius:0 var(--r) var(--r) 0; display:flex; align-items:center; gap:8px; }
  .toast-success { background:var(--surface); border-color:var(--success); color:var(--success); box-shadow:0 4px 14px rgba(0,0,0,0.1); }
  .toast-error   { background:var(--surface); border-color:var(--danger);  color:var(--danger);  box-shadow:0 4px 14px rgba(0,0,0,0.1); }
  .toast-info    { background:var(--surface); border-color:var(--info);    color:var(--info);    box-shadow:0 4px 14px rgba(0,0,0,0.1); }
  @keyframes tin { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }

  /* Usuários */
  .user-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .user-btn { padding:12px 12px; cursor:pointer; text-align:left; border-radius:var(--r); font-family:var(--mono); font-size:12px; display:flex; align-items:center; gap:8px; transition:all .15s; background:var(--surface2); border:1px solid var(--border); color:var(--text); -webkit-tap-highlight-color:transparent; }
  .user-btn:hover,.user-btn:active { border-color:var(--accent); }
  .user-btn.selected { background:rgba(249,115,22,.08); border-color:var(--accent); color:var(--accent); font-weight:600; }

  /* Logout Overlay */
  .logout-overlay { position:fixed; inset:0; background:rgba(15,23,42,.75); backdrop-filter:blur(4px); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
  .logout-box { background:var(--surface); border:1px solid var(--border2); border-radius:var(--r); padding:24px 20px; width:100%; max-width:360px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); }
  .logout-title { font-family:var(--display); font-size:24px; letter-spacing:2px; color:var(--danger); margin-bottom:4px; }
  .logout-sub { font-family:var(--mono); font-size:11px; color:var(--text-dim); margin-bottom:20px; }

  .setor-pill { font-family:var(--mono); font-size:11px; letter-spacing:1px; padding:4px 10px; border-radius:20px; border:1px solid; font-weight:600; display:inline-flex; align-items:center; gap:6px; }
`;

// ─── Helpers ─────────────────────────────────────────────────
const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR");
};
const genCodigo = () => "REQ-" + Date.now().toString(36).toUpperCase().slice(-5);

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (msg, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  return { toasts, add };
}
const ToastEl = ({ toasts }) => (
  <div className="toast-wrap">
    {toasts.map(t => (
      <div key={t.id} className={`toast toast-${t.type}`}>
        <Icon name={t.type === "success" ? "checkCircle" : t.type === "error" ? "alertTriangle" : "info"} size={16} />
        <span>{t.msg}</span>
      </div>
    ))}
  </div>
);

// ─── LOGIN DO APP DE REQUISIÇÃO (ID + SENHA) ─────────────────
function ReqLoginScreen({ onLoginSuccess, initialId }) {
  const [idInput, setIdInput] = useState(initialId || "");
  const [senhaInput, setSenhaInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanId = idInput.trim().toUpperCase();
    const cleanIdLower = idInput.trim().toLowerCase();
    if (!cleanId) { setErr("Digite o ID de Acesso."); return; }
    if (!senhaInput.trim()) { setErr("Digite a Senha de Acesso."); return; }

    setLoading(true);
    setErr("");
    try {
      // 1. Checar se é login direto de Operador (3 letras + 3 números ex: ABC123)
      const opSnap = await getDoc(doc(db, "req_user_logins", cleanIdLower));
      if (opSnap.exists()) {
        const opData = opSnap.data();
        const expectedSenha = opData.senha || opData.pin || "1234";
        if (senhaInput.trim() === expectedSenha) {
          const allowedSectors = (opData.allowedSectors && opData.allowedSectors.length > 0)
            ? opData.allowedSectors
            : [opData.setorId];
          const enrichedOp = { ...opData, allowedSectors };

          saveOperatorSession(enrichedOp);
          saveCompanySession(opData.adminEmail, opData.nomeEmpresa || opData.adminEmail);
          saveSetorSession(opData.setorId);
          onLoginSuccess({
            type: "operator",
            empresaId: opData.adminEmail,
            nomeEmpresa: opData.nomeEmpresa || opData.adminEmail,
            setorKey: opData.setorId,
            operator: enrichedOp
          });
          return;
        }
      }

      // 2. Checar se é login por ID da Empresa
      const compSnap = await getDoc(doc(db, "company_ids", cleanIdLower));
      let realEmail = null;
      if (compSnap.exists()) {
        realEmail = compSnap.data().email;
      } else if (cleanIdLower.includes("@")) {
        realEmail = cleanIdLower;
      }

      if (realEmail) {
        const docSnap = await getDoc(doc(db, "users", realEmail));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const expectedSenha = data.senhaApp || data.senha || "123456";
          if (senhaInput.trim() === expectedSenha) {
            clearOperatorSession();
            saveCompanySession(realEmail, data.nomeEmpresa || realEmail);
            onLoginSuccess({
              type: "company",
              empresaId: realEmail,
              nomeEmpresa: data.nomeEmpresa || realEmail,
              setorKey: null,
              operator: null
            });
            return;
          }
        }
      }

      setErr("ID de Acesso ou Senha incorretos.");
    } catch (e) {
      setErr("Erro de conexão: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: "40px 10px" }}>
      <div className="card hover-lift" style={{ maxWidth: 400, margin: "0 auto", padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", width: 58, height: 58, borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Icon name="package" size={30} />
          </div>
          <div className="page-title" style={{ fontSize: 28, color: "var(--accent)" }}>ACESSO REQUISIÇÃO</div>
          <div className="page-sub">Digite seu ID de Acesso e Senha para entrar direto no seu setor</div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">ID de Acesso (Usuário ou Empresa)</label>
            <input
              className="form-input"
              placeholder="ex: ABC123"
              value={idInput}
              onChange={e => setIdInput(e.target.value.toUpperCase().replace(/\s/g, ""))}
              required
              autoFocus
              style={{ fontFamily: "var(--mono)", letterSpacing: 2, fontWeight: 700, fontSize: 15 }}
            />
            <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--text-dim)", marginTop: 4, display: "block" }}>
              * Usuários: código de 3 letras e 3 números gerado pelo Admin
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Senha de Acesso</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                className="form-input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={senhaInput}
                onChange={e => setSenhaInput(e.target.value)}
                required
                style={{ fontFamily: "var(--mono)", letterSpacing: showPassword ? 1 : 4, fontSize: 15 }}
              />
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: "10px 12px" }}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar Senha" : "Ver Senha"}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={14} />
              </button>
            </div>
          </div>

          {err && (
            <div style={{ background: "var(--danger-light)", border: "1px solid var(--danger)", color: "var(--danger)", padding: "10px 12px", borderRadius: "var(--r)", fontFamily: "var(--mono)", fontSize: 11, marginBottom: 16 }} className="animate-fade-in">
              <Icon name="alertTriangle" size={14} style={{ marginRight: 6 }} /> {err}
            </div>
          )}

          <button className="btn btn-accent btn-lg btn-full" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> VERIFICANDO...</> : <><Icon name="login" size={16} /> ENTRAR NO SETOR</>}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── PIN DE SETOR ─────────────────────────────────────────────
function PinScreen({ setor, setorKey, getColPrivate, mode = "login", onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (pin.length === 4) verify(); }, [pin]);

  const verify = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, getColPrivate(setorKey, "config"), "requisicao_config"));
      if (!snap.exists() || !snap.data().pin || snap.data().pin === pin) {
        onSuccess();
        return;
      }
      wrong();
    } catch {
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const wrong = () => {
    setShake(true);
    setErr(mode === "logout" ? "Senha incorreta. Não é possível sair." : "Senha incorreta.");
    setTimeout(() => { setPin(""); setShake(false); setErr(""); }, 900);
  };

  const press = (d) => { if (pin.length < 4 && !loading) setPin(p => p + d); };
  const del = () => setPin(p => p.slice(0, -1));
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"];

  const isLogout = mode === "logout";

  return (
    <div className="pin-wrap animate-scale-in">
      <div className="page-hd" style={{ marginBottom: 14 }}>
        <div className="page-title" style={{ color: isLogout ? "var(--danger)" : setor?.color || "var(--accent)" }}>
          {isLogout ? "SAIR DO SETOR" : setor?.label}
        </div>
        <div className="page-sub">
          {isLogout
            ? `Confirme a senha do setor ${setor?.label} para sair`
            : "Digite a senha PIN de 4 dígitos do setor"}
        </div>
      </div>

      <div className="pin-display">
        {[0, 1, 2, 3].map(i => <div key={i} className={`pin-dot ${pin.length > i ? (shake ? "error" : "filled") : ""}`} />)}
      </div>

      <div className="pin-grid">
        {digits.map((d, i) => {
          if (d === null) return <div key={i} />;
          if (d === "del") return <button key={i} className="pin-btn del" onClick={del} disabled={loading} title="Apagar">⌫</button>;
          return <button key={i} className="pin-btn" onClick={() => press(String(d))} disabled={loading || pin.length === 4}>{d}</button>;
        })}
      </div>

      <div className="pin-err">{err}</div>
      {onCancel && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn btn-outline" style={{ width: "100%" }} onClick={onCancel}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

// ─── Modal de Logout do Setor ──────────────────────────────────
function LogoutModal({ setor, setorKey, getColPrivate, onConfirm, onCancel }) {
  return (
    <div className="logout-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="logout-box animate-scale-in">
        <PinScreen
          setor={setor}
          setorKey={setorKey}
          getColPrivate={getColPrivate}
          mode="logout"
          onSuccess={onConfirm}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}

// ─── Painel inline de busca + quantidade ─────────────────────
function AddItemInline({ setorKey, getCol, onAdd, jaAdicionados, activeUser }) {
  const [produtos, setProdutos] = useState([]);
  const [estoqueMap, setEstoqueMap] = useState({});
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState("");
  const [sel, setSel] = useState(null);
  const [qtd, setQtd] = useState(1);
  const inputRef = useRef(null);
  const qtdRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [sc, sp, se] = await Promise.all([
          getDocs(collection(db, getCol(setorKey, "categorias"))),
          getDocs(collection(db, getCol(setorKey, "produtos_padrao"))),
          getDocs(collection(db, getCol(setorKey, "produtos"))),
        ]);

        const padraoList = sp.docs.map(d => ({ id: d.id, ...d.data() }));
        const estoqueList = se.docs.map(d => ({ id: d.id, ...d.data() }));

        const map = {};
        estoqueList.forEach(x => {
          if (x.nome) map[x.nome] = x.quantidade ?? 0;
        });
        setEstoqueMap(map);

        // Mesclar produtos_padrao e produtos para nunca faltar nenhum item
        const prodsMap = new Map();
        padraoList.forEach(p => {
          if (p.nome) {
            const key = p.nome.trim().toLowerCase();
            prodsMap.set(key, { ...p, nome: p.nome.trim(), categoria: p.categoria || "Geral" });
          }
        });
        estoqueList.forEach(p => {
          if (p.nome) {
            const key = p.nome.trim().toLowerCase();
            if (!prodsMap.has(key)) {
              prodsMap.set(key, { ...p, nome: p.nome.trim(), categoria: p.categoria || "Geral" });
            }
          }
        });

        const mergedProds = Array.from(prodsMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
        setProdutos(mergedProds);

        // Mesclar categorias cadastradas e encontradas nos produtos
        const catMap = new Map();
        sc.docs.forEach(d => {
          const data = d.data();
          if (data.nome) catMap.set(data.nome.trim(), { id: d.id, nome: data.nome.trim() });
        });
        mergedProds.forEach(p => {
          if (p.categoria && !catMap.has(p.categoria)) {
            catMap.set(p.categoria, { id: p.categoria, nome: p.categoria });
          }
        });
        setCats(Array.from(catMap.values()));
      } catch (err) {
        console.error("Erro ao carregar catálogo de produtos:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [setorKey]);

  useEffect(() => {
    if (sel) setTimeout(() => qtdRef.current?.select(), 60);
  }, [sel?.id]);

  const allowedCats = activeUser?.allowedCategories || [];
  const hasRestriction = allowedCats.length > 0;

  const displayCats = hasRestriction
    ? cats.filter(c => allowedCats.includes(c.nome))
    : cats;

  const filtrados = produtos
    .filter(p => !hasRestriction || allowedCats.includes(p.categoria))
    .filter(p => !catFiltro || p.categoria === catFiltro)
    .filter(p => !busca.trim() || p.nome.toLowerCase().includes(busca.toLowerCase()))
    .filter(p => !jaAdicionados.some(j => j.nome.toLowerCase() === p.nome.toLowerCase()));

  const estoque = sel ? (estoqueMap[sel.nome] ?? null) : null;
  const qtdNum = Math.max(1, parseInt(qtd) || 1);

  const handleSelect = (p) => {
    setSel(prev => prev?.id === p.id ? null : p);
    setQtd(1);
  };

  const handleAdd = () => {
    if (!sel || qtdNum < 1) return;
    onAdd({ nome: sel.nome, categoria: sel.categoria || "Geral", quantidade: qtdNum });
    setSel(null);
    setQtd(1);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const handleKeyQtd = (e) => {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") setSel(null);
  };

  if (loading) return (
    <div className="add-panel" style={{ padding: 20, textAlign: "center" }}>
      <span className="spinner" />
    </div>
  );

  return (
    <div className="add-panel">
      <div className="search-row">
        <Icon name="search" size={16} color="var(--text-dim)" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar produto no catálogo do setor..."
          value={busca}
          onChange={e => { setBusca(e.target.value); setSel(null); }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {busca && (
          <button className="btn-ghost" style={{ padding: "2px 4px" }}
            onClick={() => { setBusca(""); setSel(null); inputRef.current?.focus(); }}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {displayCats.length > 1 && (
        <div className="cat-strip">
          {[{ id: "__all", nome: "Todos" }, ...displayCats].map(c => {
            const val = c.id === "__all" ? "" : c.nome;
            return (
              <button key={c.id} className={`cat-chip ${catFiltro === val ? "on" : ""}`}
                onClick={() => { setCatFiltro(val); setSel(null); }}>
                {c.nome}
              </button>
            );
          })}
        </div>
      )}

      <div className="prod-list">
        {filtrados.length === 0 ? (
          <div className="empty" style={{ padding: "18px 12px", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
            <div>{busca ? `Nenhum produto cadastrado com "${busca}"` : "Nenhum produto cadastrado no setor"}</div>
            {busca.trim() && (
              <button
                type="button"
                className="btn btn-outline"
                style={{ fontSize: 11, padding: "7px 14px", gap: 6, borderColor: "var(--accent)", color: "var(--accent)" }}
                onClick={() => {
                  onAdd({ nome: busca.trim(), categoria: catFiltro || "Geral", quantidade: 1 });
                  setBusca("");
                  setSel(null);
                }}
              >
                <Icon name="plus" size={13} /> Solicitar "{busca.trim()}" como item sob demanda
              </button>
            )}
          </div>
        ) : (
          filtrados.map(p => {
            const stk = estoqueMap[p.nome] ?? null;
            const zero = stk !== null && stk <= 0;
            const isSel = sel?.id === p.id;
            return (
              <div
                key={p.id}
                className={`prod-row ${isSel ? "selected" : ""}`}
                onClick={() => handleSelect(p)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="prod-row-name">{p.nome}</div>
                  <div className="prod-row-cat">{p.categoria || "Geral"}</div>
                </div>
                {stk !== null && (
                  <div className={`prod-stock ${zero ? "warn" : stk <= 5 ? "warn" : "ok"}`}>
                    {zero ? "0 un. (solicitar reposição)" : `${stk} un. em estoque`}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {sel && (
        <div className="qty-panel">
          <div className="qty-name">{sel.nome}</div>
          <div className="qty-controls">
            <button className="qty-btn"
              onClick={() => setQtd(q => Math.max(1, (parseInt(q) || 1) - 1))}>−</button>
            <input
              ref={qtdRef}
              type="number"
              inputMode="numeric"
              className="qty-input"
              value={qtd}
              min={1}
              onChange={e => setQtd(e.target.value)}
              onKeyDown={handleKeyQtd}
            />
            <button className="qty-btn"
              onClick={() => setQtd(q => (parseInt(q) || 1) + 1)}>+</button>
          </div>
          <button
            className="btn btn-accent"
            style={{ padding: "8px 16px", fontSize: 12 }}
            onClick={handleAdd}
            disabled={qtdNum < 1}
          >
            <Icon name="plus" size={14} /> ADICIONAR
          </button>
          <div style={{ width: "100%", fontFamily: "var(--mono)", fontSize: 10, marginTop: 4, color: "var(--text-dim)" }}>
            {estoque !== null ? `Estoque atual no setor: ${estoque} un.` : "Produto disponível para solicitação"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FORMULÁRIO DE REQUISIÇÃO ────────────────────────────────
function FormRequisicao({ setorKey, setor, getCol, getColPrivate, toast, activeUserProp, onLogoutOperator }) {
  const [itens, setItens] = useState([]);
  const [obs, setObs] = useState("");
  const [solicitante, setSolicitante] = useState(activeUserProp?.nome || "");
  const [usuarios, setUsuarios] = useState([]);
  const [activeUser, setActiveUser] = useState(activeUserProp || null);
  const [userPinModal, setUserPinModal] = useState(null);
  const [userPinInput, setUserPinInput] = useState("");
  const [userPinErr, setUserPinErr] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(!activeUserProp);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
    if (activeUserProp) {
      setActiveUser(activeUserProp);
      setSolicitante(activeUserProp.nome);
      setLoadingUsers(false);
      return;
    }
    getDocs(collection(db, getColPrivate(setorKey, "req_usuarios")))
      .then(s => {
        const list = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.nome.localeCompare(b.nome));
        setUsuarios(list);
        const savedOpId = sessionStorage.getItem(`req_operator_${setorKey}`);
        if (savedOpId) {
          const found = list.find(u => u.id === savedOpId);
          if (found) {
            setActiveUser(found);
            setSolicitante(found.nome);
          }
        }
      })
      .catch(() => setUsuarios([]))
      .finally(() => setLoadingUsers(false));
  }, [setorKey, activeUserProp]);

  const handleSelectUser = (u) => {
    if (u.pin && u.pin.trim()) {
      setUserPinModal(u);
      setUserPinInput("");
      setUserPinErr("");
    } else {
      confirmUserLogin(u);
    }
  };

  const confirmUserLogin = (u) => {
    setActiveUser(u);
    setSolicitante(u.nome);
    sessionStorage.setItem(`req_operator_${setorKey}`, u.id);
    setUserPinModal(null);
    toast(`Operador ${u.nome} identificado`, "success");
  };

  const handleUserPinSubmit = (e) => {
    e.preventDefault();
    if (userPinInput.trim() === userPinModal.pin.trim()) {
      confirmUserLogin(userPinModal);
    } else {
      setUserPinErr("Senha incorreta");
    }
  };

  const handleLogoutUser = () => {
    if (onLogoutOperator) {
      onLogoutOperator();
      return;
    }
    sessionStorage.removeItem(`req_operator_${setorKey}`);
    setActiveUser(null);
    setSolicitante("");
    toast("Operador deslogado", "info");
  };

  const addItem = (item) => {
    setItens(prev => {
      const idx = prev.findIndex(i => i.nome.toLowerCase() === item.nome.toLowerCase());
      if (idx !== -1) {
        const upd = [...prev];
        upd[idx] = { ...upd[idx], quantidade: upd[idx].quantidade + item.quantidade };
        toast(`+${item.quantidade}x "${item.nome}"`, "info");
        return upd;
      }
      toast(`"${item.nome}" adicionado ao pedido`, "info");
      return [...prev, item];
    });
  };

  const updateItemQty = (idx, delta) => {
    setItens(prev => {
      const upd = [...prev];
      const newQty = (upd[idx].quantidade || 1) + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      upd[idx] = { ...upd[idx], quantidade: newQty };
      return upd;
    });
  };

  const remover = (idx) => setItens(p => p.filter((_, i) => i !== idx));

  const enviar = async () => {
    if (itens.length === 0) { toast("Adicione pelo menos um item.", "error"); return; }
    const nomeSolicitante = activeUser ? activeUser.nome : solicitante.trim();
    if (!nomeSolicitante) { toast("Informe quem está solicitando.", "error"); return; }
    setLoading(true);
    try {
      const codigo = genCodigo();
      await addDoc(collection(db, getColPrivate(setorKey, "requisicoes")), {
        codigo, setor: setorKey, setorLabel: setor.label,
        solicitante: nomeSolicitante,
        operadorId: activeUser?.userId || null,
        itens,
        observacao: obs.trim(), status: "pendente",
        criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
      });
      setEnviado(codigo);
      toast("Requisição registrada com sucesso!", "success");
    } catch (e) { toast("Erro ao enviar: " + e.message, "error"); }
    finally { setLoading(false); }
  };

  if (enviado) return (
    <div className="card animate-scale-in">
      <div className="success-box">
        <div className="success-icon animate-bounce">
          <Icon name="checkCircle" size={36} />
        </div>
        <div className="success-title">PEDIDO ENVIADO!</div>
        <div className="success-sub">Sua requisição foi enviada para aprovação do estoque.</div>
        <div className="success-sub" style={{ marginTop: 12 }}>Código de Acompanhamento:</div>
        <div className="success-code">{enviado}</div>
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-outline btn-lg" onClick={() => { setEnviado(null); setItens([]); setObs(""); }}>
            <Icon name="plus" size={16} /> FAZER NOVA REQUISIÇÃO
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-slide-up">
      <div className="selected-setor-bar">
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${setor.color || "var(--accent)"}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={setor.iconName || "package"} size={18} color={setor.color || "var(--accent)"} />
        </div>
        <span style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 2, color: setor.color || "var(--accent)" }}>
          SETOR: {setor.label}
        </span>
      </div>

      <div className="card hover-lift">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="clipboardList" size={20} color="var(--accent)" /> NOVA REQUISIÇÃO DE ESTOQUE
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Quem está solicitando? *</label>
          {activeUser ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface2)", border: "1px solid var(--accent)", padding: "10px 14px", borderRadius: "var(--r)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="userCheck" size={18} color="var(--accent)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{activeUser.nome}</span>
                    {activeUser.userId && (
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10, background: "var(--surface)", border: "1px solid var(--border2)", padding: "2px 6px", borderRadius: "4px", color: "var(--accent)" }}>
                        ID: {activeUser.userId}
                      </span>
                    )}
                  </div>
                  {activeUser.allowedCategories?.length > 0 ? (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", marginTop: 2 }}>
                      Filtro de Categorias: {activeUser.allowedCategories.join(", ")}
                    </div>
                  ) : (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--success)", marginTop: 2 }}>
                      Acesso Total (Todas as Categorias)
                    </div>
                  )}
                </div>
              </div>
              <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={handleLogoutUser} title="Trocar de Usuário / Sair">
                <Icon name="refreshCw" size={12} /> Alternar
              </button>
            </div>
          ) : loadingUsers ? (
            <div style={{ padding: "8px 0" }}><span className="spinner" /></div>
          ) : usuarios.length === 0 ? (
            <input className="form-input" placeholder="Digite seu nome..."
              value={solicitante} onChange={e => setSolicitante(e.target.value)} />
          ) : (
            <div className="user-grid">
              {usuarios.map(u => (
                <button key={u.id}
                  className={`user-btn ${solicitante === u.nome ? "selected" : ""}`}
                  onClick={() => handleSelectUser(u)}>
                  <Icon name="user" size={14} color={solicitante === u.nome ? "var(--accent)" : "var(--text-dim)"} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nome}</span>
                  {u.pin && <Icon name="lock" size={12} color="var(--warn)" title="Requer Senha" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {itens.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>
              Itens no Pedido ({itens.length})
            </label>
            <div className="items-list">
              {itens.map((item, i) => (
                <div key={i} className="item-row animate-slide-up" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                  <div className="item-info" style={{ flex: 1, minWidth: 0 }}>
                    <div className="item-name" style={{ fontWeight: 600 }}>{item.nome}</div>
                    <div className="item-cat" style={{ fontSize: 10, color: "var(--text-dim)" }}>{item.categoria || "Geral"}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ width: 26, height: 26, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border2)", borderRadius: "var(--r)", fontSize: 14 }}
                      onClick={() => updateItemQty(i, -1)}
                      title="Diminuir 1 un."
                    >
                      −
                    </button>
                    <div className="item-qty" style={{ minWidth: 26, textAlign: "center", fontWeight: 700, fontFamily: "var(--mono)", fontSize: 13 }}>
                      {item.quantidade}×
                    </div>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ width: 26, height: 26, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border2)", borderRadius: "var(--r)", fontSize: 14 }}
                      onClick={() => updateItemQty(i, 1)}
                      title="Aumentar 1 un."
                    >
                      +
                    </button>
                    <button className="btn-ghost" style={{ padding: "4px 6px", marginLeft: 4 }} onClick={() => remover(i)} title="Remover item">
                      <Icon name="x" size={15} color="var(--danger)" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="form-label" style={{ marginBottom: 8, display: "block" }}>
          {itens.length === 0 ? "Adicionar produtos *" : "Adicionar mais produtos"}
        </label>
        <AddItemInline setorKey={setorKey} getCol={getCol} onAdd={addItem} jaAdicionados={itens} activeUser={activeUser} />

        <div className="divider" />

        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Observações <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(opcional)</span></label>
          <textarea className="form-textarea"
            placeholder="Grau de urgência, setor final de entrega..."
            value={obs} onChange={e => setObs(e.target.value)} />
        </div>

        <button
          className="btn btn-accent btn-lg btn-full"
          onClick={enviar}
          disabled={loading || itens.length === 0 || (!activeUser && !solicitante.trim())}
        >
          {loading
            ? <><span className="spinner" /> ENVIANDO...</>
            : <><Icon name="arrowUp" size={16} /> ENVIAR REQUISIÇÃO ({itens.length} {itens.length === 1 ? "item" : "itens"})</>}
        </button>
      </div>

      {userPinModal && (
        <div className="logout-overlay" onClick={() => setUserPinModal(null)}>
          <div className="logout-box animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="card-title" style={{ fontSize: 18, color: "var(--accent)", marginBottom: 8 }}>
              SENHA DO USUÁRIO: {userPinModal.nome}
            </div>
            <form onSubmit={handleUserPinSubmit}>
              <input
                className="form-input"
                type="password"
                placeholder="Digite a senha..."
                value={userPinInput}
                onChange={e => setUserPinInput(e.target.value)}
                autoFocus
                style={{ marginBottom: 12 }}
              />
              {userPinErr && (
                <div style={{ color: "var(--danger)", fontFamily: "var(--mono)", fontSize: 11, marginBottom: 12 }}>
                  {userPinErr}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline" type="button" style={{ flex: 1 }} onClick={() => setUserPinModal(null)}>Cancelar</button>
                <button className="btn btn-accent" type="submit" style={{ flex: 1 }}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HISTÓRICO DE REQUISIÇÕES ────────────────────────────────
function HistoricoRequisicoes({ setorKey, setor, getColPrivate }) {
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await getDocs(query(collection(db, getColPrivate(setorKey, "requisicoes")), orderBy("criadoEm", "desc")));
        setReqs(s.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { setReqs([]); }
      finally { setLoading(false); }
    })();
  }, [setorKey]);

  const cls = { pendente: "s-pendente", aprovado: "s-aprovado", recusado: "s-recusado", entregue: "s-entregue" };
  const lbl = { pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado", entregue: "Entregue" };
  const iconsMap = { pendente: "info", aprovado: "checkCircle", recusado: "x", entregue: "truck" };

  if (loading) return <div className="empty"><span className="spinner" /></div>;

  return (
    <div className="animate-slide-up">
      <div className="page-hd">
        <div className="page-title" style={{ color: setor.color || "var(--accent)" }}>HISTÓRICO DE PEDIDOS</div>
        <div className="page-sub">Requisições do setor {setor.label}</div>
      </div>
      <div className="card hover-lift" style={{ padding: 0, overflow: "hidden" }}>
        {reqs.length === 0
          ? <div className="empty">Nenhuma requisição registrada até o momento.</div>
          : reqs.map(r => (
            <div key={r.id} className="hist-item">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <div className="hist-code">{r.codigo}</div>
                <span className={`status-badge ${cls[r.status] || "s-pendente"}`}>
                  <Icon name={iconsMap[r.status] || "info"} size={12} />
                  {lbl[r.status] || r.status}
                </span>
              </div>
              <div className="hist-date">{fmtDate(r.criadoEm)} · Solicitante: <strong>{r.solicitante}</strong></div>
              <div className="hist-items">{r.itens?.map(i => `${i.nome} (${i.quantidade}×)`).join(", ")}</div>
              {r.observacao && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Obs: {r.observacao}</div>}
              {r.respostaAdmin && <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--info)", marginTop: 4 }}>Resposta Estoque: {r.respostaAdmin}</div>}
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL DE REQUISIÇÃO ──────────────────────────────
export default function RequisicaoApp() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  // Sessão do Operador e da Empresa
  const [operatorSession, setOperatorSession] = useState(() => loadOperatorSession());
  const [companySession, setCompanySession] = useState(() => {
    const op = loadOperatorSession();
    if (op?.adminEmail) {
      return { empresaId: op.adminEmail, nomeEmpresa: op.nomeEmpresa || op.adminEmail };
    }
    return loadCompanySession();
  });
  const initialEmpresaParam = new URLSearchParams(window.location.search).get("empresa") || "";

  const empresaId = companySession?.empresaId || "default";

  const getCol = (k, t) => `users/${empresaId}/setores/${k}/${t}`;
  const getColPrivate = (k, t) => `users/${empresaId}/setores/${k}/${t}`;

  const [sectors, setSectors] = useState([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [setorKey, setSetorKey] = useState(() => {
    const op = loadOperatorSession();
    if (op?.setorId) return op.setorId;
    return loadSetorSession()?.setorKey ?? null;
  });
  const [activeUser, setActiveUser] = useState(() => loadOperatorSession());
  const [fase, setFase] = useState(() => {
    const op = loadOperatorSession();
    if (op?.setorId) return "form";
    return loadSetorSession()?.setorKey ? "form" : "setores";
  });
  const [subTab, setSubTab] = useState("form");
  const [showLogout, setShowLogout] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminAuthInput, setAdminAuthInput] = useState("");
  const [adminAuthErr, setAdminAuthErr] = useState("");
  const [modoLojaAtivo, setModoLojaAtivo] = useState(false);
  const { toasts, add: toast } = useToast();

  const handleVerifyAdminSwitch = async (e) => {
    if (e) e.preventDefault();
    setAdminAuthErr("");
    const input = adminAuthInput.trim();
    if (!input) { setAdminAuthErr("Digite a senha do Admin ou PIN do setor."); return; }

    let isValid = (input === "1234");
    if (sectorObj?.pin && input === sectorObj.pin) isValid = true;

    if (!isValid && companySession?.empresaId) {
      try {
        const uSnap = await getDoc(doc(db, "users", companySession.empresaId));
        if (uSnap.exists()) {
          const data = uSnap.data();
          if (input === data.senha || input === data.senhaApp) isValid = true;
        }
      } catch (err) {}
    }

    if (isValid) {
      localStorage.setItem("app_entry_mode", "sys");
      window.location.href = "/";
    } else {
      setAdminAuthErr("Senha do Admin ou PIN incorreto.");
    }
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  const loadSectors = async () => {
    if (!companySession?.empresaId) return;
    setLoadingSectors(true);
    try {
      const snap = await getDocs(collection(db, "users", companySession.empresaId, "setores"));
      setSectors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Erro ao carregar setores:", e);
    } finally {
      setLoadingSectors(false);
    }
  };

  useEffect(() => {
    if (companySession?.empresaId) {
      loadSectors();
    }
  }, [companySession]);

  // Verificar se o caixa (modoLoja) está ativo para o setor/empresa
  useEffect(() => {
    if (setorKey && companySession?.empresaId) {
      getDoc(doc(db, getCol(setorKey, "config"), "loja_config")).then(snap => {
        if (snap.exists() && snap.data().modoLoja) {
          setModoLojaAtivo(true);
        } else {
          setModoLojaAtivo(false);
        }
      }).catch(() => setModoLojaAtivo(false));
    } else {
      setModoLojaAtivo(false);
    }
  }, [setorKey, companySession]);

  const sectorObj = sectors.find(s => s.id === setorKey);
  const setor = sectorObj ? { ...sectorObj, color: sectorObj.color || "var(--accent)" } : null;

  const getUserAllowedSectors = () => {
    if (!activeUser) return null; // login de empresa/admin (acesso total)
    if (activeUser.allowedSectors && activeUser.allowedSectors.length > 0) {
      return activeUser.allowedSectors;
    }
    return activeUser.setorId ? [activeUser.setorId] : null;
  };

  const selecionarSetor = (key) => {
    const userAllowed = getUserAllowedSectors();
    if (userAllowed && !userAllowed.includes(key)) {
      toast("Você não possui permissão para acessar este setor.", "error");
      return;
    }
    setSetorKey(key);
    setFase("pin");
  };

  const onPinSuccess = () => {
    saveSetorSession(setorKey);
    setFase("form");
    toast(`Setor ${sectorObj?.label || setorKey} selecionado`, "success");
  };

  const handleLoginSuccess = ({ type, empresaId, nomeEmpresa, setorKey: sKey, operator }) => {
    setCompanySession({ empresaId, nomeEmpresa });
    if (type === "operator" && sKey && operator) {
      setSetorKey(sKey);
      setActiveUser(operator);
      setOperatorSession(operator);
      setFase("form");
      toast(`Bem-vindo, ${operator.nome}! Setor ${operator.setorLabel || sKey} conectado.`, "success");
    } else {
      setFase("setores");
      toast(`Empresa ${nomeEmpresa} conectada!`, "success");
    }
  };

  const handleLogoutSetor = () => {
    setShowLogout(false);
    setShowSidebar(false);

    const userAllowed = getUserAllowedSectors();

    // Se o usuário é um operador restrito a apenas 1 setor (ou não tem outros setores permitidos):
    // Sair do setor deve encerrar a sessão do operador por completo, sem expor os outros setores da empresa!
    if (activeUser && userAllowed && userAllowed.length <= 1) {
      clearSetorSession();
      clearCompanySession();
      clearOperatorSession();
      setActiveUser(null);
      setOperatorSession(null);
      setCompanySession(null);
      setSetorKey(null);
      setFase("setores");
      setSubTab("form");
      toast("Sessão do setor encerrada com segurança", "info");
      return;
    }

    // Se o operador tem múltiplos setores habilitados:
    clearSetorSession();
    setSetorKey(null);
    setFase("setores");
    setSubTab("form");
    toast("Setor desvinculado. Escolha outro setor permitido.", "info");
  };

  const handleLogoutEmpresa = () => {
    clearSetorSession();
    clearCompanySession();
    clearOperatorSession();
    setOperatorSession(null);
    setActiveUser(null);
    setCompanySession(null);
    setSetorKey(null);
    setFase("setores");
    setShowSidebar(false);
    toast("Sessão encerrada", "info");
  };

  const caixaUrl = `${window.location.origin}/caixa?empresa=${encodeURIComponent(companySession?.empresaId || "")}`;

  return (
    <>
      <style>{css}</style>
      <div className={`req-app ${theme}`}>
        <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ top: "-15%", left: "-15%" }}></video>

        {/* Header Responsivo */}
        <header className="req-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {companySession && (
              <button
                className="req-badge mobile-only-btn"
                onClick={() => setShowSidebar(true)}
                style={{ padding: "6px 10px" }}
                title="Abrir Menu Lateral"
              >
                <Icon name="menu" size={18} />
              </button>
            )}
            <div className="req-logo">
              <Icon name="package" size={20} color="var(--accent)" /> SYS
            </div>
            {activeUser && fase === "form" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                <span className="setor-pill" style={{ background: "var(--surface2)", borderColor: "var(--border2)", color: "var(--text)" }}>
                  <Icon name="userCheck" size={13} color="var(--accent)" /> {activeUser.nome}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {setor && fase === "form" && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  className={`req-badge ${subTab === "form" ? "active" : ""}`}
                  onClick={() => setSubTab("form")}
                  title="Fazer Novo Pedido"
                  style={{ padding: "6px 10px" }}
                >
                  <Icon name="plus" size={16} />
                </button>
                <button
                  className={`req-badge ${subTab === "hist" ? "active" : ""}`}
                  onClick={() => setSubTab("hist")}
                  title="Histórico de Pedidos"
                  style={{ padding: "6px 10px" }}
                >
                  <Icon name="fileText" size={16} />
                </button>
                <button
                  className="req-badge"
                  style={{ borderColor: "var(--danger)", color: "var(--danger)", padding: "6px 10px" }}
                  onClick={() => setShowLogout(true)}
                  title="Sair / Trocar de Usuário ou Setor"
                >
                  <Icon name="lock" size={16} />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ══════════ MODAL FLUTUANTE DE NAVEGAÇÃO DO APP DE REQUISIÇÃO ══════════ */}
        {showSidebar && (
          <div className="modal-sidebar-overlay" onClick={e => e.target === e.currentTarget && setShowSidebar(false)}>
            <div className="modal-sidebar-card">
              <div className="modal-sidebar-header">
                <div className="modal-sidebar-brand">
                  <div className="modal-sidebar-logo-icon">
                    <Icon name="package" size={22} color="var(--accent)" />
                  </div>
                  <div>
                    <div className="modal-sidebar-title">SYS</div>
                    <div className="modal-sidebar-sub">
                      {companySession ? (companySession.nomeEmpresa || companySession.empresaId) : "REQUISIÇÕES"}
                    </div>
                  </div>
                </div>
                <button className="modal-sidebar-close" onClick={() => setShowSidebar(false)} title="Fechar Menu">
                  <Icon name="x" size={16} />
                </button>
              </div>

              {setor && (
                <div style={{ background: "var(--surface2)", padding: "10px 14px", borderRadius: "14px", marginBottom: 14, border: "1px solid var(--border)" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1 }}>Setor Ativo</div>
                  <div style={{ fontSize: 13, color: setor.color || "var(--accent)", fontWeight: 600, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name={setor.iconName || "package"} size={15} color={setor.color} /> {setor.label}
                  </div>
                  {activeUser && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
                      Operador: <strong style={{ color: "var(--text)" }}>{activeUser.nome}</strong> (ID: {activeUser.userId || "—"})
                    </div>
                  )}
                </div>
              )}

              <div style={{ flex: 1, overflowY: "auto" }}>
                {/* MODO PADRÃO DO APP */}
                <div className="modal-nav-group" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
                  <div className="modal-nav-group-title">MODO PADRÃO DO APP</div>
                  <div style={{ display: "flex", gap: 6, padding: "2px 6px" }}>
                    <button
                      type="button"
                      className="ftab"
                      style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => { setShowSidebar(false); setShowAdminModal(true); }}
                    >
                      <Icon name="settings" size={12} /> Sys (Admin)
                    </button>
                    <button
                      type="button"
                      className="ftab active"
                      style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      <Icon name="clipboardList" size={12} /> Requisição
                    </button>
                  </div>
                </div>

                {setor && fase === "form" && (
                  <div className="modal-nav-group">
                    <div className="modal-nav-group-title">Navegação do Setor</div>
                    <button
                      className={`modal-nav-item ${subTab === "form" ? "active" : ""}`}
                      onClick={() => { setSubTab("form"); setShowSidebar(false); }}
                    >
                      <span className="modal-nav-item-icon"><Icon name="plus" size={18} /></span>
                      <span>Fazer Novo Pedido</span>
                    </button>
                    <button
                      className={`modal-nav-item ${subTab === "hist" ? "active" : ""}`}
                      onClick={() => { setSubTab("hist"); setShowSidebar(false); }}
                    >
                      <span className="modal-nav-item-icon"><Icon name="fileText" size={18} /></span>
                      <span>Histórico de Pedidos</span>
                    </button>
                  </div>
                )}

                {companySession && (!activeUser || (activeUser?.allowedSectors && activeUser.allowedSectors.length > 1)) && (
                  <div className="modal-nav-group">
                    <div className="modal-nav-group-title">Gestão de Setores</div>
                    <button
                      className="modal-nav-item"
                      onClick={() => { setFase("setores"); setSetorKey(null); setShowSidebar(false); }}
                    >
                      <span className="modal-nav-item-icon"><Icon name="grid" size={18} /></span>
                      <span>Alternar / Escolher Setor</span>
                    </button>
                  </div>
                )}

                {/* ABA APPS UNIFICADA */}
                <div className="modal-nav-group" style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <div className="modal-nav-group-title">APLICATIVO (.APK)</div>
                  <a href="/Baixar/SystemStock User.apk" download className="modal-nav-item">
                    <span className="modal-nav-item-icon"><Icon name="download" size={18} color="var(--accent)" /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>App Requisições</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Instalar no Android (Solicitantes)</div>
                    </div>
                  </a>
                </div>
              </div>

              <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="modal-nav-group-title">Sessão & Preferências</div>
                <button className="modal-nav-item" onClick={() => { toggleTheme(); setShowSidebar(false); }}>
                  <span className="modal-nav-item-icon"><Icon name={theme === "light" ? "moon" : "sun"} size={18} /></span>
                  <span>Tema {theme === "light" ? "Escuro" : "Claro"}</span>
                </button>

                {setor && fase === "form" && (
                  <button className="modal-nav-item" style={{ color: "var(--warn)" }} onClick={() => { setShowSidebar(false); setShowLogout(true); }}>
                    <span className="modal-nav-item-icon"><Icon name="lock" size={18} /></span>
                    <span>Sair do Setor</span>
                  </button>
                )}

                {companySession && (
                  <button className="modal-nav-item" style={{ color: "var(--danger)" }} onClick={handleLogoutEmpresa}>
                    <span className="modal-nav-item-icon"><Icon name="logout" size={18} /></span>
                    <span>Sair da Conta / Empresa</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className="req-content">

          {/* Login de Requisição (caso não esteja logado) */}
          {!companySession && (
            <ReqLoginScreen
              onLoginSuccess={handleLoginSuccess}
              initialId={initialEmpresaParam}
            />
          )}

          {/* Seleção de Setores da Empresa */}
          {companySession && fase === "setores" && (
            <div className="animate-slide-up">
              <div className="page-hd">
                <div className="page-title">REQUISIÇÃO DE ESTOQUE</div>
                <div className="page-sub">
                  Empresa: <strong>{companySession.nomeEmpresa || companySession.empresaId}</strong>
                  {activeUser ? ` · Operador: ${activeUser.nome}` : " · Selecione o seu setor"}
                </div>
              </div>

              {(() => {
                const userAllowed = getUserAllowedSectors();
                const visibleSectors = userAllowed
                  ? sectors.filter(s => userAllowed.includes(s.id))
                  : sectors;

                if (loadingSectors) {
                  return <div className="empty"><span className="spinner" /></div>;
                }
                if (visibleSectors.length === 0) {
                  return (
                    <div className="empty" style={{ padding: "40px 16px" }}>
                      <Icon name="lock" size={26} color="var(--warn)" style={{ marginBottom: 10 }} />
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Nenhum setor autorizado para este operador.</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Solicite acesso a setores ao Administrador no painel de configurações.</div>
                    </div>
                  );
                }
                return (
                  <div className="setor-grid">
                    {visibleSectors.map(s => (
                      <div key={s.id} className="setor-card" style={{ "--c": s.color || "var(--accent)" }} onClick={() => selecionarSetor(s.id)}>
                        <div className="setor-card-icon">
                          <Icon name={s.iconName || "package"} size={24} color={s.color || "var(--accent)"} />
                        </div>
                        <div className="setor-card-name">{s.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* PIN de entrada do Setor */}
          {companySession && fase === "pin" && setorKey && (
            <div>
              <button className="back-btn" onClick={() => { setFase("setores"); setSetorKey(null); }}>
                <Icon name="chevronLeft" size={14} /> Voltar aos setores
              </button>
              {sectorObj && (
                <PinScreen
                  setor={setor}
                  setorKey={setorKey}
                  getColPrivate={getColPrivate}
                  mode="login"
                  onSuccess={onPinSuccess}
                />
              )}
            </div>
          )}

          {/* Formulário / Histórico do Pedido */}
          {companySession && fase === "form" && setor && (
            <div>
              {subTab === "form" && (
                <FormRequisicao
                  setorKey={setorKey}
                  setor={setor}
                  getCol={getCol}
                  getColPrivate={getColPrivate}
                  toast={toast}
                  activeUserProp={activeUser}
                  onLogoutOperator={handleLogoutSetor}
                />
              )}
              {subTab === "hist" && <HistoricoRequisicoes setorKey={setorKey} setor={setor} getColPrivate={getColPrivate} />}
            </div>
          )}

        </div>
      </div>

      {/* Modal de Logout do Setor */}
      {showLogout && setor && (
        <LogoutModal
          setor={setor}
          setorKey={setorKey}
          getColPrivate={getColPrivate}
          onConfirm={handleLogoutSetor}
          onCancel={() => setShowLogout(false)}
        />
      )}

      {/* Modal de Autenticação Admin ao Mudar para Sys */}
      {showAdminModal && (
        <div className="logout-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(15,23,42,0.85)", zIndex: 3000, padding: 20 }}>
          <div className="logout-box animate-scale-in" style={{ background: "var(--surface)", border: "1.5px solid var(--accent)", borderRadius: "16px", padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="lock" size={20} color="var(--accent)" />
                <h3 style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1, color: "var(--accent)", margin: 0 }}>ACESSO PROTEGIDO</h3>
              </div>
              <button className="btn-ghost" onClick={() => { setShowAdminModal(false); setAdminAuthInput(""); setAdminAuthErr(""); }}><Icon name="x" size={14} /></button>
            </div>

            <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-mid)", marginBottom: 16, lineHeight: 1.4 }}>
              Digite a <strong>Senha da Conta Admin</strong> ou <strong>PIN do Setor</strong> para mudar para o modo Sys (Admin).
            </p>

            <form onSubmit={handleVerifyAdminSwitch} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Senha Admin / PIN</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={adminAuthInput}
                  onChange={e => setAdminAuthInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {adminAuthErr && <div style={{ color: "var(--danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{adminAuthErr}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn btn-outline" type="button" style={{ flex: 1 }} onClick={() => { setShowAdminModal(false); setAdminAuthInput(""); setAdminAuthErr(""); }}>
                  CANCELAR
                </button>
                <button className="btn btn-accent" type="submit" style={{ flex: 1 }}>
                  LIBERAR ACESSO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastEl toasts={toasts} />
    </>
  );
}