/**
 * ConfigCaixas.jsx
 * Módulo Administrativo para Monitoramento e Gestão de Caixas (POS)
 * Sub-abas:
 *  - "monitoramento": Status ao vivo, operador logado, saldo inicial/final e vendas
 *  - "operadores": Cadastro de operadores/caixas e PINs de acesso
 *  - "vendas": Histórico de vendas detalhado (itens, horário, totais, nota/comprovante)
 */

import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, doc, setDoc, deleteDoc,
  query, where, updateDoc, serverTimestamp, getDoc, onSnapshot, orderBy
} from "firebase/firestore";
import { Icon } from "./icons.jsx";

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

export function ConfigCaixasAdmin({ user, setor, addToast, resolveSetor }) {
  const [subTab, setSubTab] = useState("monitoramento"); // "monitoramento" | "operadores" | "vendas"
  const [sectors, setSectors] = useState([]);
  const [selectedSecId, setSelectedSecId] = useState(setor || "");

  // Live Monitoring State
  const [liveStatuses, setLiveStatuses] = useState({});
  const [loadingLive, setLoadingLive] = useState(true);

  // Operators State
  const [operators, setOperators] = useState([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [opNome, setOpNome] = useState("");
  const [opPin, setOpPin] = useState("");
  const [opSecId, setOpSecId] = useState("");
  const [savingOp, setSavingOp] = useState(false);

  // Sales History State
  const [salesList, setSalesList] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayMethod, setSelectedPayMethod] = useState("");
  const [expandedSaleId, setExpandedSaleId] = useState(null);

  // Load Sectors on mount
  useEffect(() => {
    if (!user?.email) return;
    getDocs(collection(db, "users", user.email, "setores")).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSectors(list);
      if (!selectedSecId && list.length > 0) {
        setSelectedSecId(list[0].id);
        setOpSecId(list[0].id);
      }
    }).catch(e => console.error(e));
  }, [user]);

  useEffect(() => {
    if (setor) {
      setSelectedSecId(setor);
      setOpSecId(setor);
    }
  }, [setor]);

  // Subscribe to live status of all sectors
  useEffect(() => {
    if (!user?.email || sectors.length === 0) return;
    setLoadingLive(true);
    const unsubs = [];

    sectors.forEach(s => {
      const statusRef = doc(db, `users/${user.email}/setores/${s.id}/caixa_status`, "atual");
      const unsub = onSnapshot(statusRef, (snap) => {
        setLiveStatuses(prev => ({
          ...prev,
          [s.id]: snap.exists() ? snap.data() : { aberto: false }
        }));
      }, err => console.error(err));
      unsubs.push(unsub);
    });

    setLoadingLive(false);
    return () => unsubs.forEach(u => u());
  }, [user, sectors]);

  // Load Operators for selected sector
  const loadOperators = async (secId) => {
    if (!user?.email || !secId) return;
    setLoadingOps(true);
    try {
      const snap = await getDocs(collection(db, `users/${user.email}/setores/${secId}/caixa_operadores`));
      setOperators(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOps(false);
    }
  };

  useEffect(() => {
    if (subTab === "operadores" && selectedSecId) {
      loadOperators(selectedSecId);
    }
  }, [subTab, selectedSecId]);

  const handleCreateOperator = async (e) => {
    if (e) e.preventDefault();
    const nome = opNome.trim();
    const pin = opPin.trim();
    const targetSec = opSecId || selectedSecId;

    if (!nome) { addToast("Digite o nome do operador.", "error"); return; }
    if (pin.length < 4 || !/^\d{4,6}$/.test(pin)) { addToast("O PIN deve ter entre 4 e 6 dígitos numéricos.", "error"); return; }
    if (!targetSec) { addToast("Selecione o setor do operador.", "error"); return; }

    setSavingOp(true);
    try {
      await addDoc(collection(db, `users/${user.email}/setores/${targetSec}/caixa_operadores`), {
        nome,
        pin,
        ativo: true,
        criadoEm: new Date().toISOString()
      });
      addToast(`Operador "${nome}" cadastrado com sucesso!`, "success");
      setOpNome("");
      setOpPin("");
      loadOperators(targetSec);
    } catch (e) {
      addToast("Erro ao cadastrar operador: " + e.message, "error");
    } finally {
      setSavingOp(false);
    }
  };

  const toggleOperatorStatus = async (op) => {
    try {
      await updateDoc(doc(db, `users/${user.email}/setores/${selectedSecId}/caixa_operadores`, op.id), {
        ativo: !op.ativo
      });
      addToast(`Operador "${op.nome}" ${!op.ativo ? "ativado" : "desativado"}.`, "info");
      loadOperators(selectedSecId);
    } catch (e) {
      addToast("Erro: " + e.message, "error");
    }
  };

  const handleDeleteOperator = async (op) => {
    if (!confirm(`Excluir o operador "${op.nome}"?`)) return;
    try {
      await deleteDoc(doc(db, `users/${user.email}/setores/${selectedSecId}/caixa_operadores`, op.id));
      addToast("Operador removido.", "success");
      loadOperators(selectedSecId);
    } catch (e) {
      addToast("Erro: " + e.message, "error");
    }
  };

  // Load Sales for selected sector
  const loadSales = async (secId) => {
    if (!user?.email || !secId) return;
    setLoadingSales(true);
    try {
      const snap = await getDocs(collection(db, `users/${user.email}/setores/${secId}/vendas`));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.criadoEm || b.timestamp) - new Date(a.criadoEm || a.timestamp));
      setSalesList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    if (subTab === "vendas" && selectedSecId) {
      loadSales(selectedSecId);
    }
  }, [subTab, selectedSecId]);

  const fmtCurrency = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const fmtDate = (isoOrTs) => {
    if (!isoOrTs) return "—";
    if (isoOrTs.toDate) return isoOrTs.toDate().toLocaleString("pt-BR");
    return new Date(isoOrTs).toLocaleString("pt-BR");
  };

  const filteredSales = salesList.filter(s => {
    const queryStr = searchQuery.toLowerCase();
    const matchNota = s.numeroNota?.toLowerCase().includes(queryStr);
    const matchOp = s.operadorNome?.toLowerCase().includes(queryStr);
    const matchClient = s.cliente?.toLowerCase().includes(queryStr);
    const matchItem = s.items?.some(i => i.nome.toLowerCase().includes(queryStr));
    const matchesSearch = !queryStr || matchNota || matchOp || matchClient || matchItem;
    const matchesPay = !selectedPayMethod || s.formaPagamento === selectedPayMethod;
    return matchesSearch && matchesPay;
  });

  return (
    <div className="animate-slide-up">
      {/* Sub-header e Seletor de Setor */}
      <div className="card hover-lift" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
              <Icon name="store" size={22} color="var(--success)" /> MONITORAMENTO & GESTÃO DE CAIXAS (POS)
            </div>
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>
              Gerencie operadores, acompanhe o caixa ao vivo com valores iniciais/finais e audite comprovantes de vendas.
            </p>
          </div>

          {/* Selector de Setores */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>SETOR:</span>
            <select
              className="form-select"
              value={selectedSecId}
              onChange={e => {
                setSelectedSecId(e.target.value);
                setOpSecId(e.target.value);
              }}
              style={{ width: 180, padding: "8px 12px", fontSize: 12 }}
            >
              {sectors.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          <button className={`ftab ${subTab === "monitoramento" ? "active" : ""}`} onClick={() => setSubTab("monitoramento")}>
            <Icon name="monitor" size={13} /> Monitoramento ao Vivo
          </button>
          <button className={`ftab ${subTab === "operadores" ? "active" : ""}`} onClick={() => setSubTab("operadores")}>
            <Icon name="users" size={13} /> Operadores do Caixa
          </button>
          <button className={`ftab ${subTab === "vendas" ? "active" : ""}`} onClick={() => setSubTab("vendas")}>
            <Icon name="receipt" size={13} /> Histórico de Vendas
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SUB-ABA 1: MONITORAMENTO AO VIVO                              */}
      {/* ============================================================ */}
      {subTab === "monitoramento" && (
        <div className="animate-fade-in">
          {loadingLive ? (
            <div style={{ padding: 30, textAlign: "center" }}><span className="spinner" /></div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {sectors.map(sec => {
                const st = liveStatuses[sec.id] || {};
                const isAberto = st.aberto === true;
                const saldoInicial = st.saldoAbertura || 0;
                const totalVendasDinheiro = st.totalVendasDinheiro || 0;
                const saldoPrevisto = saldoInicial + totalVendasDinheiro;

                return (
                  <div
                    key={sec.id}
                    className="card hover-lift"
                    style={{
                      borderLeft: `4px solid ${isAberto ? "var(--success)" : "var(--border2)"}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12
                    }}
                  >
                    {/* Header do Card do Setor */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "10px", background: `${sec.color || "var(--accent)"}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name={sec.iconName || "package"} size={20} color={sec.color || "var(--accent)"} />
                        </div>
                        <div>
                          <div style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 700 }}>{sec.label}</div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>ID: {sec.id}</div>
                        </div>
                      </div>

                      <span className={`badge ${isAberto ? "badge-ok" : "badge-zero"}`} style={{ fontSize: 10, padding: "4px 10px" }}>
                        {isAberto ? "🟢 CAIXA ABERTO" : "🔴 FECHADO"}
                      </span>
                    </div>

                    <div className="divider" style={{ margin: "4px 0" }} />

                    {/* Informações da Sessão Ativa / Última Sessão */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "var(--mono)" }}>
                        <span style={{ color: "var(--text-dim)" }}>Operador Logado:</span>
                        <strong style={{ color: "var(--text)" }}>{st.operadorNome || "Nenhum no momento"}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "var(--mono)" }}>
                        <span style={{ color: "var(--text-dim)" }}>{isAberto ? "Aberto em:" : "Última abertura:"}</span>
                        <span>{fmtDate(st.abertoEm)}</span>
                      </div>

                      {!isAberto && st.fechadoEm && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: "var(--mono)" }}>
                          <span style={{ color: "var(--text-dim)" }}>Fechado em:</span>
                          <span>{fmtDate(st.fechadoEm)}</span>
                        </div>
                      )}
                    </div>

                    <div className="divider" style={{ margin: "4px 0" }} />

                    {/* Controle de Saldos (Antes vs Depois) */}
                    <div style={{ background: "var(--surface2)", padding: 12, borderRadius: "var(--r)", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>Saldo Inicial (Abertura):</span>
                        <strong style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{fmtCurrency(saldoInicial)}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>Vendas em Dinheiro:</span>
                        <strong style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--success)" }}>+ {fmtCurrency(totalVendasDinheiro)}</strong>
                      </div>

                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent)" }}>
                          {isAberto ? "Saldo Previsto no Caixa:" : "Saldo Final no Fechamento:"}
                        </span>
                        <strong style={{ fontFamily: "var(--display)", fontSize: 20, color: "var(--accent)" }}>
                          {fmtCurrency(isAberto ? saldoPrevisto : (st.saldoFechamento || saldoPrevisto))}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-ABA 2: OPERADORES DO CAIXA                               */}
      {/* ============================================================ */}
      {subTab === "operadores" && (
        <div className="animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Formulário Novo Operador */}
          <div className="card hover-lift" style={{ height: "fit-content" }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="userCheck" size={18} color="var(--accent)" /> CADASTRAR NOVO OPERADOR
            </div>
            <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 14 }}>
              Cadastre atendentes do caixa para autenticação e acompanhamento de auditoria.
            </p>

            <form onSubmit={handleCreateOperator} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Setor do Operador *</label>
                <select className="form-select" value={opSecId} onChange={e => setOpSecId(e.target.value)}>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nome Completo do Atendente *</label>
                <input
                  className="form-input"
                  placeholder="ex: Carlos Eduardo"
                  value={opNome}
                  onChange={e => setOpNome(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">PIN / Senha de Acesso (4 a 6 dígitos) *</label>
                <input
                  className="form-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="ex: 1234"
                  value={opPin}
                  onChange={e => setOpPin(e.target.value.replace(/\D/g, ""))}
                  style={{ fontFamily: "var(--mono)", letterSpacing: 4 }}
                  required
                />
              </div>

              <button className="btn btn-accent btn-full" type="submit" disabled={savingOp} style={{ marginTop: 6 }}>
                {savingOp ? <><span className="spinner" /> CADASTRANDO...</> : <><Icon name="plus" size={15} /> CADASTRAR OPERADOR</>}
              </button>
            </form>
          </div>

          {/* Lista de Operadores do Setor */}
          <div className="card hover-lift">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="users" size={18} color="var(--info)" /> OPERADORES CADASTRADOS ({operators.length})
            </div>

            {loadingOps ? (
              <div style={{ padding: 20, textAlign: "center" }}><span className="spinner" /></div>
            ) : operators.length === 0 ? (
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", padding: "20px 0", textAlign: "center" }}>
                Nenhum operador cadastrado para o setor selecionado.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {operators.map(op => (
                  <div
                    key={op.id}
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r)",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between"
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: "var(--sans)", fontSize: 14, fontWeight: 600 }}>{op.nome}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                        PIN: <span style={{ color: "var(--accent)" }}>••••</span> | Status: {op.ativo ? <strong style={{ color: "var(--success)" }}>ATIVO</strong> : <strong style={{ color: "var(--danger)" }}>INATIVO</strong>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className={`btn-icon-sm ${op.ativo ? "" : "edit-btn"}`}
                        onClick={() => toggleOperatorStatus(op)}
                        title={op.ativo ? "Desativar Operador" : "Ativar Operador"}
                      >
                        <Icon name={op.ativo ? "x" : "check"} size={14} />
                      </button>
                      <button
                        className="btn-icon-sm"
                        onClick={() => handleDeleteOperator(op)}
                        title="Excluir Operador"
                      >
                        <Icon name="trash" size={14} color="var(--danger)" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SUB-ABA 3: HISTÓRICO DE VENDAS                               */}
      {/* ============================================================ */}
      {subTab === "vendas" && (
        <div className="animate-fade-in">
          <div className="card hover-lift" style={{ marginBottom: 16 }}>
            {/* Filtros e Busca */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, marginBottom: 14 }}>
              <SearchBox value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nº da nota, produto, cliente ou operador..." />
              <select
                className="form-select"
                value={selectedPayMethod}
                onChange={e => setSelectedPayMethod(e.target.value)}
                style={{ height: 42 }}
              >
                <option value="">Todas as Formas de Pagamento</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="PIX">PIX</option>
                <option value="Cartão">Cartão</option>
                <option value="Fiado">Fiado</option>
              </select>
            </div>

            {loadingSales ? (
              <div style={{ padding: 30, textAlign: "center" }}><span className="spinner" /></div>
            ) : filteredSales.length === 0 ? (
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", padding: "30px 0", textAlign: "center" }}>
                Nenhuma venda registrada para este filtro.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredSales.map(sale => {
                  const isExpanded = expandedSaleId === sale.id;
                  return (
                    <div
                      key={sale.id}
                      style={{
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--r)",
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontFamily: "var(--display)", fontSize: 20, color: "var(--accent)", letterSpacing: 1 }}>
                            {sale.numeroNota || `#${sale.id.slice(0, 6)}`}
                          </span>
                          <span className="badge badge-ok" style={{ fontSize: 10 }}>{sale.formaPagamento || "Dinheiro"}</span>
                          {sale.cliente && (
                            <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-mid)" }}>
                              Cliente: <strong>{sale.cliente}</strong>
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>
                              Horário: {fmtDate(sale.criadoEm || sale.timestamp)}
                            </div>
                            <div style={{ fontFamily: "var(--display)", fontSize: 22, color: "var(--success)" }}>
                              {fmtCurrency(sale.total)}
                            </div>
                          </div>

                          <button
                            className="btn btn-outline"
                            style={{ fontSize: 11, padding: "6px 10px" }}
                            onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                          >
                            <Icon name={isExpanded ? "chevronUp" : "chevronDown"} size={14} />
                            {isExpanded ? "Ocultar Itens" : "Ver Itens"}
                          </button>
                        </div>
                      </div>

                      {/* Lista de Itens Vendidos na Venda */}
                      {isExpanded && (
                        <div style={{ background: "var(--surface)", padding: 12, borderRadius: "var(--r)", border: "1px solid var(--border2)", marginTop: 6 }}>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                            Itens do Comprovante / Nota ({sale.items?.length || 0}):
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {sale.items?.map((item, idx) => (
                              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontFamily: "var(--mono)", borderBottom: "1px dashed var(--border)", paddingBottom: 4 }}>
                                <span>{item.nome} <span style={{ color: "var(--accent)" }}>x{item.qtd}</span></span>
                                <strong>{fmtCurrency(item.subtotal || (item.precoVenda * item.qtd))}</strong>
                              </div>
                            ))}
                          </div>

                          {sale.operadorNome && (
                            <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--text-dim)", marginTop: 8, textAlign: "right" }}>
                              Operador responsável: <strong>{sale.operadorNome}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
