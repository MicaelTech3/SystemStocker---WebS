/**
 * Caixa.jsx — Frente de Caixa / POS para Vendas
 * v2 — Suporta multi-tenancy por empresa no link (?empresa=email)
 * Integrado com abertura/fechamento de caixa, fiado e scanner persistente
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, getDoc,
  setDoc, query, where, updateDoc, increment, serverTimestamp, deleteDoc, onSnapshot
} from "firebase/firestore";

const params = new URLSearchParams(window.location.search);
const empresaId = params.get("empresa") || "default";

const getCol = (sector, type) => `users/${empresaId}/setores/${sector}/${type}`;

// Emojis for sectors
const getEmojiForIcon = (iconName) => {
  const mapping = {
    monitor: "🖥️", utensils: "🍽️", sparkles: "✨", broom: "🧹",
    wrench: "🔧", tools: "🔧", hammer: "🔨", home: "🏠",
    package: "📦", tag: "🎟️", cpu: "💻", grid: "📊", clipboardList: "📋"
  };
  return mapping[iconName] || "📦";
};

// CSS
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  :root {
    --bg:#f5f2e9; --surface:#ffffff; --surface2:#e9e4d4;
    --border:#dfd9c4; --border2:#ccc4a8;
    --accent:#f97316; --accent2:#ea580c;
    --success:#10b981; --danger:#ef4444; --info:#3b82f6; --warn:#f59e0b;
    --text:#292524; --text-dim:#78716c; --text-mid:#57534e;
    --mono:'IBM Plex Mono',monospace; --sans:'IBM Plex Sans',sans-serif; --display:'Bebas Neue',sans-serif;
    --r:6px;
  }
  .dark {
    --bg:#0c0a09; --surface:#1c1917; --surface2:#292524;
    --border:#2e2a28; --border2:#3f3a37;
    --text:#fafaf9; --text-dim:#a8a29e; --text-mid:#d6d3d1;
  }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:var(--bg); color:var(--text); font-family:var(--sans); min-height:100vh; transition: background 0.25s, color 0.25s; }

  .caixa-app { min-height:100vh; display:flex; flex-direction:column; position:relative; overflow:hidden; background:var(--bg); color:var(--text); }
  .ambient-video { position:absolute; width:700px; height:700px; object-fit:cover; border-radius:50%; filter:blur(40px) opacity(0.35); pointer-events:none; z-index:1; animation:floatAmbient 22s ease-in-out infinite; }
  @keyframes floatAmbient { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(80px, -60px) scale(1.1); } }
  
  .caixa-header { background:var(--surface); border-bottom:1px solid var(--border); height:52px; display:flex; align-items:center; justify-content:space-between; padding:0 18px; position:sticky; top:0; z-index:100; }
  .caixa-logo { font-family:var(--display); font-size:16px; letter-spacing:2px; color:var(--accent); }
  .caixa-badge { background:var(--surface); border:1px solid var(--border2); color:var(--text-dim); padding:4px 12px; font-family:var(--mono); font-size:10px; letter-spacing:1px; border-radius:var(--r); cursor:pointer; transition:all .15s; text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
  .caixa-badge:hover { border-color:var(--accent); color:var(--accent); }
  .caixa-badge.active { background:var(--accent); color:#fff; border-color:var(--accent); }
  
  .caixa-main-layout { display:flex; flex:1; position:relative; z-index:2; height:calc(100vh - 52px); overflow:hidden; }
  
  /* POS grid and cart panel */
  .pos-products-panel { flex:1; display:flex; flex-direction:column; padding:16px; overflow-y:auto; }
  .pos-cart-panel { width:360px; border-left:1px solid var(--border); background:var(--surface); display:flex; flex-direction:column; }
  
  @media(max-width:768px) {
    .caixa-main-layout { flex-direction:column; overflow-y:auto; height:auto; }
    .pos-cart-panel { width:100%; border-left:none; border-top:1px solid var(--border); height:auto; }
    .caixa-header { padding: 0 10px; }
    .caixa-logo { font-size: 14px; letter-spacing: 1px; }
    .header-actions-desktop { display: none !important; }
  }
  @media(min-width:769px) {
    .hamburger-btn { display: none !important; }
  }

  /* Sidebar Drawer styles */
  .mobile-sidebar-drawer {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100vh;
    background: var(--surface);
    border-right: 1px solid var(--border);
    z-index: 2500;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    padding: 20px;
    box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  }
  .mobile-sidebar-drawer.open {
    transform: translateX(0);
  }
  .mobile-sidebar-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 2400;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .mobile-sidebar-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }
  .mobile-sidebar-section {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mobile-sidebar-title {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .mobile-sidebar-download-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 10px 12px;
    border-radius: var(--r);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s;
  }
  .mobile-sidebar-download-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(249,115,22,0.05);
  }

  .pos-search-box { display:flex; gap:8px; margin-bottom:14px; }
  .pos-search-input { flex:1; background:var(--surface); border:1px solid var(--border2); padding:10px 14px; border-radius:var(--r); color:var(--text); font-family:var(--sans); font-size:14px; outline:none; }
  .pos-search-input:focus { border-color:var(--accent); }

  .pos-categories-nav { display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:12px; }
  .pos-cat-pill { padding:6px 12px; border-radius:16px; background:var(--surface2); border:1px solid var(--border); font-size:12px; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
  .pos-cat-pill.active { background:var(--accent); color:#fff; border-color:var(--accent); }

  .pos-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px; }
  .pos-prod-card { background:var(--surface); border:1px solid var(--border); padding:12px; border-radius:var(--r); cursor:pointer; transition:all .15s; display:flex; flex-direction:column; gap:6px; position:relative; overflow:hidden; }
  .pos-prod-card:hover { border-color:var(--accent); transform:translateY(-2px); }
  .pos-prod-card-name { font-size:13px; font-weight:600; line-height:1.2; height:2.4em; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .pos-prod-card-stock { font-family:var(--mono); font-size:10px; color:var(--text-dim); }
  .pos-prod-card-price { font-family:var(--mono); font-size:14px; color:var(--accent); font-weight:600; }

  /* PIN login screen */
  .pin-wrap { max-width:320px; margin:60px auto; padding:20px; background:var(--surface); border:1px solid var(--border); border-radius:var(--r); text-align:center; }
  .pin-display { display:flex; gap:14px; justify-content:center; margin:20px 0; }
  .pin-dot { width:16px; height:16px; border-radius:50%; border:2px solid var(--border2); transition:all .15s; }
  .pin-dot.filled { background:var(--accent); border-color:var(--accent); }
  .pin-dot.error { background:var(--danger); border-color:var(--danger); animation:shake .3s; }
  @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
  .pin-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
  .pin-btn { background:var(--surface2); border:1px solid var(--border2); color:var(--text); font-family:var(--display); font-size:26px; padding:18px 10px; cursor:pointer; border-radius:var(--r); }

  /* Toast alerts */
  .toast-container { position:fixed; bottom:16px; right:16px; z-index:999; display:flex; flex-direction:column; gap:8px; }
  .toast { padding:10px 16px; border-radius:var(--r); background:var(--surface); border-left:4px solid var(--accent); color:var(--text); font-size:12px; font-family:var(--mono); box-shadow:0 4px 12px rgba(0,0,0,0.1); animation:slideIn 0.2s ease-out; }
  @keyframes slideIn { from{transform:translateX(100%); opacity:0;} to{transform:translateX(0); opacity:1;} }

  /* Scanner Overlay */
  .scanner-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:2000; display:flex; flex-direction:column; }
  .scanner-video-wrap { flex:1; position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .scanner-video-wrap video { width:100%; height:100%; object-fit:cover; }
  .scan-frame { position:absolute; width:260px; height:160px; border:2px solid var(--accent); border-radius:4px; box-shadow:0 0 0 9999px rgba(0,0,0,0.55); }
  .scan-line-anim { position:absolute; width:100%; height:2px; background:var(--accent); animation:scanAnim 1.8s ease-in-out infinite; top:0; }
  @keyframes scanAnim { 0%,100%{top:0} 50%{top:calc(100% - 2px)} }
  .scan-bar { background:var(--surface); padding:14px 18px; display:flex; flex-direction:column; gap:10px; }
  .scan-bar-row { display:flex; gap:8px; align-items:center; }
  .scan-status { font-family:var(--mono); font-size:12px; padding:8px 12px; background:var(--surface2); border-radius:var(--r); color:var(--text-dim); text-align:center; }
  .scan-status.ok { color:var(--success); }
  .scan-status.err { color:var(--danger); }

  /* Inline scanner */
  .inline-scanner { position:relative; width:100%; height:140px; background:#000; border-radius:var(--r); overflow:hidden; border:2px solid var(--accent); margin-bottom:12px; }
  .inline-scanner-video { width:100%; height:100%; object-fit:cover; }
  .inline-scan-frame { position:absolute; width:80%; height:80%; top:10%; left:10%; border:1.5px dashed var(--accent); }
  .inline-scan-status { position:absolute; bottom:6px; left:6px; right:6px; background:rgba(0,0,0,0.75); color:#fff; padding:2px 6px; font-family:var(--mono); fontSize:9px; border-radius:3px; text-align:center; }

  /* Qty modal */
  .qty-modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:3000; display:flex; align-items:center; justify-content:center; }
  .qty-modal { background:var(--surface); border:1px solid var(--border); border-radius:var(--r); padding:24px; width:90%; max-width:300px; text-align:center; }

  /* General Cards and Grids */
  .card-premium { background:var(--surface); border:1px solid var(--border); border-radius:var(--r); padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.05); position:relative; overflow:hidden; }
  .btn-premium { background:var(--accent); color:#fff; border:1px solid var(--accent); padding:10px 16px; border-radius:var(--r); font-family:var(--sans); font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; gap:8px; justify-content:center; }
  .btn-premium:hover { background:var(--accent2); border-color:var(--accent2); }
  .btn-premium:disabled { opacity:0.5; cursor:not-allowed; }
  
  .badge-fiel { background:rgba(16,185,129,0.12); border:1px solid var(--success); color:var(--success); padding:2px 6px; font-size:9px; border-radius:3px; font-family:var(--mono); font-weight:600; }
  .badge-infiel { background:rgba(120,113,108,0.12); border:1px solid var(--text-dim); color:var(--text-dim); padding:2px 6px; font-size:9px; border-radius:3px; font-family:var(--mono); }
`;

export default function Caixa() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [sectors, setSectors] = useState([]);
  const [selectedSector, setSelectedSector] = useState(null);
  const [fase, setFase] = useState("setores"); // "setores" | "pin" | "pos"
  const [posTab, setPosTab] = useState("vendas"); // "vendas" | "fiadores"
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState(false);
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState("");
  const [payMethod, setPayMethod] = useState("Dinheiro");
  const [toasts, setToasts] = useState([]);
  const [modoLoja, setModoLoja] = useState(false);
  const [fluxoLoja, setFluxoLoja] = useState("estoque");
  const [showClosure, setShowClosure] = useState(false);
  const [sessionSales, setSessionSales] = useState([]);

  // Cash Register State
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [caixaInfo, setCaixaInfo] = useState(null);
  const [saldoAbertura, setSaldoAbertura] = useState("0");
  const [loadingCaixa, setLoadingCaixa] = useState(false);

  // Fiadores State
  const [fiadores, setFiadores] = useState([]);
  const [selectedFiadorId, setSelectedFiadorId] = useState("");
  const [fiadorSearch, setFiadorSearch] = useState("");
  const [newFiadorNome, setNewFiadorNome] = useState("");
  const [newFiadorLimite, setNewFiadorLimite] = useState("");
  const [newFiadorDiaPagamento, setNewFiadorDiaPagamento] = useState("5");
  const [newFiadorFiel, setNewFiadorFiel] = useState(true);
  const [savingFiador, setSavingFiador] = useState(false);
  const [showQuitarFiador, setShowQuitarFiador] = useState(null); // fiador object
  const [quitarValor, setQuitarValor] = useState("");
  const [quitarMetodo, setQuitarMetodo] = useState("Dinheiro");

  // Quick edit price state
  const [quickEditProduct, setQuickEditProduct] = useState(null);
  const [quickPriceVal, setQuickPriceVal] = useState("");

  // Mobile sidebar and inline customer creation state
  const [showSidebar, setShowSidebar] = useState(false);
  const [showInlineAddFiador, setShowInlineAddFiador] = useState(false);
  const [inlineFiadorNome, setInlineFiadorNome] = useState("");
  const [inlineFiadorLimite, setInlineFiadorLimite] = useState("300");
  const [inlineFiadorDia, setInlineFiadorDia] = useState("5");

  // Scanner State
  const [scannerActive, setScannerActive] = useState(() => localStorage.getItem("caixa_scanner_enabled") === "true");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState({ msg: "Aponte para o código de barras", t: "" });
  const [scanReady, setScanReady] = useState(false);
  const [qtyModal, setQtyModal] = useState(null); // { product, qty }
  const [qtyInput, setQtyInput] = useState(1);

  const html5QrCodeRef = useRef(null);
  const histRef = useRef([]);
  const CONFIRMS = 1;

  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(() => localStorage.getItem("caixa_preferred_camera_id") || "");
  const [valorPago, setValorPago] = useState("");
  const scannerStateRef = useRef("IDLE"); // "IDLE" | "STARTING" | "RUNNING" | "STOPPING"

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const stopScanner = useCallback(async () => {
    if (scannerStateRef.current === "IDLE" || scannerStateRef.current === "STOPPING") {
      setScannerOpen(p => p ? false : p);
      return;
    }

    const prevScanner = html5QrCodeRef.current;
    html5QrCodeRef.current = null;
    scannerStateRef.current = "STOPPING";

    if (prevScanner) {
      if (prevScanner.isScanning) {
        try {
          await prevScanner.stop();
          try { prevScanner.clear(); } catch (e) { }
        } catch (err) {
          console.error("Erro ao parar camera:", err);
        }
      }
    }
    scannerStateRef.current = "IDLE";
    setScannerOpen(p => p ? false : p);
  }, []);

  const onBarcodeScan = useCallback((code) => {
    const h = histRef.current;
    h.push(code); if (h.length > CONFIRMS) h.shift();
    if (h.length === CONFIRMS && h.every(c => c === h[0])) {
      setScanStatus({ msg: `✔ ${code}`, t: "ok" });

      const found = products.find(p =>
        (p.barcodes && p.barcodes.includes(code)) ||
        (p.codigoBarras && p.codigoBarras === code) ||
        (p.barcode && p.barcode === code)
      );
      if (found) {
        setQtyModal({ product: found, code });
        setQtyInput(1);
      } else {
        setScanStatus({ msg: `Código ${code} não encontrado`, t: "err" });
        setTimeout(() => {
          histRef.current = [];
          setScanStatus({ msg: "Aponte para o código de barras", t: "" });
        }, 2000);
      }
    }
  }, [products]);

  // ─── iOS/iPhone Camera Scanner ────────────────────────────────────────────────
  // No iOS Safari é OBRIGATÓRIO pedir getUserMedia ANTES de usar Html5Qrcode,
  // e enumerar câmeras somente depois da permissão. Sem isso, iPhone bloqueia.
  const openInlineScanner = useCallback(async () => {
    if (!scannerActive) return;
    if (scannerStateRef.current === "STARTING" || scannerStateRef.current === "RUNNING") return;

    scannerStateRef.current = "STARTING";
    setScanStatus({ msg: "Iniciando câmera...", t: "" });

    const startCamera = async () => {
      try {
        const element = document.getElementById("reader");
        if (!element) {
          setScanStatus({ msg: "Elemento não encontrado", t: "err" });
          scannerStateRef.current = "IDLE";
          return;
        }

        // PASSO 1: Solicitar permissão explícita (CRÍTICO para iOS/Safari)
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          try {
            const tempStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: "environment" } }
            });
            tempStream.getTracks().forEach(t => t.stop());
          } catch (permErr) {
            const permMsg = String(permErr);
            if (permMsg.includes("NotAllowedError") || permMsg.includes("denied")) {
              setScanStatus({
                msg: "❌ Câmera bloqueada. Vá em Ajustes > Safari > Câmera e selecione 'Permitir'.",
                t: "err"
              });
              scannerStateRef.current = "IDLE";
              return;
            }
            console.warn("Aviso permissão câmera:", permErr);
          }
        }

        if (scannerStateRef.current === "STOPPING" || scannerStateRef.current === "IDLE") {
          scannerStateRef.current = "IDLE";
          return;
        }

        // PASSO 2: Enumerar câmeras (funciona no iOS só DEPOIS da permissão)
        let availableCameras = [];
        try {
          availableCameras = await window.Html5Qrcode.getCameras();
          if (availableCameras && availableCameras.length > 0) setCameras(availableCameras);
        } catch (e) { console.warn("Erro ao enumerar câmeras:", e); }

        // PASSO 3: Criar instância
        const scannerInstance = new window.Html5Qrcode("reader");
        html5QrCodeRef.current = scannerInstance;

        if (scannerStateRef.current === "STOPPING" || scannerStateRef.current === "IDLE") {
          html5QrCodeRef.current = null;
          scannerStateRef.current = "IDLE";
          return;
        }

        // PASSO 4: Determinar câmera a usar
        let cameraConfig;
        if (selectedCameraId) {
          cameraConfig = selectedCameraId;
        } else if (availableCameras.length > 0) {
          const backCam = availableCameras.find(c =>
            c.label && (
              c.label.toLowerCase().includes("back") ||
              c.label.toLowerCase().includes("rear") ||
              c.label.toLowerCase().includes("traseira") ||
              c.label.toLowerCase().includes("environment") ||
              c.label.toLowerCase().includes("wide")
            )
          );
          cameraConfig = backCam ? backCam.id : availableCameras[availableCameras.length - 1].id;
        } else {
          cameraConfig = { facingMode: "environment" };
        }

        const scanCfg = {
          fps: 10,
          qrbox: (width, height) => ({ width: Math.min(width * 0.85, 400), height: Math.min(height * 0.45, 110) }),
          aspectRatio: 1.777778,
          videoConstraints: typeof cameraConfig === "string"
            ? { deviceId: { exact: cameraConfig } }
            : { facingMode: { ideal: "environment" } }
        };

        const cb = (text) => onBarcodeScan(text);
        const noop = () => {};

        // PASSO 5: Iniciar com fallbacks
        try {
          await scannerInstance.start(cameraConfig, scanCfg, cb, noop);
        } catch (startErr) {
          console.warn("Câmera primária falhou, fallback:", startErr);
          try {
            await scannerInstance.start({ facingMode: "environment" }, { ...scanCfg, videoConstraints: { facingMode: { ideal: "environment" } } }, cb, noop);
          } catch {
            const fb = availableCameras.length > 0 ? availableCameras[0].id : { facingMode: "user" };
            await scannerInstance.start(fb, { ...scanCfg, videoConstraints: {} }, cb, noop);
          }
        }

        scannerStateRef.current = "RUNNING";
        setScanStatus({ msg: "📷 Aponte para o código de barras", t: "ok" });

      } catch (err) {
        html5QrCodeRef.current = null;
        scannerStateRef.current = "IDLE";
        const msg = String(err);
        if (msg.includes("NotAllowedError") || msg.includes("Permission") || msg.includes("denied")) {
          setScanStatus({ msg: "❌ Permissão negada. Vá em Ajustes > Safari > Câmera e permita o acesso.", t: "err" });
        } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFound")) {
          setScanStatus({ msg: "❌ Nenhuma câmera encontrada.", t: "err" });
        } else if (msg.includes("NotReadableError") || msg.includes("TrackStartError")) {
          setScanStatus({ msg: "❌ Câmera em uso por outro app. Feche-o e tente novamente.", t: "err" });
        } else {
          setScanStatus({ msg: "❌ Câmera indisponível. Toque em 'Tentar novamente'.", t: "err" });
        }
        console.error("Erro scanner:", err);
      }
    };

    setTimeout(() => { startCamera(); }, 350);
  }, [scannerActive, onBarcodeScan, selectedCameraId]);

  const openScanner = useCallback(async () => { openInlineScanner(); }, [openInlineScanner]);
  const closeScanner = useCallback(() => { stopScanner(); setQtyModal(null); }, [stopScanner]);
  const confirmQty = () => {
    if (!qtyModal) return;
    addToCart({ ...qtyModal.product, _forceQty: parseInt(qtyInput) || 1 });
    addToast(`Adicionado: ${qtyModal.product.nome} x${parseInt(qtyInput) || 1}`, "success");
    setQtyModal(null);
    histRef.current = [];
    setScanStatus({ msg: "Aponte para o código de barras", t: "" });
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  // Load sectors on start
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, "users", empresaId, "setores"));
        setSectors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Erro ao carregar setores:", e);
      }
    };
    load();
  }, []);



  // Check sector settings when sector is selected and authenticated (using real-time onSnapshot)
  useEffect(() => {
    if (!selectedSector || fase !== "pos") return;

    let unsubConfig = () => { };
    let unsubProducts = () => { };
    let unsubCats = () => { };
    let unsubStatus = () => { };
    let unsubFiadores = () => { };

    try {
      // 1. Subscribe to config
      unsubConfig = onSnapshot(doc(db, getCol(selectedSector.id, "config"), "loja_config"), (cfgSnap) => {
        if (cfgSnap.exists()) {
          setModoLoja(cfgSnap.data().modoLoja || false);
          setFluxoLoja(cfgSnap.data().fluxoLoja || "estoque");
        } else {
          setModoLoja(false);
          setFluxoLoja("estoque");
        }
      });

      // 2. Subscribe to products
      unsubProducts = onSnapshot(collection(db, getCol(selectedSector.id, "produtos")), (snap) => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // 3. Subscribe to categories
      unsubCats = onSnapshot(collection(db, getCol(selectedSector.id, "categorias")), (snap) => {
        setCats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

      // 4. Subscribe to cashier status
      unsubStatus = onSnapshot(doc(db, getCol(selectedSector.id, "caixa_status"), "atual"), (statusSnap) => {
        if (statusSnap.exists() && statusSnap.data().aberto) {
          setCaixaAberto(true);
          setCaixaInfo(statusSnap.data());
          // Load current shift sales that aren't closed
          getDocs(query(collection(db, getCol(selectedSector.id, "vendas")), where("caixaFechado", "==", false))).then(salesSnap => {
            setSessionSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          });
        } else {
          setCaixaAberto(false);
          setCaixaInfo(null);
          setSessionSales([]);
        }
      });

      // 5. Subscribe to fiadores
      unsubFiadores = onSnapshot(collection(db, getCol(selectedSector.id, "fiadores")), (snap) => {
        setFiadores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });

    } catch (e) {
      addToast("Erro ao iniciar sincronização: " + e.message, "error");
    }

    return () => {
      unsubConfig();
      unsubProducts();
      unsubCats();
      unsubStatus();
      unsubFiadores();
    };
  }, [selectedSector, fase]);

  const handleSaveQuickPrice = async () => {
    if (!quickEditProduct) return;
    const newVal = Number(quickPriceVal);
    if (isNaN(newVal) || newVal < 0) {
      addToast("Preço inválido", "error");
      return;
    }
    try {
      await updateDoc(doc(db, getCol(selectedSector.id, "produtos"), quickEditProduct.id), {
        precoVenda: newVal
      });
      addToast("Valor atualizado com sucesso!", "success");
      setQuickEditProduct(null);
    } catch (e) {
      addToast("Erro ao atualizar: " + e.message, "error");
    }
  };

  const handleSaveInlineFiador = async () => {
    if (!inlineFiadorNome.trim()) {
      addToast("Digite o nome do cliente.", "error");
      return;
    }
    const limit = Number(inlineFiadorLimite);
    if (isNaN(limit) || limit <= 0) {
      addToast("Limite inválido", "error");
      return;
    }
    const day = parseInt(inlineFiadorDia) || 5;

    try {
      const docRef = await addDoc(collection(db, getCol(selectedSector.id, "fiadores")), {
        nome: inlineFiadorNome.trim(),
        limite: limit,
        diaPagamento: day,
        fiel: true,
        dividaAtual: 0,
        criadoEm: new Date().toISOString()
      });

      addToast(`Cliente ${inlineFiadorNome.trim()} cadastrado com sucesso!`, "success");
      setSelectedFiadorId(docRef.id);
      setInlineFiadorNome("");
      setInlineFiadorLimite("300");
      setInlineFiadorDia("5");
      setShowInlineAddFiador(false);
    } catch (e) {
      addToast("Erro ao cadastrar cliente: " + e.message, "error");
    }
  };

  // Inline scanner activation controller
  useEffect(() => {
    if (fase === "pos" && caixaAberto && scannerActive && posTab === "vendas") {
      openInlineScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [fase, caixaAberto, scannerActive, posTab, openInlineScanner, stopScanner]);

  const handleToggleScannerActive = () => {
    const nextVal = !scannerActive;
    setScannerActive(nextVal);
    localStorage.setItem("caixa_scanner_enabled", String(nextVal));
    addToast(nextVal ? "Scanner automático ativado!" : "Scanner automático desativado.", "info");
  };

  // Redirect global typing to search input if no input is currently focused
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (fase !== "pos" || posTab !== "vendas" || !caixaAberto) return;

      const active = document.activeElement;
      const isInput = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT");
      
      if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const searchInput = document.querySelector(".pos-search-input");
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [fase, posTab, caixaAberto]);

  // Handle Sector PIN verification
  const handlePinPress = async (num) => {
    if (pinError) return;
    const val = pinValue + num;
    setPinValue(val);
    if (val.length === 4) {
      try {
        const docSnap = await getDoc(doc(db, getCol(selectedSector.id, "config"), "requisicao_config"));
        const realPin = docSnap.exists() ? (docSnap.data().pin || "") : "";
        if (!realPin || val === realPin) {
          addToast(`Acessando Caixa do setor ${selectedSector.label}...`, "success");
          setFase("pos");
          setPinValue("");
        } else {
          setPinError(true);
          setTimeout(() => {
            setPinValue("");
            setPinError(false);
          }, 600);
        }
      } catch (e) {
        addToast("Erro ao verificar PIN: " + e.message, "error");
        setPinValue("");
      }
    }
  };

  const handleBackspace = () => {
    setPinValue(p => p.slice(0, -1));
  };

  const selectSector = (s) => {
    setSelectedSector(s);
    setFase("pin");
  };

  // Open cashier register
  const handleOpenCaixa = async () => {
    setLoadingCaixa(true);
    try {
      const info = {
        aberto: true,
        abertoEm: new Date().toISOString(),
        saldoInicial: Number(saldoAbertura) || 0,
        operador: "Caixa POS"
      };
      await setDoc(doc(db, getCol(selectedSector.id, "caixa_status"), "atual"), info);
      setCaixaInfo(info);
      setCaixaAberto(true);
      setSessionSales([]);

      // Log opening
      await addDoc(collection(db, getCol(selectedSector.id, "log")), {
        tipo: "abertura",
        descricao: `Caixa Aberto. Saldo Inicial: R$ ${Number(saldoAbertura).toFixed(2)}`,
        ts: serverTimestamp(),
        usuario: "Caixa POS"
      });

      addToast("Caixa aberto com sucesso!", "success");
    } catch (e) {
      addToast("Erro ao abrir caixa: " + e.message, "error");
    } finally {
      setLoadingCaixa(false);
    }
  };

  // Add to cart
  const addToCart = (product) => {
    const forceQty = product._forceQty || 1;
    const stockQty = fluxoLoja === "loja" ? (product.qtdLoja || 0) : (product.quantidade || 0);
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
      if (existing.quantity + forceQty > stockQty) { addToast("Quantidade indisponível!", "warn"); return; }
      setCart(cart.map(i => i.id === product.id ? { ...i, quantity: i.quantity + forceQty } : i));
    } else {
      if (stockQty < 1) { addToast("Produto sem estoque!", "warn"); return; }
      setCart([...cart, { ...product, quantity: forceQty }]);
    }
  };

  const updateCartQty = (id, delta) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter(i => i.id !== id));
      return;
    }

    const originalProduct = products.find(p => p.id === id);
    const stockQty = fluxoLoja === "loja" ? (originalProduct?.qtdLoja || 0) : (originalProduct?.quantidade || 0);

    if (newQty > stockQty) {
      addToast("Quantidade indisponível no estoque/loja!", "warn");
      return;
    }

    setCart(cart.map(i => i.id === id ? { ...i, quantity: newQty } : i));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * (Number(item.precoVenda) || 0)), 0);

  // Barcode / Search submit
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const queryStr = searchQuery.trim().toLowerCase();
    if (!queryStr) return;

    const found = products.find(p =>
      (p.codigoBarras && p.codigoBarras.toLowerCase() === queryStr) ||
      (p.barcode && p.barcode.toLowerCase() === queryStr) ||
      (p.barcodes && p.barcodes.includes(queryStr)) ||
      p.nome.toLowerCase() === queryStr
    );

    if (found) {
      addToCart(found);
      addToast(`Adicionado: ${found.nome}`, "success");
      setSearchQuery("");
    } else {
      addToast("Produto não encontrado por código exato. Filtro aplicado na lista.", "info");
    }
  };

  // Complete Sale
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    let selectedFiador = null;
    if (payMethod === "Fiado") {
      selectedFiador = fiadores.find(f => f.id === selectedFiadorId);
      if (!selectedFiador) {
        addToast("Selecione um cliente fiador.", "error");
        return;
      }
      const remainingLimit = (selectedFiador.limite || 0) - (selectedFiador.dividaAtual || 0);
      if (cartTotal > remainingLimit) {
        addToast("Limite de crédito excedido para este cliente!", "error");
        return;
      }
    }

    try {
      const clientFinalName = payMethod === "Fiado" ? selectedFiador.nome : (clientName.trim() || "Consumidor Final");
      // Save Sale document
      const saleData = {
        cliente: clientFinalName,
        itens: cart.map(i => ({
          id: i.id,
          nome: i.nome,
          quantity: i.quantity,
          precoVenda: Number(i.precoVenda) || 0,
          subtotal: i.quantity * (Number(i.precoVenda) || 0)
        })),
        total: cartTotal,
        metodoPagamento: payMethod,
        timestamp: new Date().toISOString(),
        caixaFechado: false
      };

      if (payMethod === "Fiado") {
        saleData.fiadorId = selectedFiador.id;
      }

      // Add Sale to sales collection
      await addDoc(collection(db, getCol(selectedSector.id, "vendas")), saleData);

      // Decrement inventory quantities in Firebase
      for (const item of cart) {
        const itemRef = doc(db, getCol(selectedSector.id, "produtos"), item.id);
        if (fluxoLoja === "loja") {
          await updateDoc(itemRef, { qtdLoja: increment(-item.quantity) });
        } else {
          await updateDoc(itemRef, { quantidade: increment(-item.quantity) });
        }
      }

      // If payment is Fiado, increment debtor's debt
      if (payMethod === "Fiado") {
        await updateDoc(doc(db, getCol(selectedSector.id, "fiadores"), selectedFiador.id), {
          dividaAtual: increment(cartTotal)
        });
      }

      // Add to session summary
      setSessionSales(s => [...s, saleData]);

      // Create log entry
      await addDoc(collection(db, getCol(selectedSector.id, "log")), {
        tipo: "venda",
        descricao: `Venda finalizada: R$ ${cartTotal.toFixed(2)} (${payMethod}) - Cliente: ${saleData.cliente}`,
        ts: serverTimestamp(),
        usuario: "Caixa POS"
      });

      addToast("Venda finalizada com sucesso!", "success");
      setCart([]);
      setClientName("");
      setSelectedFiadorId("");
      setValorPago("");

      // Reload products list to show new stock level
      const prodSnap = await getDocs(collection(db, getCol(selectedSector.id, "produtos")));
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      addToast("Erro ao processar venda: " + e.message, "error");
    }
  };

  // Close shift
  const handleCloseShift = async () => {
    try {
      const totalRev = sessionSales.reduce((sum, s) => sum + s.total, 0);

      // Log closure
      await addDoc(collection(db, getCol(selectedSector.id, "log")), {
        tipo: "fechamento",
        descricao: `Caixa Fechado. Turno finalizado com ${sessionSales.length} vendas. Faturamento: R$ ${totalRev.toFixed(2)}`,
        ts: serverTimestamp(),
        usuario: "Caixa POS"
      });

      // Mark all sales in shift as closed
      const salesSnap = await getDocs(query(collection(db, getCol(selectedSector.id, "vendas")), where("caixaFechado", "==", false)));
      await Promise.all(salesSnap.docs.map(d => updateDoc(doc(db, getCol(selectedSector.id, "vendas"), d.id), { caixaFechado: true })));

      // Close cashier register state in DB
      await setDoc(doc(db, getCol(selectedSector.id, "caixa_status"), "atual"), {
        aberto: false,
        fechadoEm: new Date().toISOString(),
        ultimoFaturamento: totalRev
      });

      addToast("Caixa fechado com sucesso!", "success");
      setSessionSales([]);
      setCaixaAberto(false);
      setCaixaInfo(null);
      setShowClosure(false);
    } catch (e) {
      addToast("Erro ao fechar caixa: " + e.message, "error");
    }
  };

  // Add a new Fiador (debtor/credit customer)
  const handleAddFiador = async (e) => {
    e.preventDefault();
    if (!newFiadorNome.trim()) { addToast("Digite o nome do fiador.", "error"); return; }
    if (!newFiadorLimite || Number(newFiadorLimite) <= 0) { addToast("Defina um limite de crédito válido.", "error"); return; }

    setSavingFiador(true);
    try {
      const cleanLimit = Number(newFiadorLimite);
      const cleanDay = parseInt(newFiadorDiaPagamento) || 5;

      await addDoc(collection(db, getCol(selectedSector.id, "fiadores")), {
        nome: newFiadorNome.trim(),
        limite: cleanLimit,
        diaPagamento: cleanDay,
        fiel: newFiadorFiel,
        dividaAtual: 0,
        criadoEm: new Date().toISOString()
      });

      addToast(`Fiador ${newFiadorNome.trim()} cadastrado!`, "success");
      setNewFiadorNome("");
      setNewFiadorLimite("");
      setNewFiadorDiaPagamento("5");
      setNewFiadorFiel(true);
    } catch (e) {
      addToast("Erro ao criar fiador: " + e.message, "error");
    } finally {
      setSavingFiador(false);
    }
  };

  // Delete a Fiador
  const handleDeleteFiador = async (fiador) => {
    if (fiador.dividaAtual > 0) {
      if (!confirm(`Atenção: "${fiador.nome}" tem uma dívida de R$ ${fiador.dividaAtual.toFixed(2)}. Deseja mesmo excluí-lo?`)) return;
    } else {
      if (!confirm(`Excluir o fiador "${fiador.nome}"?`)) return;
    }

    try {
      await deleteDoc(doc(db, getCol(selectedSector.id, "fiadores"), fiador.id));
      addToast(`Fiador "${fiador.nome}" removido.`, "success");
    } catch (e) {
      addToast("Erro ao remover: " + e.message, "error");
    }
  };

  // Receive a payment (quitar fiado) and register it in the cashier
  const handlePayDebt = async (e) => {
    e.preventDefault();
    if (!showQuitarFiador) return;
    const valor = Number(quitarValor);
    if (!valor || valor <= 0) { addToast("Digite um valor válido para pagamento.", "error"); return; }
    if (valor > showQuitarFiador.dividaAtual) {
      if (!confirm("O valor digitado é maior que a dívida atual. Registrar assim mesmo?")) return;
    }

    try {
      // 1. Decrement debt
      const finalDebt = Math.max(0, (showQuitarFiador.dividaAtual || 0) - valor);
      await updateDoc(doc(db, getCol(selectedSector.id, "fiadores"), showQuitarFiador.id), {
        dividaAtual: finalDebt
      });

      // 2. Register sale transaction in Caixa for current shift
      const paymentSale = {
        cliente: `Recebimento Fiado: ${showQuitarFiador.nome}`,
        itens: [{
          id: "pagamento_fiado",
          nome: `Recebimento de Fiado - ${showQuitarFiador.nome}`,
          quantity: 1,
          precoVenda: valor,
          subtotal: valor
        }],
        total: valor,
        metodoPagamento: quitarMetodo,
        timestamp: new Date().toISOString(),
        caixaFechado: false
      };

      const docRef = await addDoc(collection(db, getCol(selectedSector.id, "vendas")), paymentSale);
      paymentSale.id = docRef.id;

      // 3. Log transaction
      await addDoc(collection(db, getCol(selectedSector.id, "log")), {
        tipo: "recebimento",
        descricao: `Recebimento de Fiado (${showQuitarFiador.nome}): R$ ${valor.toFixed(2)} (${quitarMetodo})`,
        ts: serverTimestamp(),
        usuario: "Caixa POS"
      });

      // Update state
      setSessionSales(s => [...s, paymentSale]);
      addToast(`Recebimento de R$ ${valor.toFixed(2)} registrado no caixa!`, "success");

      setShowQuitarFiador(null);
      setQuitarValor("");
    } catch (e) {
      addToast("Erro ao registrar pagamento: " + e.message, "error");
    }
  };

  // Exit POS
  const handleLogout = () => {
    stopScanner();
    setFase("setores");
    setSelectedSector(null);
    setCart([]);
    setSessionSales([]);
  };

  const filteredProducts = products.filter(p => {
    const matchCat = !selectedCat || p.categoria === selectedCat;
    const matchQuery = !searchQuery ||
      p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.codigoBarras && p.codigoBarras.includes(searchQuery)) ||
      (p.barcode && p.barcode.includes(searchQuery));
    return matchCat && matchQuery;
  });

  const filteredFiadores = fiadores.filter(f =>
    f.nome.toLowerCase().includes(fiadorSearch.toLowerCase())
  );

  return (
    <>
      <style>{css}</style>
      <div className={`caixa-app ${theme}`}>
        <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ top: "-15%", left: "-15%" }}></video>
        <video className="ambient-video" src="/Baixar/s.mp4" autoPlay loop muted playsInline style={{ bottom: "-15%", right: "-15%", animationDelay: "-11s", width: "550px", height: "550px" }}></video>

        {/* Header */}
        <header className="caixa-header" style={{ position: "relative", zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Hamburger — mobile only */}
            <button
              className="hamburger-btn caixa-badge"
              onClick={() => setShowSidebar(true)}
              style={{ padding: "4px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              aria-label="Menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div className="caixa-logo">CAIXA</div>
            {selectedSector && fase === "pos" && (
              <>
                <span className="caixa-badge" style={{ borderColor: selectedSector.color, color: selectedSector.color, cursor: "default" }}>
                  {getEmojiForIcon(selectedSector.iconName)} {selectedSector.label}
                </span>
                {caixaAberto && (
                  <span className="caixa-badge" style={{ borderColor: "var(--success)", color: "var(--success)", cursor: "default", background: "rgba(16,185,129,0.06)" }}>
                    ● ABERTO · R$ {caixaInfo?.saldoInicial?.toFixed(2)}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="header-actions-desktop" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={toggleTheme} className="caixa-badge" style={{ borderRadius: "50%", width: 28, height: 28, padding: 0, justifyContent: "center", display: "inline-flex", alignItems: "center" }} aria-label="Toggle Theme">
              {theme === "light" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              )}
            </button>
            {selectedSector && fase === "pos" && (
              <>
                <button className={`caixa-badge ${posTab === "vendas" ? "active" : ""}`} onClick={() => setPosTab("vendas")}>Frente de Caixa</button>
                <button className={`caixa-badge ${posTab === "fiadores" ? "active" : ""}`} onClick={() => setPosTab("fiadores")}>Clientes (Fiado)</button>
                {caixaAberto && (
                  <button className="caixa-badge" style={{ borderColor: "var(--warn)", color: "var(--warn)" }} onClick={() => setShowClosure(true)}>Fechamento</button>
                )}
                <button className="caixa-badge" style={{ borderColor: "var(--danger)", color: "var(--danger)" }} onClick={handleLogout}>Sair</button>
              </>
            )}
          </div>

          {/* Right side on mobile: just theme toggle */}
          <div style={{ display: "none" }} className="header-actions-mobile">
            <button onClick={toggleTheme} className="caixa-badge" style={{ borderRadius: "50%", width: 32, height: 32, padding: 0, justifyContent: "center", display: "inline-flex", alignItems: "center" }}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </header>

        {/* ══════════ MOBILE SIDEBAR DRAWER ══════════ */}
        <div className={`mobile-sidebar-backdrop ${showSidebar ? "open" : ""}`} onClick={() => setShowSidebar(false)} />
        <div className={`mobile-sidebar-drawer ${showSidebar ? "open" : ""}`}>
          {/* Drawer Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <span style={{ fontFamily: "var(--display)", fontSize: 20, color: "var(--accent)", letterSpacing: 2 }}>MENU</span>
            <button onClick={() => setShowSidebar(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text)", fontSize: 18 }}>✕</button>
          </div>

          {/* Theme Toggle */}
          <div className="mobile-sidebar-section">
            <div className="mobile-sidebar-title">Aparência</div>
            <button onClick={() => { toggleTheme(); }} className="mobile-sidebar-download-btn" style={{ cursor: "pointer", border: "1px solid var(--border2)" }}>
              {theme === "light" ? "🌙 Modo Escuro" : "☀️ Modo Claro"}
            </button>
          </div>

          {/* POS Navigation */}
          {selectedSector && fase === "pos" && (
            <div className="mobile-sidebar-section">
              <div className="mobile-sidebar-title">Navegação</div>
              <button className={`mobile-sidebar-download-btn ${posTab === "vendas" ? "active" : ""}`} onClick={() => { setPosTab("vendas"); setShowSidebar(false); }}
                style={{ cursor: "pointer", background: posTab === "vendas" ? "var(--accent)" : undefined, color: posTab === "vendas" ? "#fff" : undefined, border: posTab === "vendas" ? "1px solid var(--accent)" : undefined }}>
                🛒 Frente de Caixa
              </button>
              <button className={`mobile-sidebar-download-btn ${posTab === "fiadores" ? "active" : ""}`} onClick={() => { setPosTab("fiadores"); setShowSidebar(false); }}
                style={{ cursor: "pointer", background: posTab === "fiadores" ? "var(--accent)" : undefined, color: posTab === "fiadores" ? "#fff" : undefined, border: posTab === "fiadores" ? "1px solid var(--accent)" : undefined }}>
                📋 Clientes (Fiado)
              </button>
            </div>
          )}

          {/* Tools */}
          {selectedSector && fase === "pos" && caixaAberto && (
            <div className="mobile-sidebar-section">
              <div className="mobile-sidebar-title">Ferramentas</div>
              <button className="mobile-sidebar-download-btn" style={{ cursor: "pointer" }} onClick={() => { setShowClosure(true); setShowSidebar(false); }}>
                🔒 Fechar Caixa / Relatório
              </button>
              <button className="mobile-sidebar-download-btn" style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => { handleToggleScannerActive(); setShowSidebar(false); }}>
                📷 Scanner: {scannerActive ? "ATIVADO ✓" : "DESATIVADO"}
              </button>
            </div>
          )}

          {/* Downloads */}
          <div className="mobile-sidebar-section">
            <div className="mobile-sidebar-title">Baixar Aplicativos</div>
            <a className="mobile-sidebar-download-btn" href="/Baixar/SystemStock adm.apk" download>
              <span style={{ fontSize: 18 }}>📦</span>
              <div>
                <div style={{ fontWeight: 600 }}>App Administrador</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>systemstock-adm.apk</div>
              </div>
            </a>
            <a className="mobile-sidebar-download-btn" href="/Baixar/SystemStock User.apk" download>
              <span style={{ fontSize: 18 }}>📱</span>
              <div>
                <div style={{ fontWeight: 600 }}>App Usuário / Requisição</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>systemstock-user.apk</div>
              </div>
            </a>
          </div>

          {/* Logout */}
          {fase === "pos" && (
            <div style={{ marginTop: "auto" }}>
              <button className="mobile-sidebar-download-btn" style={{ cursor: "pointer", color: "var(--danger)", borderColor: "var(--danger)", width: "100%", justifyContent: "center" }}
                onClick={() => { handleLogout(); setShowSidebar(false); }}>
                ← Sair do Caixa
              </button>
            </div>
          )}
        </div>

        {/* FASE: SELEÇÃO DE SETOR */}
        {fase === "setores" && (
          <div style={{ position: "relative", zIndex: 10, flex: 1, padding: 30, maxWidth: 800, margin: "40px auto", width: "100%" }}>
            <h2 style={{ fontFamily: "var(--display)", fontSize: 28, letterSpacing: 2, marginBottom: 20, textAlign: "center" }}>SELECIONE SEU SETOR DE VENDAS</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
              {sectors.map(s => (
                <div
                  key={s.id}
                  onClick={() => selectSector(s)}
                  style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 24, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transition: "all 0.2s"
                  }}
                  className="sector-select-card"
                >
                  <span style={{ fontSize: 32 }}>{getEmojiForIcon(s.iconName)}</span>
                  <span style={{ fontFamily: "var(--display)", fontSize: 18, color: s.color }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FASE: PIN */}
        {fase === "pin" && (
          <div style={{ position: "relative", zIndex: 10 }}>
            <div className="pin-wrap">
              <div style={{ fontFamily: "var(--display)", fontSize: 22, color: selectedSector.color }}>{selectedSector.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>Digite o PIN de 4 dígitos do caixa</div>

              <div className="pin-display">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`pin-dot ${pinValue.length > i ? "filled" : ""} ${pinError ? "error" : ""}`}
                    style={pinValue.length > i ? { background: selectedSector.color, borderColor: selectedSector.color } : {}}
                  />
                ))}
              </div>

              <div className="pin-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button key={n} className="pin-btn" onClick={() => handlePinPress(String(n))}>{n}</button>
                ))}
                <button className="pin-btn" onClick={handleBackspace} style={{ fontSize: 14 }}>APAGAR</button>
                <button className="pin-btn" onClick={() => handlePinPress("0")}>0</button>
                <button className="pin-btn" style={{ fontSize: 11, color: "var(--danger)" }} onClick={() => setFase("setores")}>SAIR</button>
              </div>
            </div>
          </div>
        )}

        {/* FASE: POS FRENTE DE CAIXA */}
        {fase === "pos" && (
          <>
            {/* CAIXA FECHADO SCREEN */}
            {!caixaAberto ? (
              <div style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                <div className="card-premium" style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                  <h2 style={{ fontFamily: "var(--display)", fontSize: 24, marginBottom: 6 }}>CAIXA FECHADO</h2>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 20 }}>Insira o saldo inicial em dinheiro para iniciar as vendas neste turno.</p>

                  <div style={{ textAlign: "left", marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 6 }}>SALDO INICIAL EM DINHEIRO (R$)</label>
                    <input
                      type="number"
                      min="0"
                      className="pos-search-input"
                      style={{ fontSize: 18, fontFamily: "var(--mono)", fontWeight: 600, padding: 12 }}
                      value={saldoAbertura}
                      onChange={e => setSaldoAbertura(e.target.value)}
                    />
                  </div>

                  <button className="btn-premium" style={{ width: "100%", padding: 14 }} onClick={handleOpenCaixa} disabled={loadingCaixa}>
                    {loadingCaixa ? "ABRINDO..." : "✓ ABRIR CAIXA E INICIAR TURNO"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ══════════ TELA DE VENDAS ══════════ */}
                {posTab === "vendas" && (
                  <div className="caixa-main-layout">
                    {/* Esquerda: Catálogo */}
                    <div className="pos-products-panel">
                      <form onSubmit={handleBarcodeSubmit} className="pos-search-box">
                        <input
                          type="text"
                          className="pos-search-input"
                          placeholder="Buscar produto por nome ou código..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="caixa-badge" style={{ whiteSpace: "nowrap" }}>Buscar</button>
                      </form>

                      {/* Persistent Inline Scanner preview block */}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                        <button
                          type="button"
                          onClick={handleToggleScannerActive}
                          className={`caixa-badge ${scannerActive ? "active" : ""}`}
                          style={{ fontSize: 11, padding: "8px 14px" }}
                        >
                          📹 Scanner Automático: {scannerActive ? "ATIVADO" : "DESATIVADO"}
                        </button>
                        <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
                          (Salvo no cache. Câmera sempre aberta para leitura rápida)
                        </span>
                      </div>

                      {scannerActive && (
                        <div className="inline-scanner" style={{ position: "relative", minHeight: 180, background: "#000", borderRadius: "var(--r)", overflow: "hidden", border: "2px solid var(--accent)", marginBottom: 12 }}>
                          <div id="reader" style={{ width: "100%" }} />
                          
                          {cameras.length > 0 && (
                            <div style={{ position: "absolute", top: 8, left: 8, zIndex: 11 }}>
                              <select
                                value={selectedCameraId}
                                onChange={async (e) => {
                                  const camId = e.target.value;
                                  setSelectedCameraId(camId);
                                  localStorage.setItem("caixa_preferred_camera_id", camId);
                                  await stopScanner();
                                  setTimeout(() => openInlineScanner(), 300);
                                }}
                                style={{
                                  background: "rgba(0,0,0,0.85)", color: "#fff", border: "1px solid var(--border)",
                                  padding: "4px 8px", borderRadius: 4, fontSize: 11, fontFamily: "var(--mono)",
                                  outline: "none", cursor: "pointer"
                                }}
                              >
                                <option value="">📷 Padrão (Traseira)</option>
                                {cameras.map(cam => (
                                  <option key={cam.id} value={cam.id}>
                                    {cam.label || `Câmera ${cam.id}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <div className="inline-scan-status" style={{ position: "absolute", bottom: 6, left: 6, right: 6, zIndex: 10, background: "rgba(0,0,0,0.75)", color: "#fff", padding: "4px 8px", borderRadius: 4, textAlign: "center", fontSize: 11, fontFamily: "var(--mono)" }}>
                            {scanStatus.msg}
                          </div>
                          {scanStatus.t === "err" && (
                            <button
                              type="button"
                              onClick={() => openInlineScanner()}
                              style={{
                                position: "absolute", top: 8, right: 8, zIndex: 11,
                                background: "var(--accent)", color: "#fff", border: "none",
                                padding: "6px 12px", borderRadius: 4, fontSize: 11,
                                fontFamily: "var(--sans)", fontWeight: 600, cursor: "pointer"
                              }}
                            >
                              🔄 Tentar novamente
                            </button>
                          )}
                        </div>
                      )}

                      {/* Categorias */}
                      <div className="pos-categories-nav">
                        <span
                          className={`pos-cat-pill ${!selectedCat ? "active" : ""}`}
                          onClick={() => setSelectedCat("")}
                        >
                          Todos
                        </span>
                        {cats.map(c => (
                          <span
                            key={c.id}
                            className={`pos-cat-pill ${selectedCat === c.nome ? "active" : ""}`}
                            onClick={() => setSelectedCat(c.nome)}
                          >
                            {c.nome}
                          </span>
                        ))}
                      </div>

                      {/* Grid de produtos */}
                      <div className="pos-grid">
                        {filteredProducts.map(p => {
                          const qty = fluxoLoja === "loja" ? (p.qtdLoja || 0) : (p.quantidade || 0);
                          const price = Number(p.precoVenda) || 0;
                          return (
                            <div key={p.id} className="pos-prod-card" onClick={() => addToCart(p)}>
                              <div className="pos-prod-card-name">{p.nome}</div>
                              <div className="pos-prod-card-stock">
                                Disponível: <strong style={{ color: qty > 0 ? "var(--success)" : "var(--danger)" }}>{qty}</strong>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                                <div className="pos-prod-card-price">
                                  R$ {price.toFixed(2)}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickEditProduct(p);
                                    setQuickPriceVal(price.toString());
                                  }}
                                  style={{
                                    background: "rgba(249,115,22,0.1)",
                                    border: "1px solid rgba(249,115,22,0.3)",
                                    cursor: "pointer",
                                    color: "var(--accent)",
                                    display: "flex",
                                    padding: "2px 6px",
                                    borderRadius: 3,
                                    fontSize: 10,
                                    fontFamily: "var(--sans)",
                                    fontWeight: 600
                                  }}
                                  title="Editar Preço no Banco"
                                >
                                  ✏️ Editar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Direita: Carrinho */}
                    <div className="pos-cart-panel">
                      <div style={{ padding: 16, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, fontSize: 16 }}>Carrinho</span>
                        <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>{cart.length} item(s)</span>
                      </div>

                      {/* Lista Itens */}
                      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
                        {cart.length === 0 ? (
                          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-dim)", fontSize: 13, fontFamily: "var(--mono)" }}>
                            Carrinho vazio
                          </div>
                        ) : (
                          cart.map(item => {
                            const price = Number(item.precoVenda) || 0;
                            return (
                              <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.nome}</div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>R$</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={item.precoVenda === "" ? "" : price}
                                      onChange={(e) => {
                                        const newVal = e.target.value === "" ? "" : (Number(e.target.value) || 0);
                                        setCart(cart.map(i => i.id === item.id ? { ...i, precoVenda: newVal } : i));
                                      }}
                                      style={{
                                        width: 65,
                                        padding: "2px 4px",
                                        fontFamily: "var(--mono)",
                                        fontSize: 12,
                                        border: "1px solid var(--border2)",
                                        borderRadius: 3,
                                        background: "var(--surface2)",
                                        color: "var(--accent)",
                                        outline: "none"
                                      }}
                                    />
                                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>x {item.quantity}</span>
                                  </div>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => updateCartQty(item.id, -1)} style={{ width: 24, height: 24, border: "1px solid var(--border2)", borderRadius: 4, background: "var(--surface2)", color: "var(--text)", cursor: "pointer" }}>-</button>
                                    <button onClick={() => updateCartQty(item.id, 1)} style={{ width: 24, height: 24, border: "1px solid var(--border2)", borderRadius: 4, background: "var(--surface2)", color: "var(--text)", cursor: "pointer" }}>+</button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Formulário & Ações */}
                      <div style={{ padding: 16, borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>MÉTODO DE PAGAMENTO</label>
                            <select
                              className="pos-search-input"
                              value={payMethod}
                              onChange={e => setPayMethod(e.target.value)}
                              style={{ padding: "8px 10px" }}
                            >
                              <option value="Dinheiro">💵 Dinheiro</option>
                              <option value="Pix">📱 Pix</option>
                              <option value="Cartão">💳 Cartão de Crédito/Débito</option>
                              <option value="Fiado">📝 Fiado (Notas)</option>
                            </select>
                          </div>

                          {payMethod === "Fiado" ? (
                            <div>
                              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>SELECIONAR CLIENTE FIADOR</label>
                              <select
                                className="pos-search-input"
                                value={selectedFiadorId}
                                onChange={e => setSelectedFiadorId(e.target.value)}
                                style={{ padding: "8px 10px" }}
                              >
                                <option value="">Escolha um fiador...</option>
                                {fiadores.map(f => {
                                  const remaining = f.limite - f.dividaAtual;
                                  return (
                                    <option key={f.id} value={f.id}>
                                      {f.nome} (Disp: R$ {remaining.toFixed(2)})
                                    </option>
                                  );
                                })}
                              </select>
                              {selectedFiadorId && (() => {
                                const selectedFiador = fiadores.find(f => f.id === selectedFiadorId);
                                if (!selectedFiador) return null;
                                const remaining = selectedFiador.limite - selectedFiador.dividaAtual;
                                return (
                                  <div style={{ fontSize: 11, color: remaining < cartTotal ? "var(--danger)" : "var(--text-dim)", fontFamily: "var(--mono)", marginTop: 6 }}>
                                    Limite: R$ {selectedFiador.limite.toFixed(2)} | Dívida: R$ {selectedFiador.dividaAtual.toFixed(2)}<br />
                                    <strong>Disponível: R$ {remaining.toFixed(2)}</strong>
                                    {remaining < cartTotal && <div style={{ color: "var(--danger)", fontWeight: 600, marginTop: 4 }}>Crédito Insuficiente!</div>}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div>
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>NOME DO CLIENTE</label>
                                <input
                                  type="text"
                                  className="pos-search-input"
                                  placeholder="Consumidor Final"
                                  value={clientName}
                                  onChange={e => setClientName(e.target.value)}
                                  style={{ padding: "8px 10px" }}
                                />
                              </div>
                              {payMethod === "Dinheiro" && (
                                <div>
                                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>VALOR RECEBIDO (TROCO)</label>
                                  <input
                                    type="text"
                                    className="pos-search-input"
                                    placeholder="0,00"
                                    value={valorPago}
                                    onChange={e => setValorPago(e.target.value)}
                                    style={{ padding: "8px 10px", fontFamily: "var(--mono)" }}
                                  />
                                  {(() => {
                                    const pagoVal = parseFloat(valorPago.replace(",", ".")) || 0;
                                    const troco = pagoVal - cartTotal;
                                    if (pagoVal > 0) {
                                      return (
                                        <div style={{ fontSize: 12, marginTop: 6, fontWeight: "bold", color: troco >= 0 ? "var(--success)" : "var(--danger)" }}>
                                          {troco >= 0 
                                            ? `Troco: R$ ${troco.toFixed(2)}` 
                                            : `Falta: R$ ${Math.abs(troco).toFixed(2)}`}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>Total Geral</span>
                          <span style={{ fontSize: 22, fontFamily: "var(--mono)", fontWeight: 700, color: "var(--accent)" }}>
                            R$ {cartTotal.toFixed(2)}
                          </span>
                        </div>

                        <button
                          className="caixa-badge"
                          onClick={handleCheckout}
                          disabled={cart.length === 0 || (payMethod === "Fiado" && (!selectedFiadorId || (fiadores.find(f => f.id === selectedFiadorId)?.limite - fiadores.find(f => f.id === selectedFiadorId)?.dividaAtual < cartTotal)))}
                          style={{ width: "100%", padding: "12px", background: "var(--success)", color: "#fff", borderColor: "var(--success)", fontSize: 14, fontWeight: 600, textAlign: "center", display: "block" }}
                        >
                          Finalizar Venda
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════ GERENCIAR FIADORES ══════════ */}
                {posTab === "fiadores" && (
                  <div className="caixa-main-layout" style={{ overflowY: "auto", display: "block", padding: 20 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, maxWidth: 1100, margin: "0 auto" }}>

                      {/* Lado Esquerdo: Lista de Clientes */}
                      <div className="card-premium">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                          <h3 style={{ fontFamily: "var(--display)", fontSize: 20 }}>CLIENTES FIADORES</h3>
                          <input
                            type="text"
                            placeholder="Buscar por nome..."
                            className="pos-search-input"
                            style={{ maxWidth: 220, padding: "6px 12px", fontSize: 12 }}
                            value={fiadorSearch}
                            onChange={e => setFiadorSearch(e.target.value)}
                          />
                        </div>

                        {filteredFiadores.length === 0 ? (
                          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--mono)", fontSize: 13 }}>
                            Nenhum fiador cadastrado.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {filteredFiadores.map(f => {
                              const remainingLimit = f.limite - f.dividaAtual;
                              return (
                                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--surface2)" }}>
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <strong style={{ fontSize: 14 }}>{f.nome}</strong>
                                      {f.fiel ? <span className="badge-fiel">FIEL</span> : <span className="badge-infiel">REGULAR</span>}
                                    </div>
                                    <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>
                                      <span>Limite: <strong>R$ {f.limite.toFixed(2)}</strong></span>
                                      <span>Dívida: <strong style={{ color: f.dividaAtual > 0 ? "var(--danger)" : "var(--text-dim)" }}>R$ {f.dividaAtual.toFixed(2)}</strong></span>
                                      <span>Restante: <strong style={{ color: "var(--success)" }}>R$ {remainingLimit.toFixed(2)}</strong></span>
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--mono)" }}>
                                      Dia de Vencimento: todo dia {f.diaPagamento}
                                    </div>
                                  </div>

                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                      className="caixa-badge"
                                      style={{ borderColor: "var(--success)", color: "var(--success)", fontSize: 11 }}
                                      onClick={() => { setShowQuitarFiador(f); setQuitarValor(f.dividaAtual.toString()); }}
                                    >
                                      💵 Receber
                                    </button>
                                    <button
                                      className="caixa-badge"
                                      style={{ borderColor: "var(--danger)", color: "var(--danger)", fontSize: 11 }}
                                      onClick={() => handleDeleteFiador(f)}
                                    >
                                      ✕ Excluir
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Lado Direito: Formulário de Cadastro */}
                      <div className="card-premium" style={{ height: "fit-content" }}>
                        <h3 style={{ fontFamily: "var(--display)", fontSize: 20, marginBottom: 14 }}>CADASTRAR FIADOR</h3>
                        <form onSubmit={handleAddFiador} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>NOME COMPLETO</label>
                            <input
                              type="text"
                              required
                              className="pos-search-input"
                              placeholder="Nome do cliente"
                              value={newFiadorNome}
                              onChange={e => setNewFiadorNome(e.target.value)}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>LIMITE DE CRÉDITO (R$)</label>
                            <input
                              type="number"
                              min="1"
                              required
                              className="pos-search-input"
                              placeholder="Ex: 500"
                              value={newFiadorLimite}
                              onChange={e => setNewFiadorLimite(e.target.value)}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>DIA DE PAGAMENTO</label>
                            <select
                              className="pos-search-input"
                              value={newFiadorDiaPagamento}
                              onChange={e => setNewFiadorDiaPagamento(e.target.value)}
                            >
                              {[...Array(31)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>todo dia {i + 1}</option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <input
                              type="checkbox"
                              id="fiel"
                              checked={newFiadorFiel}
                              onChange={e => setNewFiadorFiel(e.target.checked)}
                            />
                            <label htmlFor="fiel" style={{ fontSize: 12, userSelect: "none", cursor: "pointer" }}>Cliente Fiel/Fiel do Fiado</label>
                          </div>

                          <button type="submit" className="btn-premium" style={{ marginTop: 10 }} disabled={savingFiador}>
                            {savingFiador ? "CADASTRANDO..." : "+ CADASTRAR FIADOR"}
                          </button>
                        </form>
                      </div>

                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* INLINE SCANNER FALLBACK (FULLSCREEN MODAL IF MANUALLY OPENED VIA SCANNER BUTTON) */}
        {scannerOpen && (
          <div className="scanner-overlay">
            <div className="scanner-video-wrap">
              <div id="reader" style={{ width: "100%", height: "100%" }} />
              <div className="scan-frame">
                <div className="scan-line-anim" />
              </div>
            </div>
            <div className="scan-bar">
              <div className={`scan-status ${scanStatus.t}`}>{scanStatus.msg}</div>
              <div className="scan-bar-row">
                <input
                  type="text"
                  className="pos-search-input"
                  placeholder="Digitar código manualmente..."
                  style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { onBarcodeScan(e.target.value.trim()); e.target.value = ""; } }}
                />
                <button className="caixa-badge" style={{ borderColor: "var(--danger)", color: "var(--danger)", whiteSpace: "nowrap" }} onClick={closeScanner}>✕ Fechar</button>
              </div>
            </div>
          </div>
        )}

        {/* QTY MODAL */}
        {qtyModal && (
          <div className="qty-modal-bg">
            <div className="qty-modal">
              <div style={{ fontFamily: "var(--display)", fontSize: 18, marginBottom: 4 }}>{qtyModal.product.nome}</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)", marginBottom: 16 }}>Código: {qtyModal.code}</div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 6 }}>QUANTIDADE</label>
              <input
                type="number" min="1" autoFocus
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmQty()}
                style={{ width: "100%", padding: "10px", fontFamily: "var(--mono)", fontSize: 18, textAlign: "center", background: "var(--surface2)", border: "1px solid var(--accent)", borderRadius: "var(--r)", color: "var(--text)", outline: "none", marginBottom: 12 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="caixa-badge" style={{ flex: 1, padding: 10, textAlign: "center" }}
                  onClick={() => { setQtyModal(null); histRef.current = []; }}>Cancelar</button>
                <button className="caixa-badge" style={{ flex: 1, padding: 10, background: "var(--success)", color: "#fff", borderColor: "var(--success)", textAlign: "center" }}
                  onClick={confirmQty}>✔ Adicionar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: FECHAMENTO DE CAIXA */}
        {showClosure && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", width: "90%", maxWidth: 400, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontFamily: "var(--display)", fontSize: 20 }}>FECHAMENTO DE TURNO</h3>
                <button onClick={() => setShowClosure(false)} style={{ background: "transparent", border: "none", fontSize: 16, cursor: "pointer", color: "var(--text)" }}>✕</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20, fontFamily: "var(--mono)", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Saldo de Abertura:</span>
                  <strong>R$ {caixaInfo?.saldoInicial?.toFixed(2)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Vendas Realizadas:</span>
                  <strong>{sessionSales.length}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Faturamento do Turno:</span>
                  <strong style={{ color: "var(--success)" }}>
                    R$ {sessionSales.reduce((sum, s) => sum + s.total, 0).toFixed(2)}
                  </strong>
                </div>

                <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>VENDAS POR MÉTODO:</div>
                  {["Dinheiro", "Pix", "Cartão", "Fiado"].map(method => {
                    const totalVal = sessionSales.filter(s => s.metodoPagamento === method).reduce((sum, s) => sum + s.total, 0);
                    return (
                      <div key={method} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span>{method}:</span>
                        <span>R$ {totalVal.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>Saldo Esperado no Caixa (Dinheiro):</span>
                  <strong>R$ {((caixaInfo?.saldoInicial || 0) + sessionSales.filter(s => s.metodoPagamento === "Dinheiro").reduce((sum, s) => sum + s.total, 0)).toFixed(2)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="caixa-badge" style={{ flex: 1, padding: 10, textAlign: "center" }} onClick={() => setShowClosure(false)}>Cancelar</button>
                <button
                  className="caixa-badge"
                  style={{ flex: 1, padding: 10, background: "var(--danger)", color: "#fff", borderColor: "var(--danger)", textAlign: "center" }}
                  onClick={handleCloseShift}
                >
                  Confirmar Fechamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RECEBER PAGAMENTO DE FIADO */}
        {showQuitarFiador && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", width: "90%", maxWidth: 360, padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontFamily: "var(--display)", fontSize: 20 }}>RECEBER PAGAMENTO</h3>
                <button onClick={() => setShowQuitarFiador(null)} style={{ background: "transparent", border: "none", fontSize: 16, cursor: "pointer", color: "var(--text)" }}>✕</button>
              </div>

              <form onSubmit={handlePayDebt} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, background: "var(--surface2)", padding: 10, borderRadius: "var(--r)" }}>
                  Cliente: <strong>{showQuitarFiador.nome}</strong><br />
                  Dívida Atual: <strong style={{ color: "var(--danger)" }}>R$ {showQuitarFiador.dividaAtual.toFixed(2)}</strong>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>VALOR PAGO (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="pos-search-input"
                    value={quitarValor}
                    onChange={e => setQuitarValor(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>MEIO DE PAGAMENTO</label>
                  <select
                    className="pos-search-input"
                    value={quitarMetodo}
                    onChange={e => setQuitarMetodo(e.target.value)}
                  >
                    <option value="Dinheiro">💵 Dinheiro</option>
                    <option value="Pix">📱 Pix</option>
                    <option value="Cartão">💳 Cartão de Crédito/Débito</option>
                  </select>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" className="caixa-badge" style={{ flex: 1, padding: 10, textAlign: "center" }} onClick={() => setShowQuitarFiador(null)}>Cancelar</button>
                  <button
                    type="submit"
                    className="caixa-badge"
                    style={{ flex: 1, padding: 10, background: "var(--success)", color: "#fff", borderColor: "var(--success)", textAlign: "center" }}
                  >
                    Registrar Recebimento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* QUICK PRICE EDIT MODAL */}
        {quickEditProduct && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", width: "90%", maxWidth: 320, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontFamily: "var(--display)", fontSize: 18 }}>EDITAR VALOR</h3>
                <button onClick={() => setQuickEditProduct(null)} style={{ background: "transparent", border: "none", fontSize: 16, cursor: "pointer", color: "var(--text)" }}>✕</button>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--accent)" }}>{quickEditProduct.nome}</div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>NOVO VALOR (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pos-search-input"
                  value={quickPriceVal}
                  onChange={e => setQuickPriceVal(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === "Enter") {
                      await handleSaveQuickPrice();
                    }
                  }}
                  autoFocus
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="caixa-badge" style={{ flex: 1, padding: 8, textAlign: "center" }} onClick={() => setQuickEditProduct(null)}>Cancelar</button>
                <button
                  className="caixa-badge"
                  style={{ flex: 1, padding: 8, background: "var(--accent)", color: "#fff", borderColor: "var(--accent)", textAlign: "center" }}
                  onClick={handleSaveQuickPrice}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOASTS CONTAINER */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className="toast" style={{ borderLeftColor: t.type === "success" ? "var(--success)" : t.type === "error" ? "var(--danger)" : t.type === "warn" ? "var(--warn)" : "var(--accent)" }}>
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}