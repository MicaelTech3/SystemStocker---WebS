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

// ─── LOGIN DE EMPRESA (ID + SENHA) ───────────────────────────
function CompanyLoginScreen({ onLoginSuccess, initialEmpresaId }) {
  const [empresaIdInput, setEmpresaIdInput] = useState(initialEmpresaId || "");
  const [senhaInput, setSenhaInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanId = empresaIdInput.trim();
    if (!cleanId) { setErr("Digite o ID ou Email da Empresa."); return; }
    if (!senhaInput.trim()) { setErr("Digite a Senha de Acesso."); return; }

    setLoading(true);
    setErr("");
    try {
      const docRef = doc(db, "users", cleanId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const expectedSenha = data.senhaApp || data.senha || "123456";
        if (senhaInput.trim() === expectedSenha) {
          saveCompanySession(cleanId, data.nomeEmpresa || cleanId);
          onLoginSuccess(cleanId, data.nomeEmpresa || cleanId);
          return;
        }
      }

      setErr("ID ou Senha de Acesso incorretos.");
    } catch (e) {
      setErr("Erro de conexão: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: "40px 10px" }}>
      <div className="card hover-lift" style={{ maxWidth: 380, margin: "0 auto", padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", width: 54, height: 54, borderRadius: "50%", background: "var(--accent-light)", color: "var(--accent)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Icon name="building" size={28} />
          </div>
          <div className="page-title" style={{ fontSize: 28, color: "var(--accent)" }}>ACESSO DA EMPRESA</div>
          <div className="page-sub">Digite as credenciais fornecidas pelo administrador</div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">ID ou Email da Empresa</label>
            <input
              className="form-input"
              placeholder="ex: admin@empresa.com ou ID"
              value={empresaIdInput}
              onChange={e => setEmpresaIdInput(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Senha de Acesso do App</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={senhaInput}
              onChange={e => setSenhaInput(e.target.value)}
              required
            />
          </div>

          {err && (
            <div style={{ background: "var(--danger-light)", border: "1px solid var(--danger)", color: "var(--danger)", padding: "10px 12px", borderRadius: "var(--r)", fontFamily: "var(--mono)", fontSize: 11, marginBottom: 16 }} className="animate-fade-in">
              <Icon name="alertTriangle" size={14} style={{ marginRight: 6 }} /> {err}
            </div>
          )}

          <button className="btn btn-accent btn-lg btn-full" type="submit" disabled={loading}>
            {loading ? <><span className="spinner" /> VERIFICANDO...</> : <><Icon name="login" size={16} /> ENTRAR NO APP</>}
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
        setCats(sc.docs.map(d => ({ id: d.id, ...d.data() })));
        setProdutos(sp.docs.map(d => ({ id: d.id, ...d.data() })));
        const map = {};
        se.docs.forEach(d => { const x = d.data(); map[x.nome] = x.quantidade ?? 0; });
        setEstoqueMap(map);
      } catch { }
      finally { setLoading(false); }
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
    .filter(p => !jaAdicionados.some(j => j.nome === p.nome));

  const estoque = sel ? (estoqueMap[sel.nome] ?? null) : null;
  const qtdNum = Math.max(1, parseInt(qtd) || 1);
  const excede = estoque !== null && qtdNum > estoque;

  const handleSelect = (p) => {
    setSel(prev => prev?.id === p.id ? null : p);
    setQtd(1);
  };

  const handleAdd = () => {
    if (!sel || excede || qtdNum < 1) return;
    onAdd({ nome: sel.nome, categoria: sel.categoria, quantidade: qtdNum });
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
          placeholder="Buscar produto no catálogo..."
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
        {filtrados.length === 0
          ? <div className="empty" style={{ padding: "16px 12px" }}>
            {busca ? `Nenhum resultado para "${busca}"` : "Nenhum produto disponível"}
          </div>
          : filtrados.map(p => {
            const stk = estoqueMap[p.nome] ?? null;
            const zero = stk !== null && stk <= 0;
            const isSel = sel?.id === p.id;
            return (
              <div key={p.id}
                className={`prod-row ${isSel ? "selected" : ""} ${zero ? "unavail" : ""}`}
                onClick={() => !zero && handleSelect(p)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="prod-row-name">{p.nome}</div>
                  <div className="prod-row-cat">{p.categoria}</div>
                </div>
                {stk !== null && (
                  <div className={`prod-stock ${zero ? "zero" : stk <= 5 ? "warn" : "ok"}`}>
                    {zero ? "sem estoque" : `${stk} un.`}
                  </div>
                )}
              </div>
            );
          })}
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
              max={estoque ?? undefined}
              onChange={e => setQtd(e.target.value)}
              onKeyDown={handleKeyQtd}
            />
            <button className="qty-btn"
              onClick={() => setQtd(q => {
                const n = (parseInt(q) || 1) + 1;
                return estoque !== null ? Math.min(estoque, n) : n;
              })}>+</button>
          </div>
          <button
            className="btn btn-accent"
            style={{ padding: "8px 16px", fontSize: 12 }}
            onClick={handleAdd}
            disabled={excede || qtdNum < 1}
          >
            <Icon name="plus" size={14} /> ADICIONAR
          </button>
          {estoque !== null && (
            <div style={{ width: "100%", fontFamily: "var(--mono)", fontSize: 10, marginTop: 4, color: excede ? "var(--danger)" : "var(--success)" }}>
              {excede ? `Disponível em estoque: ${estoque} un.` : `Em estoque: ${estoque} un.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FORMULÁRIO DE REQUISIÇÃO ────────────────────────────────
function FormRequisicao({ setorKey, setor, getCol, getColPrivate, toast }) {
  const [itens, setItens] = useState([]);
  const [obs, setObs] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [userPinModal, setUserPinModal] = useState(null);
  const [userPinInput, setUserPinInput] = useState("");
  const [userPinErr, setUserPinErr] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
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
  }, [setorKey]);

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
    sessionStorage.removeItem(`req_operator_${setorKey}`);
    setActiveUser(null);
    setSolicitante("");
    toast("Operador deslogado", "info");
  };

  const addItem = (item) => {
    setItens(prev => {
      const idx = prev.findIndex(i => i.nome === item.nome);
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
        solicitante: nomeSolicitante, itens,
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
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{activeUser.nome}</div>
                  {activeUser.allowedCategories?.length > 0 ? (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>
                      Filtro de Categorias: {activeUser.allowedCategories.join(", ")}
                    </div>
                  ) : (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--success)" }}>
                      Acesso Total
                    </div>
                  )}
                </div>
              </div>
              <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={handleLogoutUser} title="Trocar de Usuário">
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
                <div key={i} className="item-row animate-slide-up">
                  <div className="item-info">
                    <div className="item-name">{item.nome}</div>
                    <div className="item-cat">{item.categoria}</div>
                  </div>
                  <div className="item-qty">{item.quantidade}×</div>
                  <button className="btn-ghost" onClick={() => remover(i)} title="Remover item">
                    <Icon name="x" size={16} />
                  </button>
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

  // Sessão da Empresa (ID + Nome)
  const [companySession, setCompanySession] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const empresaParam = params.get("empresa");
    if (empresaParam) return { empresaId: empresaParam, nomeEmpresa: empresaParam };
    return loadCompanySession();
  });

  const empresaId = companySession?.empresaId || "default";

  const getCol = (k, t) => `users/${empresaId}/setores/${k}/${t}`;
  const getColPrivate = (k, t) => `users/${empresaId}/setores/${k}/${t}`;

  const [sectors, setSectors] = useState([]);
  const [loadingSectors, setLoadingSectors] = useState(false);
  const [setorKey, setSetorKey] = useState(() => loadSetorSession()?.setorKey ?? null);
  const [fase, setFase] = useState(() => loadSetorSession()?.setorKey ? "form" : "setores");
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

  const selecionarSetor = (key) => {
    setSetorKey(key);
    setFase("pin");
  };

  const onPinSuccess = () => {
    saveSetorSession(setorKey);
    setFase("form");
    toast(`Setor ${sectorObj?.label || setorKey} selecionado`, "success");
  };

  const handleLogoutSetor = () => {
    clearSetorSession();
    setSetorKey(null);
    setFase("setores");
    setSubTab("form");
    setShowLogout(false);
    setShowSidebar(false);
    toast("Sessão do setor encerrada", "info");
  };

  const handleLogoutEmpresa = () => {
    clearSetorSession();
    clearCompanySession();
    setCompanySession(null);
    setSetorKey(null);
    setFase("setores");
    setShowSidebar(false);
    toast("Sessão da empresa encerrada", "info");
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
            {setor && fase === "form" && (
              <span className="setor-pill" style={{ color: setor.color, borderColor: setor.color }}>
                <Icon name={setor.iconName || "package"} size={14} color={setor.color} /> {setor.label}
              </span>
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
                  title="Sair / Trancar Setor (Cadeado)"
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
                </div>
              )}

              <div style={{ flex: 1, overflowY: "auto" }}>
                {/* MODO PADRÃO DO APP */}
                <div className="modal-nav-group" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
                  <div className="modal-nav-group-title">MODO PADRÃO DO APP</div>
                  <div style={{ display: "flex", gap: 4, padding: "2px 6px" }}>
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
                      className="ftab"
                      style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => {
                        localStorage.setItem("app_entry_mode", "caixa");
                        setShowSidebar(false);
                        window.location.href = `/caixa?empresa=${encodeURIComponent(companySession?.empresaId || "")}`;
                      }}
                    >
                      <Icon name="store" size={12} /> Caixa
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

                    {modoLojaAtivo && (
                      <a
                        href={caixaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="modal-nav-item caixa-item"
                        onClick={() => setShowSidebar(false)}
                      >
                        <span className="modal-nav-item-icon"><Icon name="store" size={18} /></span>
                        <span>Frente de Caixa (POS)</span>
                      </a>
                    )}
                  </div>
                )}

                {companySession && (
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
                  <div className="modal-nav-group-title">APLICATIVOS (.APK)</div>
                  <a href="/Baixar/SystemStock adm.apk" download className="modal-nav-item">
                    <span className="modal-nav-item-icon"><Icon name="download" size={18} color="var(--success)" /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>App Administrador</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Gestão & Estoque</div>
                    </div>
                  </a>
                  <a href="/Baixar/SystemStock User.apk" download className="modal-nav-item">
                    <span className="modal-nav-item-icon"><Icon name="download" size={18} color="var(--info)" /></span>
                    <div>
                      <div style={{ fontWeight: 600 }}>App Requisições</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Solicitantes</div>
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
                    <span>Sair da Empresa</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className="req-content">

          {/* Login de Empresa (caso não esteja logado) */}
          {!companySession && (
            <CompanyLoginScreen
              onLoginSuccess={(id, nome) => setCompanySession({ empresaId: id, nomeEmpresa: nome })}
              initialEmpresaId={new URLSearchParams(window.location.search).get("empresa")}
            />
          )}

          {/* Seleção de Setores da Empresa */}
          {companySession && fase === "setores" && (
            <div className="animate-slide-up">
              <div className="page-hd">
                <div className="page-title">REQUISIÇÃO DE ESTOQUE</div>
                <div className="page-sub">Empresa: <strong>{companySession.nomeEmpresa || companySession.empresaId}</strong> · Selecione o seu setor</div>
              </div>

              {loadingSectors ? (
                <div className="empty"><span className="spinner" /></div>
              ) : sectors.length === 0 ? (
                <div className="empty">Nenhum setor cadastrado para esta empresa no sistema.</div>
              ) : (
                <div className="setor-grid">
                  {sectors.map(s => (
                    <div key={s.id} className="setor-card" style={{ "--c": s.color || "var(--accent)" }} onClick={() => selecionarSetor(s.id)}>
                      <div className="setor-card-icon">
                        <Icon name={s.iconName || "package"} size={24} color={s.color || "var(--accent)"} />
                      </div>
                      <div className="setor-card-name">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
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
              {subTab === "form" && <FormRequisicao setorKey={setorKey} setor={setor} getCol={getCol} getColPrivate={getColPrivate} toast={toast} />}
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