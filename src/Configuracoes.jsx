/**
 * Configuracoes.jsx
 * Aba de configurações centralizada e intuitiva
 * Exports: Configuracoes, ConfigRequisicao, ConfigEmpresa, ConfigSetores
 */

import { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  query, where, updateDoc, serverTimestamp, getDoc,
} from "firebase/firestore";
import { Icon } from "./icons.jsx";

// ─── Helpers ─────────────────────────────────────────────────
const getCol = (setor, type) => {
  const email = auth.currentUser?.email;
  return email ? `users/${email}/setores/${setor}/${type}` : `estoque_${setor}_${type}`;
};
const getColPrivate = (setor, type) => {
  const email = auth.currentUser?.email;
  return email ? `users/${email}/setores/${setor}/${type}` : `estoque_${setor}_${type}`;
};
const DEFAULT_THRESH = { baixo: 5, medio: 15 };

// ─── SearchBox simples ────────────────────────────────────────
function SearchBox({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "var(--r)", overflow: "hidden", marginBottom: 10 }}>
      <span style={{ padding: "0 10px", color: "var(--text-dim)", display: "flex" }}>
        <Icon name="search" size={15} />
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, padding: "10px 0" }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ padding: "0 10px", background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex" }}>
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

// ─── DupAlert ────────────────────────────────────────────────
function DupAlert({ tipo, existente, onScrollTo, onEdit, onDelete, onDismiss }) {
  return (
    <div style={{ background: "var(--warn-light)", border: "1px solid var(--warn)", borderRadius: "var(--r)", padding: "12px 14px", marginBottom: 10 }} className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--warn)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>
            {tipo === "cat" ? "Categoria já existe" : "Produto já existe"}
          </div>
          <div style={{ fontFamily: "var(--display)", fontSize: 18, letterSpacing: 1 }}>{existente.nome}</div>
          {tipo === "prod" && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>Categoria: {existente.categoria}</div>}
        </div>
        <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 2 }}>
          <Icon name="x" size={14} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn btn-outline" style={{ fontSize: 10, padding: "6px 10px" }} onClick={onScrollTo}>
          <Icon name="search" size={13} /> Ver existente
        </button>
        <button className="btn btn-outline" style={{ fontSize: 10, padding: "6px 10px", color: "var(--info)", borderColor: "var(--info)" }} onClick={onEdit}>
          <Icon name="edit" size={13} /> Renomear
        </button>
        <button className="btn btn-outline" style={{ fontSize: 10, padding: "6px 10px", color: "var(--danger)", borderColor: "var(--danger)" }} onClick={onDelete}>
          <Icon name="trash" size={13} /> Excluir
        </button>
      </div>
    </div>
  );
}

// ============================================================
// CONFIG EMPRESA & ACESSO APP
// ============================================================
export function ConfigEmpresa({ user, addToast, showBottomNav, onToggleBottomNav }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [empresaData, setEmpresaData] = useState({
    nomeEmpresa: "",
    companyId: "",
    senhaApp: "",
    numero: ""
  });
  const [showPassword, setShowPassword] = useState(false);

  const loadEmpresa = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const docRef = doc(db, "users", user.email);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEmpresaData({
          nomeEmpresa: data.nomeEmpresa || data.nome || "",
          companyId: data.companyId || user.email,
          senhaApp: data.senhaApp || data.senha || "123456",
          numero: data.numero || ""
        });
      } else {
        // Inicializa dados padrão da empresa
        const defaultCompanyId = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        const defaultData = {
          nomeEmpresa: "Minha Empresa",
          companyId: defaultCompanyId || user.email,
          senhaApp: "123456",
          email: user.email,
          criadoEm: new Date().toISOString()
        };
        await setDoc(docRef, defaultData, { merge: true });
        setEmpresaData(defaultData);
      }
    } catch (e) {
      addToast("Erro ao carregar dados da empresa: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEmpresa(); }, [user]);

  const saveEmpresa = async (e) => {
    if (e) e.preventDefault();
    if (!empresaData.nomeEmpresa.trim()) { addToast("Digite o nome da empresa.", "error"); return; }
    if (!empresaData.senhaApp || empresaData.senhaApp.length < 4) { addToast("A senha do App deve ter pelo menos 4 caracteres.", "error"); return; }

    setSaving(true);
    try {
      const docRef = doc(db, "users", user.email);
      await setDoc(docRef, {
        nomeEmpresa: empresaData.nomeEmpresa.trim(),
        senhaApp: empresaData.senhaApp.trim(),
        senha: empresaData.senhaApp.trim(), // compatibilidade
        numero: empresaData.numero.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      addToast("Configurações da Empresa salvas!", "success");
    } catch (e) {
      addToast("Erro ao salvar: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const generateNewPassword = () => {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let pwd = "";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEmpresaData(p => ({ ...p, senhaApp: pwd }));
    addToast(`Nova senha gerada: ${pwd}. Não se esqueça de salvar!`, "info");
  };

  const reqUrl = `${window.location.origin}/requisicao?empresa=${encodeURIComponent(user?.email || "")}`;
  const caixaUrl = `${window.location.origin}/caixa?empresa=${encodeURIComponent(user?.email || "")}`;

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copiado!`, "success");
  };

  if (loading) return <div style={{ padding: 30, textAlign: "center" }}><span className="spinner" /></div>;

  return (
    <div className="animate-slide-up">
      {/* Dados Principais */}
      <div className="card hover-lift" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="building" size={20} color="var(--accent)" /> EMPRESA & CREDENCIAIS DO APP
        </div>
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>
          Credenciais utilizadas para identificação da empresa nos aplicativos de Requisição e Frente de Caixa.
        </p>

        <form onSubmit={saveEmpresa}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label className="form-label">Nome da Empresa *</label>
              <input
                className="form-input"
                value={empresaData.nomeEmpresa}
                onChange={e => setEmpresaData(p => ({ ...p, nomeEmpresa: e.target.value }))}
                placeholder="Ex: Minha Loja Ltda"
                required
              />
            </div>
            <div>
              <label className="form-label">Email Principal (Admin)</label>
              <input className="form-input" value={user?.email || ""} disabled style={{ opacity: 0.7 }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <label className="form-label">ID da Empresa (Autenticação)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="form-input"
                  value={user?.email || ""}
                  readOnly
                  style={{ background: "var(--surface2)", fontFamily: "var(--mono)", color: "var(--accent)", fontWeight: 600 }}
                />
                <button type="button" className="btn btn-outline" style={{ padding: "10px 12px" }} onClick={() => copyToClipboard(user?.email || "", "ID da Empresa")}>
                  <Icon name="copy" size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Senha de Acesso dos Apps *</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  value={empresaData.senhaApp}
                  onChange={e => setEmpresaData(p => ({ ...p, senhaApp: e.target.value }))}
                  style={{ fontFamily: "var(--mono)", letterSpacing: showPassword ? 1 : 4, fontSize: 15 }}
                  required
                />
                <button type="button" className="btn btn-outline" style={{ padding: "10px 12px" }} onClick={() => setShowPassword(!showPassword)} title={showPassword ? "Ocultar" : "Mostrar"}>
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={14} />
                </button>
                <button type="button" className="btn btn-outline" style={{ padding: "10px 12px", color: "var(--info)", borderColor: "var(--info)" }} onClick={generateNewPassword} title="Gerar Senha Aleatória">
                  <Icon name="refreshCw" size={14} />
                </button>
              </div>
            </div>
          </div>

          <button className="btn btn-accent" type="submit" disabled={saving} style={{ padding: "12px 24px" }}>
            {saving ? <><span className="spinner" /> SALVANDO...</> : <><Icon name="save" size={16} /> SALVAR ALTERAÇÕES</>}
          </button>
        </form>
      </div>

      {/* Links de Acesso Direto aos Apps */}
      <div className="card hover-lift">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="smartphone" size={20} color="var(--success)" /> LINKS DIRETOS PARA OS APLICATIVOS
        </div>
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>
          Compartilhe estes links com a sua equipe. Os links já vêm pré-configurados com a sua empresa.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* App de Requisições */}
          <div style={{ background: "var(--surface2)", padding: 14, borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, fontFamily: "var(--sans)" }}>
                <Icon name="clipboardList" size={16} color="var(--accent)" /> APP DE REQUISIÇÕES (PEDIDOS)
              </div>
              <a href={reqUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ fontSize: 11, padding: "5px 10px", color: "var(--accent)" }}>
                <Icon name="externalLink" size={13} /> Abrir App
              </a>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="form-input" readOnly value={reqUrl} style={{ flex: 1, fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)" }} />
              <button className="btn btn-accent" style={{ fontSize: 11, padding: "9px 14px" }} onClick={() => copyToClipboard(reqUrl, "Link do App de Requisição")}>
                <Icon name="copy" size={13} /> Copiar
              </button>
            </div>
          </div>

          {/* App de Frente de Caixa */}
          <div style={{ background: "var(--surface2)", padding: 14, borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13, fontFamily: "var(--sans)" }}>
                <Icon name="store" size={16} color="var(--success)" /> APP DE FRENTE DE CAIXA (POS)
              </div>
              <a href={caixaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ fontSize: 11, padding: "5px 10px", color: "var(--success)" }}>
                <Icon name="externalLink" size={13} /> Abrir Caixa
              </a>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="form-input" readOnly value={caixaUrl} style={{ flex: 1, fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)" }} />
              <button className="btn btn-accent" style={{ fontSize: 11, padding: "9px 14px", background: "var(--success)", borderColor: "var(--success)" }} onClick={() => copyToClipboard(caixaUrl, "Link do Caixa POS")}>
                <Icon name="copy" size={13} /> Copiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preferências da Interface & Layout Mobile */}
      <div className="card hover-lift" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="monitor" size={20} color="var(--info)" /> PREFERÊNCIAS DE INTERFACE & MOBILE
        </div>
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>
          Personalize a navegação para dispositivos móveis (smartphones e tablets).
        </p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--surface2)", padding: "14px 16px", borderRadius: "var(--r)", border: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Barra de Navegação Inferior (Mobile)</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              Exibe a barra fixa com ícones na parte inferior da tela em smartphones (apenas abas principais).
            </div>
          </div>
          <button
            type="button"
            className={`btn ${showBottomNav ? "btn-accent" : "btn-outline"}`}
            style={{ fontSize: 11, padding: "8px 16px" }}
            onClick={() => onToggleBottomNav?.(!showBottomNav)}
          >
            <Icon name={showBottomNav ? "checkCircle" : "x"} size={14} />
            {showBottomNav ? "ATIVADA" : "DESATIVADA"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ============================================================
// CONFIG SETORES (GESTOR DOS SETORES + PINS + USUÁRIOS)
// ============================================================
export function ConfigSetores({ user, addToast, resolveSetor }) {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSector, setEditSector] = useState(null);
  const [selectedSectorUsers, setSelectedSectorUsers] = useState(null); // sector object for managing users

  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#f97316");
  const [newIcon, setNewIcon] = useState("package");
  const [newPin, setNewPin] = useState("1234");
  const [saving, setSaving] = useState(false);

  // Sector Users state
  const [sectorUsersList, setSectorUsersList] = useState([]);
  const [newSectorUser, setNewSectorUser] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [sectorCategoriesList, setSectorCategoriesList] = useState([]);
  const [editingUserPresetId, setEditingUserPresetId] = useState(null);

  const loadSectors = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users", user.email, "setores"));
      const list = [];
      for (const d of snap.docs) {
        const sData = { id: d.id, ...d.data() };
        try {
          const pinSnap = await getDoc(doc(db, `users/${user.email}/setores/${d.id}/config`, "requisicao_config"));
          sData.pin = pinSnap.exists() ? (pinSnap.data().pin || "1234") : "1234";
        } catch { sData.pin = "1234"; }
        list.push(sData);
      }
      setSectors(list);
    } catch (e) {
      addToast("Erro ao carregar setores: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSectors(); }, [user]);

  const loadSectorUsers = async (secId) => {
    if (!user?.email || !secId) return;
    try {
      const uSnap = await getDocs(collection(db, `users/${user.email}/setores/${secId}/req_usuarios`));
      setSectorUsersList(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const openUsersModal = async (s) => {
    setSelectedSectorUsers(s);
    setEditingUserPresetId(null);
    loadSectorUsers(s.id);
    try {
      const cSnap = await getDocs(collection(db, `users/${user.email}/setores/${s.id}/categorias`));
      setSectorCategoriesList(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setSectorCategoriesList([]);
    }
  };

  const toggleUserCategoryPreset = async (uObj, catName) => {
    if (!selectedSectorUsers || !user?.email) return;
    const current = uObj.allowedCategories || [];
    const updated = current.includes(catName)
      ? current.filter(c => c !== catName)
      : [...current, catName];
    try {
      await updateDoc(doc(db, `users/${user.email}/setores/${selectedSectorUsers.id}/req_usuarios`, uObj.id), {
        allowedCategories: updated
      });
      setSectorUsersList(prev => prev.map(item => item.id === uObj.id ? { ...item, allowedCategories: updated } : item));
      addToast(`Preset de "${uObj.nome}" atualizado!`, "success");
    } catch (e) {
      addToast("Erro ao atualizar preset: " + e.message, "error");
    }
  };

  const handleCreateOrUpdate = async (e) => {
    if (e) e.preventDefault();
    if (!editSector) {
      const cleanId = newId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!cleanId) { addToast("Digite um ID válido (letras/números).", "error"); return; }
      if (sectors.some(s => s.id === cleanId)) { addToast("Este ID de setor já existe.", "error"); return; }
      if (!newLabel.trim()) { addToast("Digite o nome do setor.", "error"); return; }
      if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) { addToast("O PIN deve ter 4 dígitos.", "error"); return; }

      setSaving(true);
      try {
        await setDoc(doc(db, "users", user.email, "setores", cleanId), {
          id: cleanId,
          label: newLabel.trim(),
          color: newColor,
          iconName: newIcon,
          createdAt: new Date().toISOString()
        });
        await setDoc(doc(db, `users/${user.email}/setores/${cleanId}/config`, "requisicao_config"), {
          pin: newPin.trim(),
          updatedAt: new Date().toISOString()
        });
        await setDoc(doc(db, `users/${user.email}/setores/${cleanId}/config`, "thresholds"), {
          baixo: 5, medio: 15, updatedAt: new Date().toISOString()
        });
        addToast(`Setor "${newLabel.trim()}" criado com sucesso!`, "success");
        setShowModal(false);
        resetForm();
        loadSectors();
      } catch (err) {
        addToast("Erro ao criar setor: " + err.message, "error");
      } finally {
        setSaving(false);
      }
    } else {
      setSaving(true);
      try {
        await updateDoc(doc(db, "users", user.email, "setores", editSector.id), {
          label: newLabel.trim(),
          color: newColor,
          iconName: newIcon,
          updatedAt: new Date().toISOString()
        });
        if (newPin && newPin.length === 4) {
          await setDoc(doc(db, `users/${user.email}/setores/${editSector.id}/config`, "requisicao_config"), {
            pin: newPin.trim(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        addToast(`Setor "${newLabel.trim()}" atualizado!`, "success");
        setShowModal(false);
        resetForm();
        loadSectors();
      } catch (err) {
        addToast("Erro ao atualizar setor: " + err.message, "error");
      } finally {
        setSaving(false);
      }
    }
  };

  const resetForm = () => {
    setEditSector(null);
    setNewId("");
    setNewLabel("");
    setNewColor("#f97316");
    setNewIcon("package");
    setNewPin("1234");
  };

  const openEdit = async (s) => {
    setEditSector(s);
    setNewId(s.id);
    setNewLabel(s.label);
    setNewColor(s.color || "#f97316");
    setNewIcon(s.iconName || "package");
    setNewPin(s.pin || "1234");
    setShowModal(true);
  };

  const handleAddSectorUser = async () => {
    const nome = newSectorUser.trim();
    if (!nome || !selectedSectorUsers) return;
    if (sectorUsersList.some(u => u.nome.toLowerCase() === nome.toLowerCase())) {
      addToast("Usuário já cadastrado neste setor.", "error"); return;
    }
    setSavingUser(true);
    try {
      await addDoc(collection(db, `users/${user.email}/setores/${selectedSectorUsers.id}/req_usuarios`), {
        nome, criadoEm: serverTimestamp()
      });
      addToast(`"${nome}" adicionado ao setor!`, "success");
      setNewSectorUser("");
      loadSectorUsers(selectedSectorUsers.id);
    } catch (e) { addToast("Erro ao adicionar usuário: " + e.message, "error"); }
    finally { setSavingUser(false); }
  };

  const handleDeleteSectorUser = async (userId) => {
    if (!selectedSectorUsers || !confirm("Remover este usuário do setor?")) return;
    try {
      await deleteDoc(doc(db, `users/${user.email}/setores/${selectedSectorUsers.id}/req_usuarios`, userId));
      addToast("Usuário removido.", "success");
      loadSectorUsers(selectedSectorUsers.id);
    } catch (e) { addToast("Erro: " + e.message, "error"); }
  };

  const deleteSector = async (s) => {
    if (!confirm(`Excluir o setor "${s.label}"? Os dados de estoque não serão apagados imediatamente, mas o setor não estará visível.`)) return;
    try {
      await deleteDoc(doc(db, "users", user.email, "setores", s.id));
      addToast(`Setor "${s.label}" removido.`, "success");
      loadSectors();
    } catch (e) {
      addToast("Erro: " + e.message, "error");
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

  if (loading) return <div style={{ padding: 30, textAlign: "center" }}><span className="spinner" /></div>;

  return (
    <div className="animate-slide-up">
      <div className="card hover-lift" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
              <Icon name="layers" size={20} color="var(--accent)" /> GESTOR DOS SETORES & PINS DE ACESSO
            </div>
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
              Cadastre setores, defina PINs de segurança e gerencie operadores/solicitantes autorizados.
            </p>
          </div>
          <button className="btn btn-accent" onClick={() => { resetForm(); setShowModal(true); }}>
            <Icon name="plus" size={15} /> CRIAR NOVO SETOR
          </button>
        </div>

        {sectors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 10px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--text-dim)" }}>
            Nenhum setor cadastrado ainda. Clique em "CRIAR NOVO SETOR" para iniciar.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {sectors.map(s => (
              <div
                key={s.id}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  borderLeft: `4px solid ${s.color || "var(--accent)"}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "12px", background: `${s.color || "var(--accent)"}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name={s.iconName || "package"} size={22} color={s.color || "var(--accent)"} />
                    </div>
                    <div>
                      <div style={{ fontFamily: "var(--sans)", fontSize: 15, fontWeight: 700 }}>{s.label}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>ID: {s.id}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-icon-sm edit-btn" onClick={() => openEdit(s)} title="Editar Setor / PIN">
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="btn-icon-sm" onClick={() => deleteSector(s)} title="Excluir Setor">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>

                {/* PIN & Usuários Badges */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", padding: "4px 10px", borderRadius: "10px", fontSize: 11, fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Icon name="key" size={12} color="var(--accent)" />
                    <span>PIN: <strong style={{ color: "var(--accent)" }}>{s.pin || "1234"}</strong></span>
                  </div>

                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: "10px", height: "auto" }}
                    onClick={() => openUsersModal(s)}
                  >
                    <Icon name="users" size={12} /> Operadores / Solicitantes
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="logout-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, padding: 20 }}>
          <div className="logout-box animate-scale-in" style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: "var(--r)", padding: 24, width: "100%", maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ fontFamily: "var(--display)", fontSize: 24, letterSpacing: 1, color: "var(--accent)" }}>
                {editSector ? `EDITAR SETOR — ${editSector.label}` : "NOVO SETOR"}
              </h3>
              <button className="btn-icon-sm" onClick={() => setShowModal(false)}><Icon name="x" size={14} /></button>
            </div>
            <form onSubmit={handleCreateOrUpdate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {!editSector && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Identificador (ID Único)</label>
                  <input
                    className="form-input"
                    placeholder="ex: ti, limpeza, cozinha"
                    value={newId}
                    onChange={e => setNewId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                    required
                  />
                  <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4, display: "block" }}>Apenas letras minúsculas e números (sem espaços)</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome do Setor *</label>
                <input
                  className="form-input"
                  placeholder="ex: Tecnologia da Informação"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cor Visual</label>
                  <select className="form-select" value={newColor} onChange={e => setNewColor(e.target.value)}>
                    {colors.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ícone Vetorial</label>
                  <select className="form-select" value={newIcon} onChange={e => setNewIcon(e.target.value)}>
                    {icons.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">PIN de Acesso do Setor (4 dígitos)</label>
                <input
                  className="form-input"
                  placeholder="ex: 1234"
                  maxLength={4}
                  pattern="\d{4}"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              <button className="btn btn-accent btn-full" type="submit" disabled={saving} style={{ marginTop: 10 }}>
                {saving ? <><span className="spinner" /> SALVANDO...</> : <><Icon name="save" size={15} /> {editSector ? "SALVAR ALTERAÇÕES" : "CRIAR SETOR"}</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Usuários / Operadores do Setor */}
      {selectedSectorUsers && (
        <div className="logout-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, padding: 20 }}>
          <div className="logout-box animate-scale-in" style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: "var(--r)", padding: 24, width: "100%", maxWidth: 450 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontFamily: "var(--display)", fontSize: 22, letterSpacing: 1, color: selectedSectorUsers.color || "var(--accent)" }}>
                  OPERADORES — {selectedSectorUsers.label}
                </h3>
                <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>
                  Usuários autorizados para requisições neste setor
                </span>
              </div>
              <button className="btn-icon-sm" onClick={() => setSelectedSectorUsers(null)}><Icon name="x" size={14} /></button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input
                className="form-input"
                placeholder="Nome / Email do operador..."
                value={newSectorUser}
                onChange={e => setNewSectorUser(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddSectorUser()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-accent" onClick={handleAddSectorUser} disabled={savingUser || !newSectorUser.trim()}>
                <Icon name="plus" size={16} />
              </button>
            </div>

            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {sectorUsersList.length === 0 ? (
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", textAlign: "center", padding: "16px 0" }}>
                  Nenhum operador individual cadastrado. O acesso será via PIN do setor.
                </div>
              ) : (
                sectorUsersList.map(u => {
                  const allowed = u.allowedCategories || [];
                  const isEditingPreset = editingUserPresetId === u.id;
                  return (
                    <div key={u.id} style={{ background: "var(--surface2)", borderRadius: "var(--r)", border: "1px solid var(--border)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ fontSize: 13, fontFamily: "var(--mono)", fontWeight: 600 }}>{u.nome}</span>
                          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: allowed.length > 0 ? "var(--accent)" : "var(--text-dim)", marginTop: 2 }}>
                            {allowed.length > 0 ? `Filtro: ${allowed.join(", ")}` : "Acesso Total (Todas as Categorias)"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className={`btn-icon-sm ${isEditingPreset ? "edit-btn" : ""}`}
                            onClick={() => setEditingUserPresetId(isEditingPreset ? null : u.id)}
                            title="Configurar Preset / Filtro de Categorias"
                            style={{ borderColor: allowed.length > 0 ? "var(--accent)" : undefined }}
                          >
                            <Icon name="filter" size={13} color={allowed.length > 0 ? "var(--accent)" : undefined} />
                          </button>
                          <button className="btn-icon-sm" onClick={() => handleDeleteSectorUser(u.id)} title="Remover Operador">
                            <Icon name="trash" size={13} color="var(--danger)" />
                          </button>
                        </div>
                      </div>

                      {isEditingPreset && (
                        <div style={{ background: "var(--surface)", padding: "10px 12px", borderRadius: "var(--r)", border: "1px solid var(--border2)", marginTop: 4 }}>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                            Categorias Permitidas para {u.nome}:
                          </div>
                          {sectorCategoriesList.length === 0 ? (
                            <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>
                              Nenhuma categoria cadastrada no setor. Cadastre categorias na aba "Criar P/C".
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {sectorCategoriesList.map(c => {
                                const isSelected = allowed.includes(c.nome);
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className={`ftab ${isSelected ? "active" : ""}`}
                                    style={{ fontSize: 10, padding: "4px 8px" }}
                                    onClick={() => toggleUserCategoryPreset(u, c.nome)}
                                  >
                                    <Icon name={isSelected ? "check" : "plus"} size={11} /> {c.nome}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--text-dim)", marginTop: 6 }}>
                            * Se nenhuma categoria for selecionada, o operador terá acesso a todas as categorias.
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONFIG REQUISIÇÃO (PIN & USUÁRIOS DO SETOR)
// ============================================================
export function ConfigRequisicao({ setor, addToast }) {
  const [pinAtual, setPinAtual] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [novoUser, setNovoUser] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [loading, setLoading] = useState(true);

  const colConfig = getColPrivate(setor, "config");
  const colUsers = getColPrivate(setor, "req_usuarios");

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

  if (loading) return <div style={{ padding: 20, textAlign: "center" }}><span className="spinner" /></div>;

  return (
    <div className="animate-slide-up">
      {/* PIN */}
      <div className="card hover-lift" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="key" size={18} color="var(--accent)" /> PIN DE ACESSO — SETOR {setor?.toUpperCase()}
        </div>
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 14 }}>
          Senha de 4 dígitos exigida ao acessar este setor no site de requisições. Deixe em branco para acesso livre.
        </p>
        {pinAtual && (
          <div style={{ background: "rgba(245,166,35,.06)", border: "1px solid var(--accent)", borderRadius: "var(--r)", padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="key" size={16} color="var(--accent)" />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              PIN atual: <strong style={{ color: "var(--accent)", letterSpacing: 8, fontSize: 18 }}>{pinAtual}</strong>
            </span>
            <button className="btn btn-outline" onClick={() => { setPinNovo(""); savePin(); }}
              style={{ marginLeft: "auto", fontSize: 10, padding: "5px 10px", color: "var(--danger)", borderColor: "var(--danger)" }}>
              REMOVER
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text" inputMode="numeric" maxLength={4} placeholder="0000"
            value={pinNovo} onChange={e => setPinNovo(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--text)", padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 20, letterSpacing: 8, outline: "none", borderRadius: "var(--r)", width: 130, textAlign: "center" }}
          />
          <button className="btn btn-accent" onClick={savePin} disabled={savingPin}>
            {savingPin ? <span className="spinner" /> : <><Icon name="save" size={15} /> {pinNovo ? "SALVAR PIN" : "LIMPAR PIN"}</>}
          </button>
        </div>
      </div>

      {/* Usuários */}
      <div className="card hover-lift">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="user" size={18} color="var(--accent)" /> USUÁRIOS / REQUISITANTES DO SETOR
        </div>
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 14 }}>
          Nomes disponíveis para seleção rápida na tela de requisição deste setor.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input className="form-input" placeholder="Nome do solicitante..." value={novoUser}
            onChange={e => setNovoUser(e.target.value)} onKeyDown={e => e.key === "Enter" && addUser()} style={{ flex: 1 }} />
          <button className="btn btn-accent" onClick={addUser} disabled={savingUser || !novoUser.trim()} style={{ padding: "12px 16px" }}>
            {savingUser ? <span className="spinner" /> : <Icon name="plus" size={16} />}
          </button>
        </div>
        {usuarios.length === 0
          ? <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", padding: "10px 0" }}>Nenhum usuário cadastrado neste setor.</div>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[...usuarios].sort((a, b) => a.nome.localeCompare(b.nome)).map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                  {editId === u.id ? (
                    <>
                      <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(u); if (e.key === "Escape") setEditId(null); }}
                        style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--accent)", color: "var(--text)", padding: "6px 10px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)" }} />
                      <button className="btn-icon-sm" style={{ borderColor: "var(--success)", color: "var(--success)" }} onClick={() => saveEdit(u)}><Icon name="check" size={14} /></button>
                      <button className="btn-icon-sm" onClick={() => setEditId(null)}><Icon name="x" size={13} /></button>
                    </>
                  ) : (
                    <>
                      <Icon name="user" size={14} color="var(--text-dim)" />
                      <span style={{ fontFamily: "var(--mono)", fontSize: 13, flex: 1 }}>{u.nome}</span>
                      <button className="btn-icon-sm edit-btn" onClick={() => { setEditId(u.id); setEditVal(u.nome); }}><Icon name="edit" size={14} /></button>
                      <button className="btn-icon-sm" onClick={() => delUser(u)}><Icon name="trash" size={14} /></button>
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
// CONFIGURACOES (Componente Principal da Aba)
// ============================================================
export function Configuracoes({ setor, user, addToast, thresh, onThreshChange, resolveSetor, getCol: getColProp, registrarLog, db: dbProp, initialSubTab, showBottomNav, onToggleBottomNav }) {
  const _db = dbProp || db;
  const _getCol = getColProp || getCol;

  const [configSubTab, setConfigSubTab] = useState(initialSubTab || "empresa");

  useEffect(() => {
    if (initialSubTab) {
      setConfigSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const colCat = _getCol(setor, "categorias");
  const colPadrao = _getCol(setor, "produtos_padrao");
  const colEst = _getCol(setor, "produtos");

  const [cats, setCats] = useState([]);
  const [prods, setProds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nomeCat, setNomeCat] = useState("");
  const [nomeProd, setNomeProd] = useState("");
  const [catProd, setCatProd] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");

  const [localThresh, setLocalThresh] = useState(thresh || DEFAULT_THRESH);
  const [savingThresh, setSavingThresh] = useState(false);

  const [editCatId, setEditCatId] = useState(null);
  const [editCatVal, setEditCatVal] = useState("");
  const [editProdId, setEditProdId] = useState(null);
  const [editProdVal, setEditProdVal] = useState("");
  const [editProdPreco, setEditProdPreco] = useState("");

  const [searchCat, setSearchCat] = useState("");
  const [searchProd, setSearchProd] = useState("");
  const [dupCat, setDupCat] = useState(null);
  const [dupProd, setDupProd] = useState(null);

  const [highlightCat, setHighlightCat] = useState(null);
  const [highlightProd, setHighlightProd] = useState(null);

  const catItemRefs = useRef({});
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

  const checkEditCatDup = (val, selfId) => cats.find(c => c.id !== selfId && c.nome.toLowerCase() === val.trim().toLowerCase()) || null;
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

  const InlineEdit = ({ id, val, setVal, onSave, checkDup, onCancel }) => {
    const dup = checkDup(val, id);
    return (
      <div style={{ flex: 1, marginRight: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={{ flex: 1, background: "var(--surface2)", border: `1px solid ${dup ? "var(--warn)" : "var(--accent)"}`, color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)" }}
          />
          <button className="btn-icon-sm" style={{ borderColor: "var(--success)", color: "var(--success)" }} onClick={onSave} disabled={!!dup}><Icon name="check" size={14} /></button>
          <button className="btn-icon-sm" onClick={onCancel}><Icon name="x" size={13} /></button>
        </div>
      </div>
    );
  };

  const InlineEditProd = ({ id, name, setName, price, setPrice, onSave, checkDup, onCancel }) => {
    const dup = checkDup(name, id);
    return (
      <div style={{ flex: 1, marginRight: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="Nome do produto..."
            onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={{ flex: 2, background: "var(--surface2)", border: `1px solid ${dup ? "var(--warn)" : "var(--accent)"}`, color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)" }}
          />
          <input type="number" step="0.01" min="0" placeholder="R$ Preço..." value={price} onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={{ width: 100, background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)" }}
          />
          <button className="btn-icon-sm" style={{ borderColor: "var(--success)", color: "var(--success)" }} onClick={onSave} disabled={!!dup}><Icon name="check" size={14} /></button>
          <button className="btn-icon-sm" onClick={onCancel}><Icon name="x" size={13} /></button>
        </div>
        {dup && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--warn)", marginTop: 5 }}>Nome já existe</div>}
      </div>
    );
  };

  const mainTabs = [
    { id: "empresa", icon: "building", label: "Empresa & Acesso App" },
    { id: "loja", icon: "store", label: "Módulo Loja (POS)" },
    { id: "estoque", icon: "barChart", label: "Limites de Alerta" },
  ];

  return (
    <div className="animate-fade-in">
      <div className="page-hd">
        <div className="page-title">CONFIGURAÇÕES</div>
        <div className="page-sub">Painel de Configuração — Setor Ativo: {s.label}</div>
      </div>

      {/* Navegação por Sub-tabs intuitivas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "thin" }}>
        {mainTabs.map(tab => (
          <button
            key={tab.id}
            className={`btn ${configSubTab === tab.id ? "btn-accent" : "btn-outline"} hover-lift`}
            onClick={() => setConfigSubTab(tab.id)}
            style={{ fontSize: 11, padding: "10px 16px", whiteSpace: "nowrap" }}
          >
            <Icon name={tab.icon} size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {configSubTab === "empresa" && <ConfigEmpresa user={user} addToast={addToast} showBottomNav={showBottomNav} onToggleBottomNav={onToggleBottomNav} />}

      {configSubTab === "loja" && (
        <div className="card hover-lift animate-slide-up">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="store" size={20} color="var(--accent)" /> MÓDULO FRENTE DE CAIXA (POS)
          </div>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>
            Habilite a frente de caixa para vendas diretas ao cliente final, puxando itens do estoque.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 500 }}>Habilitar Frente de Caixa</span>
              <button
                className={`btn ${modoLoja ? "btn-accent" : "btn-outline"}`}
                style={{ fontSize: 11, padding: "7px 16px" }}
                onClick={() => saveLojaConfig(!modoLoja, fluxoLoja)}
                disabled={savingLoja}
              >
                <Icon name={modoLoja ? "checkCircle" : "x"} size={14} />
                {modoLoja ? "ATIVADO" : "DESATIVADO"}
              </button>
            </div>

            {modoLoja && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="form-label">Origem da Saída das Vendas</label>
                  <select
                    className="form-select"
                    value={fluxoLoja}
                    onChange={e => saveLojaConfig(modoLoja, e.target.value)}
                    disabled={savingLoja}
                    style={{ fontSize: 12 }}
                  >
                    <option value="estoque">Apenas Estoque (Saída direta do Estoque principal)</option>
                    <option value="loja">Estoque + Loja (Controle de Estoque e Loja separados)</option>
                  </select>
                </div>

                <div style={{ background: "var(--surface2)", padding: 14, borderRadius: "var(--r)", border: "1px solid var(--border)", marginTop: 4 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginBottom: 6, letterSpacing: 1 }}>LINK DIRETO DO CAIXA</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/caixa?empresa=${user.email}`}
                      style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border2)", padding: "9px 12px", borderRadius: "var(--r)", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", outline: "none" }}
                    />
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: 11, padding: "8px 12px" }}
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/caixa?empresa=${user.email}`);
                        addToast("Link copiado!", "success");
                      }}
                    >
                      <Icon name="copy" size={13} /> Copiar
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {configSubTab === "estoque" && (
        <div className="card hover-lift animate-slide-up">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="barChart" size={20} color="var(--accent)" /> NÍVEIS DE ALERTA DE ESTOQUE
          </div>
          <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>
            Defina as faixas numéricas para classificação visual da quantidade dos produtos.
          </p>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              ["ZERADO", "0", "var(--danger)"],
              ["BAIXO", `1–${localThresh.baixo}`, "var(--accent)"],
              ["MÉDIO", `${localThresh.baixo + 1}–${localThresh.medio}`, "var(--warn)"],
              ["OK", `${localThresh.medio + 1}+`, "var(--success)"],
            ].map(([lbl, val, cor]) => (
              <div key={lbl} style={{ flex: 1, minWidth: 90, background: "var(--surface2)", border: `1px solid ${cor}`, borderRadius: "var(--r)", padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: cor, letterSpacing: 2, marginBottom: 4 }}>{lbl}</div>
                <div style={{ fontFamily: "var(--display)", fontSize: 24, color: cor }}>{val}</div>
              </div>
            ))}
          </div>
          {[["BAIXO ≤", "var(--accent)", "baixo", 50], ["MÉDIO ≤", "var(--warn)", "medio", 200]].map(([lbl, cor, key, max]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: cor, width: 80, flexShrink: 0 }}>{lbl}</div>
              <input type="range" min={key === "baixo" ? 1 : 2} max={max} value={localThresh[key]}
                onChange={e => setLocalThresh(p => key === "baixo" ? { ...p, baixo: Math.min(Number(e.target.value), p.medio - 1) } : { ...p, medio: Math.max(Number(e.target.value), p.baixo + 1) })}
                style={{ flex: 1, WebkitAppearance: "none", appearance: "none", height: 5, borderRadius: 3, outline: "none", cursor: "pointer", background: `linear-gradient(to right,${cor} 0%,${cor} ${(localThresh[key] / max) * 100}%,var(--border2) ${(localThresh[key] / max) * 100}%,var(--border2) 100%)` }}
              />
              <div style={{ fontFamily: "var(--display)", fontSize: 24, color: cor, width: 40, textAlign: "right", flexShrink: 0 }}>{localThresh[key]}</div>
            </div>
          ))}
          <button className="btn btn-accent btn-full" style={{ marginTop: 18 }} onClick={saveThresh} disabled={savingThresh}>
            {savingThresh ? <><span className="spinner" /> SALVANDO...</> : <><Icon name="save" size={16} /> SALVAR LIMITES</>}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConfigProdutosCategorias({ setor, user, addToast, resolveSetor, getCol: propGetCol, registrarLog, db: propDb }) {
  const _db = propDb || db;
  const _getCol = propGetCol || getCol;

  const [cats, setCats] = useState([]);
  const [prods, setProds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nomeCat, setNomeCat] = useState("");
  const [nomeProd, setNomeProd] = useState("");
  const [catProd, setCatProd] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");

  const [editCatId, setEditCatId] = useState(null);
  const [editCatVal, setEditCatVal] = useState("");
  const [editProdId, setEditProdId] = useState(null);
  const [editProdVal, setEditProdVal] = useState("");
  const [editProdPreco, setEditProdPreco] = useState("");

  const [searchCat, setSearchCat] = useState("");
  const [searchProd, setSearchProd] = useState("");
  const [dupCat, setDupCat] = useState(null);
  const [dupProd, setDupProd] = useState(null);

  const [highlightCat, setHighlightCat] = useState(null);
  const [highlightProd, setHighlightProd] = useState(null);

  const catItemRefs = useRef({});
  const prodItemRefs = useRef({});

  const [modoLoja, setModoLoja] = useState(false);

  const colCat = _getCol(setor, "categorias");
  const colPadrao = _getCol(setor, "produtos_padrao");
  const colEst = _getCol(setor, "produtos");

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
      setModoLoja(lojaSnap.exists() && lojaSnap.data().modoLoja === true);
    } catch (e) { addToast("Erro: " + e.message, "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [setor]);

  useEffect(() => {
    const v = nomeCat.trim().toLowerCase();
    setDupCat(!v ? null : cats.find(c => c.nome.toLowerCase() === v) || null);
  }, [nomeCat, cats]);

  useEffect(() => {
    const v = nomeProd.trim().toLowerCase();
    setDupProd(!v ? null : prods.find(p => p.nome.toLowerCase() === v) || null);
  }, [nomeProd, prods]);

  const checkEditCatDup = (val, selfId) => cats.find(c => c.id !== selfId && c.nome.toLowerCase() === val.trim().toLowerCase()) || null;
  const checkEditProdDup = (val, selfId) => prods.find(p => p.id !== selfId && p.nome.toLowerCase() === val.trim().toLowerCase()) || null;

  const addCat = async () => {
    if (!nomeCat.trim()) return;
    if (dupCat) { addToast(`"${dupCat.nome}" já existe.`, "error"); return; }
    try {
      await addDoc(collection(_db, colCat), { nome: nomeCat.trim(), criadoEm: new Date().toISOString() });
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Categoria criada: ${nomeCat.trim()}`, usuario: user?.email });
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
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Categoria: "${c.nome}"→"${novo}"`, usuario: user?.email });
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
      if (registrarLog) await registrarLog(setor, "config", { descricao: `Produto criado: ${nomeProd.trim()}`, usuario: user?.email });
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

      if (registrarLog) await registrarLog(setor, "config", { descricao: `Produto: "${p.nome}" (R$ ${(p.precoVenda || 0)}) → "${novo}" (R$ ${(precoFinal || 0)})`, usuario: user?.email });
      addToast(`Produto "${novo}" atualizado!`, "success"); setEditProdId(null); load();
    } catch (e) { addToast("Erro: " + e.message, "error"); }
  };

  const scrollTo = (id, refs, setHL) => {
    setHL(id);
    setTimeout(() => { refs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 80);
    setTimeout(() => setHL(null), 2500);
  };

  const InlineEdit = ({ id, val, setVal, onSave, checkDup, onCancel }) => {
    const dup = checkDup(val, id);
    return (
      <div style={{ flex: 1, marginRight: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input autoFocus value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={{ flex: 1, background: "var(--surface2)", border: `1px solid ${dup ? "var(--warn)" : "var(--accent)"}`, color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)" }}
          />
          <button className="btn-icon-sm" style={{ borderColor: "var(--success)", color: "var(--success)" }} onClick={onSave} disabled={!!dup}><Icon name="check" size={14} /></button>
          <button className="btn-icon-sm" onClick={onCancel}><Icon name="x" size={13} /></button>
        </div>
      </div>
    );
  };

  const InlineEditProd = ({ id, name, setName, price, setPrice, onSave, checkDup, onCancel }) => {
    const dup = checkDup(name, id);
    return (
      <div style={{ flex: 1, marginRight: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="Nome do produto..."
            onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={{ flex: 2, background: "var(--surface2)", border: `1px solid ${dup ? "var(--warn)" : "var(--accent)"}`, color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)" }}
          />
          <input type="number" step="0.01" min="0" placeholder="R$ Preço..." value={price} onChange={e => setPrice(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
            style={{ width: 100, background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--text)", padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 13, outline: "none", borderRadius: "var(--r)" }}
          />
          <button className="btn-icon-sm" style={{ borderColor: "var(--success)", color: "var(--success)" }} onClick={onSave} disabled={!!dup}><Icon name="check" size={14} /></button>
          <button className="btn-icon-sm" onClick={onCancel}><Icon name="x" size={13} /></button>
        </div>
        {dup && <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--warn)", marginTop: 5 }}>Nome já existe</div>}
      </div>
    );
  };

  if (loading) return <div className="empty"><span className="spinner" /></div>;

  const s = resolveSetor ? resolveSetor(setor) : { label: setor };

  return (
    <div className="animate-slide-up">
      <div className="page-hd">
        <div className="page-title">CRIAR PRODUTOS & CATEGORIAS</div>
        <div className="page-sub">Catálogo Geral de Produtos e Categorias — Setor: {s.label}</div>
      </div>

      <div className="card hover-lift" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="tag" size={18} color="var(--accent)" /> CATEGORIAS DE PRODUTOS
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: dupCat ? 8 : 10 }}>
          <input className="form-input" placeholder="Nova categoria..." value={nomeCat}
            onChange={e => setNomeCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()}
            style={{ flex: 1, borderColor: dupCat ? "var(--warn)" : undefined }} />
          <button className="btn btn-accent" onClick={addCat} disabled={!!dupCat} style={{ padding: "12px 16px", opacity: dupCat ? .4 : 1 }}>
            <Icon name="plus" size={16} />
          </button>
        </div>
        {dupCat && <DupAlert tipo="cat" existente={dupCat} onDismiss={() => setNomeCat("")}
          onScrollTo={() => scrollTo(dupCat.id, catItemRefs, setHighlightCat)}
          onEdit={() => { scrollTo(dupCat.id, catItemRefs, setHighlightCat); setTimeout(() => { setEditCatId(dupCat.id); setEditCatVal(dupCat.nome); }, 300); setNomeCat(""); }}
          onDelete={() => { delCat(dupCat); setNomeCat(""); }} />}
        <SearchBox value={searchCat} onChange={setSearchCat} placeholder="Filtrar categorias..." />
        {(() => {
          const visible = searchCat.trim() ? cats.filter(c => c.nome.toLowerCase().includes(searchCat.toLowerCase())) : cats;
          if (!visible.length) return <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{cats.length === 0 ? "Nenhuma categoria cadastrada." : "Nenhuma encontrada."}</div>;
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {visible.map(c => (
                <div key={c.id} ref={el => catItemRefs.current[c.id] = el}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: highlightCat === c.id ? "rgba(250,204,21,.08)" : "var(--surface2)", border: highlightCat === c.id ? "1px solid var(--warn)" : "1px solid var(--border)", borderRadius: "var(--r)", transition: "all .3s" }}>
                  {editCatId === c.id
                    ? <InlineEdit id={c.id} val={editCatVal} setVal={setEditCatVal} onSave={() => saveCat(c)} checkDup={checkEditCatDup} onCancel={() => setEditCatId(null)} />
                    : <span style={{ fontFamily: "var(--mono)", fontSize: 13, flex: 1 }}>{c.nome}</span>}
                  {editCatId !== c.id && <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn-icon-sm edit-btn" onClick={() => { setEditCatId(c.id); setEditCatVal(c.nome); }}><Icon name="edit" size={14} /></button>
                    <button className="btn-icon-sm" onClick={() => delCat(c)}><Icon name="trash" size={14} /></button>
                  </div>}
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="card hover-lift">
        <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="package" size={18} color="var(--accent)" /> CATÁLOGO DE PRODUTOS PADRÃO
          {modoLoja && <span style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--mono)", fontWeight: 400 }}>(MODO LOJA ATIVO)</span>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: dupProd ? 8 : 10 }}>
          <select className="form-select" value={catProd} onChange={e => setCatProd(e.target.value)}>
            <option value="">Selecionar categoria...</option>
            {cats.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" placeholder="Nome do produto..." value={nomeProd}
              onChange={e => setNomeProd(e.target.value)} onKeyDown={e => e.key === "Enter" && addProd()}
              style={{ flex: 1, borderColor: dupProd ? "var(--warn)" : undefined }} />
            <input className="form-input" type="number" min="0" step="0.01"
              placeholder={modoLoja ? "R$ Preço *" : "R$ Preço (opcional)"}
              value={precoVenda} onChange={e => setPrecoVenda(e.target.value)}
              style={{ width: 150, flexShrink: 0 }} />
            <button className="btn btn-accent" onClick={addProd} disabled={!!dupProd} style={{ padding: "12px 16px", opacity: dupProd ? .4 : 1 }}>
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
        {dupProd && <DupAlert tipo="prod" existente={dupProd} onDismiss={() => setNomeProd("")}
          onScrollTo={() => scrollTo(dupProd.id, prodItemRefs, setHighlightProd)}
          onEdit={() => { scrollTo(dupProd.id, prodItemRefs, setHighlightProd); setTimeout(() => { setEditProdId(dupProd.id); setEditProdVal(dupProd.nome); setEditProdPreco(String(dupProd.precoVenda ?? "")); }, 300); setNomeProd(""); }}
          onDelete={() => { delProd(dupProd); setNomeProd(""); }} />}
        <SearchBox value={searchProd} onChange={setSearchProd} placeholder="Filtrar produtos do catálogo..." />
        {(() => {
          const qp = searchProd.toLowerCase();
          const fp = qp ? prods.filter(p => p.nome.toLowerCase().includes(qp) || p.categoria.toLowerCase().includes(qp)) : prods;
          if (!fp.length) return <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>{prods.length === 0 ? "Nenhum produto padrão." : "Nenhum encontrado."}</div>;
          const catsComProds = cats.filter(c => fp.some(p => p.categoria === c.nome));
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
              {catsComProds.map(c => {
                const ps = fp.filter(p => p.categoria === c.nome);
                if (!ps.length) return null;
                return (
                  <div key={c.id}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", letterSpacing: 2, textTransform: "uppercase", padding: "8px 0 4px" }}>{c.nome}</div>
                    {ps.map(p => (
                      <div key={p.id} ref={el => prodItemRefs.current[p.id] = el}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", background: highlightProd === p.id ? "rgba(250,204,21,.08)" : "var(--surface2)", border: highlightProd === p.id ? "1px solid var(--warn)" : "1px solid var(--border)", borderRadius: "var(--r)", marginBottom: 4, transition: "all .3s" }}>
                        {editProdId === p.id
                          ? <InlineEditProd id={p.id} name={editProdVal} setName={setEditProdVal} price={editProdPreco} setPrice={setEditProdPreco} onSave={() => saveProd(p)} checkDup={checkEditProdDup} onCancel={() => setEditProdId(null)} />
                          : <>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 13, flex: 1 }}>{p.nome}</span>
                            {p.precoVenda != null && <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", marginRight: 12, fontWeight: 600 }}>R$ {Number(p.precoVenda).toFixed(2)}</span>}
                          </>}
                        {editProdId !== p.id && <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn-icon-sm edit-btn" onClick={() => { setEditProdId(p.id); setEditProdVal(p.nome); setEditProdPreco(String(p.precoVenda ?? "")); }}><Icon name="edit" size={14} /></button>
                          <button className="btn-icon-sm" onClick={() => delProd(p)}><Icon name="trash" size={14} /></button>
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
    </div>
  );
}

export default Configuracoes;