/**
 * Configuracoes.jsx
 * Aba de configurações separada do App.jsx principal
 * Exports: Configuracoes, ConfigRequisicao
 */

import { useState, useEffect, useRef } from "react";
import { db } from "./firebase.js";
import {
  getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  query, where, updateDoc, serverTimestamp, getDoc,
} from "firebase/firestore";

// ─── helpers ─────────────────────────────────────────────────
const getCol = (setor, type) => `estoque_${setor}_${type}`;
const getColPrivate = (setor, type) => `estoque_${setor}_${type}`;
const DEFAULT_THRESH = { baixo: 5, medio: 15 };

// ─── ícones inline ───────────────────────────────────────────
const Svg = ({ size = 14, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "inline-block", flexShrink: 0 }}>
    {children}
  </svg>
);
const IcoKey   = () => <Svg size={15}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></Svg>;
const IcoUser  = () => <Svg size={15}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>;
const IcoPlus  = () => <Svg size={15}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
const IcoSave  = () => <Svg size={15}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></Svg>;
const IcoTrash = () => <Svg size={14}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></Svg>;
const IcoEdit  = () => <Svg size={14}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Svg>;
const IcoX     = () => <Svg size={13}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Svg>;
const IcoCheck = () => <Svg size={14}><polyline points="20 6 9 17 4 12"/></Svg>;
const IcoSearch= () => <Svg size={14}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>;

// ─── SearchBox simples ────────────────────────────────────────
function SearchBox({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <div style={{ display:"flex", alignItems:"center", background:"var(--surface2)", border:"1px solid var(--border2)", borderRadius:"var(--r)", overflow:"hidden", marginBottom:10 }}>
      <span style={{ padding:"0 10px", color:"var(--text-dim)", display:"flex" }}><IcoSearch /></span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, padding:"10px 0" }}
      />
      {value && <button onClick={() => onChange("")} style={{ padding:"0 10px", background:"transparent", border:"none", color:"var(--text-dim)", cursor:"pointer", display:"flex" }}><IcoX /></button>}
    </div>
  );
}

// ─── DupAlert ────────────────────────────────────────────────
function DupAlert({ tipo, existente, onScrollTo, onEdit, onDelete, onDismiss }) {
  return (
    <div style={{ background:"rgba(250,204,21,.06)", border:"1px solid var(--warn)", borderRadius:"var(--r)", padding:"12px 14px", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:10 }}>
        <div>
          <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--warn)", letterSpacing:2, textTransform:"uppercase", marginBottom:3 }}>{tipo==="cat"?"Categoria já existe":"Produto já existe"}</div>
          <div style={{ fontFamily:"var(--display)", fontSize:18, letterSpacing:1 }}>{existente.nome}</div>
          {tipo==="prod" && <div style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--text-dim)", marginTop:2 }}>Categoria: {existente.categoria}</div>}
        </div>
        <button onClick={onDismiss} style={{ background:"transparent", border:"none", color:"var(--text-dim)", cursor:"pointer", padding:2 }}><IcoX /></button>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        <button className="btn btn-outline" style={{ fontSize:10,padding:"7px 10px" }} onClick={onScrollTo}><IcoSearch /> Ver existente</button>
        <button className="btn btn-outline" style={{ fontSize:10,padding:"7px 10px",color:"var(--info)",borderColor:"var(--info)" }} onClick={onEdit}><IcoEdit /> Renomear</button>
        <button className="btn btn-outline" style={{ fontSize:10,padding:"7px 10px",color:"var(--danger)",borderColor:"var(--danger)" }} onClick={onDelete}><IcoTrash /> Excluir</button>
      </div>
    </div>
  );
}

// ============================================================
// CONFIG REQUISIÇÃO
// ============================================================
export function ConfigRequisicao({ setor, addToast }) {
  const [pinAtual, setPinAtual]     = useState("");
  const [pinNovo, setPinNovo]       = useState("");
  const [savingPin, setSavingPin]   = useState(false);
  const [usuarios, setUsuarios]     = useState([]);
  const [novoUser, setNovoUser]     = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [editId, setEditId]         = useState(null);
  const [editVal, setEditVal]       = useState("");
  const [loading, setLoading]       = useState(true);

  const colConfig = getColPrivate(setor, "config");
  const colUsers  = getColPrivate(setor, "req_usuarios");

  const load = async () => {
    setLoading(true);
    try {
      const [pinSnap, uSnap] = await Promise.all([
        getDoc(doc(db, colConfig, "requisicao_config")),
        getDocs(collection(db, colUsers)),
      ]);
      setPinAtual(pinSnap.exists() ? (pinSnap.data().pin || "") : "");
      setUsuarios(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [setor]);

  const savePin = async () => {
    if (pinNovo && (pinNovo.length !== 4 || !/^\d{4}$/.test(pinNovo))) {
      addToast("PIN deve ter 4 dígitos.", "error"); return;
    }
    setSavingPin(true);
    try {
      await setDoc(doc(db, colConfig, "requisicao_config"), { pin: pinNovo || "", updatedAt: new Date().toISOString() });
      setPinAtual(pinNovo);
      setPinNovo("");
      addToast(pinNovo ? `PIN ${pinNovo} salvo!` : "PIN removido.", "success");
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setSavingPin(false); }
  };

  const addUser = async () => {
    const nome = novoUser.trim();
    if (!nome) return;
    if (usuarios.some(u => u.nome.toLowerCase() === nome.toLowerCase())) { addToast("Usuário já existe.", "error"); return; }
    setSavingUser(true);
    try {
      await addDoc(collection(db, colUsers), { nome, criadoEm: serverTimestamp() });
      addToast(`"${nome}" adicionado!`, "success"); setNovoUser(""); load();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setSavingUser(false); }
  };

  const saveEdit = async (u) => {
    const novo = editVal.trim();
    if (!novo || novo === u.nome) { setEditId(null); return; }
    if (usuarios.some(x => x.id !== u.id && x.nome.toLowerCase() === novo.toLowerCase())) { addToast("Nome já existe.", "error"); return; }
    try {
      await updateDoc(doc(db, colUsers, u.id), { nome: novo });
      addToast(`Renomeado → "${novo}"`, "success"); setEditId(null); load();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
  };

  const delUser = async (u) => {
    if (!confirm(`Remover "${u.nome}"?`)) return;
    try { await deleteDoc(doc(db, colUsers, u.id)); addToast("Removido.", "success"); load(); }
    catch (e) { addToast("Erro: " + e.message, "error"); }
  };

  if (loading) return <div style={{ padding:20, textAlign:"center" }}><span className="spinner" /></div>;

  return (
    <div>
      {/* PIN */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-title" style={{ display:"flex", alignItems:"center", gap:8 }}>
          <IcoKey /> PIN DE ACESSO — {LABELS[setor]||setor}
        </div>
        <p style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", marginBottom:14 }}>
          Senha de 4 dígitos exigida ao acessar o site de requisições. Deixe em branco para acesso livre.
        </p>
        {pinAtual && (
          <div style={{ background:"rgba(245,166,35,.06)", border:"1px solid var(--accent)", borderRadius:"var(--r)", padding:"10px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:10 }}>
            <IcoKey />
            <span style={{ fontFamily:"var(--mono)", fontSize:12 }}>
              PIN atual: <strong style={{ color:"var(--accent)", letterSpacing:8, fontSize:18 }}>{pinAtual}</strong>
            </span>
            <button className="btn btn-outline" onClick={() => { setPinNovo(""); savePin(); }}
              style={{ marginLeft:"auto", fontSize:10, padding:"5px 10px", color:"var(--danger)", borderColor:"var(--danger)" }}>
              REMOVER
            </button>
          </div>
        )}
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input
            type="text" inputMode="numeric" maxLength={4} placeholder="0000"
            value={pinNovo} onChange={e => setPinNovo(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ background:"var(--surface2)", border:"1px solid var(--border2)", color:"var(--text)", padding:"12px 14px", fontFamily:"var(--mono)", fontSize:20, letterSpacing:8, outline:"none", borderRadius:"var(--r)", width:130, textAlign:"center" }}
          />
          <button className="btn btn-accent" onClick={savePin} disabled={savingPin}>
            {savingPin ? <span className="spinner" /> : <><IcoSave /> {pinNovo ? "SALVAR PIN" : "LIMPAR PIN"}</>}
          </button>
        </div>
      </div>

      {/* Usuários */}
      <div className="card">
        <div className="card-title" style={{ display:"flex", alignItems:"center", gap:8 }}>
          <IcoUser /> USUÁRIOS DO SETOR
        </div>
        <p style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", marginBottom:14 }}>
          Nomes disponíveis para seleção na tela de requisição.
        </p>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <input className="form-input" placeholder="Nome do usuário..." value={novoUser}
            onChange={e => setNovoUser(e.target.value)} onKeyDown={e => e.key==="Enter" && addUser()} style={{ flex:1 }}/>
          <button className="btn btn-accent" onClick={addUser} disabled={savingUser || !novoUser.trim()} style={{ padding:"12px 16px" }}>
            {savingUser ? <span className="spinner" /> : <IcoPlus />}
          </button>
        </div>
        {usuarios.length === 0
          ? <div style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--text-dim)", padding:"10px 0" }}>Nenhum usuário cadastrado.</div>
          : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[...usuarios].sort((a, b) => a.nome.localeCompare(b.nome)).map(u => (
                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"var(--r)" }}>
                  {editId === u.id ? (
                    <>
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter") saveEdit(u); if(e.key==="Escape") setEditId(null); }}
                        style={{ flex:1, background:"var(--surface)", border:"1px solid var(--accent)", color:"var(--text)", padding:"6px 10px", fontFamily:"var(--mono)", fontSize:13, outline:"none", borderRadius:"var(--r)" }}/>
                      <button className="btn-icon-sm" style={{ borderColor:"var(--success)", color:"var(--success)" }} onClick={() => saveEdit(u)}><IcoCheck /></button>
                      <button className="btn-icon-sm" onClick={() => setEditId(null)}><IcoX /></button>
                    </>
                  ) : (
                    <>
                      <IcoUser />
                      <span style={{ fontFamily:"var(--mono)", fontSize:13, flex:1 }}>{u.nome}</span>
                      <button className="btn-icon-sm" onClick={() => { setEditId(u.id); setEditVal(u.nome); }}><IcoEdit /></button>
                      <button className="btn-icon-sm" onClick={() => delUser(u)}><IcoTrash /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ============================================================
// CONFIGURACOES (componente principal da aba)
// ============================================================
export function Configuracoes({ setor, user, addToast, thresh, onThreshChange, resolveSetor, getCol: getColProp, registrarLog, db: dbProp }) {
  // Usa o db e helpers passados pelo App ou os próprios
  const _db = dbProp || db;
  const _getCol = getColProp || getCol;

  const [configSubTab, setConfigSubTab] = useState("geral");

  const colCat    = _getCol(setor, "categorias");
  const colPadrao = _getCol(setor, "produtos_padrao");
  const colEst    = _getCol(setor, "produtos");

  const [cats, setCats]       = useState([]);
  const [prods, setProds]     = useState([]);
  const [loading, setLoading] = useState(true);

  const [nomeCat, setNomeCat]   = useState("");
  const [nomeProd, setNomeProd] = useState("");
  const [catProd, setCatProd]   = useState("");
  const [precoVenda, setPrecoVenda] = useState("");

  const [localThresh, setLocalThresh] = useState(thresh || DEFAULT_THRESH);
  const [savingThresh, setSavingThresh] = useState(false);

  const [editCatId, setEditCatId]   = useState(null);
  const [editCatVal, setEditCatVal] = useState("");
  const [editProdId, setEditProdId] = useState(null);
  const [editProdVal, setEditProdVal] = useState("");
  const [editProdPreco, setEditProdPreco] = useState("");

  const [searchCat, setSearchCat]   = useState("");
  const [searchProd, setSearchProd] = useState("");
  const [dupCat, setDupCat]   = useState(null);
  const [dupProd, setDupProd] = useState(null);

  const [highlightCat, setHighlightCat]   = useState(null);
  const [highlightProd, setHighlightProd] = useState(null);

  const catItemRefs  = useRef({});
  const prodItemRefs = useRef({});

  const [modoLoja, setModoLoja] = useState(false);
  const [fluxoLoja, setFluxoLoja] = useState("estoque");
  const [savingLoja, setSavingLoja] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const colLojaCfg = _getCol(setor, "config");
      const [sc, sp, lojaSnap] = await Promise.all([
        getDocs(collection(_db, colCat)),
        getDocs(collection(_db, colPadrao)),
        getDoc(doc(_db, colLojaCfg, "loja_config"))
      ]);
      setCats(sc.docs.map(d => ({ id: d.id, ...d.data() })));
      setProds(sp.docs.map(d => ({ id: d.id, ...d.data() })));
      if (lojaSnap.exists()) {
        const data = lojaSnap.data();
        setModoLoja(data.modoLoja || false);
        setFluxoLoja(data.fluxoLoja || "estoque");
      } else {
        setModoLoja(false);
        setFluxoLoja("estoque");
      }
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setLoading(false); }
  };

  const saveLojaConfig = async (newModo, newFluxo) => {
    setSavingLoja(true);
    try {
      const colLojaCfg = _getCol(setor, "config");
      await setDoc(doc(_db, colLojaCfg, "loja_config"), {
        modoLoja: newModo,
        fluxoLoja: newFluxo,
        updatedAt: new Date().toISOString()
      });
      setModoLoja(newModo);
      setFluxoLoja(newFluxo);
      addToast("Configuração da Loja salva!", "success");
      if (window.dispatchEvent) {
        window.dispatchEvent(new Event("lojaConfigChanged"));
      }
    } catch (e) {
      addToast("Erro ao salvar configuração da loja: " + e.message, "error");
    } finally {
      setSavingLoja(false);
    }
  };

  useEffect(() => { load(); setLocalThresh(thresh || DEFAULT_THRESH); }, [setor, thresh]);
  useEffect(() => {
    const v = nomeCat.trim().toLowerCase();
    setDupCat(!v ? null : cats.find(c => c.nome.toLowerCase() === v) || null);
  }, [nomeCat, cats]);
  useEffect(() => {
    const v = nomeProd.trim().toLowerCase();
    setDupProd(!v ? null : prods.find(p => p.nome.toLowerCase() === v) || null);
  }, [nomeProd, prods]);

  const checkEditCatDup  = (val, selfId) => cats.find(c => c.id !== selfId && c.nome.toLowerCase() === val.trim().toLowerCase()) || null;
  const checkEditProdDup = (val, selfId) => prods.find(p => p.id !== selfId && p.nome.toLowerCase() === val.trim().toLowerCase()) || null;

  const addCat = async () => {
    if (!nomeCat.trim()) return;
    if (dupCat) { addToast(`"${dupCat.nome}" já existe.`, "error"); return; }
    try {
      await addDoc(collection(_db, colCat), { nome: nomeCat.trim(), criadoEm: new Date().toISOString() });
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Categoria criada: ${nomeCat.trim()}`, usuario: user.email });
      addToast("Categoria criada!", "success"); setNomeCat(""); setDupCat(null); load();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
  };

  const delCat = async (c) => {
    if (!confirm(`Excluir "${c.nome}"?`)) return;
    try { await deleteDoc(doc(_db, colCat, c.id)); addToast("Removida.", "success"); load(); }
    catch (e) { addToast("Erro: " + e.message, "error"); }
  };

  const saveCat = async (c) => {
    const novo = editCatVal.trim();
    if (!novo || novo === c.nome) { setEditCatId(null); return; }
    if (checkEditCatDup(novo, c.id)) { addToast("Nome já existe.", "error"); return; }
    try {
      await updateDoc(doc(_db, colCat, c.id), { nome: novo });
      const sn = await getDocs(query(collection(_db, colPadrao), where("categoria", "==", c.nome)));
      await Promise.all(sn.docs.map(d => updateDoc(doc(_db, colPadrao, d.id), { categoria: novo })));
      const se = await getDocs(query(collection(_db, colEst), where("categoria", "==", c.nome)));
      await Promise.all(se.docs.map(d => updateDoc(doc(_db, colEst, d.id), { categoria: novo })));
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Categoria: "${c.nome}"→"${novo}"`, usuario: user.email });
      addToast(`Renomeada para "${novo}"`, "success"); setEditCatId(null); load();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
  };
  const addProd = async () => {
    if (!nomeProd.trim() || !catProd) { addToast("Preencha nome e categoria.", "error"); return; }
    if (dupProd) { addToast(`"${dupProd.nome}" já existe.`, "error"); return; }
    if (modoLoja && (!precoVenda || isNaN(parseFloat(precoVenda)) || parseFloat(precoVenda) < 0)) { addToast("Informe um valor unitário válido (Loja ativa).", "error"); return; }
    try {
      const prodData = { nome: nomeProd.trim(), categoria: catProd, criadoEm: new Date().toISOString() };
      if (precoVenda !== "" && !isNaN(parseFloat(precoVenda))) {
        prodData.precoVenda = parseFloat(precoVenda);
      }
      await addDoc(collection(_db, colPadrao), prodData);
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Produto criado: ${nomeProd.trim()}`, usuario: user.email });
      addToast(`"${nomeProd.trim()}" criado!`, "success"); setNomeProd(""); setPrecoVenda(""); setDupProd(null); load();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
  };


  const delProd = async (p) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    try { await deleteDoc(doc(_db, colPadrao, p.id)); addToast("Removido.", "success"); load(); }
    catch (e) { addToast("Erro: " + e.message, "error"); }
  };
  const saveProd = async (p) => {
    const novo = editProdVal.trim();
    const novoPreco = editProdPreco.trim();
    if (!novo) { addToast("Nome do produto não pode ser vazio.", "error"); return; }
    if (modoLoja && (!novoPreco || isNaN(parseFloat(novoPreco)) || parseFloat(novoPreco) < 0)) { addToast("Informe um valor unitário válido (Loja ativa).", "error"); return; }
    
    if (novo !== p.nome) {
      const dup = checkEditProdDup(novo, p.id);
      if (dup) { addToast(`"${dup.nome}" já existe.`, "error"); return; }
    }

    try {
      const isPrecoValido = novoPreco !== "" && !isNaN(parseFloat(novoPreco));
      const precoFinal = isPrecoValido ? parseFloat(novoPreco) : null;
      
      await updateDoc(doc(_db, colPadrao, p.id), { nome: novo, precoVenda: precoFinal });
      
      const sn = await getDocs(query(collection(_db, colEst), where("nome", "==", p.nome)));
      await Promise.all(sn.docs.map(d => updateDoc(doc(_db, colEst, d.id), { nome: novo, precoVenda: precoFinal })));
      
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Produto: "${p.nome}" (R$ ${(p.precoVenda || 0)}) → "${novo}" (R$ ${(precoFinal || 0)})`, usuario: user.email });
      addToast(`Produto "${novo}" atualizado!`, "success"); setEditProdId(null); load();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
  };


  const saveThresh = async () => {
    if (localThresh.baixo >= localThresh.medio) { addToast("'Baixo' deve ser menor que 'Médio'.", "error"); return; }
    setSavingThresh(true);
    try {
      await setDoc(doc(_db, _getCol(setor, "config"), "thresholds"), { ...localThresh, updatedAt: new Date().toISOString() });
      onThreshChange(localThresh);
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Thresholds: baixo≤${localThresh.baixo}, médio≤${localThresh.medio}`, usuario: user.email });
      addToast("Limites salvos!", "success");
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setSavingThresh(false); }
  };

  const scrollTo = (id, refs, setHL) => {
    setHL(id);
    setTimeout(() => { refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);
    setTimeout(() => setHL(null), 2500);
  };

  if (loading) return <div className="empty"><span className="spinner" /></div>;

  const s = resolveSetor ? resolveSetor(setor) : { label: setor };

  const InlineEdit = ({ id, val, setId, setVal, onSave, checkDup, onCancel }) => {
    const dup = checkDup(val, id);
    return (
      <div style={{ flex: 1, marginRight: 6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if(e.key==="Enter") onSave(); if(e.key==="Escape") onCancel(); }}
            style={{ flex:1, background:"var(--surface2)", border:`1px solid ${dup?"var(--warn)":"var(--accent)"}`, color:"var(--text)", padding:"7px 10px", fontFamily:"var(--mono)", fontSize:13, outline:"none", borderRadius:"var(--r)" }}
          />
          <button className="btn-icon-sm" style={{ borderColor:"var(--success)",color:"var(--success)" }} onClick={onSave} disabled={!!dup}><IcoCheck /></button>
          <button className="btn-icon-sm" onClick={onCancel}><IcoX /></button>
        </div>
      </div>
    );
  };

  const InlineEditProd = ({ id, name, setName, price, setPrice, onSave, checkDup, onCancel }) => {
    const dup = checkDup(name, id);
    return (
      <div style={{ flex: 1, marginRight: 6 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="Nome do produto..."
            onKeyDown={e => { if(e.key==="Enter") onSave(); if(e.key==="Escape") onCancel(); }}
            style={{ flex:2, background:"var(--surface2)", border:`1px solid ${dup?"var(--warn)":"var(--accent)"}`, color:"var(--text)", padding:"7px 10px", fontFamily:"var(--mono)", fontSize:13, outline:"none", borderRadius:"var(--r)" }}
          />
          <input type="number" step="0.01" min="0" placeholder="R$ Preço..." value={price} onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if(e.key==="Enter") onSave(); if(e.key==="Escape") onCancel(); }}
            style={{ width:100, background:"var(--surface2)", border:"1px solid var(--accent)", color:"var(--text)", padding:"7px 10px", fontFamily:"var(--mono)", fontSize:13, outline:"none", borderRadius:"var(--r)" }}
          />
          <button className="btn-icon-sm" style={{ borderColor:"var(--success)",color:"var(--success)" }} onClick={onSave} disabled={!!dup}><IcoCheck /></button>
          <button className="btn-icon-sm" onClick={onCancel}><IcoX /></button>
        </div>
        {dup && <div style={{ fontFamily:"var(--mono)",fontSize:10,color:"var(--warn)",marginTop:5 }}>Nome já existe</div>}
      </div>
    );
  };




  return (
    <div>
      <div className="page-hd">
        <div className="page-title">CONFIG</div>
        <div className="page-sub">Configurações — {s.label}</div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <button className={"btn " + (configSubTab==="geral" ? "btn-accent" : "btn-outline")} onClick={() => setConfigSubTab("geral")} style={{ fontSize:12, padding:"10px 18px" }}>
          ⚙ Geral
        </button>
        <button className={"btn " + (configSubTab==="requisicao" ? "btn-accent" : "btn-outline")} onClick={() => setConfigSubTab("requisicao")} style={{ fontSize:12, padding:"10px 18px" }}>
          📋 Config Requisição
        </button>
      </div>

      {configSubTab === "requisicao" && <ConfigRequisicao setor={setor} addToast={addToast} />}

      {configSubTab === "geral" && (
        <>
          {/* Módulo Loja & Caixa */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              MÓDULO LOJA & CAIXA (POS)
            </div>
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 14 }}>
              Habilite a frente de caixa para vendas diretas ao cliente final, puxando itens do estoque.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>Habilitar Frente de Caixa</span>
                <button
                  className={"btn " + (modoLoja ? "btn-accent" : "btn-outline")}
                  style={{ fontSize: 11, padding: "6px 12px" }}
                  onClick={() => saveLojaConfig(!modoLoja, fluxoLoja)}
                  disabled={savingLoja}
                >
                  {modoLoja ? "ATIVADO" : "DESATIVADO"}
                </button>
              </div>

              {modoLoja && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>Origem da Saída das Vendas</label>
                    <select
                      className="form-select"
                      value={fluxoLoja}
                      onChange={e => saveLojaConfig(modoLoja, e.target.value)}
                      disabled={savingLoja}
                      style={{ fontSize: 12, padding: "8px 10px" }}
                    >
                      <option value="estoque">Apenas Estoque (Saída direta do Estoque principal)</option>
                      <option value="loja">Estoque + Loja (Controle de Estoque e Loja separados)</option>
                    </select>
                  </div>

                  <div style={{ background: "var(--surface2)", padding: 12, borderRadius: "var(--r)", border: "1px solid var(--border)", marginTop: 4 }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>LINK ÚNICO DO CAIXA</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/caixa?empresa=${user.email}`}
                        style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border2)", padding: "8px 10px", borderRadius: "var(--r)", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", outline: "none" }}
                      />
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 10, padding: "8px 12px" }}
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/caixa?empresa=${user.email}`);
                          addToast("Link copiado para a área de transferência!", "success");
                        }}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Thresholds */}
          <div className="card">
            <div className="card-title">NÍVEIS DE ESTOQUE</div>
            <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
              {[
                ["ZERADO", "0", "var(--danger)"],
                ["BAIXO",  `1–${localThresh.baixo}`, "var(--accent)"],
                ["MÉDIO",  `${localThresh.baixo+1}–${localThresh.medio}`, "var(--warn)"],
                ["OK",     `${localThresh.medio+1}+`, "var(--success)"],
              ].map(([lbl, val, cor]) => (
                <div key={lbl} style={{ flex:1, minWidth:80, background:"var(--surface2)", border:`1px solid ${cor}`, borderRadius:"var(--r)", padding:"10px 14px", textAlign:"center" }}>
                  <div style={{ fontFamily:"var(--mono)", fontSize:9, color:cor, letterSpacing:2, marginBottom:4 }}>{lbl}</div>
                  <div style={{ fontFamily:"var(--display)", fontSize:22, color:cor }}>{val}</div>
                </div>
              ))}
            </div>
            {[["BAIXO ≤","var(--accent)","baixo",50],["MÉDIO ≤","var(--warn)","medio",200]].map(([lbl,cor,key,max]) => (
              <div key={key} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:"1px solid var(--border)" }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:11, color:cor, width:70, flexShrink:0 }}>{lbl}</div>
                <input type="range" min={key==="baixo"?1:2} max={max} value={localThresh[key]}
                  onChange={e => setLocalThresh(p => key==="baixo"?{...p,baixo:Math.min(Number(e.target.value),p.medio-1)}:{...p,medio:Math.max(Number(e.target.value),p.baixo+1)})}
                  style={{ flex:1, WebkitAppearance:"none", appearance:"none", height:4, borderRadius:2, outline:"none", cursor:"pointer", background:`linear-gradient(to right,${cor} 0%,${cor} ${(localThresh[key]/max)*100}%,var(--border2) ${(localThresh[key]/max)*100}%,var(--border2) 100%)` }}
                />
                <div style={{ fontFamily:"var(--display)", fontSize:22, color:cor, width:36, textAlign:"right", flexShrink:0 }}>{localThresh[key]}</div>
              </div>
            ))}
            <button className="btn btn-accent btn-full" style={{ marginTop:16 }} onClick={saveThresh} disabled={savingThresh}>
              {savingThresh ? <><span className="spinner" /> SALVANDO...</> : <><IcoSave /> SALVAR LIMITES</>}
            </button>
          </div>

          {/* Categorias */}
          <div className="card">
            <div className="card-title">CATEGORIAS</div>
            <div style={{ display:"flex", gap:8, marginBottom: dupCat?8:10 }}>
              <input className="form-input" placeholder="Nova categoria..." value={nomeCat}
                onChange={e => setNomeCat(e.target.value)} onKeyDown={e => e.key==="Enter" && addCat()}
                style={{ flex:1, borderColor:dupCat?"var(--warn)":undefined }}/>
              <button className="btn btn-accent" onClick={addCat} disabled={!!dupCat} style={{ padding:"12px 16px", opacity:dupCat?.4:1 }}><IcoPlus /></button>
            </div>
            {dupCat && <DupAlert tipo="cat" existente={dupCat} onDismiss={()=>setNomeCat("")}
              onScrollTo={()=>scrollTo(dupCat.id,catItemRefs,setHighlightCat)}
              onEdit={()=>{scrollTo(dupCat.id,catItemRefs,setHighlightCat);setTimeout(()=>{setEditCatId(dupCat.id);setEditCatVal(dupCat.nome);},300);setNomeCat("");}}
              onDelete={()=>{delCat(dupCat);setNomeCat("");}}/>}
            <SearchBox value={searchCat} onChange={setSearchCat} placeholder="Filtrar categorias..." />
            {(() => {
              const visible = searchCat.trim() ? cats.filter(c=>c.nome.toLowerCase().includes(searchCat.toLowerCase())) : cats;
              if (!visible.length) return <div style={{ fontFamily:"var(--mono)",fontSize:11,color:"var(--text-dim)" }}>{cats.length===0?"Nenhuma categoria.":"Nenhuma encontrada."}</div>;
              return (
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {visible.map(c => (
                    <div key={c.id} ref={el=>catItemRefs.current[c.id]=el}
                      style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:highlightCat===c.id?"rgba(250,204,21,.08)":"var(--surface2)",border:highlightCat===c.id?"1px solid var(--warn)":"1px solid var(--border)",borderRadius:"var(--r)",transition:"all .3s" }}>
                      {editCatId===c.id
                        ? <InlineEdit id={c.id} val={editCatVal} setId={setEditCatId} setVal={setEditCatVal} onSave={()=>saveCat(c)} checkDup={checkEditCatDup} onCancel={()=>setEditCatId(null)}/>
                        : <span style={{ fontFamily:"var(--mono)",fontSize:13,flex:1 }}>{c.nome}</span>}
                      {editCatId!==c.id && <div style={{ display:"flex",gap:4 }}>
                        <button className="btn-icon-sm edit-btn" onClick={()=>{setEditCatId(c.id);setEditCatVal(c.nome);}}><IcoEdit /></button>
                        <button className="btn-icon-sm" onClick={()=>delCat(c)}><IcoTrash /></button>
                      </div>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Produtos padrão */}
          <div className="card">
            <div className="card-title">PRODUTOS PADRÃO{modoLoja && <span style={{ marginLeft:8,fontSize:10,color:"var(--accent)",fontFamily:"var(--mono)",fontWeight:400 }}>MODO LOJA — preço obrigatório</span>}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:dupProd?8:10 }}>
              <select className="form-select" value={catProd} onChange={e=>setCatProd(e.target.value)}>
                <option value="">Selecionar categoria...</option>
                {cats.map(c=><option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <div style={{ display:"flex",gap:8 }}>
                <input className="form-input" placeholder="Nome do produto..." value={nomeProd}
                  onChange={e=>setNomeProd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addProd()}
                  style={{ flex:1,borderColor:dupProd?"var(--warn)":undefined }}/>
                <input className="form-input" type="number" min="0" step="0.01"
                  placeholder={modoLoja ? "R$ Preço *" : "R$ Preço (opcional)"}
                  value={precoVenda} onChange={e=>setPrecoVenda(e.target.value)}
                  style={{ width:150,flexShrink:0 }}/>
                <button className="btn btn-accent" onClick={addProd} disabled={!!dupProd} style={{ padding:"12px 16px",opacity:dupProd?.4:1 }}><IcoPlus /></button>
              </div>
            </div>
            {dupProd && <DupAlert tipo="prod" existente={dupProd} onDismiss={()=>setNomeProd("")}
              onScrollTo={()=>scrollTo(dupProd.id,prodItemRefs,setHighlightProd)}
              onEdit={()=>{scrollTo(dupProd.id,prodItemRefs,setHighlightProd);setTimeout(()=>{setEditProdId(dupProd.id);setEditProdVal(dupProd.nome);setEditProdPreco(String(dupProd.precoVenda??""));},300);setNomeProd("");}}
              onDelete={()=>{delProd(dupProd);setNomeProd("");}}/>}
            <SearchBox value={searchProd} onChange={setSearchProd} placeholder="Filtrar produtos..." />
            {(() => {
              const qp = searchProd.toLowerCase();
              const fp = qp ? prods.filter(p=>p.nome.toLowerCase().includes(qp)||p.categoria.toLowerCase().includes(qp)) : prods;
              if (!fp.length) return <div style={{ fontFamily:"var(--mono)",fontSize:11,color:"var(--text-dim)" }}>{prods.length===0?"Nenhum produto padrão.":"Nenhum encontrado."}</div>;
              const catsComProds = cats.filter(c=>fp.some(p=>p.categoria===c.nome));
              return (
                <div style={{ display:"flex",flexDirection:"column",gap:6,maxHeight:360,overflowY:"auto" }}>
                  {catsComProds.map(c => {
                    const ps = fp.filter(p=>p.categoria===c.nome);
                    if (!ps.length) return null;
                    return (
                      <div key={c.id}>
                        <div style={{ fontFamily:"var(--mono)",fontSize:9,color:"var(--text-dim)",letterSpacing:2,textTransform:"uppercase",padding:"8px 0 4px" }}>{c.nome}</div>
                        {ps.map(p => (
                          <div key={p.id} ref={el=>prodItemRefs.current[p.id]=el}
                            style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",background:highlightProd===p.id?"rgba(250,204,21,.08)":"var(--surface2)",border:highlightProd===p.id?"1px solid var(--warn)":"1px solid var(--border)",borderRadius:"var(--r)",marginBottom:4,transition:"all .3s" }}>
                            {editProdId===p.id
                              ? <InlineEditProd id={p.id} name={editProdVal} setName={setEditProdVal} price={editProdPreco} setPrice={setEditProdPreco} onSave={()=>saveProd(p)} checkDup={checkEditProdDup} onCancel={()=>setEditProdId(null)}/>
                              : <>
                                  <span style={{ fontFamily:"var(--mono)",fontSize:12,flex:1 }}>{p.nome}</span>
                                  {p.precoVenda!=null && <span style={{ fontFamily:"var(--mono)",fontSize:11,color:"var(--accent)",marginRight:8 }}>R$ {Number(p.precoVenda).toFixed(2)}</span>}
                                </>}
                            {editProdId!==p.id && <div style={{ display:"flex",gap:4 }}>
                              <button className="btn-icon-sm edit-btn" onClick={()=>{setEditProdId(p.id);setEditProdVal(p.nome);setEditProdPreco(String(p.precoVenda??""));}}><IcoEdit /></button>
                              <button className="btn-icon-sm" onClick={()=>delProd(p)}><IcoTrash /></button>
                            </div>}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}

export default Configuracoes;