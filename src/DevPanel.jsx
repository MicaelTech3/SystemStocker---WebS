/**
 * DevPanel.jsx — Página do Desenvolvedor (Dev)
 * Rota: /dev
 * Acesso: micaelbardimtech@gmail.com (Dev Master) — login automático reconhecido.
 * Todas as demais contas precisam autenticar para acessar.
 */

import { useState, useEffect, useMemo } from "react";
import { db, auth } from "./firebase.js";
import {
  collection, doc, updateDoc, setDoc, onSnapshot
} from "firebase/firestore";
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "firebase/auth";
import { Icon } from "./icons.jsx";

const DEV_MASTER_EMAIL = "micaelbardimtech@gmail.com";

// ──────────────── Estilos ────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
  :root {
    --bg:#f5f2e9; --surface:#ffffff; --surface2:#e9e4d4;
    --border:#dfd9c4; --border2:#ccc4a8;
    --accent:#f97316; --accent2:#ea580c;
    --success:#10b981; --danger:#ef4444; --info:#3b82f6; --warn:#f59e0b;
    --text:#292524; --text-dim:#78716c; --text-mid:#57534e;
    --mono:'IBM Plex Mono',monospace; --sans:'IBM Plex Sans',sans-serif;
    --display:'Bebas Neue',sans-serif; --r:6px;
  }
  .dark {
    --bg:#0c0a09; --surface:#1c1917; --surface2:#292524;
    --border:#2e2a28; --border2:#3f3a37;
    --text:#fafaf9; --text-dim:#a8a29e; --text-mid:#d6d3d1;
  }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:var(--sans); transition: background .25s, color .25s; }
  .dev-app { min-height:100vh; background:var(--bg); color:var(--text); }
  .dev-header { background:var(--surface); border-bottom:1px solid var(--border); height:56px; display:flex; align-items:center; justify-content:space-between; padding:0 20px; position:sticky; top:0; z-index:100; }
  .dev-header-logo { font-family:var(--display); font-size:20px; letter-spacing:2px; color:var(--accent); display:flex; align-items:center; gap:8px; }
  .dev-header-right { display:flex; align-items:center; gap:6px; }
  .dev-content { max-width:960px; margin:0 auto; padding:24px 16px 60px; }
  .hbtn { background:var(--surface); border:1px solid var(--border); color:var(--text-dim); padding:6px 10px; font-family:var(--mono); font-size:11px; cursor:pointer; transition:all .2s; text-transform:uppercase; letter-spacing:1px; border-radius:var(--r); white-space:nowrap; display:inline-flex; align-items:center; gap:5px; }
  .hbtn:hover { border-color:var(--accent); color:var(--accent); }
  .hbtn.danger:hover { border-color:var(--danger); color:var(--danger); }

  /* Login */
  .dev-login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:var(--bg); }
  .dev-login-card { background:var(--surface); border:1.5px solid var(--border); border-top:4px solid var(--accent); border-radius:16px; padding:32px 28px; width:100%; max-width:420px; box-shadow:0 20px 40px rgba(0,0,0,.12); }

  /* Card */
  .card { background:var(--surface); border:1px solid var(--border); border-radius:10px; }
  .card.hover-lift { transition:transform .18s,box-shadow .18s; }
  .card.hover-lift:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.1); }
  .form-group { margin-bottom:14px; }
  .form-label { display:block; font-family:var(--mono); font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:var(--text-dim); margin-bottom:6px; }
  .form-input { width:100%; background:var(--surface2); border:1.5px solid var(--border2); border-radius:var(--r); padding:10px 12px; font-size:13px; color:var(--text); font-family:var(--sans); outline:none; transition:border-color .2s; }
  .form-input:focus { border-color:var(--accent); }
  .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; border-radius:var(--r); border:1.5px solid transparent; font-family:var(--mono); font-size:11px; font-weight:600; cursor:pointer; transition:all .2s; letter-spacing:.5px; text-transform:uppercase; }
  .btn-accent { background:var(--accent); color:#fff; border-color:var(--accent); }
  .btn-accent:hover { background:var(--accent2); border-color:var(--accent2); }
  .btn-lg { padding:11px 20px; font-size:12px; }
  .btn-outline { background:transparent; color:var(--text-mid); border-color:var(--border2); }
  .btn-outline:hover { border-color:var(--accent); color:var(--accent); }
  .btn-success { background:var(--success); color:#fff; border-color:var(--success); }
  .btn-success:hover { opacity:.85; }
  .btn-danger { background:var(--danger); color:#fff; border-color:var(--danger); }
  .btn-danger:hover { opacity:.85; }
  .page-title { font-family:var(--display); font-size:28px; letter-spacing:1px; display:flex; align-items:center; gap:10px; }
  .page-sub { font-family:var(--mono); font-size:11px; color:var(--text-dim); letter-spacing:1px; margin-top:2px; }
  .badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border:1px solid; border-radius:100px; font-family:var(--mono); font-size:10px; font-weight:600; }
  .ftab { background:transparent; border:1px solid var(--border2); border-radius:var(--r); color:var(--text-dim); font-family:var(--mono); font-size:10px; padding:6px 12px; cursor:pointer; transition:all .18s; display:inline-flex; align-items:center; gap:5px; }
  .ftab.active, .ftab:hover { border-color:var(--accent); color:var(--accent); background:rgba(249,115,22,.06); }
  .spinner { display:inline-block; width:20px; height:20px; border:2.5px solid var(--border2); border-top-color:var(--accent); border-radius:50%; animation:spin .7s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .animate-fade-in { animation:fadeIn .25s ease; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .animate-scale-in { animation:scaleIn .18s ease; }
  @keyframes scaleIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
`;

// ──────────────── Toast ────────────────
function Toast({ toasts }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "success" ? "var(--success)" : t.type === "error" ? "var(--danger)" : t.type === "info" ? "var(--info)" : "var(--accent)",
          color:"#fff", padding:"10px 16px", borderRadius:8, fontFamily:"var(--mono)", fontSize:12,
          boxShadow:"0 4px 12px rgba(0,0,0,.3)", animation:"scaleIn .18s ease"
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
        {/* Tema no canto superior direito */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
          <button onClick={toggleTheme} className="hbtn" title={theme === "light" ? "Modo Escuro" : "Modo Claro"} style={{ padding:"6px 8px" }}>
            <Icon name={theme === "light" ? "moon" : "sun"} size={14} />
          </button>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:"rgba(249,115,22,0.12)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Icon name="code" size={26} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontFamily:"var(--display)", fontSize:26, letterSpacing:1 }}>PAINEL DO DESENVOLVEDOR</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:1 }}>ACESSO RESTRITO — DEV MASTER</div>
          </div>
        </div>

        <p style={{ fontSize:13, color:"var(--text-mid)", lineHeight:1.5, marginBottom:22 }}>
          Esta página é exclusiva para o <strong>Dev Master</strong>. Aqui você gerencia contas e <strong>ativa individualmente o módulo de Caixa / POS</strong> para cada empresa cadastrada.
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
            <div style={{ color:"var(--danger)", fontFamily:"var(--mono)", fontSize:11, background:"rgba(239,68,68,.08)", padding:"8px 12px", borderRadius:6, border:"1px solid rgba(239,68,68,.2)" }}>
              {err}
            </div>
          )}

          <button type="submit" className="btn btn-accent btn-lg" style={{ width:"100%", marginTop:4, justifyContent:"center" }} disabled={loading}>
            {loading ? <span className="spinner" style={{ width:14, height:14, borderWidth:2 }} /> : <Icon name="lock" size={15} />}
            {loading ? "Autenticando..." : "ACESSAR PAINEL DEV"}
          </button>
        </form>

        <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid var(--border)", textAlign:"center" }}>
          <a href="/" style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:5 }}>
            <Icon name="arrowLeft" size={12} /> Voltar para o Sistema
          </a>
        </div>
      </div>
    </div>
  );
}

// ──────────────── Painel Principal Dev ────────────────
function DevPanelContent({ user, addToast, theme, toggleTheme }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

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

  const handleBulkToggle = async (targetStatus) => {
    if (!confirm(`Deseja realmente ${targetStatus ? "ATIVAR" : "DESATIVAR"} o modo caixa para TODAS as contas exibidas?`)) return;
    setLoading(true);
    try {
      await Promise.all(filteredAccounts.map(acc =>
        updateDoc(doc(db, "users", acc.id), {
          caixaAtivo: targetStatus,
          caixaModificadoEm: new Date().toISOString(),
          caixaModificadoPor: user?.email || "dev"
        }).catch(() =>
          setDoc(doc(db, "users", acc.id), { caixaAtivo: targetStatus }, { merge: true })
        )
      ));
      addToast(`Caixa ${targetStatus ? "ATIVADO" : "DESATIVADO"} em todas!`, "success");
    } catch (e) {
      addToast("Erro: " + e.message, "error");
    } finally {
      setLoading(false);
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
      {/* Header */}
      <header className="dev-header">
        <div className="dev-header-logo">
          <Icon name="code" size={20} color="var(--accent)" />
          <span>PAINEL DEV</span>
          <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", letterSpacing:1, background:"rgba(249,115,22,.1)", padding:"2px 8px", borderRadius:4 }}>DEV MASTER</span>
        </div>
        <div className="dev-header-right">
          <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)" }}>{user?.email}</span>
          <button className="hbtn" onClick={toggleTheme} title={theme === "light" ? "Modo Escuro" : "Modo Claro"} style={{ padding:"7px 8px" }}>
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
        {/* Métricas */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px,1fr))", gap:12, marginBottom:20 }}>
          <div className="card hover-lift" style={{ padding:18, borderLeft:"4px solid var(--info)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"center" }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:1 }}>Total Contas</span>
              <Icon name="building" size={18} color="var(--info)" />
            </div>
            <div style={{ fontFamily:"var(--display)", fontSize:34, lineHeight:1 }}>{total}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", marginTop:4 }}>Empresas registradas</div>
          </div>
          <div className="card hover-lift" style={{ padding:18, borderLeft:"4px solid var(--success)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"center" }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:1 }}>Caixa Ativado</span>
              <Icon name="store" size={18} color="var(--success)" />
            </div>
            <div style={{ fontFamily:"var(--display)", fontSize:34, lineHeight:1, color:"var(--success)" }}>{activeCount}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", marginTop:4 }}>Liberadas para PDV</div>
          </div>
          <div className="card hover-lift" style={{ padding:18, borderLeft:"4px solid var(--accent)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"center" }}>
              <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", textTransform:"uppercase", letterSpacing:1 }}>Sem Caixa</span>
              <Icon name="lock" size={18} color="var(--accent)" />
            </div>
            <div style={{ fontFamily:"var(--display)", fontSize:34, lineHeight:1, color:"var(--accent)" }}>{inactiveCount}</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", marginTop:4 }}>Apenas estoque</div>
          </div>
        </div>

        {/* Regra */}
        <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--r)", padding:"12px 16px", marginBottom:20, display:"flex", alignItems:"flex-start", gap:10 }}>
          <Icon name="info" size={16} color="var(--accent)" style={{ marginTop:2, flexShrink:0 }} />
          <div style={{ fontSize:12, color:"var(--text-mid)", lineHeight:1.5 }}>
            <strong>Política:</strong> Toda conta criada inicia com o módulo Caixa <strong>desativado</strong>. Ative individualmente abaixo para liberar o Frente de Caixa (POS).
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ padding:14, marginBottom:16 }}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ flex:"1 1 220px", position:"relative" }}>
              <input
                type="text"
                className="form-input"
                placeholder="Buscar empresa, email ou telefone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft:34, height:38, fontSize:12 }}
              />
              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text-dim)", pointerEvents:"none", display:"flex" }}>
                <Icon name="search" size={14} />
              </span>
              {search && (
                <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"var(--text-dim)", cursor:"pointer" }}>
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <button className={`ftab ${statusFilter === "all" ? "active" : ""}`} onClick={() => setStatusFilter("all")} style={{ fontSize:10, padding:"6px 10px" }}>
                TODAS ({total})
              </button>
              <button className={`ftab ${statusFilter === "active" ? "active" : ""}`} onClick={() => setStatusFilter("active")} style={{ fontSize:10, padding:"6px 10px" }}>
                <Icon name="checkCircle" size={11} color="var(--success)" /> ATIVAS ({activeCount})
              </button>
              <button className={`ftab ${statusFilter === "inactive" ? "active" : ""}`} onClick={() => setStatusFilter("inactive")} style={{ fontSize:10, padding:"6px 10px" }}>
                <Icon name="lock" size={11} color="var(--accent)" /> BLOQUEADAS ({inactiveCount})
              </button>
            </div>

            <div style={{ display:"flex", gap:6 }}>
              <button className="btn btn-outline" style={{ fontSize:10, padding:"6px 10px", borderColor:"var(--success)", color:"var(--success)" }} onClick={() => handleBulkToggle(true)} title="Ativar caixa em todas visíveis">
                <Icon name="check" size={11} /> Ativar Todos
              </button>
              <button className="btn btn-outline" style={{ fontSize:10, padding:"6px 10px", borderColor:"var(--danger)", color:"var(--danger)" }} onClick={() => handleBulkToggle(false)} title="Desativar caixa em todas visíveis">
                <Icon name="x" size={11} /> Desativar Todos
              </button>
            </div>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ padding:40, textAlign:"center" }}>
            <span className="spinner" style={{ width:32, height:32 }} />
            <div style={{ marginTop:10, fontFamily:"var(--mono)", fontSize:12, color:"var(--text-dim)" }}>Carregando contas...</div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="card" style={{ padding:40, textAlign:"center", color:"var(--text-dim)" }}>
            <Icon name="search" size={32} color="var(--text-dim)" />
            <div style={{ fontFamily:"var(--display)", fontSize:20, marginTop:10 }}>Nenhuma conta encontrada</div>
            <div style={{ fontFamily:"var(--mono)", fontSize:11, marginTop:4 }}>Tente buscar por outro termo.</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filteredAccounts.map(account => {
              const isCaixaActive = account.caixaAtivo === true;
              const isUpdating = updatingId === account.id;
              return (
                <div
                  key={account.id}
                  className="card hover-lift"
                  style={{
                    padding:"14px 18px",
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    flexWrap:"wrap", gap:12,
                    borderLeft:`5px solid ${isCaixaActive ? "var(--success)" : "var(--border2)"}`
                  }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:12, flex:"1 1 260px" }}>
                    <div style={{ width:42, height:42, borderRadius:10, background: isCaixaActive ? "rgba(16,185,129,.12)" : "rgba(120,113,108,.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Icon name={isCaixaActive ? "store" : "building"} size={20} color={isCaixaActive ? "var(--success)" : "var(--text-dim)"} />
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontFamily:"var(--sans)", fontSize:15, fontWeight:700 }}>{account.nomeEmpresa || "Empresa sem Nome"}</span>
                        {isCaixaActive ? (
                          <span className="badge" style={{ background:"rgba(16,185,129,.12)", color:"var(--success)", borderColor:"var(--success)" }}>
                            <Icon name="checkCircle" size={10} /> CAIXA ATIVO
                          </span>
                        ) : (
                          <span className="badge" style={{ background:"var(--surface2)", color:"var(--text-dim)", borderColor:"var(--border2)" }}>
                            <Icon name="lock" size={10} /> DESATIVADO
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", marginTop:3, display:"flex", gap:10, flexWrap:"wrap" }}>
                        <span><strong>ID:</strong> {account.id}</span>
                        {account.numero && <span><strong>Tel:</strong> {account.numero}</span>}
                        {account.pais && <span><strong>País:</strong> {account.pais}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                    <button
                      onClick={() => toggleCaixaStatus(account)}
                      disabled={isUpdating}
                      className={`btn ${isCaixaActive ? "btn-danger" : "btn-success"}`}
                      style={{ fontSize:11, padding:"7px 14px", minWidth:140, fontWeight:600, justifyContent:"center" }}
                    >
                      {isUpdating
                        ? <span className="spinner" style={{ width:13, height:13, borderWidth:2 }} />
                        : isCaixaActive
                        ? <><Icon name="toggleRight" size={14} /> DESATIVAR CAIXA</>
                        : <><Icon name="toggleLeft" size={14} /> ATIVAR CAIXA (POS)</>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────── Página Principal ────────────────
export default function DevPage() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [user, setUser] = useState(undefined); // undefined = loading, null = não logado
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

  // Loading
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

// Também exporta o componente antigo para compatibilidade interna (usado em App.jsx como tab)
export function DevPanel({ user, addToast }) {
  return <DevPanelContent user={user} addToast={addToast} theme="light" toggleTheme={() => {}} />;
}
