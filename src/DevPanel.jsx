/**
 * DevPanel.jsx — Página do Desenvolvedor (Dev Master)
 * Rota: /dev
 * Acesso: micaelbardimtech@gmail.com (Dev Master) — login automático reconhecido.
 */

import { useState, useEffect, useMemo } from "react";
import { db, auth } from "./firebase.js";
import {
  collection, doc, updateDoc, setDoc, onSnapshot, getDocs, deleteDoc, addDoc, query, where
} from "firebase/firestore";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import { Icon } from "./icons.jsx";

const DEV_MASTER_EMAIL = "micaelbardimtech@gmail.com";

// ──────────────── Estilos Aprimorados ────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
  :root {
    --bg:#f4f1ea; --surface:#ffffff; --surface2:#eae4d3; --surface3:#ded6c0;
    --border:#dcd5c0; --border2:#c8be9f;
    --accent:#f97316; --accent2:#ea580c;
    --success:#10b981; --danger:#ef4444; --info:#3b82f6; --warn:#f59e0b;
    --text:#292524; --text-dim:#78716c; --text-mid:#57534e;
    --mono:'IBM Plex Mono',monospace; --sans:'IBM Plex Sans',sans-serif;
    --display:'Bebas Neue',sans-serif; --r:8px;
  }
  .dark {
    --bg:#09090b; --surface:#18181b; --surface2:#27272a; --surface3:#3f3f46;
    --border:#27272a; --border2:#3f3a37;
    --text:#fafaf9; --text-dim:#a8a29e; --text-mid:#d6d3d1;
  }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:var(--sans); transition: background .25s, color .25s; }
  .dev-app { min-height:100vh; background:var(--bg); color:var(--text); }
  .dev-header { background:var(--surface); border-bottom:1px solid var(--border); height:60px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; position:sticky; top:0; z-index:100; box-shadow:0 4px 20px rgba(0,0,0,0.03); }
  .dev-header-logo { font-family:var(--display); font-size:22px; letter-spacing:2px; color:var(--accent); display:flex; align-items:center; gap:10px; }
  .dev-header-right { display:flex; align-items:center; gap:10px; }
  .dev-content { max-width:1160px; margin:0 auto; padding:28px 20px 80px; }
  .hbtn { background:var(--surface2); border:1px solid var(--border); color:var(--text-mid); padding:7px 12px; font-family:var(--mono); font-size:11px; font-weight:600; cursor:pointer; transition:all .2s; text-transform:uppercase; letter-spacing:.5px; border-radius:var(--r); white-space:nowrap; display:inline-flex; align-items:center; gap:6px; }
  .hbtn:hover { border-color:var(--accent); color:var(--accent); background:rgba(249,115,22,.08); }
  .hbtn.danger:hover { border-color:var(--danger); color:var(--danger); background:rgba(239,68,68,.08); }

  /* Login */
  .dev-login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:var(--bg); }
  .dev-login-card { background:var(--surface); border:1.5px solid var(--border); border-top:5px solid var(--accent); border-radius:20px; padding:36px 32px; width:100%; max-width:440px; box-shadow:0 24px 48px rgba(0,0,0,.15); }

  /* Card Aprimorado */
  .dev-account-card { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:20px; transition:all .2s cubic-bezier(0.16,1,0.3,1); box-shadow:0 2px 8px rgba(0,0,0,.03); }
  .dev-account-card:hover { border-color:var(--border2); box-shadow:0 8px 24px rgba(0,0,0,.08); transform:translateY(-2px); }

  .card { background:var(--surface); border:1px solid var(--border); border-radius:12px; }
  .form-group { margin-bottom:14px; }
  .form-label { display:block; font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-dim); margin-bottom:6px; }
  .form-input { width:100%; background:var(--surface2); border:1.5px solid var(--border2); border-radius:var(--r); padding:10px 14px; font-size:13px; color:var(--text); font-family:var(--sans); outline:none; transition:all .2s; }
  .form-input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(249,115,22,.15); }
  
  .btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:var(--r); border:1.5px solid transparent; font-family:var(--mono); font-size:11px; font-weight:600; cursor:pointer; transition:all .2s; letter-spacing:.5px; text-transform:uppercase; white-space:nowrap; }
  .btn-accent { background:var(--accent); color:#fff; border-color:var(--accent); }
  .btn-accent:hover { background:var(--accent2); border-color:var(--accent2); }
  .btn-lg { padding:12px 22px; font-size:12px; }
  .btn-outline { background:var(--surface2); color:var(--text-mid); border-color:var(--border2); }
  .btn-outline:hover { border-color:var(--accent); color:var(--accent); background:rgba(249,115,22,.08); }
  .btn-success { background:var(--success); color:#fff; border-color:var(--success); }
  .btn-success:hover { opacity:.9; }
  .btn-danger { background:var(--danger); color:#fff; border-color:var(--danger); }
  .btn-danger:hover { opacity:.9; }
  .btn-warn { background:var(--warn); color:#000; border-color:var(--warn); }
  .btn-warn:hover { opacity:.9; }

  .badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border:1px solid; border-radius:100px; font-family:var(--mono); font-size:10px; font-weight:700; letter-spacing:.5px; }
  .ftab { background:transparent; border:1.5px solid var(--border2); border-radius:var(--r); color:var(--text-dim); font-family:var(--mono); font-size:11px; padding:8px 16px; cursor:pointer; transition:all .18s; display:inline-flex; align-items:center; gap:6px; font-weight:600; }
  .ftab.active, .ftab:hover { border-color:var(--accent); color:var(--accent); background:rgba(249,115,22,.08); }
  .spinner { display:inline-block; width:18px; height:18px; border:2.5px solid var(--border2); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .animate-fade-in { animation:fadeIn .25s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .animate-scale-in { animation:scaleIn .18s ease; }
  @keyframes scaleIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }

  /* Overlay Modal */
  .modal-overlay { position:fixed; inset:0; z-index:2000; background:rgba(0,0,0,.75); display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px); }
  .modal-box { background:var(--surface); border:1.5px solid var(--border); border-radius:16px; width:100%; max-width:500px; padding:28px; box-shadow:0 24px 48px rgba(0,0,0,.35); }

  /* Dev Action Group */
  .action-group { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .action-group-title { font-family:var(--mono); font-size:9px; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; width:100%; margin-bottom:2px; font-weight:600; }
`;

// ──────────────── Toast ────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "success" ? "var(--success)" : t.type === "error" ? "var(--danger)" : t.type === "info" ? "var(--info)" : "var(--accent)",
          color:"#fff", padding:"11px 18px", borderRadius:10, fontFamily:"var(--mono)", fontSize:12, fontWeight:600,
          boxShadow:"0 8px 24px rgba(0,0,0,.25)", animation:"scaleIn .18s ease"
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ──────────────── Tela de Login Dev ────────────────
function DevLoginScreen({ onLogin, theme, toggleTheme }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    const trimEmail = email.trim().toLowerCase();
    if (trimEmail !== DEV_MASTER_EMAIL) {
      setErr("Acesso negado: apenas o Dev Master pode acessar esta página.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, trimEmail, pass);
      onLogin();
    } catch (ex) {
      setErr(ex.code === "auth/wrong-password" || ex.code === "auth/invalid-credential"
        ? "Senha incorreta."
        : ex.code === "auth/user-not-found"
        ? "Conta não encontrada."
        : ex.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dev-login-wrap">
      <div className="dev-login-card animate-scale-in">
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
          <button onClick={toggleTheme} className="hbtn" title={theme === "light" ? "Modo Escuro" : "Modo Claro"} style={{ padding:"6px 8px" }}>
            <Icon name={theme === "light" ? "moon" : "sun"} size={14} />
          </button>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:"rgba(249,115,22,0.12)", border:"1px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Icon name="code" size={28} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily:"var(--display)", fontSize:28, letterSpacing:1 }}>PAINEL DO DESENVOLVEDOR</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:1.5 }}>ACESSO RESTRITO — DEV MASTER</div>
          </div>
        </div>

        <p style={{ fontSize:13, color:"var(--text-mid)", lineHeight:1.5, marginBottom:22 }}>
          Esta página é exclusiva para o <strong>Dev Master</strong>. Aqui você gerencia contas, reseta bancos, injeta dados de teste e inspeciona dados do Firestore.
        </p>

        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">E-mail do Dev Master</label>
            <input
              type="email"
              className="form-input"
              placeholder="micaelbardimtech@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label className="form-label">Senha</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
            />
          </div>

          {err && (
            <div style={{ color:"var(--danger)", fontFamily:"var(--mono)", fontSize:11, background:"rgba(239,68,68,.08)", padding:"10px 14px", borderRadius:8, border:"1px solid rgba(239,68,68,.2)" }}>
              {err}
            </div>
          )}

          <button type="submit" className="btn btn-accent btn-lg" style={{ width:"100%", marginTop:4, justifyContent:"center" }} disabled={loading}>
            {loading ? <span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> : <Icon name="lock" size={15} />}
            {loading ? "Autenticando..." : "ACESSAR PAINEL DEV"}
          </button>
        </form>

        <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid var(--border)", textAlign:"center" }}>
          <a href="/" style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6 }}>
            <Icon name="arrowLeft" size={13} /> Voltar para o Sistema
          </a>
        </div>
      </div>
    </div>
  );
}

// ──────────────── Funções Auxiliares de Banco ────────────────
async function resetCompanyData(companyId) {
  const sectorsSnap = await getDocs(collection(db, "users", companyId, "setores"));
  for (const sDoc of sectorsSnap.docs) {
    const sId = sDoc.id;
    const subcols = ["produtos", "log", "requisicoes", "config", "req_usuarios", "caixas", "vendas"];
    for (const sub of subcols) {
      const subSnap = await getDocs(collection(db, "users", companyId, "setores", sId, sub));
      for (const itemDoc of subSnap.docs) {
        await deleteDoc(doc(db, "users", companyId, "setores", sId, sub, itemDoc.id));
      }
    }
    await deleteDoc(doc(db, "users", companyId, "setores", sId));
  }
}

async function deleteCompanyAccount(companyId) {
  await resetCompanyData(companyId);
  await deleteDoc(doc(db, "users", companyId));
}

// Injeção de Produtos Realistas e Categorizados com Quantidades Variadas para Teste/Print
async function seedTestData(companyId) {
  let sectorId = "exfood";
  const sectorsSnap = await getDocs(collection(db, "users", companyId, "setores"));
  if (!sectorsSnap.empty) {
    sectorId = sectorsSnap.docs[0].id;
  } else {
    await setDoc(doc(db, "users", companyId, "setores", "exfood"), {
      label: "Alimentação / Exfood",
      color: "var(--accent)",
      iconName: "package",
      pin: "1234"
    });
  }

  // Lista variada com produtos das mesmas categorias realistas e quantidades totalmente variadas
  const testProducts = [
    // 🥤 Categoria: Bebidas & Gelados
    { nome: "Coca-Cola Lança 350ml (Teste)", categoria: "Bebidas & Gelados", quantidade: 24, preco: 6.50, barcode: "7891000100011" },
    { nome: "Suco Natural de Laranja 500ml (Teste)", categoria: "Bebidas & Gelados", quantidade: 12, preco: 9.00, barcode: "7891000100028" },
    { nome: "Cerveja Heineken Long Neck 330ml (Teste)", categoria: "Bebidas & Gelados", quantidade: 36, preco: 11.50, barcode: "7891000100035" },
    { nome: "Sorvete Kibon Creme 1.5L (Teste)", categoria: "Bebidas & Gelados", quantidade: 5, preco: 28.00, barcode: "7891000100042" },
    { nome: "Red Bull Energy Drink 250ml (Teste)", categoria: "Bebidas & Gelados", quantidade: 18, preco: 14.00, barcode: "7891000100059" },

    // 🍔 Categoria: Comidas & Lanches
    { nome: "Hambúrguer Artesanal X-Burguer (Teste)", categoria: "Comidas & Lanches", quantidade: 15, preco: 32.90, barcode: "7891000200018" },
    { nome: "Batata Frita Palito Especial 1kg (Teste)", categoria: "Comidas & Lanches", quantidade: 8, preco: 22.50, barcode: "7891000200025" },
    { nome: "Pizza Calabresa Família (Teste)", categoria: "Comidas & Lanches", quantidade: 3, preco: 48.00, barcode: "7891000200032" },
    { nome: "Pastel de Carne Especial (Teste)", categoria: "Comidas & Lanches", quantidade: 20, preco: 10.00, barcode: "7891000200049" },
    { nome: "Açaí na Tigela Completo 500ml (Teste)", categoria: "Comidas & Lanches", quantidade: 14, preco: 18.50, barcode: "7891000200056" },

    // 🧼 Categoria: Limpeza & Insumos
    { nome: "Guardanapo de Papel Folha Dupla (Teste)", categoria: "Limpeza & Insumos", quantidade: 45, preco: 5.80, barcode: "7891000300015" },
    { nome: "Detergente Concentrado 5L (Teste)", categoria: "Limpeza & Insumos", quantidade: 4, preco: 34.00, barcode: "7891000300022" },
    { nome: "Papel Toalha Rolo Triplo (Teste)", categoria: "Limpeza & Insumos", quantidade: 22, preco: 12.90, barcode: "7891000300039" }
  ];

  for (const prod of testProducts) {
    await addDoc(collection(db, "users", companyId, "setores", sectorId, "produtos"), {
      ...prod,
      isTest: true,
      criadoEm: new Date().toISOString()
    });
  }
}

async function cleanTestData(companyId) {
  const sectorsSnap = await getDocs(collection(db, "users", companyId, "setores"));
  let removedCount = 0;
  for (const sDoc of sectorsSnap.docs) {
    const prodsSnap = await getDocs(collection(db, "users", companyId, "setores", sDoc.id, "produtos"));
    for (const pDoc of prodsSnap.docs) {
      if (pDoc.data().isTest || (pDoc.data().nome && pDoc.data().nome.includes("(Teste)"))) {
        await deleteDoc(doc(db, "users", companyId, "setores", sDoc.id, "produtos", pDoc.id));
        removedCount++;
      }
    }
  }
  return removedCount;
}

async function fetchCompanyMetrics(companyId) {
  const sectorsSnap = await getDocs(collection(db, "users", companyId, "setores"));
  let totalProds = 0;
  let totalLogs = 0;
  let totalReqs = 0;
  let totalOps = 0;

  for (const sDoc of sectorsSnap.docs) {
    const sId = sDoc.id;
    const [p, l, r, o] = await Promise.all([
      getDocs(collection(db, "users", companyId, "setores", sId, "produtos")),
      getDocs(collection(db, "users", companyId, "setores", sId, "log")),
      getDocs(collection(db, "users", companyId, "setores", sId, "requisicoes")),
      getDocs(collection(db, "users", companyId, "setores", sId, "req_usuarios"))
    ]);
    totalProds += p.size;
    totalLogs += l.size;
    totalReqs += r.size;
    totalOps += o.size;
  }

  return {
    setores: sectorsSnap.size,
    produtos: totalProds,
    logs: totalLogs,
    requisicoes: totalReqs,
    operadores: totalOps,
    totalDocs: sectorsSnap.size + totalProds + totalLogs + totalReqs + totalOps
  };
}

// ──────────────── Explorador do Banco de Dados ────────────────
function DatabaseExplorer({ accounts, addToast }) {
  const [selectedCompany, setSelectedCompany] = useState(accounts[0]?.id || "");
  const [subTab, setSubTab] = useState("produtos");
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadExplorerData = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    try {
      const sectorsSnap = await getDocs(collection(db, "users", selectedCompany, "setores"));
      const sectors = sectorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (subTab === "setores") {
        setDataList(sectors);
        setLoading(false);
        return;
      }

      let allItems = [];
      for (const s of sectors) {
        let colName = "produtos";
        if (subTab === "logs") colName = "log";
        if (subTab === "requisicoes") colName = "requisicoes";
        if (subTab === "operadores") colName = "req_usuarios";

        const snap = await getDocs(collection(db, "users", selectedCompany, "setores", s.id, colName));
        const items = snap.docs.map(d => ({ id: d.id, setorId: s.id, setorLabel: s.label, ...d.data() }));
        allItems.push(...items);
      }
      setDataList(allItems);
    } catch (e) {
      addToast("Erro ao ler banco: " + e.message, "error");
      setDataList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExplorerData();
  }, [selectedCompany, subTab]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return dataList;
    return dataList.filter(item => {
      const str = JSON.stringify(item).toLowerCase();
      return str.includes(q);
    });
  }, [dataList, search]);

  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 1, color: "var(--accent)", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="database" size={22} /> EXPLORADOR DO BANCO DE DADOS
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
            Inspecione registros e dados armazenados no Firestore por empresa
          </div>
        </div>

        {/* Seletor de Empresa */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 600 }}>Empresa:</label>
          <select
            value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            className="form-input"
            style={{ width: 240, height: 40, padding: "6px 12px", fontSize: 13 }}
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.nomeEmpresa || acc.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navegação de Sub-Coleções */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {[
          ["produtos", "Produtos", "package"],
          ["setores", "Setores", "building"],
          ["operadores", "Operadores", "user"],
          ["requisicoes", "Requisições", "clipboardList"],
          ["logs", "Logs", "fileText"],
        ].map(([tKey, tLabel, icon]) => (
          <button
            key={tKey}
            className={`ftab ${subTab === tKey ? "active" : ""}`}
            onClick={() => setSubTab(tKey)}
            style={{ fontSize: 11, padding: "8px 16px" }}
          >
            <Icon name={icon} size={14} /> {tLabel} ({subTab === tKey ? filtered.length : ""})
          </button>
        ))}

        <button
          className="btn btn-outline"
          style={{ fontSize: 11, padding: "7px 14px", marginLeft: "auto" }}
          onClick={loadExplorerData}
          disabled={loading}
        >
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><Icon name="search" size={13} /> Atualizar</>}
        </button>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          className="form-input"
          placeholder="Filtrar registros por qualquer campo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* Resultados */}
      {loading ? (
        <div style={{ padding: 50, textAlign: "center" }}>
          <span className="spinner" style={{ width: 32, height: 32 }} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>Carregando registros...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)", background: "var(--surface2)", borderRadius: "var(--r)" }}>
          Nenhum registro encontrado nesta coleção.
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "var(--surface2)", textAlign: "left", color: "var(--text-dim)", textTransform: "uppercase" }}>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>ID</th>
                {subTab !== "setores" && <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>Setor</th>}
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>Dados Principais</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>JSON do Documento</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 14px", color: "var(--accent)", fontWeight: 700 }}>{item.id}</td>
                  {subTab !== "setores" && <td style={{ padding: "10px 14px" }}>{item.setorLabel || item.setorId}</td>}
                  <td style={{ padding: "10px 14px", color: "var(--text)" }}>
                    {subTab === "produtos" && <strong>{item.nome} ({item.quantidade}x) - R$ {item.preco || "0,00"} {item.isTest && <span style={{ color: "var(--warn)", marginLeft: 6 }}>[TESTE]</span>}</strong>}
                    {subTab === "setores" && <strong>{item.label} (PIN: {item.pin || "N/A"})</strong>}
                    {subTab === "operadores" && <strong>{item.nome} (PIN: {item.pin || "Sem Senha"})</strong>}
                    {subTab === "requisicoes" && <strong>Req #{item.codigo} · {item.solicitante} · {item.status} ({item.prioridade || "medio"})</strong>}
                    {subTab === "logs" && <strong>[{item.tipo}] {item.descricao || item.produto} ({item.usuario})</strong>}
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-dim)", fontSize: 10, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {JSON.stringify(item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────── Painel Principal Dev ────────────────
function DevPanelContent({ user, addToast, theme, toggleTheme }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("contas"); // "contas" | "explorer"

  const [updatingId, setUpdatingId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Modais de Confirmação
  const [resetModalAcc, setResetModalAcc] = useState(null);
  const [resetConfirmInput, setResetConfirmInput] = useState("");

  const [deleteModalAcc, setDeleteModalAcc] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");

  // Métricas
  const [accountMetrics, setAccountMetrics] = useState({});

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) =>
        (a.nomeEmpresa || a.id || "").toLowerCase().localeCompare((b.nomeEmpresa || b.id || "").toLowerCase())
      );
      setAccounts(list);
      setLoading(false);
    }, (err) => {
      addToast("Erro ao carregar contas: " + err.message, "error");
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const toggleCaixaStatus = async (account) => {
    const newStatus = account.caixaAtivo !== true;
    setUpdatingId(account.id);
    try {
      await updateDoc(doc(db, "users", account.id), {
        caixaAtivo: newStatus,
        caixaModificadoEm: new Date().toISOString(),
        caixaModificadoPor: user?.email || "dev"
      });
      addToast(`Modo Caixa ${newStatus ? "ATIVADO" : "DESATIVADO"} para ${account.nomeEmpresa || account.id}!`, newStatus ? "success" : "info");
    } catch {
      try {
        await setDoc(doc(db, "users", account.id), { caixaAtivo: newStatus, caixaModificadoEm: new Date().toISOString() }, { merge: true });
        addToast(`Modo Caixa atualizado!`, "success");
      } catch (e2) {
        addToast("Erro: " + e2.message, "error");
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetAccountSubmit = async (e) => {
    e.preventDefault();
    if (resetConfirmInput.trim().toUpperCase() !== "RESETAR") {
      addToast("Digite exatamente RESETAR para confirmar.", "error");
      return;
    }
    const acc = resetModalAcc;
    setResetModalAcc(null);
    setActionLoadingId(acc.id);
    try {
      await resetCompanyData(acc.id);
      addToast(`Banco da conta ${acc.nomeEmpresa || acc.id} foi totalmente resetado!`, "success");
      handleLoadMetricsForAccount(acc.id);
    } catch (err) {
      addToast("Erro ao resetar: " + err.message, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteAccountSubmit = async (e) => {
    e.preventDefault();
    const acc = deleteModalAcc;
    if (deleteConfirmInput.trim() !== acc.id.trim()) {
      addToast(`Digite o e-mail/ID exatamente (${acc.id}) para apagar.`, "error");
      return;
    }
    setDeleteModalAcc(null);
    setActionLoadingId(acc.id);
    try {
      await deleteCompanyAccount(acc.id);
      addToast(`Conta ${acc.id} excluída com sucesso!`, "success");
    } catch (err) {
      addToast("Erro ao excluir conta: " + err.message, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSeedProducts = async (account) => {
    setActionLoadingId(account.id);
    try {
      await seedTestData(account.id);
      addToast(`✅ Produtos demo (Bebidas, Comidas, Limpeza com quantidades variadas) injetados com sucesso!`, "success");
      handleLoadMetricsForAccount(account.id);
    } catch (e) {
      addToast("Erro ao injetar teste: " + e.message, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCleanProducts = async (account) => {
    setActionLoadingId(account.id);
    try {
      const count = await cleanTestData(account.id);
      addToast(`🧹 ${count} produto(s) de teste removido(s)!`, "success");
      handleLoadMetricsForAccount(account.id);
    } catch (e) {
      addToast("Erro ao limpar testes: " + e.message, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLoadMetricsForAccount = async (companyId) => {
    setActionLoadingId(companyId);
    try {
      const m = await fetchCompanyMetrics(companyId);
      setAccountMetrics(prev => ({ ...prev, [companyId]: m }));
    } catch (e) {
      addToast("Erro ao carregar métricas: " + e.message, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const total = accounts.length;
  const activeCount = accounts.filter(a => a.caixaAtivo === true).length;
  const inactiveCount = total - activeCount;

  const filteredAccounts = useMemo(() => accounts.filter(acc => {
    const q = search.toLowerCase();
    const match = (acc.nomeEmpresa || "").toLowerCase().includes(q) ||
      (acc.id || "").toLowerCase().includes(q) ||
      (acc.numero || "").includes(q);
    if (!match) return false;
    if (statusFilter === "active") return acc.caixaAtivo === true;
    if (statusFilter === "inactive") return acc.caixaAtivo !== true;
    return true;
  }), [accounts, search, statusFilter]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="dev-app">
      {/* Header Dev Aprimorado */}
      <header className="dev-header">
        <div className="dev-header-logo">
          <Icon name="code" size={22} color="var(--accent)" />
          <span>PAINEL DEV MASTER</span>
          <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:1.5, background:"rgba(249,115,22,.12)", border:"1px solid var(--accent)", padding:"2px 8px", borderRadius:6, fontWeight:700 }}>
            v2.5
          </span>
        </div>
        <div className="dev-header-right">
          <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)" }}>{user?.email}</span>
          <button className="hbtn" onClick={toggleTheme} title={theme === "light" ? "Modo Escuro" : "Modo Claro"} style={{ padding:"7px 10px" }}>
            <Icon name={theme === "light" ? "moon" : "sun"} size={14} />
          </button>
          <a href="/" className="hbtn" title="Voltar ao Sistema" style={{ textDecoration:"none" }}>
            <Icon name="arrowLeft" size={13} /> Sistema
          </a>
          <button className="hbtn danger" onClick={handleLogout} title="Sair">
            <Icon name="logout" size={14} />
          </button>
        </div>
      </header>

      <div className="dev-content animate-fade-in">
        {/* Navegação por Abas Principais */}
        <div style={{ display:"flex", gap:10, marginBottom:22, borderBottom:"2px solid var(--border)", paddingBottom:14 }}>
          <button
            className={`ftab ${activeTab === "contas" ? "active" : ""}`}
            onClick={() => setActiveTab("contas")}
            style={{ fontSize:12, padding:"10px 20px" }}
          >
            <Icon name="building" size={16} /> GESTÃO DE CONTAS ({accounts.length})
          </button>

          <button
            className={`ftab ${activeTab === "explorer" ? "active" : ""}`}
            onClick={() => setActiveTab("explorer")}
            style={{ fontSize:12, padding:"10px 20px" }}
          >
            <Icon name="database" size={16} /> EXPLORADOR DB GERAL
          </button>
        </div>

        {activeTab === "explorer" ? (
          <DatabaseExplorer accounts={accounts} addToast={addToast} />
        ) : (
          <>
            {/* Métricas Globais */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))", gap:14, marginBottom:24 }}>
              <div className="card" style={{ padding:20, borderLeft:"5px solid var(--info)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, alignItems:"center" }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:1.5, fontWeight:600 }}>Total de Contas</span>
                  <Icon name="building" size={20} color="var(--info)" />
                </div>
                <div style={{ fontFamily:"var(--display)", fontSize:38, lineHeight:1 }}>{total}</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", marginTop:4 }}>Empresas cadastradas</div>
              </div>

              <div className="card" style={{ padding:20, borderLeft:"5px solid var(--success)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, alignItems:"center" }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:1.5, fontWeight:600 }}>Caixa POS Ativo</span>
                  <Icon name="store" size={20} color="var(--success)" />
                </div>
                <div style={{ fontFamily:"var(--display)", fontSize:38, lineHeight:1, color:"var(--success)" }}>{activeCount}</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", marginTop:4 }}>Liberadas para PDV</div>
              </div>

              <div className="card" style={{ padding:20, borderLeft:"5px solid var(--accent)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, alignItems:"center" }}>
                  <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:1.5, fontWeight:600 }}>Apenas Estoque</span>
                  <Icon name="lock" size={20} color="var(--accent)" />
                </div>
                <div style={{ fontFamily:"var(--display)", fontSize:38, lineHeight:1, color:"var(--accent)" }}>{inactiveCount}</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", marginTop:4 }}>Caixa desativado</div>
              </div>
            </div>

            {/* Barra de Busca e Filtros */}
            <div className="card" style={{ padding:16, marginBottom:20 }}>
              <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ flex:"1 1 260px", position:"relative" }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Buscar por empresa, e-mail ou telefone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ paddingLeft:36, height:40, fontSize:13 }}
                  />
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"var(--text-dim)", pointerEvents:"none", display:"flex" }}>
                    <Icon name="search" size={15} />
                  </span>
                  {search && (
                    <button onClick={() => setSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer" }}>
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>

                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button className={`ftab ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")} style={{ fontSize:11, padding:"7px 14px" }}>
                    TODAS ({total})
                  </button>
                  <button className={`ftab ${statusFilter === "active" ? "active" : ""}`} onClick={() => setStatusFilter("active")} style={{ fontSize:11, padding:"7px 14px" }}>
                    <Icon name="checkCircle" size={12} color="var(--success)" /> CAIXA ATIVO ({activeCount})
                  </button>
                  <button className={`ftab ${statusFilter === "inactive" ? "active" : ""}`} onClick={() => setStatusFilter("inactive")} style={{ fontSize:11, padding:"7px 14px" }}>
                    <Icon name="lock" size={12} color="var(--accent)" /> DESATIVADO ({inactiveCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Lista de Contas com Layout Aprimorado */}
            {loading ? (
              <div style={{ padding:50, textAlign:"center" }}>
                <span className="spinner" style={{ width:36, height:36 }} />
                <div style={{ marginTop:12, fontFamily:"var(--mono)", fontSize:13, color:"var(--text-dim)" }}>Carregando empresas...</div>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="card" style={{ padding:50, textAlign:"center", color:"var(--text-dim)" }}>
                <Icon name="search" size={36} color="var(--text-dim)" />
                <div style={{ fontFamily:"var(--display)", fontSize:22, marginTop:12 }}>Nenhuma empresa encontrada</div>
                <div style={{ fontFamily:"var(--mono)", fontSize:12, marginTop:4 }}>Tente buscar por outro termo.</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {filteredAccounts.map(account => {
                  const isCaixaActive = account.caixaAtivo === true;
                  const isUpdating = updatingId === account.id;
                  const isActionLoading = actionLoadingId === account.id;
                  const metrics = accountMetrics[account.id];

                  return (
                    <div
                      key={account.id}
                      className="dev-account-card"
                      style={{
                        borderLeft:`6px solid ${isCaixaActive ? "var(--success)" : "var(--border2)"}`
                      }}
                    >
                      {/* Cabeçalho da Empresa */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:14, marginBottom:12 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:14, flex:"1 1 280px" }}>
                          <div style={{ width:48, height:48, borderRadius:12, background: isCaixaActive ? "rgba(16,185,129,.14)" : "rgba(120,113,108,.12)", border:`1px solid ${isCaixaActive ? "var(--success)" : "var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <Icon name={isCaixaActive ? "store" : "building"} size={22} color={isCaixaActive ? "var(--success)" : "var(--text-dim)"} />
                          </div>
                          <div style={{ minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                              <span style={{ fontFamily:"var(--sans)", fontSize:17, fontWeight:700 }}>{account.nomeEmpresa || "Empresa sem Nome"}</span>
                              {isCaixaActive ? (
                                <span className="badge" style={{ background:"rgba(16,185,129,.14)", color:"var(--success)", borderColor:"var(--success)" }}>
                                  <Icon name="checkCircle" size={11} /> CAIXA ATIVO (POS)
                                </span>
                              ) : (
                                <span className="badge" style={{ background:"var(--surface2)", color:"var(--text-dim)", borderColor:"var(--border2)" }}>
                                  <Icon name="lock" size={11} /> CAIXA BLOQUEADO
                                </span>
                              )}
                            </div>
                            <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", marginTop:4, display:"flex", gap:14, flexWrap:"wrap" }}>
                              <span><strong>ID:</strong> {account.id}</span>
                              {account.numero && <span><strong>Tel:</strong> {account.numero}</span>}
                              {account.pais && <span><strong>País:</strong> {account.pais}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Botão de Chave do Modo Caixa */}
                        <button
                          onClick={() => toggleCaixaStatus(account)}
                          disabled={isUpdating}
                          className={`btn ${isCaixaActive ? "btn-danger" : "btn-success"}`}
                          style={{ fontSize:11, padding:"8px 16px", minWidth:150, fontWeight:700, justifyContent:"center" }}
                        >
                          {isUpdating
                            ? <span className="spinner" style={{ width:14, height:14, borderWidth:2 }} />
                            : isCaixaActive
                            ? <><Icon name="toggleRight" size={15} /> DESATIVAR CAIXA</>
                            : <><Icon name="toggleLeft" size={15} /> ATIVAR CAIXA (POS)</>
                          }
                        </button>
                      </div>

                      {/* Métricas do Banco da Conta */}
                      {metrics && (
                        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"10px 14px", marginBottom:12, display:"flex", gap:14, flexWrap:"wrap", alignItems:"center", fontFamily:"var(--mono)", fontSize:11 }}>
                          <span style={{ color:"var(--accent)", fontWeight:700 }}>📊 Métricas DB:</span>
                          <span>🏢 {metrics.setores} setor(es)</span>
                          <span>📦 {metrics.produtos} produto(s)</span>
                          <span>📜 {metrics.logs} log(s)</span>
                          <span>📋 {metrics.requisicoes} requisições</span>
                          <span>👥 {metrics.operadores} operador(es)</span>
                          <span style={{ color:"var(--info)", fontWeight:700, marginLeft:"auto" }}>Total: {metrics.totalDocs} docs</span>
                        </div>
                      )}

                      {/* Barra de Ações com Layout Organizado */}
                      <div style={{ paddingTop:12, borderTop:"1px solid var(--border)", display:"flex", flexDirection:"column", gap:8 }}>
                        <div className="action-group">
                          <div className="action-group-title">Ações Dev & Banco de Dados:</div>

                          {/* Injetar Testes Demo */}
                          <button
                            className="btn btn-accent"
                            style={{ fontSize:10, padding:"6px 12px" }}
                            onClick={() => handleSeedProducts(account)}
                            disabled={isActionLoading}
                            title="Injeta produtos demo categorizados (Comidas, Bebidas & Limpeza) com quantidades e preços realistas"
                          >
                            <Icon name="package" size={13} /> Injetar Teste (Comidas/Bebidas/Limpeza)
                          </button>

                          {/* Limpar Teste */}
                          <button
                            className="btn btn-outline"
                            style={{ fontSize:10, padding:"6px 12px" }}
                            onClick={() => handleCleanProducts(account)}
                            disabled={isActionLoading}
                            title="Remove os produtos de teste criados"
                          >
                            <Icon name="x" size={13} /> Limpar Testes
                          </button>

                          {/* Consultar Uso DB */}
                          <button
                            className="btn btn-outline"
                            style={{ fontSize:10, padding:"6px 12px", borderColor:"var(--info)", color:"var(--info)" }}
                            onClick={() => handleLoadMetricsForAccount(account.id)}
                            disabled={isActionLoading}
                            title="Calcula total de registros e documentos no Firestore para cuidar da saúde do banco"
                          >
                            <Icon name="database" size={13} /> Consultar Uso DB
                          </button>

                          {/* Resetar Banco */}
                          <button
                            className="btn btn-outline"
                            style={{ fontSize:10, padding:"6px 12px", borderColor:"var(--warn)", color:"var(--warn)" }}
                            onClick={() => { setResetModalAcc(account); setResetConfirmInput(""); }}
                            disabled={isActionLoading}
                            title="Restaura a conta zerando setores, produtos, operadores, requisições e logs"
                          >
                            <Icon name="trash" size={13} /> Resetar Banco
                          </button>

                          {/* Deletar Conta */}
                          <button
                            className="btn btn-danger"
                            style={{ fontSize:10, padding:"6px 12px", marginLeft:"auto" }}
                            onClick={() => { setDeleteModalAcc(account); setDeleteConfirmInput(""); }}
                            disabled={isActionLoading}
                            title="Exclui totalmente a empresa do sistema"
                          >
                            <Icon name="trash" size={13} /> Deletar Conta
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Confirmação de RESETAR BANCO */}
      {resetModalAcc && (
        <div className="modal-overlay" onClick={() => setResetModalAcc(null)}>
          <div className="modal-box animate-scale-in" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"var(--display)", fontSize:24, color:"var(--warn)", marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
              <Icon name="trash" size={22} /> RESETAR BANCO DE DADOS
            </div>
            <p style={{ fontSize:13, color:"var(--text-mid)", lineHeight:1.5, marginBottom:18 }}>
              Atenção! Esta ação apagará <strong>TODOS os setores, produtos, operadores, requisições e logs</strong> da empresa <strong style={{ color:"var(--accent)" }}>{resetModalAcc.nomeEmpresa || resetModalAcc.id}</strong>.
            </p>
            <form onSubmit={handleResetAccountSubmit}>
              <div className="form-group">
                <label className="form-label">Digite RESETAR para confirmar</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="RESETAR"
                  value={resetConfirmInput}
                  onChange={e => setResetConfirmInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                <button type="button" className="btn btn-outline" style={{ flex:1 }} onClick={() => setResetModalAcc(null)}>Cancelar</button>
                <button type="submit" className="btn btn-warn" style={{ flex:1 }}>Confirmar Reset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de DELETAR CONTA */}
      {deleteModalAcc && (
        <div className="modal-overlay" onClick={() => setDeleteModalAcc(null)}>
          <div className="modal-box animate-scale-in" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"var(--display)", fontSize:24, color:"var(--danger)", marginBottom:10, display:"flex", alignItems:"center", gap:10 }}>
              <Icon name="trash" size={22} /> EXCLUIR CONTA DEFINITIVAMENTE
            </div>
            <p style={{ fontSize:13, color:"var(--text-mid)", lineHeight:1.5, marginBottom:18 }}>
              Esta ação apaga permanentemente a empresa <strong style={{ color:"var(--danger)" }}>{deleteModalAcc.id}</strong> e todos os seus operadores e registros do banco.
            </p>
            <form onSubmit={handleDeleteAccountSubmit}>
              <div className="form-group">
                <label className="form-label">Digite o ID/E-mail ({deleteModalAcc.id}) para confirmar</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={deleteModalAcc.id}
                  value={deleteConfirmInput}
                  onChange={e => setDeleteConfirmInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display:"flex", gap:10, marginTop:18 }}>
                <button type="button" className="btn btn-outline" style={{ flex:1 }} onClick={() => setDeleteModalAcc(null)}>Cancelar</button>
                <button type="submit" className="btn btn-danger" style={{ flex:1 }}>Excluir Conta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────── Página Principal ────────────────
export default function DevPage() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [user, setUser] = useState(undefined);
  const [toasts, setToasts] = useState([]);
  const [authorized, setAuthorized] = useState(false);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthorized(!!u && u.email?.toLowerCase() === DEV_MASTER_EMAIL);
    });
    return () => unsub();
  }, []);

  const addToast = (message, type = "info") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };

  if (user === undefined) {
    return (
      <>
        <style>{styles}</style>
        <div className={`dev-app ${theme}`} style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
          <span className="spinner" style={{ width:32, height:32 }} />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className={`dev-app ${theme}`}>
        {authorized
          ? <DevPanelContent user={user} addToast={addToast} theme={theme} toggleTheme={toggleTheme} />
          : <DevLoginScreen onLogin={() => {}} theme={theme} toggleTheme={toggleTheme} />
        }
        <Toast toasts={toasts} />
      </div>
    </>
  );
}

export function DevPanel({ user, addToast }) {
  return <DevPanelContent user={user} addToast={addToast} theme="light" toggleTheme={() => {}} />;
}
