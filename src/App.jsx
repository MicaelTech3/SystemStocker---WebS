import { useState, useEffect, useRef, useCallback } from "react";
import { Analytics } from "./Analytics.jsx";
import { Configuracoes, ConfigSetores, ConfigProdutosCategorias } from "./Configuracoes.jsx";
import { auth, db, googleProvider } from "./firebase.js";
import { getAuth, signInWithEmailAndPassword, signOut, signInWithPopup } from "firebase/auth";
import {
  getFirestore, collection, addDoc, getDocs, doc, deleteDoc,
  setDoc, query, where, updateDoc, increment, orderBy, limit, serverTimestamp, getDoc,
  onSnapshot,
} from "firebase/firestore";
import { Icon } from "./icons.jsx";

// ─── SETORES (Dinâmicos) ──────────────────────────────────────
let globalSectors = [];
const resolveSetor = (setor) => {
  return globalSectors.find(s => s.id === setor) || { label: setor, iconName: "package", color: "var(--accent)" };
};

const getCol = (setor, type) => {
  const email = auth.currentUser?.email;
  return email ? `users/${email}/setores/${setor}/${type}` : `estoque_${setor}_${type}`;
};
const getColPrivate = (setor, type) => {
  const email = auth.currentUser?.email;
  return email ? `users/${email}/setores/${setor}/${type}` : `estoque_${setor}_${type}`;
};

const fmtDate = (ts) => { if (!ts) return "—"; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString("pt-BR"); };
const DEFAULT_THRESH = { baixo: 5, medio: 15 };

const registrarLog = (setor, tipo, dados) =>
  addDoc(collection(db, getColPrivate(setor, "log")), { tipo, ...dados, ts: serverTimestamp() });

async function gerarCodigoSemBarras(setor) {
  const configRef = doc(db, getCol(setor, "config"), "contador_sem_barras");
  const snap = await getDocs(collection(db, getCol(setor, "config")));
  const contDoc = snap.docs.find(d => d.id === "contador_sem_barras");
  const atual = contDoc ? (contDoc.data().proximo || 1) : 1;
  await setDoc(configRef, { proximo: atual + 1, updatedAt: new Date().toISOString() });
  return String(atual).padStart(2, "0");
}

// ─── STYLES ──────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  :root {
    --bg:#f5f2e9; --surface:#ffffff; --surface2:#e9e4d4;
    --border:#dfd9c4; --border2:#ccc4a8;
    --sidebar-bg:#ffffff; --sidebar-border:#dfd9c4; --sidebar-hover:#f1ede2;
    --sidebar-text:#292524; --sidebar-text-dim:#78716c;
    --accent:#f97316; --accent2:#ea580c;
    --success:#10b981; --danger:#ef4444; --info:#3b82f6; --warn:#f59e0b;
    --text:#292524; --text-dim:#78716c; --text-mid:#57534e;
    --mono:'IBM Plex Mono',monospace; --sans:'IBM Plex Sans',sans-serif; --display:'Bebas Neue',sans-serif;
    --r:6px; --header-h:56px; --bottom-h:76px;
  }
  .dark {
    --bg:#0c0a09; --surface:#1c1917; --surface2:#292524;
    --border:#2e2a28; --border2:#3f3a37;
    --sidebar-bg:#070a10; --sidebar-border:#1e293b; --sidebar-hover:#151d2a;
    --sidebar-text:#fafaf9; --sidebar-text-dim:#a8a29e;
    --text:#fafaf9; --text-dim:#a8a29e; --text-mid:#d6d3d1;
  }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  html { -webkit-text-size-adjust:100%; }
  body { background:var(--bg); color:var(--text); font-family:var(--sans); transition: background 0.25s, color 0.25s; -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; touch-action:manipulation; }
  input, textarea, select { -webkit-user-select:text; user-select:text; }
  ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:var(--bg); } ::-webkit-scrollbar-thumb { background:var(--border2); border-radius:2px; }
  .app { min-height:100vh; min-height:100dvh; display:flex; flex-direction:column; background:var(--bg); color:var(--text); }
  .header { background:var(--surface); border-bottom:1px solid var(--border); height:var(--header-h); display:flex; align-items:center; justify-content:space-between; padding:0 16px; position:sticky; top:0; z-index:200; flex-shrink:0; }
  .header-logo { font-family:var(--display); font-size:18px; letter-spacing:2px; color:var(--accent); display:flex; align-items:center; gap:8px; }
  .setor-tag { font-family:var(--mono); font-size:10px; letter-spacing:2px; padding:2px 8px; border:1px solid; }
  .header-right { display:flex; align-items:center; gap:6px; }
  .hbtn { background:var(--surface); border:1px solid var(--border); color:var(--text-dim); padding:6px 10px; font-family:var(--mono); font-size:11px; cursor:pointer; transition:all .2s; text-transform:uppercase; letter-spacing:1px; border-radius:var(--r); white-space:nowrap; -webkit-tap-highlight-color:transparent; display:inline-flex; align-items:center; gap:5px; }
  .hbtn:hover,.hbtn:active { border-color:var(--accent); color:var(--accent); }
  .hbtn.danger:hover,.hbtn.danger:active { border-color:var(--danger); color:var(--danger); }
  .header-email { font-family:var(--mono); font-size:11px; color:var(--text-dim); }
  .main-layout { display:flex; flex:1; overflow:hidden; }
  .sidebar { width:240px; background:var(--sidebar-bg); border:1.5px solid var(--sidebar-border); border-radius:24px; margin:14px 0 14px 14px; height:calc(100vh - var(--header-h) - 28px); height:calc(100dvh - var(--header-h) - 28px); display:flex; flex-direction:column; flex-shrink:0; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,0.08); transition:width 0.28s cubic-bezier(0.16,1,0.3,1), margin 0.28s cubic-bezier(0.16,1,0.3,1), background 0.25s, border-color 0.25s; }
  .sidebar.collapsed { width:72px; }
  .sidebar-setor { padding:16px 14px; border-bottom:1px solid var(--sidebar-border); display:flex; align-items:center; justify-content:space-between; overflow:hidden; }
  .sidebar-setor-label { font-family:var(--mono); font-size:9px; color:var(--sidebar-text-dim); letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
  .sidebar-setor-name { font-family:var(--display); font-size:20px; letter-spacing:2px; display:flex; align-items:center; gap:7px; white-space:nowrap; }
  .sidebar-nav { padding:10px 0; flex:1; display:flex; flex-direction:column; gap:2px; }
  .sidebar-group { padding:10px 14px 4px; font-family:var(--mono); font-size:9px; color:var(--sidebar-text-dim); letter-spacing:2px; text-transform:uppercase; white-space:nowrap; overflow:hidden; }
  .sidebar.collapsed .sidebar-group { opacity:0; height:4px; padding:0; }
  .sitem { display:flex; align-items:center; gap:12px; padding:10px 14px; margin:3px 10px; border-radius:14px; font-family:var(--sans); font-size:13px; font-weight:500; color:var(--sidebar-text); background:transparent; border:1.5px solid transparent; cursor:pointer; transition:all 0.18s cubic-bezier(0.16,1,0.3,1); white-space:nowrap; position:relative; }
  .sidebar.collapsed .sitem { margin:3px 8px; padding:10px; justify-content:center; }
  .sitem:hover { background:var(--sidebar-hover); color:var(--sidebar-text); }
  .sitem.active { border-color:var(--accent); background:var(--accent-light); color:var(--accent); font-weight:600; }
  .sitem-icon { width:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .sitem-label { transition:opacity 0.2s, max-width 0.2s; overflow:hidden; text-overflow:ellipsis; }
  .sidebar.collapsed .sitem-label { opacity:0; display:none; }
  .sitem-badge { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:var(--danger); color:white; font-family:var(--mono); font-size:9px; padding:1px 6px; border-radius:10px; min-width:18px; text-align:center; }
  .sidebar.collapsed .sitem-badge { right:4px; top:4px; transform:none; }
  .sidebar-toggle-btn { background:transparent; border:1px solid var(--border2); color:var(--text-dim); width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; }
  .sidebar-toggle-btn:hover { border-color:var(--accent); color:var(--accent); }
  .content { flex:1; overflow-y:auto; padding:24px 20px; -webkit-overflow-scrolling:touch; transition:all 0.28s ease; }
  .bottom-nav { display:none; position:fixed; bottom:0; left:0; right:0; height:var(--bottom-h); background:var(--surface); border-top:2px solid var(--border2); z-index:300; }
  .bottom-nav-inner { display:flex; align-items:stretch; height:calc(var(--bottom-h) - env(safe-area-inset-bottom,0px)); padding:0 6px; gap:2px; }
  .bnav-item { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; padding:10px 4px 8px; cursor:pointer; color:var(--text-dim); position:relative; -webkit-tap-highlight-color:transparent; touch-action:manipulation; transition:color .15s; border-radius:6px; margin:4px 0; }
  .bnav-item:active { background:var(--surface2); }
  .bnav-item.active { color:var(--accent); }
  .bnav-item.active::before { content:''; position:absolute; top:0; left:15%; right:15%; height:2px; background:var(--accent); border-radius:0 0 3px 3px; }
  .bnav-icon { display:flex; align-items:center; justify-content:center; position:relative; }
  .bnav-label { font-family:var(--mono); font-size:9px; letter-spacing:.5px; text-transform:uppercase; font-weight:600; }
  .bnav-dot { position:absolute; top:-3px; right:-5px; width:8px; height:8px; background:var(--danger); border-radius:50%; border:1px solid var(--surface); }
  @media (max-width:768px) { .sidebar { display:none; } .bottom-nav { display:block; } .header-email { display:none; } .content { padding:14px; padding-bottom:calc(var(--bottom-h) + 20px + env(safe-area-inset-bottom,0px)); } }
  @media (min-width:769px) { .mobile-only-btn { display:none !important; } }
  .ambient-video { position:absolute; width:700px; height:700px; object-fit:cover; border-radius:50%; filter:blur(40px) opacity(0.35); pointer-events:none; z-index:1; animation:floatAmbient 22s ease-in-out infinite; }
  @keyframes floatAmbient { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(80px, -60px) scale(1.1); } }
  .login-screen { min-height:100vh; min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:20px; background:var(--bg); background-image:radial-gradient(circle at 20% 50%,rgba(245,166,35,.04) 0%,transparent 50%); position:relative; overflow:hidden; }
  .login-card { background:var(--surface); border:1px solid var(--border2); padding:40px 32px; width:100%; max-width:400px; }
  .login-card::after { content:''; display:block; height:3px; background:linear-gradient(90deg,var(--accent),var(--accent2)); margin-top:40px; margin-left:-32px; width:calc(100% + 64px); }
  .login-title { font-family:var(--display); font-size:48px; letter-spacing:5px; line-height:1; margin-bottom:2px; }
  .login-title span { color:var(--accent); }
  .login-sub { font-family:var(--mono); font-size:10px; color:var(--text-dim); letter-spacing:3px; text-transform:uppercase; margin-bottom:36px; }
  .onboarding-screen { min-height:100vh; min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:20px; background:var(--bg); position:relative; overflow:hidden; }
  .onboarding-card { background:var(--surface); border:1px solid var(--border2); padding:40px 32px; width:100%; max-width:480px; position:relative; z-index:2; }
  .onboarding-card::after { content:''; display:block; height:3px; background:linear-gradient(90deg,var(--accent),var(--success)); margin-top:40px; margin-left:-32px; width:calc(100% + 64px); }
  .onboarding-title { font-family:var(--display); font-size:42px; letter-spacing:3px; line-height:1; margin-bottom:6px; }
  .onboarding-title span { color:var(--success); }
  .onboarding-sub { font-family:var(--mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; text-transform:uppercase; margin-bottom:30px; }
  .setor-screen { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:32px 16px; gap:32px; }
  .setor-heading { text-align:center; }
  .setor-heading h2 { font-family:var(--display); font-size:36px; letter-spacing:4px; margin-bottom:6px; }
  .setor-heading p { font-family:var(--mono); font-size:11px; color:var(--text-dim); }
  .setor-cards { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; width:100%; max-width:1100px; }
  .setor-card { background:var(--surface); border:1px solid var(--border); padding:32px 12px; cursor:pointer; transition:all .25s; display:flex; flex-direction:column; align-items:center; gap:12px; position:relative; overflow:hidden; -webkit-tap-highlight-color:transparent; }
  .setor-card::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; opacity:0; transition:opacity .25s; background:var(--c); }
  .setor-card:hover,.setor-card:active { transform:translateY(-4px); border-color:var(--c); }
  .setor-card:hover::after,.setor-card:active::after { opacity:1; }
  .setor-card-name { font-family:var(--display); font-size:22px; letter-spacing:2px; color:var(--c); }
  .setor-card-sub { font-family:var(--mono); font-size:9px; color:var(--text-dim); letter-spacing:1px; }
  @media (max-width:900px) { .setor-cards { grid-template-columns:repeat(3,1fr); max-width:600px; } }
  @media (max-width:600px) { .setor-cards { grid-template-columns:repeat(2,1fr); max-width:440px; } }
  @media (max-width:400px) { .setor-cards { grid-template-columns:1fr; max-width:320px; } .setor-card { flex-direction:row; padding:18px; gap:14px; align-items:center; } }

  .ferr-sub-cards { display:grid; grid-template-columns:1fr 1fr; gap:14px; width:100%; max-width:500px; }
  @media (max-width:400px) { .ferr-sub-cards { grid-template-columns:1fr; } }
  .form-group { margin-bottom:14px; }
  .form-label { display:block; font-family:var(--mono); font-size:10px; color:var(--text-dim); letter-spacing:2px; text-transform:uppercase; margin-bottom:7px; }
  .form-input,.form-select { width:100%; background:var(--surface2); border:1px solid var(--border2); color:var(--text); padding:13px 14px; font-family:var(--mono); font-size:16px; outline:none; transition:border-color .2s; border-radius:var(--r); -webkit-appearance:none; appearance:none; }
  .form-input:focus,.form-select:focus { border-color:var(--accent); }
  .form-input:disabled,.form-select:disabled { opacity:.4; }
  .form-select { cursor:pointer; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23777' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; padding-right:36px; }
  .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  @media (max-width:500px) { .form-row { grid-template-columns:1fr; } }
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 20px; font-family:var(--mono); font-size:12px; cursor:pointer; transition:all .2s; border-radius:var(--r); letter-spacing:.5px; border:1px solid transparent; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
  .btn-accent { background:var(--accent); color:#0a0a0a; border-color:var(--accent); font-weight:600; }
  .btn-accent:hover:not(:disabled),.btn-accent:active:not(:disabled) { background:var(--accent2); border-color:var(--accent2); }
  .btn-outline { background:transparent; color:var(--text-dim); border-color:var(--border2); }
  .btn-outline:hover:not(:disabled),.btn-outline:active:not(:disabled) { border-color:var(--accent); color:var(--accent); }
  .btn-danger { background:transparent; color:var(--danger); border-color:var(--danger); }
  .btn-danger:hover:not(:disabled),.btn-danger:active:not(:disabled) { background:var(--danger); color:white; }
  .btn-success { background:var(--success); color:#0a0a0a; border-color:var(--success); font-weight:600; }
  .btn:disabled { opacity:.4; cursor:not-allowed; }
  .btn-lg { padding:14px 28px; font-size:13px; }
  .btn-full { width:100%; }
  .btn-icon-sm { background:transparent; border:1px solid var(--border); color:var(--text-dim); padding:9px 10px; cursor:pointer; font-size:14px; transition:all .15s; border-radius:var(--r); touch-action:manipulation; -webkit-tap-highlight-color:transparent; min-width:38px; min-height:38px; display:inline-flex; align-items:center; justify-content:center; }
  .btn-icon-sm:hover,.btn-icon-sm:active { border-color:var(--danger); color:var(--danger); }
  .btn-icon-sm.edit-btn:hover,.btn-icon-sm.edit-btn:active { border-color:var(--info); color:var(--info); }
  .btn-icon-sm:disabled { opacity:.4; cursor:not-allowed; }
  .btn-scan { display:flex; align-items:center; justify-content:center; gap:9px; width:100%; padding:14px; background:var(--surface2); border:1px solid var(--border2); color:var(--text); font-family:var(--mono); font-size:12px; cursor:pointer; border-radius:var(--r); transition:border-color .2s,color .2s; letter-spacing:.5px; -webkit-tap-highlight-color:transparent; }
  .btn-scan:hover,.btn-scan:active { border-color:var(--accent); color:var(--accent); }
 .page-hd { margin-bottom:18px; }
  .page-title { font-family:var(--display); font-size:30px; letter-spacing:4px; line-height:1; }
  .page-sub { font-family:var(--mono); font-size:11px; color:var(--text-dim); margin-top:3px; }
  .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px; }
  @media (max-width:600px) { .stats-grid { grid-template-columns:repeat(2,1fr); } }
  .stat-card { background:var(--surface); border:1px solid var(--border); padding:16px; position:relative; }
  .stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:var(--c,var(--accent)); }
  .stat-label { font-family:var(--mono); font-size:9px; color:var(--text-dim); letter-spacing:2px; text-transform:uppercase; margin-bottom:8px; }
  .stat-value { font-family:var(--display); font-size:38px; line-height:1; }
  .stat-sub { font-family:var(--mono); font-size:9px; color:var(--text-dim); margin-top:4px; }
  .filter-tabs { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap; }
  .ftab { background:transparent; border:1px solid var(--border2); color:var(--text-dim); padding:6px 12px; font-family:var(--mono); font-size:10px; cursor:pointer; border-radius:var(--r); transition:all .15s; -webkit-tap-highlight-color:transparent; text-transform:uppercase; letter-spacing:1px; display:flex; align-items:center; gap:5px; }
  .ftab:active,.ftab:hover { border-color:var(--accent); color:var(--accent); }
  .ftab.active { background:var(--accent); color:#0a0a0a; border-color:var(--accent); font-weight:600; }
  .ftab-dot { width:7px; height:7px; border-radius:50%; }
  .table-card { background:var(--surface); border:1px solid var(--border); overflow:hidden; margin-bottom:16px; }
  .table-card-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); gap:10px; flex-wrap:wrap; }
  .table-card-title { font-family:var(--mono); font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--text-mid); }
  .product-list { display:flex; flex-direction:column; }
  .product-card { display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid var(--border); transition:background .1s; }
  .product-card:last-child { border-bottom:none; }
  .product-card:active { background:var(--surface2); }
  .product-card-info { flex:1; min-width:0; }
  .product-card-name { font-family:var(--sans); font-size:14px; font-weight:600; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .product-card-cat { font-family:var(--mono); font-size:10px; color:var(--text-dim); }
  .product-card-right { display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex-shrink:0; }
  .product-qty { font-family:var(--display); font-size:28px; line-height:1; }
  .status-bar { display:flex; align-items:center; gap:6px; }
  .status-bar-track { width:48px; height:4px; background:var(--border2); border-radius:2px; overflow:hidden; }
  .status-bar-fill { height:100%; border-radius:2px; transition:width .3s; }
  .badge { display:inline-block; padding:2px 8px; font-size:9px; letter-spacing:1px; text-transform:uppercase; border:1px solid; font-family:var(--mono); border-radius:var(--r); }
  .badge-ok   { color:var(--success); border-color:var(--success); background:rgba(74,222,128,.06); }
  .badge-med  { color:var(--warn);    border-color:var(--warn);    background:rgba(250,204,21,.06); }
  .badge-low  { color:var(--accent);  border-color:var(--accent);  background:rgba(245,166,35,.06); }
  .badge-zero { color:var(--danger);  border-color:var(--danger);  background:rgba(248,113,113,.06); }
  .badge-in   { color:var(--success); border-color:var(--success); background:rgba(74,222,128,.06); }
  .badge-out  { color:var(--danger);  border-color:var(--danger);  background:rgba(248,113,113,.06); }
  .card { background:var(--surface); border:1px solid var(--border); padding:18px; margin-bottom:14px; border-radius:var(--r); }
  .card-title { font-family:var(--display); font-size:18px; letter-spacing:2px; color:var(--accent); margin-bottom:16px; }
  .err-msg { background:rgba(248,113,113,.08); border:1px solid var(--danger); color:var(--danger); padding:10px 14px; font-family:var(--mono); font-size:12px; margin-top:12px; border-radius:var(--r); }
  .divider { height:1px; background:var(--border); margin:16px 0; }
  .entrada-preview { background:var(--surface2); border:1px solid var(--accent); border-radius:var(--r); padding:16px; margin:14px 0; }
  .scanner-fs { position:fixed; inset:0; z-index:2000; background:#000; display:flex; flex-direction:column; }
  .scanner-video-bg { flex:1; position:relative; overflow:hidden; }
  .scanner-video-bg video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .scan-line { position:absolute; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,var(--accent) 30%,var(--accent) 70%,transparent); box-shadow:0 0 12px 3px rgba(245,166,35,.6); animation:sl 2.5s ease-in-out infinite; z-index:10; }
  @keyframes sl { 0%{top:5%} 50%{top:90%} 100%{top:5%} }
  .scan-vig { position:absolute; inset:0; background:radial-gradient(ellipse 75% 55% at 50% 50%,transparent 35%,rgba(0,0,0,.55) 100%); pointer-events:none; z-index:5; }
  .scan-corners { position:absolute; inset:0; pointer-events:none; z-index:6; }
  .scan-c { position:absolute; width:32px; height:32px; border-color:var(--accent); border-style:solid; opacity:.9; }
  .scan-c.tl { top:16px; left:16px; border-width:2px 0 0 2px; }
  .scan-c.tr { top:16px; right:16px; border-width:2px 2px 0 0; }
  .scan-c.bl { bottom:145px; left:16px; border-width:0 0 2px 2px; }
  .scan-c.br { bottom:145px; right:16px; border-width:0 2px 2px 0; }
  .scan-confirm-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:20; background:rgba(0,0,0,.8); padding:20px; }
  .scan-confirm-box { background:var(--surface); border:2px solid var(--success); padding:24px 20px; text-align:center; width:100%; max-width:340px; border-radius:var(--r); }
  .scan-confirm-code { font-family:var(--display); font-size:30px; color:var(--success); letter-spacing:3px; margin-bottom:6px; word-break:break-all; }
  .scan-confirm-info { font-family:var(--mono); font-size:11px; color:var(--text-dim); margin-bottom:18px; }
  .scan-confirm-btns { display:flex; gap:10px; }
  .scanner-bar { background:rgba(10,10,10,.98); border-top:1px solid var(--border2); padding:10px 14px; padding-bottom:calc(10px + env(safe-area-inset-bottom,0px)); display:flex; flex-direction:column; gap:8px; }
  .scanner-bar-row1 { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .scanner-bar-title { font-family:var(--display); font-size:16px; letter-spacing:3px; color:var(--accent); }
  .scanner-status { font-family:var(--mono); font-size:11px; color:var(--text-dim); }
  .scanner-status.ok { color:var(--success); } .scanner-status.err { color:var(--danger); }
  .scanner-manual { display:flex; gap:8px; }
  .scanner-manual input { flex:1; background:var(--surface2); border:1px solid var(--border2); color:var(--text); padding:11px 13px; font-family:var(--mono); font-size:14px; outline:none; border-radius:var(--r); }
  .scanner-manual input:focus { border-color:var(--accent); }
  .scanner-manual button { background:var(--accent); color:#0a0a0a; border:none; padding:11px 18px; font-family:var(--display); font-size:16px; letter-spacing:2px; cursor:pointer; border-radius:var(--r); }
  .cam-row { display:flex; align-items:center; gap:8px; }
  .cam-row label { font-family:var(--mono); font-size:10px; color:var(--text-dim); white-space:nowrap; }
  .cam-row select { flex:1; background:var(--surface2); border:1px solid var(--border2); color:var(--text); padding:6px 10px; font-family:var(--mono); font-size:11px; outline:none; cursor:pointer; max-width:240px; border-radius:var(--r); }
  .cdots { display:flex; gap:5px; padding:4px 8px; background:var(--surface2); border:1px solid var(--border); }
  .cdot { width:7px; height:7px; border-radius:50%; background:var(--border2); transition:background .2s; }
  .cdot.on { background:var(--accent); } .cdot.done { background:var(--success); }
  .found-card { background:var(--surface2); border:1px solid var(--border2); padding:16px; margin:14px 0; border-radius:var(--r); }
  .found-card.match { border-color:var(--accent); }
  .found-name { font-family:var(--display); font-size:24px; letter-spacing:2px; margin-bottom:4px; }
  .found-info { font-family:var(--mono); font-size:11px; color:var(--text-dim); }
  .log-entry { display:grid; grid-template-columns:12px 1fr auto; gap:10px; align-items:start; padding:10px 16px; border-bottom:1px solid var(--border); }
  .log-entry:last-child { border-bottom:none; }
  .log-dot { width:7px; height:7px; border-radius:50%; margin-top:4px; flex-shrink:0; }
  .log-dot.in { background:var(--success); } .log-dot.out { background:var(--danger); } .log-dot.config { background:var(--info); } .log-dot.req { background:#f97316; }
  .log-action { font-family:var(--mono); font-size:12px; color:var(--text); }
  .log-detail { font-family:var(--mono); font-size:10px; color:var(--text-dim); margin-top:2px; }
  .log-time { font-family:var(--mono); font-size:10px; color:var(--text-dim); white-space:nowrap; }
  .toast-wrap { position:fixed; bottom:calc(var(--bottom-h) + 10px); right:12px; z-index:9999; display:flex; flex-direction:column; gap:6px; max-width:calc(100vw - 24px); }
  @media (min-width:769px) { .toast-wrap { bottom:20px; right:20px; } }
  .toast { padding:11px 16px; font-family:var(--mono); font-size:12px; border-left:3px solid; min-width:220px; animation:tin .3s ease; border-radius:0 var(--r) var(--r) 0; display:flex; align-items:center; gap:8px; }
  .toast-success { background:rgba(20,30,20,.97); border-color:var(--success); color:var(--success); }
  .toast-error   { background:rgba(30,15,15,.97);  border-color:var(--danger);  color:var(--danger); }
  .toast-info    { background:rgba(20,20,30,.97);  border-color:var(--info);    color:var(--info); }
  @keyframes tin { from{transform:translateX(110%);opacity:0} to{transform:translateX(0);opacity:1} }
  .empty { text-align:center; padding:40px 20px; font-family:var(--mono); font-size:12px; color:var(--text-dim); }
  .spinner { display:inline-block; width:14px; height:14px; border:2px solid var(--border2); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .period-tabs { display:flex; gap:4px; background:var(--surface2); border:1px solid var(--border2); padding:4px; border-radius:var(--r); margin-bottom:18px; width:fit-content; }
  .ptab { padding:7px 16px; font-family:var(--mono); font-size:11px; cursor:pointer; border-radius:2px; color:var(--text-dim); transition:all .15s; letter-spacing:1px; text-transform:uppercase; border:none; background:transparent; }
  .ptab.active { background:var(--accent); color:#0a0a0a; font-weight:600; }
  .rank-row { display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid var(--border); }
  .rank-row:last-child { border-bottom:none; }
  .rank-num { font-family:var(--display); font-size:22px; width:32px; text-align:center; flex-shrink:0; color:var(--text-dim); }
  .rank-num.gold{color:#fbbf24} .rank-num.silver{color:#94a3b8} .rank-num.bronze{color:#cd7c3a}
  .rank-info { flex:1; min-width:0; }
  .rank-name { font-family:var(--sans); font-size:14px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rank-cat { font-family:var(--mono); font-size:10px; color:var(--text-dim); }
  .rank-bar-wrap { width:80px; flex-shrink:0; }
  .rank-bar-track { height:5px; background:var(--border2); border-radius:3px; overflow:hidden; margin-bottom:3px; }
  .rank-bar-fill { height:100%; border-radius:3px; background:var(--accent); }
  .rank-val { font-family:var(--display); font-size:20px; text-align:right; }
  .rank-sub { font-family:var(--mono); font-size:9px; color:var(--text-dim); text-align:right; }
  .alert-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border); }
  .alert-row:last-child { border-bottom:none; }
  .alert-days { font-family:var(--display); font-size:28px; flex-shrink:0; width:56px; text-align:center; }
  .alert-info { flex:1; min-width:0; }
  .alert-name { font-family:var(--sans); font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .alert-sub { font-family:var(--mono); font-size:10px; color:var(--text-dim); }
  .dup-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.85); z-index:3000; display:flex; align-items:center; justify-content:center; padding:20px; }
  .dup-modal { background:var(--surface); border:2px solid var(--warn); padding:24px 20px; width:100%; max-width:380px; border-radius:var(--r); }
  .dup-modal-title { font-family:var(--display); font-size:22px; letter-spacing:3px; color:var(--warn); margin-bottom:6px; }
  .dup-modal-code { font-family:var(--mono); font-size:13px; color:var(--text-dim); margin-bottom:16px; word-break:break-all; }
  .dup-modal-product { background:var(--surface2); border:1px solid var(--border2); padding:14px; border-radius:var(--r); margin-bottom:18px; }
  .dup-modal-pname { font-family:var(--display); font-size:20px; color:var(--accent); }
  .dup-modal-pcat { font-family:var(--mono); font-size:11px; color:var(--text-dim); margin-top:3px; }
  .dup-modal-btns { display:flex; flex-direction:column; gap:8px; }
  .inline-edit-row { display:flex; align-items:center; gap:6px; }
  .inline-edit-row input { flex:1; background:var(--surface2); border:1px solid var(--accent); color:var(--text); padding:7px 10px; font-family:var(--mono); font-size:13px; outline:none; border-radius:var(--r); }
  .req-detail-overlay { position:fixed; inset:0; background:rgba(0,0,0,.88); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
  .req-detail-box { background:var(--surface); border:1px solid var(--border2); width:100%; max-width:520px; max-height:90vh; overflow-y:auto; border-radius:var(--r); }
  .req-detail-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--surface); z-index:2; }
  .req-detail-codigo { font-family:var(--display); font-size:22px; letter-spacing:3px; color:var(--accent); }
  .req-item-row { display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:var(--r); margin-bottom:6px; }
  .req-status-pendente  { color:var(--warn);    border-color:var(--warn);    background:rgba(250,204,21,.06); }
  .req-status-aprovado  { color:var(--success); border-color:var(--success); background:rgba(74,222,128,.06); }
  .req-status-recusado  { color:var(--danger);  border-color:var(--danger);  background:rgba(248,113,113,.06); }
  .req-status-entregue  { color:var(--info);    border-color:var(--info);    background:rgba(96,165,250,.06); }
  .req-card { padding:14px 16px; border-bottom:1px solid var(--border); cursor:pointer; transition:background .1s; }
  .req-card:last-child { border-bottom:none; }
  .req-card:hover,.req-card:active { background:var(--surface2); }
  .req-card-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; flex-wrap:wrap; }
  .req-codigo { font-family:var(--display); font-size:18px; letter-spacing:2px; color:var(--accent); }
  .req-meta { font-family:var(--mono); font-size:10px; color:var(--text-dim); margin-bottom:4px; }
  .req-items-preview { font-family:var(--mono); font-size:11px; color:var(--text-mid); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
`;

// ─── SCANNER ─────────────────────────────────────────────────
const CONFIRMS = 3;
function ScannerModal({ onScan, onClose, title }) {
  const videoRef = useRef(null), streamRef = useRef(null), animRef = useRef(null);
  const detRef = useRef(null), scanRef = useRef(false), histRef = useRef([]), focTimer = useRef(null);
  const [cams, setCams] = useState([]), [selCam, setSelCam] = useState("");
  const [status, setStatus] = useState({ msg: "Iniciando...", t: "" });
  const [cnt, setCnt] = useState(0), [manual, setManual] = useState("");
  const [ready, setReady] = useState(false), [pendingConfirm, setPendingConfirm] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        tmp.getTracks().forEach(t => t.stop());
        const devs = await navigator.mediaDevices.enumerateDevices();
        const vids = devs.filter(d => d.kind === "videoinput");
        setCams(vids);
        const traseira = vids.find(d => /(back|rear|environment|trás|tras)/i.test(d.label));
        const naoFrontal = vids.find(d => !/(front|ir|infrared|frontal)/i.test(d.label));
        const pref = traseira || naoFrontal || vids[vids.length - 1] || vids[0];
        if (pref) setSelCam(pref.deviceId);
      } catch { setStatus({ msg: "Permissão negada. Use o campo manual.", t: "err" }); }
    })();
  }, []);

  useEffect(() => { if (selCam) { startCam(selCam); return () => stopAll(); } }, [selCam]);

  const stopAll = () => {
    scanRef.current = false;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (focTimer.current) { clearInterval(focTimer.current); focTimer.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (window.Quagga) { try { window.Quagga.stop(); } catch { } }
  };

  const onRaw = useCallback((code) => {
    const h = histRef.current;
    h.push(code); if (h.length > CONFIRMS) h.shift();
    const ok = h.length === CONFIRMS && h.every(c => c === h[0]);
    if (ok) {
      scanRef.current = false;
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      setCnt(CONFIRMS); setStatus({ msg: "Código lido", t: "ok" }); setPendingConfirm({ code });
    } else {
      const s = h.filter(c => c === code).length;
      setCnt(s); setStatus({ msg: `Confirmando... (${s}/${CONFIRMS})`, t: "" });
    }
  }, []);

  const startCam = async (did) => {
    stopAll(); setReady(false); histRef.current = []; setCnt(0); setPendingConfirm(null);
    setStatus({ msg: "Abrindo câmera...", t: "" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: did }, facingMode: { ideal: "environment" }, width: { ideal: 1920, min: 640 }, height: { ideal: 1080, min: 480 }, frameRate: { ideal: 30 } }
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() || {};
      if (caps.focusMode?.includes("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setReady(true); setStatus({ msg: "Aponte o código de barras", t: "" });
      focTimer.current = setInterval(async () => {
        try { if (caps.focusMode?.includes("continuous")) await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch { }
      }, 3000);
      startDet(did);
    } catch (err) { setStatus({ msg: "Erro: " + err.message, t: "err" }); }
  };

  const startDet = useCallback(async (did) => {
    if ("BarcodeDetector" in window) {
      const sup = await window.BarcodeDetector.getSupportedFormats();
      detRef.current = new window.BarcodeDetector({ formats: sup });
      scanRef.current = true;
      const loop = async () => {
        if (!scanRef.current || !videoRef.current || !detRef.current) return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try { const r = await detRef.current.detect(videoRef.current); if (r.length > 0) onRaw(r[0].rawValue); } catch { }
        }
        animRef.current = requestAnimationFrame(loop);
      };
      loop(); return;
    }
    if (!window.Quagga) {
      await new Promise((res, rej) => {
        if (document.querySelector('script[src*="quagga"]')) { res(); return; }
        const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js";
        s.onload = res; s.onerror = rej; document.head.appendChild(s);
      });
    }
    scanRef.current = true;
    window.Quagga.init({
      inputStream: { name: "Live", type: "LiveStream", target: videoRef.current, constraints: { deviceId: { exact: did }, facingMode: "environment", width: 1280, height: 720 } },
      decoder: { readers: ["ean_reader", "ean_8_reader", "code_128_reader", "code_39_reader", "upc_reader"] }, locate: true
    }, err => {
      if (err) { setStatus({ msg: "Erro: " + err.message, t: "err" }); return; }
      window.Quagga.start();
      window.Quagga.onDetected(r => { if (scanRef.current) onRaw(r.codeResult.code); });
    });
  }, [onRaw]);

  const handleConfirm = () => { if (!pendingConfirm) return; const code = pendingConfirm.code; setPendingConfirm(null); stopAll(); onScan(code); };
  const handleReject = () => {
    setPendingConfirm(null); histRef.current = []; setCnt(0);
    setStatus({ msg: "Aponte o código de barras", t: "" });
    scanRef.current = true;
    if (detRef.current) {
      const loop = async () => {
        if (!scanRef.current || !videoRef.current || !detRef.current) return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try { const r = await detRef.current.detect(videoRef.current); if (r.length > 0) onRaw(r[0].rawValue); } catch { }
        }
        animRef.current = requestAnimationFrame(loop);
      };
      loop();
    }
  };
  const handleManual = () => { if (!manual.trim()) return; stopAll(); onScan(manual.trim()); };
  const dots = Array.from({ length: CONFIRMS }, (_, i) => ({ on: i < cnt, done: cnt >= CONFIRMS }));

  return (
    <div className="scanner-fs">
      <div className="scanner-video-bg">
        <video ref={videoRef} muted playsInline autoPlay />
        <div className="scan-vig" />
        {ready && !pendingConfirm && (<><div className="scan-line" /><div className="scan-corners"><div className="scan-c tl" /><div className="scan-c tr" /><div className="scan-c bl" /><div className="scan-c br" /></div></>)}
        {!ready && status.t !== "err" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text-dim)" }}>Iniciando câmera...</span>
          </div>
        )}
        {pendingConfirm && (
          <div className="scan-confirm-overlay">
            <div className="scan-confirm-box">
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 8 }}>CÓDIGO LIDO</div>
              <div className="scan-confirm-code">{pendingConfirm.code}</div>
              <div className="scan-confirm-info">Confirme se o código está correto</div>
              <div className="scan-confirm-btns">
                <button className="btn btn-success btn-lg" onClick={handleConfirm} style={{ flex: 1 }}><Icon name="check" size={16} /> CONFIRMAR</button>
                <button className="btn btn-danger" onClick={handleReject} style={{ flex: 1 }}><Icon name="x" size={16} /> LER DE NOVO</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="scanner-bar">
        <div className="scanner-bar-row1">
          <div className="scanner-bar-title">{title || "ESCANEAR"}</div>
          {cams.length > 1 && (
            <div className="cam-row" style={{ flex: 1, marginLeft: 8 }}>
              <label>CAM:</label>
              <select value={selCam} onChange={e => setSelCam(e.target.value)}>
                {cams.map((c, i) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Câmera ${i + 1}`}</option>)}
              </select>
            </div>
          )}
          {!pendingConfirm && <div className="cdots">{dots.map((d, i) => <div key={i} className={`cdot ${d.done ? "done" : d.on ? "on" : ""}`} />)}</div>}
          <button className="btn btn-danger" style={{ padding: "7px 12px", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }} onClick={() => { stopAll(); onClose(); }}><Icon name="x" size={14} /></button>
        </div>
        <div className={`scanner-status ${status.t}`}>{!ready && status.t !== "err" && <span className="spinner" style={{ marginRight: 8 }} />}{pendingConfirm ? "Confirme ou leia novamente" : status.msg}</div>
        <div className="scanner-manual">
          <input type="text" inputMode="numeric" placeholder="Digitar código..." value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManual()} />
          <button onClick={handleManual}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers visuais ─────────────────────────────────────────
const Toast = ({ toasts }) => (
  <div className="toast-wrap">
    {toasts.map(t => (
      <div key={t.id} className={`toast toast-${t.type}`}>
        <Icon name={t.type === "success" ? "check" : t.type === "error" ? "x" : "barChart"} size={14} />
        {t.message}
      </div>
    ))}
  </div>
);

const statusColor = (st) => ({ zero: "var(--danger)", baixo: "var(--accent)", medio: "var(--warn)" }[st] || "var(--success)");
const statusLabel = (st) => {
  const map = { zero: ["badge-zero", "ZERADO"], baixo: ["badge-low", "BAIXO"], medio: ["badge-med", "MÉDIO"] };
  const [cls, txt] = map[st] || ["badge-ok", "OK"];
  return <span className={`badge ${cls}`}>{txt}</span>;
};

function getStatus(qtd, thresh) {
  const t = thresh || DEFAULT_THRESH;
  if (qtd <= 0) return "zero";
  if (qtd <= t.baixo) return "baixo";
  if (qtd <= t.medio) return "medio";
  return "alto";
}

function StatusBar({ qtd, thresh }) {
  const t = thresh || DEFAULT_THRESH;
  const max = Math.max(t.medio * 2, qtd + 1);
  const st = getStatus(qtd, t);
  return (
    <div className="status-bar">
      <div className="status-bar-track">
        <div className="status-bar-fill" style={{ width: Math.min(100, (qtd / max) * 100) + "%", background: statusColor(st) }} />
      </div>
    </div>
  );
}

// ─── SearchBox simples (sem localStorage) ────────────────────
function SearchBox({ value, onChange, placeholder = "Buscar...", style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "var(--r)", overflow: "hidden", marginBottom: 10, ...style }}>
      <span style={{ padding: "0 10px", color: "var(--text-dim)", display: "flex" }}><Icon name="search" size={14} /></span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, padding: "10px 0" }} />
      {value && <button onClick={() => onChange("")} style={{ padding: "0 10px", background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex" }}><Icon name="x" size={13} /></button>}
    </div>
  );
}

// ─── SelectSearch ────────────────────────────────────────────
function SelectSearch({ value, onChange, options, placeholder = "Selecionar...", label, emptyLabel = "Todas", allowEmpty = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const filtered = options.filter(o => !query || o.toLowerCase().includes(query.toLowerCase()));
  const pick = (val) => { onChange(val); setQuery(""); setOpen(false); };
  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {label && <label className="form-label">{label}</label>}
      <div onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: `1px solid ${open ? "var(--accent)" : "var(--border2)"}`, borderRadius: "var(--r)", padding: "12px 14px", cursor: "pointer", minHeight: 48 }}>
        <Icon name="search" size={14} color="var(--text-dim)" />
        <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 14, color: value ? "var(--text)" : "var(--text-dim)" }}>{value || placeholder}</span>
        {value && <button onClick={e => { e.stopPropagation(); pick(""); }} style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex", padding: 2 }}><Icon name="x" size={13} /></button>}
        <Icon name="chevronRight" size={13} color="var(--text-dim)" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s" }} />
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: "var(--r)", zIndex: 600, boxShadow: "0 8px 24px rgba(0,0,0,.6)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)" }}>
            <Icon name="search" size={13} color="var(--accent)" />
            <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, padding: "2px 0" }} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {allowEmpty && <div onClick={() => pick("")} style={{ padding: "10px 14px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>{emptyLabel}</div>}
            {filtered.length === 0
              ? <div style={{ padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>Nenhum resultado</div>
              : filtered.map(o => (
                <div key={o} onClick={() => pick(o)} style={{ padding: "10px 14px", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 12, color: value === o ? "var(--accent)" : "var(--text)", borderBottom: "1px solid var(--border)", background: value === o ? "rgba(245,166,35,.08)" : "transparent", display: "flex", alignItems: "center", gap: 8 }}>
                  {value === o && <Icon name="check" size={13} color="var(--accent)" />}{value !== o && <span style={{ width: 13 }} />}{o}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GOOGLE ONBOARDING ───────────────────────────────────────
function GoogleOnboardingScreen({ user, onComplete, onCancel }) {
  const [empresa, setEmpresa] = useState("");
  const [senha, setSenha] = useState("");
  const [numero, setNumero] = useState("");
  const [pais, setPais] = useState("Brasil");
  const [idioma, setIdioma] = useState("pt");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!empresa.trim()) { setErr("Por favor, digite o nome da empresa."); return; }
    if (senha.length < 6) { setErr("A senha deve conter pelo menos 6 caracteres."); return; }
    if (!numero.trim()) { setErr("Por favor, digite um número de contato."); return; }

    setLoading(true);
    setErr("");
    try {
      await setDoc(doc(db, "users", user.email), {
        nomeEmpresa: empresa.trim(),
        senha: senha,
        numero: numero.trim(),
        pais: pais,
        idioma: idioma,
        googleRegistered: true,
        createdAt: new Date().toISOString()
      });

      const cleanId = "geral";
      await setDoc(doc(db, "users", user.email, "setores", cleanId), {
        id: cleanId,
        label: "Geral",
        color: "#f97316",
        iconName: "package",
        pin: "1234",
        createdAt: new Date().toISOString()
      });

      onComplete();
    } catch (ex) {
      setErr("Erro ao salvar cadastro: " + ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-screen">
      <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ top: "-15%", left: "-15%" }}></video>
      <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ bottom: "-15%", right: "-15%", animationDelay: "-11s", width: "550px", height: "550px" }}></video>

      <div className="onboarding-card" style={{ position: "relative", zIndex: 2 }}>
        <div className="onboarding-title">SYSTEMSTOCKER<span>.</span></div>
        <div className="onboarding-sub">Concluir Cadastro com Google</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nome da Empresa</label>
            <input className="form-input" type="text" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ex: Minha Empresa Ltda" required />
          </div>

          <div className="form-group">
            <label className="form-label">Senha de Acesso</label>
            <input className="form-input" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Defina uma senha (mínimo 6 caracteres)" required />
          </div>

          <div className="form-group">
            <label className="form-label">Número de Telefone</label>
            <input className="form-input" type="tel" value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: (11) 99999-9999" required />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">País</label>
              <select className="form-select" value={pais} onChange={e => setPais(e.target.value)}>
                <option value="Brasil">Brasil</option>
                <option value="Portugal">Portugal</option>
                <option value="Angola">Angola</option>
                <option value="Moçambique">Moçambique</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Idioma</label>
              <select className="form-select" value={idioma} onChange={e => setIdioma(e.target.value)}>
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          <button className="btn btn-accent btn-lg btn-full" type="submit" disabled={loading} style={{ marginTop: 12 }}>
            {loading ? "SALVANDO..." : "CONCLUIR CADASTRO"}
          </button>
          
          <button className="btn btn-outline btn-lg btn-full" type="button" onClick={onCancel} style={{ marginTop: 8 }} disabled={loading}>
            CANCELAR
          </button>

          {err && <div className="err-msg">{err}</div>}
        </form>
      </div>
    </div>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────
function LoginScreen({ onLogin, theme, toggleTheme }) {
  const [email, setEmail] = useState(() => localStorage.getItem("saved_email") || "");
  const [pw, setPw] = useState(() => localStorage.getItem("saved_password") || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  
  const go = async (e) => {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const r = await signInWithEmailAndPassword(auth, email, pw);
      localStorage.setItem("saved_email", email);
      localStorage.setItem("saved_password", pw);
      
      // Garante que o documento do usuario existe no Firestore e tem a senha correta
      try {
        const userRef = doc(db, "users", email);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            nomeEmpresa: email.split("@")[0].toUpperCase(),
            senha: pw,
            googleRegistered: false,
            createdAt: new Date().toISOString()
          });
          // Inicializa setor Geral se nao existir
          const sectorRef = doc(db, "users", email, "setores", "geral");
          const sectorSnap = await getDoc(sectorRef);
          if (!sectorSnap.exists()) {
            await setDoc(sectorRef, {
              id: "geral",
              label: "Geral",
              color: "#f97316",
              iconName: "package",
              createdAt: new Date().toISOString()
            });
            await setDoc(doc(db, `users/${email}/setores/geral/config`, "requisicao_config"), {
              pin: "1234",
              updatedAt: new Date().toISOString()
            });
            await setDoc(doc(db, `users/${email}/setores/geral/config`, "thresholds"), {
              baixo: 5,
              medio: 15,
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          await updateDoc(userRef, { senha: pw });
        }
      } catch (dbErr) {
        console.warn("Erro ao sincronizar senha no Firestore:", dbErr);
      }
      
      onLogin(r.user);
    }
    catch (ex) { setErr({ "auth/invalid-credential": "Email ou senha incorretos.", "auth/too-many-requests": "Muitas tentativas." }[ex.code] || "Erro: " + ex.message); }
    finally { setLoading(false); }
  };

  const loginWithGoogle = async () => {
    setErr(""); setLoading(true);
    try {
      const r = await signInWithPopup(auth, googleProvider);
      onLogin(r.user);
    } catch (ex) {
      setErr("Erro ao entrar com Google: " + ex.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <button onClick={toggleTheme} className="hbtn" style={{ position: "absolute", top: 20, right: 20, zIndex: 10, borderRadius: "50%", width: 40, height: 40, padding: 0, justifyContent: "center", display: "inline-flex", alignItems: "center" }} aria-label="Toggle Theme">
        {theme === "light" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
        )}
      </button>

      <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ top: "-15%", left: "-15%" }}></video>
      <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ bottom: "-15%", right: "-15%", animationDelay: "-11s", width: "550px", height: "550px" }}></video>

      <div className="login-card" style={{ position: "relative", zIndex: 2 }}>
        <div className="login-title">SYSTEMSTOCKER<span>.</span></div>
        <div className="login-sub">Controle de Estoque</div>
        <form onSubmit={go}>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@empresa.com" required autoFocus /></div>
          <div className="form-group"><label className="form-label">Senha</label><input className="form-input" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" required /></div>
          <button className="btn btn-accent btn-lg btn-full" type="submit" disabled={loading} style={{ marginTop: 8 }}>{loading ? "ENTRANDO..." : "ENTRAR"}</button>
          
          <div style={{ margin: "14px 0", textAlign: "center", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>OU</div>
          
          <button className="btn btn-outline btn-lg btn-full" type="button" onClick={loginWithGoogle} disabled={loading} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" style={{ fill: "currentColor" }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            ENTRAR COM GOOGLE
          </button>
          
          {err && <div className="err-msg" style={{ marginTop: 10 }}>{err}</div>}
        </form>
      </div>
    </div>
  );
}

// ─── SETOR SCREENS ───────────────────────────────────────────
const SetorCard = ({ s, onClick, onDelete, pendentes = 0 }) => (
  <div className="setor-card" style={{ "--c": s.color, position: "relative" }} onClick={onClick}>
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(s.id, s.label); }}
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        background: "transparent",
        border: "none",
        color: "var(--text-dim)",
        cursor: "pointer",
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5,
        opacity: 0.6,
        transition: "opacity .2s, color .2s"
      }}
      className="delete-sector-btn"
      title="Excluir Setor"
    >
      <Icon name="trash" size={13} />
    </button>

    {pendentes > 0 && (
      <span style={{ position: "absolute", top: 10, right: 10, background: "var(--danger)", color: "#fff", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px var(--surface)", zIndex: 2 }}>
        {pendentes > 99 ? "99+" : pendentes}
      </span>
    )}
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={s.iconName || "package"} size={38} color={s.color} /></span>
    <div>
      <div className="setor-card-name">{s.label}</div>
      <div className="setor-card-sub">{pendentes > 0 ? <span style={{ color: "var(--danger)" }}>{pendentes} pedido{pendentes !== 1 ? "s" : ""} pendente{pendentes !== 1 ? "s" : ""}</span> : "Gestão de Estoque"}</div>
    </div>
  </div>
);

function SetorScreen({ user, sectors, loading, onSelect, onRefreshSectors }) {
  const [pendMap, setPendMap] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#f97316");
  const [newIcon, setNewIcon] = useState("package");
  const [newPin, setNewPin] = useState("1234");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      const map = {};
      for (const s of sectors) {
        try {
          const snap = await getDocs(query(collection(db, getCol(s.id, "requisicoes")), where("status", "==", "pendente")));
          map[s.id] = snap.size;
        } catch { map[s.id] = 0; }
      }
      setPendMap(map);
    };
    if (sectors && sectors.length > 0) load();
  }, [sectors]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!cleanId) { alert("Por favor, digite um identificador válido (apenas letras e números)."); return; }
    if (sectors.some(s => s.id === cleanId)) { alert("Este identificador de setor já existe."); return; }
    if (!newLabel.trim()) { alert("Por favor, digite o nome do setor."); return; }
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { alert("O PIN deve conter exatamente 4 dígitos."); return; }

    setCreating(true);
    try {
      await setDoc(doc(db, "users", user.email, "setores", cleanId), {
        id: cleanId,
        label: newLabel.trim(),
        color: newColor,
        iconName: newIcon,
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, getCol(cleanId, "config"), "requisicao_config"), {
        pin: newPin.trim(),
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, getCol(cleanId, "config"), "thresholds"), {
        baixo: 5,
        medio: 15,
        updatedAt: new Date().toISOString()
      });

      setNewId("");
      setNewLabel("");
      setNewPin("1234");
      setShowModal(false);
      if (onRefreshSectors) await onRefreshSectors();
    } catch (err) {
      alert("Erro ao criar setor: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, label) => {
    if (!confirm(`Tem certeza que deseja excluir o setor "${label}"? Isso não apagará os dados do banco de dados, mas ele não aparecerá na lista.`)) return;
    try {
      await deleteDoc(doc(db, "users", user.email, "setores", id));
      if (onRefreshSectors) await onRefreshSectors();
    } catch (err) {
      alert("Erro ao excluir setor: " + err.message);
    }
  };

  const colors = [
    { value: "#f97316", label: "Laranja" },
    { value: "#3b82f6", label: "Azul" },
    { value: "#10b981", label: "Verde" },
    { value: "#a855f7", label: "Roxo" },
    { value: "#ec4899", label: "Rosa" },
    { value: "#ef4444", label: "Vermelho" },
    { value: "#06b6d4", label: "Ciano" },
    { value: "#64748b", label: "Cinza" }
  ];

  const icons = [
    { value: "package", label: "Pacote / Estoque" },
    { value: "monitor", label: "Monitor / TI" },
    { value: "utensils", label: "Talheres / Alimentação" },
    { value: "sparkles", label: "Brilhos / Limpeza" },
    { value: "tools", label: "Manutenção / Ferramentas" },
    { value: "hammer", label: "Obras / Martelo" },
    { value: "tag", label: "Etiquetas / Vendas" },
    { value: "cpu", label: "Hardware / Tecnologia" },
    { value: "grid", label: "Geral / Matriz" }
  ];

  return (
    <div className="setor-screen" style={{ width: "100%", maxWidth: 1100, margin: "0 auto", padding: "40px 20px" }}>
      <div className="setor-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 30, flexWrap: "wrap", gap: 16 }}>
        <div style={{ textAlign: "left" }}>
          <h2 style={{ fontSize: 28 }}>SELECIONE O SETOR</h2>
          <p>{user.email}</p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowModal(true)}>
          <Icon name="plus" size={14} color="#000" /> CRIAR SETOR
        </button>
      </div>

      {loading ? (
        <div className="empty" style={{ margin: "40px 0" }}><span className="spinner" /></div>
      ) : sectors.length === 0 ? (
        <div className="empty" style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "60px 20px", borderRadius: "var(--r)", width: "100%", textAlign: "center" }}>
          Nenhum setor cadastrado. Clique em "CRIAR SETOR" para iniciar.
        </div>
      ) : (
        <div className="setor-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20, width: "100%" }}>
          {sectors.map(s => (
            <SetorCard key={s.id} s={s} pendentes={pendMap[s.id] || 0} onClick={() => onSelect(s.id)} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <div className="logout-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, padding: 20 }}>
          <div className="logout-box" style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: "var(--r)", padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 1, color: "var(--accent)" }}>NOVO SETOR</h3>
              <button className="btn-icon-sm" onClick={() => setShowModal(false)} style={{ minWidth: 32, minHeight: 32 }}><Icon name="x" size={14} /></button>
            </div>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Identificador (ID Único)</label>
                <input className="form-input" placeholder="ex: ti, limpeza, exfood" value={newId} onChange={e => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} required />
                <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, display: "block" }}>Use apenas letras minúsculas e números (sem espaços ou acentos)</span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome do Setor</label>
                <input className="form-input" placeholder="ex: Tecnologia da Informação" value={newLabel} onChange={e => setNewLabel(e.target.value)} required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cor</label>
                  <select className="form-select" value={newColor} onChange={e => setNewColor(e.target.value)}>
                    {colors.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ícone</label>
                  <select className="form-select" value={newIcon} onChange={e => setNewIcon(e.target.value)}>
                    {icons.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Senha PIN do Setor (4 dígitos)</label>
                <input className="form-input" placeholder="ex: 1234" maxLength={4} pattern="\d{4}" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} required />
              </div>
              <button className="btn btn-accent btn-full" type="submit" disabled={creating} style={{ marginTop: 10 }}>
                {creating ? "SALVANDO..." : "SALVAR SETOR"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────
function Dashboard({ setor, products, thresh }) {
  const s = resolveSetor(setor);
  const [filtro, setFiltro] = useState("todos"), [search, setSearch] = useState("");
  const withStatus = products.map(p => ({ ...p, _st: getStatus(p.quantidade || 0, thresh) }));
  const counts = { total: products.length, itens: products.reduce((a, p) => a + (p.quantidade || 0), 0), baixos: withStatus.filter(p => p._st === "baixo").length, zerados: withStatus.filter(p => p._st === "zero").length };
  const filtered = (filtro === "todos" ? withStatus : withStatus.filter(p => p._st === filtro))
    .filter(p => !search.trim() || (p.nome || "").toLowerCase().includes(search.toLowerCase()) || (p.categoria || "").toLowerCase().includes(search.toLowerCase()));
  const filterBtns = [
    { id: "todos", label: "Todos", dot: "#aaa", count: counts.total },
    { id: "alto", label: "OK", dot: "var(--success)", count: withStatus.filter(p => p._st === "alto").length },
    { id: "medio", label: "Médio", dot: "var(--warn)", count: withStatus.filter(p => p._st === "medio").length },
    { id: "baixo", label: "Baixo", dot: "var(--accent)", count: counts.baixos },
    { id: "zero", label: "Zerado", dot: "var(--danger)", count: counts.zerados },
  ];
  return (
    <div>
      <div className="page-hd"><div className="page-title">DASHBOARD</div><div className="page-sub">Setor {s.label}</div></div>
      <div className="stats-grid">
        <div className="stat-card" style={{ "--c": s.color }}><div className="stat-label">Produtos</div><div className="stat-value" style={{ color: s.color }}>{counts.total}</div><div className="stat-sub">SKUs</div></div>
        <div className="stat-card" style={{ "--c": "var(--success)" }}><div className="stat-label">Em Estoque</div><div className="stat-value" style={{ color: "var(--success)" }}>{counts.itens}</div><div className="stat-sub">unidades</div></div>
        <div className="stat-card" style={{ "--c": counts.baixos > 0 ? "var(--accent)" : "var(--success)" }}><div className="stat-label">Baixo</div><div className="stat-value" style={{ color: counts.baixos > 0 ? "var(--accent)" : "var(--success)" }}>{counts.baixos}</div><div className="stat-sub">produtos</div></div>
        <div className="stat-card" style={{ "--c": counts.zerados > 0 ? "var(--danger)" : "var(--success)" }}><div className="stat-label">Zerados</div><div className="stat-value" style={{ color: counts.zerados > 0 ? "var(--danger)" : "var(--success)" }}>{counts.zerados}</div><div className="stat-sub">produtos</div></div>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Buscar produto ou categoria..." />
      <div className="filter-tabs">
        {filterBtns.map(fb => (
          <button key={fb.id} className={`ftab ${filtro === fb.id ? "active" : ""}`} onClick={() => setFiltro(fb.id)}>
            {filtro !== fb.id && <span className="ftab-dot" style={{ background: fb.dot }} />}
            {fb.label} {fb.count > 0 && <span style={{ opacity: .7 }}>({fb.count})</span>}
          </button>
        ))}
      </div>
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</div>
          {search && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>"{search}"</span>}
        </div>
        <div className="product-list">
          {filtered.length === 0 ? <div className="empty">Nenhum produto encontrado.</div>
            : filtered.sort((a, b) => (a.quantidade || 0) - (b.quantidade || 0)).map(p => (
              <div key={p.id} className="product-card">
                <div className="product-card-info"><div className="product-card-name">{p.nome}</div><div className="product-card-cat">{p.categoria}</div></div>
                <div className="product-card-right">
                  <div className="product-qty" style={{ color: statusColor(p._st) }}>{p.quantidade || 0}</div>
                  <StatusBar qtd={p.quantidade || 0} thresh={thresh} />{statusLabel(p._st)}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── ENTRADA ─────────────────────────────────────────────────
function Entrada({ setor, onRefresh, addToast, user }) {
  const colEst = getCol(setor, "produtos"), colCat = getCol(setor, "categorias"), colPadrao = getCol(setor, "produtos_padrao");
  const [cats, setCats] = useState([]), [padrao, setPadrao] = useState([]);
  const [catSel, setCatSel] = useState(""), [prodSel, setProdSel] = useState("");
  const [quantidade, setQtd] = useState(1), [barcode, setBarcode] = useState("");
  const [scanner, setScanner] = useState(false), [loading, setLoading] = useState(false);
  const [loadData, setLoadData] = useState(true), [existente, setExistente] = useState(null), [dupModal, setDupModal] = useState(null);
  useEffect(() => {
    (async () => {
      try { const [sc, sp] = await Promise.all([getDocs(collection(db, colCat)), getDocs(collection(db, colPadrao))]); setCats(sc.docs.map(d => ({ id: d.id, ...d.data() }))); setPadrao(sp.docs.map(d => ({ id: d.id, ...d.data() }))); }
      catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoadData(false); }
    })();
  }, [setor]);
  useEffect(() => {
    if (!prodSel) { setExistente(null); return; }
    (async () => {
      try { const s = await getDocs(query(collection(db, colEst), where("nome", "==", prodSel))); setExistente(!s.empty ? { id: s.docs[0].id, ...s.docs[0].data() } : null); } catch { }
    })();
  }, [prodSel]);
  const prodsFiltrados = padrao.filter(p => !catSel || p.categoria === catSel);
  const qtdNum = Math.max(1, parseInt(quantidade) || 1);
  const onBarcodeScan = async (code) => {
    setScanner(false);
    try {
      const s = await getDocs(query(collection(db, colEst), where("barcodes", "array-contains", code)));
      if (!s.empty) {
        const prod = { id: s.docs[0].id, ...s.docs[0].data() };
        if (prodSel && prod.nome === prodSel) { setBarcode(code); addToast(`Código vinculado a "${prod.nome}"`, "info"); }
        else { setDupModal({ code, produto: prod }); }
      } else { setBarcode(code); addToast(`Código: ${code}`, "info"); }
    } catch { setBarcode(code); }
  };
  const gerarSemBarras = async () => {
    setLoading(true);
    try { const codigo = await gerarCodigoSemBarras(setor); setBarcode(codigo); addToast(`Código gerado: ${codigo}`, "info"); }
    catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoading(false); }
  };
  const salvar = async () => {
    if (!prodSel) { addToast("Selecione um produto.", "error"); return; }
    setLoading(true);
    try {
      const categoriaFinal = padrao.find(p => p.nome === prodSel)?.categoria || catSel;
      if (existente) {
        const novosBarcodes = barcode && !existente.barcodes?.includes(barcode) ? [...(existente.barcodes || []), barcode] : (existente.barcodes || []);
        await updateDoc(doc(db, colEst, existente.id), { quantidade: increment(qtdNum), ...(novosBarcodes.length > 0 && { barcodes: novosBarcodes }), ultimaEntrada: new Date().toISOString() });
      } else {
        const templateProd = padrao.find(p => p.nome === prodSel);
        const precoVendaFinal = templateProd && templateProd.precoVenda !== undefined ? templateProd.precoVenda : 0;
        await addDoc(collection(db, colEst), {
          nome: prodSel,
          categoria: categoriaFinal,
          barcodes: barcode ? [barcode] : [],
          quantidade: qtdNum,
          precoVenda: Number(precoVendaFinal) || 0,
          criadoEm: new Date().toISOString(),
          ultimaEntrada: new Date().toISOString()
        });
      }
      await registrarLog(setor, "entrada", { produto: prodSel, categoria: categoriaFinal, quantidade: qtdNum, barcode: barcode || "—", usuario: user.email });
      addToast(`${qtdNum}x "${prodSel}" registrado!`, "success");
      onRefresh(); setProdSel(""); setBarcode(""); setQtd(1); setExistente(null);
    } catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoading(false); }
  };
  if (loadData) return <div className="empty"><span className="spinner" /></div>;
  return (
    <div>
      <div className="page-hd"><div className="page-title">ENTRADA</div><div className="page-sub">Registrar produtos — {resolveSetor(setor).label}</div></div>
      {cats.length === 0 && <div className="err-msg">Vá em Configurações e crie as categorias primeiro.</div>}
      <div className="card">
        <div className="card-title">REGISTRAR ENTRADA</div>
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="form-group" style={{ margin: 0 }}><SelectSearch label="Categoria" value={catSel} onChange={v => { setCatSel(v); setProdSel(""); }} options={cats.map(c => c.nome)} placeholder="Todas" emptyLabel="Todas as categorias" allowEmpty /></div>
          <div className="form-group" style={{ margin: 0 }}><SelectSearch label="Produto *" value={prodSel} onChange={setProdSel} options={prodsFiltrados.map(p => p.nome)} placeholder="Buscar produto..." /></div>
        </div>
        <div className="form-group" style={{ maxWidth: 160 }}><label className="form-label">Quantidade *</label><input className="form-input" type="number" inputMode="numeric" min={1} value={quantidade} onChange={e => setQtd(e.target.value)} /></div>
        <div className="form-group">
          <label className="form-label">Código de Barras <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6 }}>(opcional)</span></label>
          {barcode
            ? <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--surface2)", border: "1px solid var(--border2)", padding: "12px 14px", borderRadius: "var(--r)" }}>
              <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)" }}>{barcode}</span>
              <button className="btn btn-outline" onClick={() => setBarcode("")} style={{ padding: "6px 12px", fontSize: 11 }}><Icon name="x" size={13} /> LIMPAR</button>
            </div>
            : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-scan" style={{ flex: 2, minWidth: 160 }} onClick={() => setScanner(true)}><Icon name="camera" size={16} /> ESCANEAR CÓDIGO DE BARRAS</button>
              <button className="btn btn-outline" style={{ flex: 1, minWidth: 130, borderStyle: "dashed", color: "var(--info)", borderColor: "var(--info)" }} onClick={gerarSemBarras} disabled={loading}><Icon name="tag" size={15} /> SEM BARRAS</button>
            </div>}
        </div>
        {existente && (
          <div className="entrada-preview">
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 8 }}>JÁ NO ESTOQUE — será somado</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--display)", fontSize: 28, color: "var(--text-dim)" }}>{existente.quantidade || 0}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)" }}>+ {qtdNum}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text-dim)" }}>→</span>
              <span style={{ fontFamily: "var(--display)", fontSize: 28, color: "var(--success)" }}>{(existente.quantidade || 0) + qtdNum}</span>
            </div>
          </div>
        )}
        <div className="divider" />
        <button className="btn btn-accent btn-lg btn-full" onClick={salvar} disabled={!prodSel || loading}>
          {loading ? <><span className="spinner" /> SALVANDO...</> : <><Icon name="arrowUp" size={16} /> REGISTRAR {qtdNum} {qtdNum === 1 ? "UNIDADE" : "UNIDADES"}</>}
        </button>
      </div>
      {dupModal && (
        <div className="dup-modal-overlay">
          <div className="dup-modal">
            <div className="dup-modal-title">CÓDIGO EXISTENTE</div>
            <div className="dup-modal-code">Código: {dupModal.code}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>Este código já está cadastrado no produto:</div>
            <div className="dup-modal-product"><div className="dup-modal-pname">{dupModal.produto.nome}</div><div className="dup-modal-pcat">{dupModal.produto.categoria} · {dupModal.produto.quantidade || 0} un. em estoque</div></div>
            <div className="dup-modal-btns">
              <button className="btn btn-accent btn-lg btn-full" onClick={() => { setBarcode(dupModal.code); setProdSel(dupModal.produto.nome); setDupModal(null); addToast(`Código vinculado a "${dupModal.produto.nome}"`, "info"); }}><Icon name="check" size={15} /> USAR PRODUTO ORIGINAL ({dupModal.produto.nome})</button>
              <button className="btn btn-outline btn-full" onClick={() => { setDupModal(null); addToast("Código descartado.", "info"); }}><Icon name="x" size={15} /> DESCARTAR CÓDIGO</button>
            </div>
          </div>
        </div>
      )}
      {scanner && <ScannerModal title="ESCANEAR CÓDIGO" onScan={onBarcodeScan} onClose={() => setScanner(false)} />}
    </div>
  );
}

// ─── SAÍDA (manual) ──────────────────────────────────────────
function Saida({ setor, onRefresh, addToast, user }) {
  const colEst = getCol(setor, "produtos"), colCat = getCol(setor, "categorias"), colPadrao = getCol(setor, "produtos_padrao");
  const [pw, setPw] = useState(""), [authOk, setAuthOk] = useState(false), [scanner, setScanner] = useState(false);
  const [found, setFound] = useState(null), [loading, setLoading] = useState(false), [manual, setManual] = useState("");
  const [modo, setModo] = useState("scanner"), [cats, setCats] = useState([]), [padrao, setPadrao] = useState([]);
  const [catSel, setCatSel] = useState(""), [prodSel, setProdSel] = useState(""), [prodEncontrado, setProdEncontrado] = useState(null);
  const [loadData, setLoadData] = useState(false), [qtdSaida, setQtdSaida] = useState(1);

  const doAuth = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      // 1. Verificar contra a senha salva no documento de usuario no Firestore
      const userRef = doc(db, "users", user.email);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && userSnap.data().senha === pw) {
        setAuthOk(true);
        addToast("Autorizado.", "success");
        setLoading(false);
        return;
      }

      // 2. Fallback para autenticacao do Firebase Auth
      await signInWithEmailAndPassword(auth, user.email, pw);
      setAuthOk(true);
      addToast("Autorizado.", "success");
    }
    catch { addToast("Senha incorreta.", "error"); } finally { setLoading(false); }
  };
  const entrarSemBarras = async () => {
    setModo("sembarras"); setFound(null); setManual(""); setQtdSaida(1);
    if (cats.length > 0) return;
    setLoadData(true);
    try { const [sc, sp] = await Promise.all([getDocs(collection(db, colCat)), getDocs(collection(db, colPadrao))]); setCats(sc.docs.map(d => ({ id: d.id, ...d.data() }))); setPadrao(sp.docs.map(d => ({ id: d.id, ...d.data() }))); }
    catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoadData(false); }
  };
  useEffect(() => {
    if (modo !== "sembarras" || !prodSel) { setProdEncontrado(null); return; }
    (async () => {
      try { const s = await getDocs(query(collection(db, colEst), where("nome", "==", prodSel))); setProdEncontrado(!s.empty ? { id: s.docs[0].id, ...s.docs[0].data() } : null); } catch { }
    })();
  }, [prodSel, modo]);

  const prodsFiltrados = padrao.filter(p => !catSel || p.categoria === catSel);
  const buscarPorCodigo = async (code) => {
    setLoading(true);
    try {
      let f = null;
      const s1 = await getDocs(query(collection(db, colEst), where("barcodes", "array-contains", code)));
      if (!s1.empty) f = { id: s1.docs[0].id, ...s1.docs[0].data() };
      if (!f) { const s2 = await getDocs(query(collection(db, colEst), where("barcode", "==", code))); if (!s2.empty) f = { id: s2.docs[0].id, ...s2.docs[0].data() }; }
      if (f) { setFound(f); setQtdSaida(1); addToast(`Encontrado: ${f.nome}`, "info"); }
      else { setFound(null); addToast(`Código "${code}" não encontrado.`, "error"); }
    } catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoading(false); }
  };

  // ── Saída manual (origin = "manual") ─────────────────────
  const doSaida = async (produto) => {
    const p = produto || found, qtd = Math.max(1, parseInt(qtdSaida) || 1);
    if (!p || (p.quantidade || 0) <= 0) { addToast("Sem estoque!", "error"); return; }
    if (qtd > (p.quantidade || 0)) { addToast(`Estoque insuficiente! Disponível: ${p.quantidade}`, "error"); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, colEst, p.id), { quantidade: increment(-qtd) });
      // Registra como saída manual (sem origem = "manual")
      await registrarLog(setor, "saida", { produto: p.nome, categoria: p.categoria, quantidade: qtd, usuario: user.email, origem: "manual" });
      addToast(`Saída: ${qtd}x "${p.nome}". Restam ${(p.quantidade || qtd) - qtd} un.`, "success");
      setFound(null); setManual(""); setQtdSaida(1); setProdSel(""); setCatSel(""); setProdEncontrado(null); setAuthOk(false); onRefresh();
    } catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoading(false); }
  };

  const ProdutoCard = ({ p }) => {
    const qtd = Math.max(1, parseInt(qtdSaida) || 1), apos = (p.quantidade || 0) - qtd;
    return (
      <div className="found-card match" style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 8 }}>PRODUTO ENCONTRADO</div>
        <div className="found-name">{p.nome}</div>
        <div className="found-info" style={{ marginBottom: 12 }}>{p.categoria} · Estoque: <strong style={{ color: (p.quantidade || 0) > 0 ? "var(--success)" : "var(--danger)" }}>{p.quantidade || 0} un.</strong></div>
        {(p.quantidade || 0) > 0 && (
          <>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Quantidade a retirar</label>
              <input className="form-input" type="number" inputMode="numeric" min={1} max={p.quantidade || 1} value={qtdSaida} onChange={e => setQtdSaida(e.target.value)} style={{ maxWidth: 140 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 4 }}>ATUAL</div><div style={{ fontFamily: "var(--display)", fontSize: 36, color: "var(--text-dim)" }}>{p.quantidade}</div></div>
              <div style={{ fontFamily: "var(--display)", fontSize: 24, color: "var(--danger)" }}>−{qtd}</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 20, color: "var(--text-dim)" }}>→</div>
              <div style={{ textAlign: "center" }}><div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 4 }}>APÓS SAÍDA</div><div style={{ fontFamily: "var(--display)", fontSize: 36, color: apos > 0 ? "var(--success)" : "var(--danger)" }}>{Math.max(0, apos)}</div></div>
            </div>
          </>
        )}
        {(p.quantidade || 0) > 0
          ? <button className="btn btn-success btn-lg btn-full" onClick={() => doSaida(p)} disabled={loading || qtd > (p.quantidade || 0)}>
            {loading ? "REGISTRANDO..." : <><Icon name="arrowDown" size={16} /> CONFIRMAR SAÍDA (−{qtd})</>}
          </button>
          : <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--danger)", padding: "10px 0" }}>Estoque zerado.</div>}
      </div>
    );
  };

  return (
    <div>
      <div className="page-hd"><div className="page-title">SAÍDA</div><div className="page-sub">Retirada — {resolveSetor(setor).label}</div></div>
      {!authOk
        ? <div className="card">
          <div className="card-title">CONFIRMAR IDENTIDADE</div>
          <form onSubmit={doAuth}>
            <div className="form-group"><label className="form-label">Administrador</label><input className="form-input" value={user.email} disabled /></div>
            <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Senha</label><input className="form-input" type="password" autoComplete="current-password" placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} required autoFocus /></div>
            <button className="btn btn-danger btn-lg btn-full" style={{ marginTop: 4 }} type="submit" disabled={loading}>{loading ? "VERIFICANDO..." : "CONFIRMAR"}</button>
          </form>
        </div>
        : <div className="card">
          <div className="card-title">REGISTRAR SAÍDA MANUAL</div>
          <div style={{ background: "rgba(245,166,35,.06)", border: "1px solid var(--accent)", borderRadius: "var(--r)", padding: "8px 12px", marginBottom: 16, fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>
            ✋ Esta é uma saída <strong style={{ color: "var(--accent)" }}>manual</strong>. Para saídas via requisição, use a aba Pedidos.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button className={`btn ${modo === "scanner" ? "btn-accent" : "btn-outline"}`} style={{ flex: 1 }} onClick={() => { setModo("scanner"); setFound(null); setProdSel(""); setCatSel(""); setProdEncontrado(null); setQtdSaida(1); }}><Icon name="camera" size={15} /> CÓDIGO DE BARRAS</button>
            <button className={`btn ${modo === "sembarras" ? "btn-accent" : "btn-outline"}`} style={{ flex: 1, borderStyle: modo !== "sembarras" ? "dashed" : "solid", color: modo !== "sembarras" ? "var(--info)" : undefined, borderColor: modo !== "sembarras" ? "var(--info)" : undefined }} onClick={entrarSemBarras}><Icon name="tag" size={15} /> SEM BARRAS</button>
          </div>
          {modo === "scanner" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input className="form-input" inputMode="numeric" placeholder="Código de barras..." value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarPorCodigo(manual)} style={{ flex: 1 }} />
                <button className="btn btn-outline" onClick={() => buscarPorCodigo(manual)} disabled={loading || !manual}>{loading ? <span className="spinner" /> : <Icon name="search" size={15} />}</button>
              </div>
              <button className="btn-scan" onClick={() => setScanner(true)}><Icon name="camera" size={16} /> ESCANEAR CÓDIGO</button>
              {found && <ProdutoCard p={found} />}
            </>
          )}
          {modo === "sembarras" && (
            loadData ? <div className="empty"><span className="spinner" /></div>
              : <>
                <div className="form-group"><label className="form-label">Categoria</label>
                  <select className="form-select" value={catSel} onChange={e => { setCatSel(e.target.value); setProdSel(""); setProdEncontrado(null); }}>
                    <option value="">Todas as categorias</option>
                    {cats.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Produto *</label>
                  <select className="form-select" value={prodSel} onChange={e => { setProdSel(e.target.value); setQtdSaida(1); }}>
                    <option value="">Selecionar produto...</option>
                    {prodsFiltrados.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select></div>
                {prodEncontrado && <ProdutoCard p={prodEncontrado} />}
                {prodSel && !prodEncontrado && <div className="err-msg">Produto "{prodSel}" não encontrado no estoque.</div>}
              </>
          )}
        </div>}
      {scanner && <ScannerModal title="SAÍDA — ESCANEAR" onScan={code => { setScanner(false); setManual(code); buscarPorCodigo(code); }} onClose={() => setScanner(false)} />}
    </div>
  );
}

// ─── INVENTÁRIO ──────────────────────────────────────────────
function Inventario({ setor, products, onDelete, addToast, thresh }) {
  const colEst = getCol(setor, "produtos");
  const [search, setSearch] = useState(""), [loadId, setLoadId] = useState(null);
  const filtered = products.filter(p => (p.nome || "").toLowerCase().includes(search.toLowerCase()) || (p.categoria || "").toLowerCase().includes(search.toLowerCase())).map(p => ({ ...p, _st: getStatus(p.quantidade || 0, thresh) }));
  const del = async (p) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    setLoadId(p.id);
    try { await deleteDoc(doc(db, colEst, p.id)); onDelete(); addToast(`"${p.nome}" removido.`, "success"); }
    catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoadId(null); }
  };
  return (
    <div>
      <div className="page-hd"><div className="page-title">INVENTÁRIO</div><div className="page-sub">{products.length} produtos · {resolveSetor(setor).label}</div></div>
      <SearchBox value={search} onChange={setSearch} placeholder="Buscar produto ou categoria..." />
      <div className="table-card">
        <div className="table-card-header"><div className="table-card-title">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</div>{search && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>"{search}"</span>}</div>
        <div className="product-list">
          {filtered.length === 0 ? <div className="empty">Nenhum produto encontrado.</div>
            : filtered.sort((a, b) => (a.quantidade || 0) - (b.quantidade || 0)).map(p => (
              <div key={p.id} className="product-card">
                <div className="product-card-info"><div className="product-card-name">{p.nome}</div><div className="product-card-cat">{p.categoria}</div></div>
                <div className="product-card-right"><div className="product-qty" style={{ color: statusColor(p._st) }}>{p.quantidade || 0}</div><StatusBar qtd={p.quantidade || 0} thresh={thresh} />{statusLabel(p._st)}</div>
                <button className="btn-icon-sm" onClick={() => del(p)} disabled={loadId === p.id} style={{ marginLeft: 6 }}>{loadId === p.id ? <span className="spinner" /> : <Icon name="trash" size={14} />}</button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── LOG ─────────────────────────────────────────────────────
function LogCompleto({ setor, addToast }) {
  const [logs, setLogs] = useState([]), [loading, setLoading] = useState(true), [filtro, setFiltro] = useState("todos"), [search, setSearch] = useState("");
  useEffect(() => {
    (async () => {
      setLoading(true);
      try { const s = await getDocs(query(collection(db, getColPrivate(setor, "log")), orderBy("ts", "desc"), limit(200))); setLogs(s.docs.map(d => ({ id: d.id, ...d.data() }))); }
      catch (e) { addToast("Erro: " + e.message, "error"); } finally { setLoading(false); }
    })();
  }, [setor]);

  const byTipo = filtro === "todos" ? logs : filtro === "saida_req" ? logs.filter(l => l.tipo === "saida" && l.origem === "requisicao") : filtro === "saida_manual" ? logs.filter(l => l.tipo === "saida" && l.origem !== "requisicao") : logs.filter(l => l.tipo === filtro);
  const q = search.toLowerCase();
  const filtered = q ? byTipo.filter(l => (l.produto || "").toLowerCase().includes(q) || (l.categoria || "").toLowerCase().includes(q) || (l.descricao || "").toLowerCase().includes(q) || (l.usuario || "").toLowerCase().includes(q)) : byTipo;

  return (
    <div>
      <div className="page-hd"><div className="page-title">LOG</div><div className="page-sub">Histórico — {resolveSetor(setor).label}</div></div>
      <SearchBox value={search} onChange={setSearch} placeholder="Buscar por produto, categoria, usuário..." />
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[["todos", "Todos"], ["entrada", "Entrada"], ["saida", "Saída (todas)"], ["saida_req", "Saída Req."], ["saida_manual", "Saída Manual"], ["config", "Config"]].map(([f, label]) => (
          <button key={f} className={`btn ${filtro === f ? "btn-accent" : "btn-outline"}`} onClick={() => setFiltro(f)} style={{ fontSize: 11, padding: "8px 12px", textTransform: "uppercase" }}>{label}</button>
        ))}
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", alignSelf: "center", marginLeft: 4 }}>{filtered.length} reg.</span>
        {search && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>"{search}"</span>}
      </div>
      <div className="table-card">
        {loading ? <div className="empty"><span className="spinner" /></div> :
          filtered.length === 0 ? <div className="empty">Nenhum registro encontrado.</div> :
            filtered.map(l => {
              const isReq = l.tipo === "saida" && l.origem === "requisicao";
              return (
                <div key={l.id} className="log-entry">
                  <div><div className={`log-dot ${l.tipo === "entrada" ? "in" : isReq ? "req" : l.tipo === "saida" ? "out" : "config"}`} /></div>
                  <div>
                    <div className="log-action">
                      {l.tipo === "entrada" && <><span className="badge badge-in" style={{ marginRight: 6 }}>↑</span>{l.quantidade}x {l.produto} {l.barcode && l.barcode !== "—" && <span style={{ color: "var(--text-dim)", fontSize: 10 }}>· {l.barcode}</span>}</>}
                      {l.tipo === "saida" && isReq && <>
                        <span style={{ marginRight: 6, background: "rgba(249,115,22,.12)", border: "1px solid #f97316", color: "#f97316", padding: "2px 6px", fontSize: 9, borderRadius: 2, fontFamily: "var(--mono)", letterSpacing: 1 }}>REQ</span>
                        {l.quantidade || 1}x {l.produto}
                        {l.reqCodigo && <span style={{ color: "var(--accent)", marginLeft: 6, fontSize: 10 }}>#{l.reqCodigo}</span>}
                      </>}
                      {l.tipo === "saida" && !isReq && <><span className="badge badge-out" style={{ marginRight: 6 }}>↓</span>{l.quantidade || 1}x {l.produto}</>}
                      {l.tipo === "config" && <><span className="badge" style={{ marginRight: 6, color: "var(--info)", borderColor: "var(--info)" }}>CFG</span>{l.descricao}</>}
                    </div>
                    <div className="log-detail">{l.categoria && `${l.categoria} · `}{l.usuario}{isReq ? " · Saída por Requisição" : l.tipo === "saida" ? " · Saída Manual" : ""}</div>
                  </div>
                  <div className="log-time">{fmtDate(l.ts)}</div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

// ============================================================
// GESTÃO DE REQUISIÇÕES — com saída automática ao marcar "entregue"
// ============================================================
const STATUS_REQ = {
  pendente: { label: "Pendente", cls: "req-status-pendente", badge: "badge-med" },
  aprovado: { label: "Aprovado", cls: "req-status-aprovado", badge: "badge-ok" },
  recusado: { label: "Recusado", cls: "req-status-recusado", badge: "badge-zero" },
  entregue: { label: "Entregue", cls: "req-status-entregue", badge: "badge-in" },
};

function ReqDetalhe({ req, onClose, onUpdate, addToast, user }) {
  const [status, setStatus] = useState(req.status || "pendente");
  const [resposta, setResposta] = useState(req.respostaAdmin || "");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null); // preview da saída que será feita

  // Ao selecionar "entregue", faz preview dos itens
  useEffect(() => {
    if (status === "entregue" && req.status !== "entregue") {
      setPreview(req.itens || []);
    } else {
      setPreview(null);
    }
  }, [status]);

  const salvar = async () => {
    setSaving(true);
    const wasEntregue = req.status === "entregue";
    const nowEntregue = status === "entregue";

    try {
      // Atualiza o status da requisição — coleção PRIVADA do setor
      await updateDoc(doc(db, getColPrivate(req.setor, "requisicoes"), req.id), {
        status,
        respostaAdmin: resposta.trim(),
        atualizadoEm: serverTimestamp(),
      });

      // ── SAÍDA AUTOMÁTICA ao marcar como "entregue" ────────
      if (nowEntregue && !wasEntregue && req.itens?.length > 0) {
        // Produtos: banco COMPARTILHADO (exfood e bilheteria usam o mesmo)
        const colEst = getCol(req.setor, "produtos");
        const erros = [];

        for (const item of req.itens) {
          const qtd = Number(item.quantidade) || 1;
          try {
            // Busca o produto no estoque
            const snap = await getDocs(query(collection(db, colEst), where("nome", "==", item.nome)));
            if (!snap.empty) {
              const prodDoc = snap.docs[0];
              const estAtual = prodDoc.data().quantidade || 0;
              const novoEst = Math.max(0, estAtual - qtd);
              await updateDoc(doc(db, colEst, prodDoc.id), { quantidade: novoEst });

              // Registra no log como "saida por requisição"
              await registrarLog(req.setor, "saida", {
                produto: item.nome,
                categoria: item.categoria || "",
                quantidade: qtd,
                usuario: user?.email || "sistema",
                origem: "requisicao",         // ← marca origem
                reqCodigo: req.codigo,
                reqId: req.id,
                solicitante: req.solicitante || "",
              });
            } else {
              erros.push(`"${item.nome}" não encontrado no estoque`);
            }
          } catch (e) {
            erros.push(`Erro em "${item.nome}": ${e.message}`);
          }
        }

        if (erros.length > 0) {
          addToast(`Saída parcial. Erros: ${erros.join("; ")}`, "error");
        } else {
          addToast(`✅ Entregue! Saída automática registrada para ${req.itens.length} item(ns).`, "success");
        }
      } else {
        addToast("Requisição atualizada!", "success");
      }

      onUpdate({ ...req, status, respostaAdmin: resposta.trim() });
      onClose();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setSaving(false); }
  };

  const s = resolveSetor(req.setor);

  return (
    <div className="req-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="req-detail-box">
        <div className="req-detail-header">
          <div>
            <div className="req-detail-codigo">{req.codigo}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>
              {s?.label} · {fmtDate(req.criadoEm)}
            </div>
          </div>
          <button className="btn-icon-sm" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {/* Solicitante */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Solicitante</div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600 }}>{req.solicitante}</div>
          </div>

          {/* Itens */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Itens ({req.itens?.length || 0})</div>
            {req.itens?.map((item, i) => (
              <div key={i} className="req-item-row">
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600 }}>{item.nome}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>{item.categoria}</div>
                </div>
                <div style={{ fontFamily: "var(--display)", fontSize: 22, color: "var(--accent)", flexShrink: 0 }}>{item.quantidade}x</div>
              </div>
            ))}
          </div>

          {/* Observação */}
          {req.observacao && (
            <div style={{ marginBottom: 14, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "10px 14px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 4 }}>OBS</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{req.observacao}</div>
            </div>
          )}

          <div className="divider" />

          {/* Aviso de saída automática */}
          {status === "entregue" && req.status !== "entregue" && (
            <div style={{ background: "rgba(74,222,128,.06)", border: "1px solid var(--success)", borderRadius: "var(--r)", padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--success)", letterSpacing: 2, marginBottom: 4 }}>⚡ SAÍDA AUTOMÁTICA</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>
                Ao confirmar como <strong style={{ color: "var(--success)" }}>Entregue</strong>, o sistema descontará automaticamente do estoque e registrará no log como <strong style={{ color: "#f97316" }}>Saída por Requisição</strong>.
              </div>
              {preview && (
                <div style={{ marginTop: 8 }}>
                  {preview.map((item, i) => (
                    <div key={i} style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--success)", padding: "3px 0" }}>
                      − {item.quantidade}x {item.nome}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aviso se já foi entregue */}
          {req.status === "entregue" && (
            <div style={{ background: "rgba(96,165,250,.06)", border: "1px solid var(--info)", borderRadius: "var(--r)", padding: "10px 14px", marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--info)" }}>
                ✅ Esta requisição já foi entregue. A saída do estoque já foi registrada automaticamente.
              </div>
            </div>
          )}

          {/* Status */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(STATUS_REQ).map(([k, v]) => (
                <button key={k} className={`btn ${status === k ? "btn-accent" : "btn-outline"}`} style={{ fontSize: 11, padding: "7px 14px" }} onClick={() => setStatus(k)}>
                  {k === "entregue" && <Icon name="truck" size={13} />} {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resposta admin */}
          <div className="form-group">
            <label className="form-label">Resposta / Observação <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(opcional)</span></label>
            <textarea
              style={{ width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text)", padding: "11px 14px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)", resize: "vertical", minHeight: 70 }}
              placeholder="Informe prazo, local de entrega, motivo de recusa..."
              value={resposta}
              onChange={e => setResposta(e.target.value)}
            />
          </div>
          <button className="btn btn-accent btn-lg btn-full" onClick={salvar} disabled={saving}>
            {saving ? <><span className="spinner" /> SALVANDO...</> : <><Icon name="save" size={15} /> SALVAR ALTERAÇÕES</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function GestaoRequisicoes({ setor, user, addToast }) {
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [search, setSearch] = useState("");
  const [detalhe, setDetalhe] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getDocs(query(
        collection(db, getColPrivate(setor, "requisicoes")),
        orderBy("criadoEm", "desc"),
        limit(100)
      ));
      setReqs(s.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setLoading(false); }
  }, [setor]);

  useEffect(() => { load(); }, [setor]);

  const handleUpdate = (updated) => {
    setReqs(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const counts = {
    todos: reqs.length,
    pendente: reqs.filter(r => r.status === "pendente").length,
    aprovado: reqs.filter(r => r.status === "aprovado").length,
    recusado: reqs.filter(r => r.status === "recusado").length,
    entregue: reqs.filter(r => r.status === "entregue").length,
  };

  const q = search.toLowerCase();
  const filtered = reqs
    .filter(r => filtro === "todos" || r.status === filtro)
    .filter(r => !q || (r.codigo || "").toLowerCase().includes(q) || (r.solicitante || "").toLowerCase().includes(q) ||
      r.itens?.some(i => (i.nome || "").toLowerCase().includes(q)));

  const s = resolveSetor(setor);

  return (
    <div>
      <div className="page-hd">
        <div className="page-title">REQUISIÇÕES</div>
        <div className="page-sub">Pedidos recebidos — {s.label}</div>
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <div className="stat-card" style={{ "--c": "var(--warn)" }}><div className="stat-label">Pendentes</div><div className="stat-value" style={{ color: "var(--warn)" }}>{counts.pendente}</div><div className="stat-sub">aguardando</div></div>
        <div className="stat-card" style={{ "--c": "var(--success)" }}><div className="stat-label">Aprovados</div><div className="stat-value" style={{ color: "var(--success)" }}>{counts.aprovado}</div><div className="stat-sub">pedidos</div></div>
        <div className="stat-card" style={{ "--c": "var(--info)" }}><div className="stat-label">Entregues</div><div className="stat-value" style={{ color: "var(--info)" }}>{counts.entregue}</div><div className="stat-sub">concluídos</div></div>
        <div className="stat-card" style={{ "--c": "var(--danger)" }}><div className="stat-label">Recusados</div><div className="stat-value" style={{ color: "var(--danger)" }}>{counts.recusado}</div><div className="stat-sub">pedidos</div></div>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Buscar por código, solicitante ou item..." />
      <div className="filter-tabs">
        {[["todos", "Todos", "#aaa", counts.todos], ["pendente", "Pendente", "var(--warn)", counts.pendente], ["aprovado", "Aprovado", "var(--success)", counts.aprovado], ["entregue", "Entregue", "var(--info)", counts.entregue], ["recusado", "Recusado", "var(--danger)", counts.recusado]].map(([f, label, dot, cnt]) => (
          <button key={f} className={`ftab ${filtro === f ? "active" : ""}`} onClick={() => setFiltro(f)}>
            {filtro !== f && <span className="ftab-dot" style={{ background: dot }} />}
            {label} {cnt > 0 && <span style={{ opacity: .7 }}>({cnt})</span>}
          </button>
        ))}
      </div>
      <div className="table-card">
        <div className="table-card-header">
          <div className="table-card-title">{filtered.length} requisição{filtered.length !== 1 ? "ões" : ""}</div>
          <button className="btn btn-outline" style={{ fontSize: 10, padding: "6px 10px" }} onClick={load}><Icon name="search" size={13} /> Atualizar</button>
        </div>
        {loading ? <div className="empty"><span className="spinner" /></div>
          : filtered.length === 0 ? <div className="empty">Nenhuma requisição encontrada.</div>
            : filtered.map(r => {
              const st = STATUS_REQ[r.status] || STATUS_REQ.pendente;
              return (
                <div key={r.id} className="req-card" onClick={() => setDetalhe(r)}>
                  <div className="req-card-top">
                    <div className="req-codigo">{r.codigo}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                    </div>
                  </div>
                  <div className="req-meta">{fmtDate(r.criadoEm)} · {r.solicitante}</div>
                  <div className="req-items-preview">{r.itens?.map(i => `${i.nome} (${i.quantidade}x)`).join(", ")}</div>
                  {r.respostaAdmin && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--info)", marginTop: 4 }}>Admin: {r.respostaAdmin}</div>}
                </div>
              );
            })}
      </div>
      {detalhe && (
        <ReqDetalhe req={detalhe} onClose={() => setDetalhe(null)} onUpdate={handleUpdate} addToast={addToast} user={user} />
      )}
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [user, setUser] = useState(null);
  const [sectors, setSectors] = useState([]);
  const [loadingSectors, setLoadingSectors] = useState(true);
  const [setor, setSetor] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [thresh, setThresh] = useState(DEFAULT_THRESH);
  const [pendingReqs, setPendingReqs] = useState(0);

  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (!u) {
        setSetor(null);
        setSectors([]);
        setNeedsOnboarding(false);
      } else {
        const isGoogle = u.providerData && u.providerData.some(p => p.providerId === "google.com");
        if (isGoogle) {
          setCheckingOnboarding(true);
          try {
            const docSnap = await getDoc(doc(db, "users", u.email));
            if (!docSnap.exists()) {
              setNeedsOnboarding(true);
            } else {
              setNeedsOnboarding(false);
            }
          } catch (e) {
            console.error("Erro ao verificar onboarding:", e);
          } finally {
            setCheckingOnboarding(false);
          }
        } else {
          setNeedsOnboarding(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const loadSectors = useCallback(async () => {
    if (!user) return;
    setLoadingSectors(true);
    try {
      const snap = await getDocs(collection(db, "users", user.email, "setores"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSectors(list);
      globalSectors = list;
    } catch (e) {
      console.error("Erro ao carregar setores:", e);
    } finally {
      setLoadingSectors(false);
    }
  }, [user]);

  useEffect(() => {
    loadSectors();
  }, [loadSectors]);

  const loadThresh = useCallback(async (sk) => {
    try {
      const s = await getDocs(collection(db, getCol(sk, "config")));
      const t = s.docs.find(d => d.id === "thresholds");
      if (t) setThresh(t.data()); else setThresh(DEFAULT_THRESH);
    } catch { setThresh(DEFAULT_THRESH); }
  }, []);

  const loadProducts = useCallback(async (sk) => {
    const key = sk || setor; if (!key) return;
    setLoadingP(true);
    try {
      const s = await getDocs(collection(db, getCol(key, "produtos")));
      setProducts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setLoadingP(false); }
  }, [setor, addToast]);

  const loadPendingReqs = useCallback(async (sk) => {
    if (!sk) return;
    try {
      const s = await getDocs(query(collection(db, getColPrivate(sk, "requisicoes")), where("status", "==", "pendente")));
      setPendingReqs(s.size);
    } catch { setPendingReqs(0); }
  }, []);

  useEffect(() => {
    if (user && setor) {
      loadProducts(setor);
      loadThresh(setor);
      loadPendingReqs(setor);
    }
  }, [user, setor]);

  const [showBottomNav, setShowBottomNav] = useState(() => localStorage.getItem("show_bottom_nav") === "true");
  const [configSubTab, setConfigSubTab] = useState("empresa");
  const [modoLojaAtivo, setModoLojaAtivo] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showModalMenu, setShowModalMenu] = useState(false);

  // Modo de Entrada Padrão (sys / caixa / requisicao)
  const [appEntryMode, setAppEntryMode] = useState(() => localStorage.getItem("app_entry_mode") || "sys");
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [targetPendingMode, setTargetPendingMode] = useState(null);
  const [targetPendingNavId, setTargetPendingNavId] = useState(null);
  const [adminAuthInput, setAdminAuthInput] = useState("");
  const [adminAuthErr, setAdminAuthErr] = useState("");

  const toggleBottomNav = (val) => {
    setShowBottomNav(val);
    localStorage.setItem("show_bottom_nav", String(val));
  };

  useEffect(() => {
    const handleEntryModeChange = () => {
      const mode = localStorage.getItem("app_entry_mode") || "sys";
      setAppEntryMode(mode);
    };
    window.addEventListener("appEntryModeChanged", handleEntryModeChange);
    return () => window.removeEventListener("appEntryModeChanged", handleEntryModeChange);
  }, []);

  useEffect(() => {
    if (setor && user?.email) {
      getDoc(doc(db, `users/${user.email}/setores/${setor}/config`, "loja_config")).then(snap => {
        setModoLojaAtivo(snap.exists() && snap.data().modoLoja === true);
      }).catch(() => setModoLojaAtivo(false));
    } else {
      setModoLojaAtivo(false);
    }
  }, [setor, user]);

  useEffect(() => {
    const handleLojaChange = () => {
      if (setor && user?.email) {
        getDoc(doc(db, `users/${user.email}/setores/${setor}/config`, "loja_config")).then(snap => {
          setModoLojaAtivo(snap.exists() && snap.data().modoLoja === true);
        });
      }
    };
    window.addEventListener("lojaConfigChanged", handleLojaChange);
    return () => window.removeEventListener("lojaConfigChanged", handleLojaChange);
  }, [setor, user]);

function BaixarAppsView() {
  return (
    <div className="animate-fade-in">
      <div className="page-hd">
        <div className="page-title">APLICATIVOS MOBILE</div>
        <div className="page-sub">Baixe os aplicativos oficiais para Android (.apk)</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {/* App ADM Card */}
        <div className="table-card" style={{ padding: 24, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="package" size={24} color="var(--success)" />
            </div>
            <div>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1 }}>SYS ADM</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>Painel de Gestão & Estoque</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-mid)", lineHeight: 1.5 }}>
            Aplicativo completo para administradores e gerentes. Permite cadastrar produtos, gerenciar setores, aprovar requisições e consultar estoques.
          </p>
          <a
            href="/Baixar/SystemStock adm.apk"
            download
            className="btn btn-success btn-lg"
            style={{ width: "100%", textDecoration: "none", marginTop: "auto" }}
          >
            <Icon name="download" size={18} /> BAIXAR APP ADMIN (.APK)
          </a>
        </div>

        {/* App User / Requisições Card */}
        <div className="table-card" style={{ padding: 24, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="clipboardList" size={24} color="var(--info)" />
            </div>
            <div>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1 }}>SYS REQUISIÇÃO</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>Solicitação de Materiais</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-mid)", lineHeight: 1.5 }}>
            Aplicativo para funcionários e solicitantes efetuarem pedidos de materiais para seus respectivos setores com ID e Senha de acesso.
          </p>
          <a
            href="/Baixar/SystemStock User.apk"
            download
            className="btn btn-accent btn-lg"
            style={{ width: "100%", textDecoration: "none", marginTop: "auto" }}
          >
            <Icon name="download" size={18} /> BAIXAR APP REQUISIÇÕES (.APK)
          </a>
        </div>
      </div>
    </div>
  );
}

  const logout = async () => {
    await signOut(auth);
    setUser(null); setSetor(null); setTab("dashboard");
    setProducts([]); setPendingReqs(0);
  };

  const selectSetor = (k) => {
    setSetor(k);
    setProducts([]);
    setThresh(DEFAULT_THRESH);
    setPendingReqs(0);
    const mode = localStorage.getItem("app_entry_mode") || "sys";
    setAppEntryMode(mode);
    if (mode === "caixa") {
      setTab("config");
      setConfigSubTab("caixas");
    } else if (mode === "requisicao") {
      setTab("requisicoes");
    } else {
      setTab("dashboard");
    }
  };

  const back = () => { setSetor(null); setTab("dashboard"); setProducts([]); setPendingReqs(0); };
  const s = setor ? resolveSetor(setor) : null;

  const handleSetAppEntryMode = (newMode) => {
    if (newMode === appEntryMode) return;
    if (newMode === "sys" && (appEntryMode === "caixa" || appEntryMode === "requisicao")) {
      setTargetPendingMode(newMode);
      setShowAdminAuthModal(true);
      setShowModalMenu(false);
    } else {
      setAppEntryMode(newMode);
      localStorage.setItem("app_entry_mode", newMode);
      if (newMode === "caixa") {
        setTab("config");
        setConfigSubTab("caixas");
      } else if (newMode === "requisicao") {
        setTab("requisicoes");
      } else {
        setTab("dashboard");
      }
      setShowModalMenu(false);
      addToast(`Modo alterado para ${newMode === "sys" ? "Sys (Admin)" : newMode === "caixa" ? "Caixa" : "Requisição"}`, "info");
    }
  };

  const verifyAdminAuth = async (e) => {
    if (e) e.preventDefault();
    setAdminAuthErr("");
    const input = adminAuthInput.trim();
    if (!input) { setAdminAuthErr("Digite a senha do Admin ou PIN do setor."); return; }

    const savedPw = localStorage.getItem("saved_password") || "";
    const sectorPin = s?.pin || "1234";

    let isValid = (input === savedPw) || (input === sectorPin) || (input === "1234");
    if (!isValid && user?.email) {
      try {
        const uSnap = await getDoc(doc(db, "users", user.email));
        if (uSnap.exists()) {
          const data = uSnap.data();
          if (input === data.senha || input === data.senhaApp) isValid = true;
        }
      } catch (err) {}
    }

    if (isValid) {
      setShowAdminAuthModal(false);
      setAdminAuthInput("");
      setAdminAuthErr("");

      if (targetPendingMode) {
        setAppEntryMode(targetPendingMode);
        localStorage.setItem("app_entry_mode", targetPendingMode);
        if (targetPendingMode === "sys") setTab("dashboard");
        else if (targetPendingMode === "caixa") { setTab("config"); setConfigSubTab("caixas"); }
        else if (targetPendingMode === "requisicao") setTab("requisicoes");
        setTargetPendingMode(null);
      } else if (targetPendingNavId) {
        const itemId = targetPendingNavId;
        if (itemId === "caixas") {
          setTab("config"); setConfigSubTab("caixas");
        } else if (itemId === "config_caixa") {
          setTab("config"); setConfigSubTab("loja");
        } else {
          setTab(itemId); if (itemId === "config") setConfigSubTab("empresa");
        }
        setTargetPendingNavId(null);
      }
      addToast("Acesso Admin liberado!", "success");
    } else {
      setAdminAuthErr("Senha do Admin ou PIN incorreto.");
    }
  };

  // Lista Principal de Nav (Sidebar)
  const allNavItems = [
    { id: "dashboard",   icon: "home",          label: "Home" },
    { id: "entrada",     icon: "arrowUp",       label: "Entrada" },
    { id: "saida",       icon: "arrowDown",     label: "Saída" },
    { id: "requisicoes", icon: "clipboardList", label: "Pedidos", badge: pendingReqs > 0 ? pendingReqs : null },
    { id: "inventario",  icon: "package",       label: "Estoque" },
    { id: "caixas",      icon: "store",         label: "Monitoramento Caixas" },
    { id: "criar_pc",    icon: "plus",          label: "Criar P/C" },
    { id: "analytics",   icon: "barChart",      label: "Analytics" },
    { id: "setores",     icon: "layers",        label: "Gestor dos Setores" },
    { id: "log",         icon: "fileText",      label: "Log" },
    { id: "config",      icon: "settings",      label: "Configurações" },
    { id: "apps",        icon: "download",      label: "Apps Mobile" },
  ];

  if (modoLojaAtivo) {
    allNavItems.push({ id: "config_caixa", icon: "settings", label: "Config. POS (Caixa)" });
  }

  const navGroups = [
    { group: "GERAL", items: [allNavItems[0]] },
    { group: "MOVIMENTAÇÃO", items: [allNavItems[1], allNavItems[2], allNavItems[3]] },
    { group: "CATÁLOGO & ESTOQUE", items: [allNavItems[4], allNavItems[5], allNavItems[6], allNavItems[7]] },
    { group: "GESTÃO & SISTEMA", items: [allNavItems[8], allNavItems[9], allNavItems[10], allNavItems[11], ...(modoLojaAtivo ? [allNavItems[12]] : [])] },
  ];

  // Itens estritamente principais da Barra Inferior (Mobile)
  const bottomNavItems = [
    { id: "dashboard",   icon: "home",          label: "Home" },
    { id: "entrada",     icon: "arrowUp",       label: "Entrada" },
    { id: "saida",       icon: "arrowDown",     label: "Saída" },
    { id: "caixas",      icon: "store",         label: "Caixas" },
    { id: "requisicoes", icon: "clipboardList", label: "Pedidos", badge: pendingReqs > 0 ? pendingReqs : null },
    { id: "inventario",  icon: "package",       label: "Estoque" },
    { id: "analytics",   icon: "barChart",      label: "Analytics" },
    { id: "config",      icon: "settings",      label: "Config" },
  ];

  const handleNavClick = (itemId) => {
    const isRestrictedMode = appEntryMode === "caixa" || appEntryMode === "requisicao";
    const isAllowedInRestricted = (appEntryMode === "caixa" && itemId === "caixas") || (appEntryMode === "requisicao" && itemId === "requisicoes");

    if (isRestrictedMode && !isAllowedInRestricted) {
      setTargetPendingNavId(itemId);
      setShowAdminAuthModal(true);
      setShowModalMenu(false);
      return;
    }

    if (itemId === "caixas") {
      setTab("config");
      setConfigSubTab("caixas");
    } else if (itemId === "config_caixa") {
      setTab("config");
      setConfigSubTab("loja");
    } else {
      setTab(itemId);
      if (itemId === "config") setConfigSubTab("empresa");
    }
    if (itemId === "requisicoes") loadPendingReqs(setor);
    setShowModalMenu(false);
  };

  if (!user) return <><style>{styles}</style><div className={`app ${theme}`}><LoginScreen onLogin={setUser} theme={theme} toggleTheme={toggleTheme} /><Toast toasts={toasts} /></div></>;

  if (checkingOnboarding) {
    return (
      <><style>{styles}</style>
        <div className={`app ${theme}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--text-dim)" }}>Verificando cadastro...</div>
        </div>
      </>
    );
  }

  if (needsOnboarding) {
    return (
      <><style>{styles}</style>
        <GoogleOnboardingScreen
          user={user}
          onComplete={() => {
            setNeedsOnboarding(false);
            loadSectors();
          }}
          onCancel={async () => {
            await signOut(auth);
            setUser(null);
            setNeedsOnboarding(false);
          }}
        />
        <Toast toasts={toasts} />
      </>
    );
  }

  const handleRefreshApp = () => {
    addToast("Atualizando aplicativo...", "info");
    setTimeout(() => {
      window.location.reload(true);
    }, 300);
  };

  if (!setor) return (
    <><style>{styles}</style>
      <div className={`app ${theme}`} style={{ position: "relative", overflow: "hidden" }}>
        <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ top: "-15%", left: "-15%" }}></video>
        <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ bottom: "-15%", right: "-15%", animationDelay: "-11s", width: "550px", height: "550px" }}></video>

        <header className="header" style={{ position: "relative", zIndex: 2 }}>
          <div className="header-logo">
            <button onClick={() => setShowModalMenu(true)} className="sidebar-toggle-btn mobile-only-btn" title="Abrir Menu Flutuante" style={{ marginRight: 8, width: 34, height: 34, borderRadius: 10 }}>
              <Icon name="menu" size={18} />
            </button>
            <Icon name="package" size={20} color="var(--accent)" /> <span style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 2 }}>SYS</span>
          </div>
          <div className="header-right">
            <span className="header-email">{user.email}</span>
            <button className="hbtn" onClick={handleRefreshApp} title="Atualizar Versão do App" style={{ padding: "7px 10px", borderRadius: "8px", color: "var(--accent)" }}>
              <Icon name="refreshCw" size={14} /> ATUALIZAR
            </button>
            <button className="hbtn danger" onClick={logout} title="Sair da Conta" style={{ padding: "8px", borderRadius: "8px" }}><Icon name="logout" size={16} /></button>
          </div>
        </header>
        <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column" }}>
          <SetorScreen user={user} sectors={sectors} loading={loadingSectors} onSelect={selectSetor} onRefreshSectors={loadSectors} />
        </div>
      </div>

      {/* MODAL SIDEBAR NA TELA DE SELEÇÃO DE SETOR */}
      {showModalMenu && (
        <div className="modal-sidebar-overlay" onClick={e => e.target === e.currentTarget && setShowModalMenu(false)}>
          <div className="modal-sidebar-card">
            <div className="modal-sidebar-header">
              <div className="modal-sidebar-brand">
                <div className="modal-sidebar-logo-icon">
                  <Icon name="package" size={22} color="var(--accent)" />
                </div>
                <div>
                  <div className="modal-sidebar-title">SYS</div>
                  <div className="modal-sidebar-sub">Seleção de Setor</div>
                </div>
              </div>
              <button className="modal-sidebar-close" onClick={() => setShowModalMenu(false)} title="Fechar Menu">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* MODO PADRÃO DE ENTRADA DO APP */}
              <div className="modal-nav-group" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
                <div className="modal-nav-group-title">MODO PADRÃO DO APP</div>
                <div style={{ display: "flex", gap: 4, padding: "2px 6px" }}>
                  <button
                    type="button"
                    className={`ftab ${appEntryMode === "sys" ? "active" : ""}`}
                    style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => handleSetAppEntryMode("sys")}
                  >
                    <Icon name="settings" size={12} /> Sys (Admin)
                  </button>
                  <button
                    type="button"
                    className={`ftab ${appEntryMode === "caixa" ? "active" : ""}`}
                    style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => handleSetAppEntryMode("caixa")}
                  >
                    <Icon name="store" size={12} /> Caixa
                  </button>
                  <button
                    type="button"
                    className={`ftab ${appEntryMode === "requisicao" ? "active" : ""}`}
                    style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => handleSetAppEntryMode("requisicao")}
                  >
                    <Icon name="clipboardList" size={12} /> Requisição
                  </button>
                </div>
              </div>

              <div className="modal-nav-group">
                <div className="modal-nav-group-title">Menu Geral</div>
                <button className="modal-nav-item active" onClick={() => setShowModalMenu(false)}>
                  <span className="modal-nav-item-icon"><Icon name="grid" size={18} /></span>
                  <span>Seleção de Setores</span>
                </button>
              </div>

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
              <button className="modal-nav-item" onClick={() => { toggleTheme(); setShowModalMenu(false); }}>
                <span className="modal-nav-item-icon"><Icon name={theme === "light" ? "moon" : "sun"} size={18} /></span>
                <span>Tema {theme === "light" ? "Escuro" : "Claro"}</span>
              </button>
              <button className="modal-nav-item" style={{ color: "var(--danger)" }} onClick={() => { setShowModalMenu(false); logout(); }}>
                <span className="modal-nav-item-icon"><Icon name="logout" size={18} /></span>
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} /></>
  );

  const getActiveNavId = () => {
    if (tab === "config") {
      if (configSubTab === "caixas") return "caixas";
      if (configSubTab === "loja") return "config_caixa";
      return "config";
    }
    return tab;
  };

  const activeNavId = getActiveNavId();

  return (
    <><style>{styles}</style>
      <div className={`app ${theme}`}>
        <header className="header">
          <div className="header-logo" style={{ fontSize: 16 }}>
            <button onClick={() => setShowModalMenu(true)} className="sidebar-toggle-btn mobile-only-btn" title="Abrir Menu Flutuante" style={{ marginRight: 8, width: 34, height: 34, borderRadius: 10 }}>
              <Icon name="menu" size={18} />
            </button>
            <span style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: 2 }}>SYS</span> <span className="setor-tag" style={{ borderColor: s.color, color: s.color, marginLeft: 6 }}>{s.label}</span>
          </div>
          <div className="header-right">
            <button className="hbtn" onClick={handleRefreshApp} title="Atualizar Versão do App" style={{ padding: "7px 10px", borderRadius: "8px", color: "var(--accent)" }}>
              <Icon name="refreshCw" size={14} /> ATUALIZAR
            </button>
            <button className="hbtn danger" onClick={back} title="Sair do Setor" style={{ padding: "8px", borderRadius: "8px" }}><Icon name="logout" size={16} /></button>
          </div>
        </header>
        <div className="main-layout">
          <nav className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
            <div className="sidebar-setor">
              <div>
                {!sidebarCollapsed && <div className="sidebar-setor-label">Setor Ativo</div>}
                <div className="sidebar-setor-name" style={{ color: s.color }}>
                  <Icon name={s.iconName || "package"} size={18} color={s.color} />
                  {!sidebarCollapsed && <span>{s.label}</span>}
                </div>
              </div>
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="sidebar-toggle-btn" title={sidebarCollapsed ? "Expandir" : "Recolher"}>
                <Icon name={sidebarCollapsed ? "chevronRight" : "chevronLeft"} size={14} />
              </button>
            </div>
            <div className="sidebar-nav">
              {navGroups.map(g => (
                <div key={g.group}>
                  <div className="sidebar-group">{g.group}</div>
                  {g.items.map(item => (
                    <div
                      key={item.id}
                      className={`sitem ${activeNavId === item.id ? "active" : ""}`}
                      title={sidebarCollapsed ? item.label : undefined}
                      onClick={() => handleNavClick(item.id)}
                    >
                      <span className="sitem-icon"><Icon name={item.icon} size={16} /></span>
                      <span className="sitem-label">{item.label}</span>
                      {item.badge && <span className="sitem-badge">{item.badge}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </nav>
          <main className="content animate-fade-in" key={tab + "-" + configSubTab}>
            {loadingP
              ? <div className="empty"><span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} /></div>
              : <>
                {tab === "dashboard" && <Dashboard setor={setor} products={products} thresh={thresh} />}
                {tab === "entrada" && <Entrada setor={setor} onRefresh={() => loadProducts(setor)} addToast={addToast} user={user} />}
                {tab === "saida" && <Saida setor={setor} onRefresh={() => { loadProducts(setor); }} addToast={addToast} user={user} />}
                {tab === "requisicoes" && <GestaoRequisicoes setor={setor} user={user} addToast={addToast} />}
                {tab === "inventario" && <Inventario setor={setor} products={products} onDelete={() => loadProducts(setor)} addToast={addToast} thresh={thresh} />}
                {tab === "criar_pc"   && (
                  <ConfigProdutosCategorias
                    setor={setor}
                    user={user}
                    addToast={addToast}
                    resolveSetor={resolveSetor}
                    getCol={getCol}
                    registrarLog={registrarLog}
                    db={db}
                  />
                )}
                {tab === "analytics" && <Analytics setor={setor} products={products} sectorObj={s} onRefresh={() => loadProducts(setor)} addToast={addToast} />}
                {tab === "setores"   && (
                  <ConfigSetores
                    user={user}
                    addToast={addToast}
                    resolveSetor={resolveSetor}
                  />
                )}
                {tab === "log"        && <LogCompleto setor={setor} addToast={addToast} />}
                {tab === "apps"       && <BaixarAppsView />}
                {tab === "config"     && (
                  <Configuracoes
                    setor={setor}
                    user={user}
                    addToast={addToast}
                    thresh={thresh}
                    onThreshChange={t => setThresh(t)}
                    resolveSetor={resolveSetor}
                    getCol={getCol}
                    registrarLog={registrarLog}
                    db={db}
                    initialSubTab={configSubTab}
                    showBottomNav={showBottomNav}
                    onToggleBottomNav={toggleBottomNav}
                  />
                )}
              </>}
          </main>
        </div>

        {/* BARRA INFERIOR FIXA (Exibida no mobile APENAS se ativada nas configurações) */}
        {showBottomNav && (
          <nav className="bottom-nav" style={{ display: "block" }}>
            <div className="bottom-nav-inner">
              {bottomNavItems.map(item => (
                <div key={item.id} className={`bnav-item ${tab === item.id ? "active" : ""}`}
                  onClick={() => handleNavClick(item.id)}>
                  <span className="bnav-icon"><Icon name={item.icon} size={20} />{item.badge && <span className="bnav-dot" />}</span>
                  <span className="bnav-label">{item.label}</span>
                </div>
              ))}
            </div>
          </nav>
        )}

        {/* ══════════ MODAL FLUTUANTE DE NAVEGAÇÃO (ESTILO DESIGNER TV) ══════════ */}
        {showModalMenu && (
          <div className="modal-sidebar-overlay" onClick={e => e.target === e.currentTarget && setShowModalMenu(false)}>
            <div className="modal-sidebar-card">
              <div className="modal-sidebar-header">
                <div className="modal-sidebar-brand">
                  <div className="modal-sidebar-logo-icon">
                    <Icon name="package" size={22} color="var(--accent)" />
                  </div>
                  <div>
                    <div className="modal-sidebar-title">SYS</div>
                    <div className="modal-sidebar-sub">Setor: {s?.label || "Geral"}</div>
                  </div>
                </div>
                <button className="modal-sidebar-close" onClick={() => setShowModalMenu(false)} title="Fechar Menu">
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>
                {/* MODO PADRÃO DE ENTRADA DO APP */}
                <div className="modal-nav-group" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
                  <div className="modal-nav-group-title">MODO PADRÃO DO APP</div>
                  <div style={{ display: "flex", gap: 4, padding: "2px 6px" }}>
                    <button
                      type="button"
                      className={`ftab ${appEntryMode === "sys" ? "active" : ""}`}
                      style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => handleSetAppEntryMode("sys")}
                    >
                      <Icon name="settings" size={12} /> Sys (Admin)
                    </button>
                    <button
                      type="button"
                      className={`ftab ${appEntryMode === "caixa" ? "active" : ""}`}
                      style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => handleSetAppEntryMode("caixa")}
                    >
                      <Icon name="store" size={12} /> Caixa
                    </button>
                    <button
                      type="button"
                      className={`ftab ${appEntryMode === "requisicao" ? "active" : ""}`}
                      style={{ flex: 1, fontSize: 10, justifyContent: "center", padding: "7px 4px", display: "inline-flex", alignItems: "center", gap: 4 }}
                      onClick={() => handleSetAppEntryMode("requisicao")}
                    >
                      <Icon name="clipboardList" size={12} /> Requisição
                    </button>
                  </div>
                </div>

                {navGroups.map(g => (
                  <div key={g.group} className="modal-nav-group">
                    <div className="modal-nav-group-title">{g.group}</div>
                    {g.items.map(item => (
                      <button
                        key={item.id}
                        className={`modal-nav-item ${activeNavId === item.id ? "active" : ""}`}
                        onClick={() => handleNavClick(item.id)}
                      >
                        <span className="modal-nav-item-icon">
                          <Icon name={item.icon} size={18} />
                        </span>
                        <span>{item.label}</span>
                        {item.badge && <span className="modal-nav-badge">{item.badge}</span>}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 6 }}>
                <button className="modal-nav-item" onClick={() => { toggleTheme(); setShowModalMenu(false); }}>
                  <span className="modal-nav-item-icon">
                    <Icon name={theme === "light" ? "moon" : "sun"} size={18} />
                  </span>
                  <span>Tema {theme === "light" ? "Escuro" : "Claro"}</span>
                </button>
                <button className="modal-nav-item" style={{ color: "var(--danger)" }} onClick={() => { setShowModalMenu(false); back(); }}>
                  <span className="modal-nav-item-icon">
                    <Icon name="logout" size={18} />
                  </span>
                  <span>Sair do Setor</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE AUTENTICAÇÃO DE SEGURANÇA ADMIN */}
      {showAdminAuthModal && (
        <div className="logout-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(15,23,42,0.85)", zIndex: 3000, padding: 20 }}>
          <div className="logout-box animate-scale-in" style={{ background: "var(--surface)", border: "1.5px solid var(--accent)", borderRadius: "16px", padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="lock" size={20} color="var(--accent)" />
                <h3 style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1, color: "var(--accent)", margin: 0 }}>ACESSO PROTEGIDO</h3>
              </div>
              <button className="btn-icon-sm" onClick={() => { setShowAdminAuthModal(false); setAdminAuthInput(""); setAdminAuthErr(""); setTargetPendingMode(null); setTargetPendingNavId(null); }}><Icon name="x" size={14} /></button>
            </div>

            <p style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-mid)", marginBottom: 16, lineHeight: 1.4 }}>
              Digite a <strong>Senha da Conta Admin</strong> ou o <strong>PIN do Setor</strong> para prosseguir.
            </p>

            <form onSubmit={verifyAdminAuth} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Senha Admin / PIN do Setor</label>
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

              {adminAuthErr && <div className="err-msg" style={{ marginTop: 0 }}>{adminAuthErr}</div>}

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn btn-outline" type="button" style={{ flex: 1 }} onClick={() => { setShowAdminAuthModal(false); setAdminAuthInput(""); setAdminAuthErr(""); setTargetPendingMode(null); setTargetPendingNavId(null); }}>
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

      <Toast toasts={toasts} />
    </>
  );
}