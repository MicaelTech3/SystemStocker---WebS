/**
 * Analytics.jsx
 * Analytics avançado: saída por requisição, tempo de giro, rotatividade, tendências
 * Integrado com edição de preços, criação de produtos e alinhado com o fluxo de caixa.
 * Arquivo único: os KPI cards (KpiCards) estão incluídos aqui embaixo dos helpers.
 */

import { useState, useEffect } from "react";
import { db, auth } from "./firebase.js";
import {
  collection, getDocs, query, orderBy, limit, doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";

// ─── helpers ─────────────────────────────────────────────────
const gc = (setor, type) => {
  const email = auth.currentUser?.email;
  return email ? `users/${email}/setores/${setor}/${type}` : `estoque_${setor}_${type}`;
};

const DEFAULT_THRESH = { baixo: 5, medio: 15 };
const getStatus = (qtd, thresh) => {
  const t = thresh || DEFAULT_THRESH;
  if (qtd <= 0) return "zero";
  if (qtd <= t.baixo) return "baixo";
  if (qtd <= t.medio) return "medio";
  return "alto";
};
const statusLabel = (st) => {
  const m = { zero: ["badge-zero", "ZERADO"], baixo: ["badge-low", "BAIXO"], medio: ["badge-med", "MÉDIO"] };
  const [cls, txt] = m[st] || ["badge-ok", "OK"];
  return <span className={`badge ${cls}`}>{txt}</span>;
};
const tsMs = (l) => {
  if (!l.ts) return 0;
  if (l.ts.toDate) return l.ts.toDate().getTime();
  if (l.ts.seconds) return l.ts.seconds * 1000;
  return new Date(l.ts).getTime();
};

// ─── ícones ──────────────────────────────────────────────────
const Svg = ({ size = 14, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "inline-block", flexShrink: 0 }}>
    {children}
  </svg>
);
const IcoSearch = () => <Svg size={14}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Svg>;
const IcoX = () => <Svg size={13}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;
const IcoEdit = () => <Svg size={14}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></Svg>;

function SearchA({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: "var(--r)", overflow: "hidden", marginBottom: 14 }}>
      <span style={{ padding: "0 10px", color: "var(--text-dim)", display: "flex" }}><IcoSearch /></span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text)", fontFamily: "var(--mono)", fontSize: 13, padding: "10px 0" }} />
      {value && <button onClick={() => onChange("")} style={{ padding: "0 10px", background: "transparent", border: "none", color: "var(--text-dim)", cursor: "pointer", display: "flex" }}><IcoX /></button>}
    </div>
  );
}

// ─── Mini bar chart ──────────────────────────────────────────
function MiniBar({ data, colorKey = "var(--accent)", max, label }) {
  const m = max || Math.max(...data.map(d => d.val), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 9, color: "var(--text-dim)", minHeight: 12 }}>{d.val || ""}</div>
          <div style={{ width: "100%", background: colorKey, borderRadius: "2px 2px 0 0", height: `${(d.val / m) * 100}%`, minHeight: d.val ? 2 : 0, opacity: d.val ? 1 : .12, transition: "height .3s" }} />
          <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--text-dim)", whiteSpace: "nowrap" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Calcula dias médios para esgotar estoque ─────────────────
function calcDiasGiro(nomeProd, estoqueAtual, saidasLogs, diasJanela = 30) {
  const agora = Date.now();
  const cutoff = agora - diasJanela * 86400000;
  const total = saidasLogs
    .filter(l => l.produto === nomeProd && tsMs(l) >= cutoff)
    .reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
  if (total === 0) return null;
  const mediaDia = total / diasJanela;
  if (mediaDia === 0) return null;
  return Math.round(estoqueAtual / mediaDia);
}

// ─── Tendência: compara período atual vs anterior ─────────────
function calcTendencia(produto, logs, periodoMs) {
  const agora = Date.now();
  const cutoff = agora - periodoMs;
  const atual = logs.filter(l => l.produto === produto && tsMs(l) >= cutoff).reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
  const ant = logs.filter(l => l.produto === produto && tsMs(l) >= agora - 2 * periodoMs && tsMs(l) < cutoff).reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
  if (ant === 0 && atual === 0) return 0;
  if (ant === 0) return 100;
  return Math.round(((atual - ant) / ant) * 100);
}

// ============================================================
// KPI CARDS (dados reais reconstruídos a partir dos logs)
// ============================================================
const KPI_DAY = 86400000;
const KPI_PONTOS = 14;    // pontos do gráfico (últimos 14 dias)
const KPI_COMPARAR = 30;  // comparação "vs. mês anterior"

const qtdLog = (l) => Number(l.quantidade) || 1;
const fimDoDia = (offset) => {
  const d = new Date(Date.now() - offset * KPI_DAY);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
};

function buildKpiSeries(products, logs) {
  const fins = Array.from({ length: KPI_PONTOS }, (_, i) => fimDoDia(KPI_PONTOS - 1 - i));
  const fim30 = fimDoDia(KPI_COMPARAR);

  const delta = {};   // nome -> variação líquida por dia
  const delta30 = {}; // nome -> variação líquida depois de há 30 dias
  logs.forEach((l) => {
    if (!l.produto) return;
    const t = tsMs(l);
    const sinal = l.tipo === "entrada" ? 1 : (l.tipo === "saida" || l.tipo === "venda") ? -1 : 0;
    if (!sinal) return;
    const v = sinal * qtdLog(l);
    if (t > fim30) delta30[l.produto] = (delta30[l.produto] || 0) + v;
    const idx = fins.findIndex((f) => t <= f);
    if (idx === -1) return;
    if (!delta[l.produto]) delta[l.produto] = new Array(KPI_PONTOS).fill(0);
    delta[l.produto][idx] += v;
  });

  const qtdEm = (p, i) => {
    const arr = delta[p.nome];
    const depois = arr ? arr.slice(i + 1).reduce((a, b) => a + b, 0) : 0;
    return (Number(p.quantidade) || 0) - depois;
  };

  const estoque = [], baixo = [], zero = [], total = [];
  fins.forEach((fim, i) => {
    let e = 0, b = 0, z = 0, n = 0;
    products.forEach((p) => {
      if (p.criadoEm && new Date(p.criadoEm).getTime() > fim) return;
      const q = qtdEm(p, i);
      n++; e += Math.max(q, 0);
      if (q <= 0) z++; else if (q <= 5) b++;
    });
    estoque.push(e); baixo.push(b); zero.push(z); total.push(n);
  });

  let e30 = 0, b30 = 0, z30 = 0, n30 = 0;
  products.forEach((p) => {
    if (p.criadoEm && new Date(p.criadoEm).getTime() > fim30) return;
    const q = (Number(p.quantidade) || 0) - (delta30[p.nome] || 0);
    n30++; e30 += Math.max(q, 0);
    if (q <= 0) z30++; else if (q <= 5) b30++;
  });

  const last = KPI_PONTOS - 1;
  return {
    total: { serie: total, atual: total[last], ant: n30 },
    estoque: { serie: estoque, atual: estoque[last], ant: e30 },
    baixo: { serie: baixo, atual: baixo[last], ant: b30 },
    zero: { serie: zero, atual: zero[last], ant: z30 },
  };
}

const kpiPct = (atual, ant) => {
  if (ant === 0 && atual === 0) return 0;
  if (ant === 0) return 100;
  return Math.round(((atual - ant) / ant) * 100);
};

const SP_W = 100, SP_H = 40;
function Sparkline({ values, color, id }) {
  const max = Math.max(...values), min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * SP_W,
    max === min ? SP_H * 0.55 : SP_H - 5 - ((v - min) / range) * (SP_H - 12),
  ]);

  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  const area = `${d} L ${SP_W},${SP_H} L 0,${SP_H} Z`;

  return (
    <div style={{ position: "relative", height: 56, margin: "0 -18px" }}>
      <svg viewBox={`0 0 ${SP_W} ${SP_H}`} preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke={color} strokeWidth="1.8"
          vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pts.map(([x, y], i) => (i % 2 === 0 || i === pts.length - 1) && (
        <span key={i} style={{
          position: "absolute", left: `${x}%`, top: `${(y / SP_H) * 100}%`,
          width: 5, height: 5, borderRadius: "50%", background: color,
          transform: "translate(-50%, -50%)",
        }} />
      ))}
    </div>
  );
}

const KpiIco = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const KPI_ICONES = {
  caixa: <KpiIco><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></KpiIco>,
  estoque: <KpiIco><path d="M21 16V8l-9-5-9 5v8l9 5z" /><path d="M3.3 7.5 12 12.5l8.7-5" /><path d="M12 22V12.5" /><path d="m7.5 4.8 9 5" /></KpiIco>,
  alerta: <KpiIco><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></KpiIco>,
  zero: <KpiIco><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></KpiIco>,
};

function KpiCard({ id, label, sub, valor, variacao, inverso, cor, icone, serie }) {
  const bom = inverso ? variacao < 0 : variacao > 0;
  const corVar = variacao === 0 ? "#8b949e" : bom ? "#10b981" : "#ef4444";
  const seta = variacao > 0 ? "↑" : variacao < 0 ? "↓" : "→";

  return (
    <div style={{
      background: `linear-gradient(180deg, ${cor}0d 0%, #0b1220 70%)`,
      border: `1.5px solid ${cor}`,
      borderRadius: 14,
      padding: "16px 18px 0",
      overflow: "hidden",
      boxShadow: `0 0 22px ${cor}22`,
      color: "#fff",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", columnGap: 12, alignItems: "start" }}>
        <div style={{
          gridRow: "1 / span 2", width: 42, height: 42, borderRadius: 10,
          background: `${cor}22`, border: `1px solid ${cor}55`, color: cor,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icone}</div>

        <div style={{ fontSize: 13, color: "#e6edf3" }}>{label}</div>
        <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: corVar }}>
          {seta} {Math.abs(variacao)}%
        </div>

        <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: cor }}>{valor}</div>
        <div style={{ textAlign: "right", fontSize: 10.5, color: "#8b949e", alignSelf: "end" }}>vs. mês anterior</div>
      </div>

      <div style={{ fontSize: 12, color: "#c9d1d9", margin: "2px 0 6px 54px" }}>{sub}</div>

      <Sparkline values={serie} color={cor} id={`spark-${id}`} />
    </div>
  );
}

function KpiCards({ products = [], logs = [] }) {
  const s = buildKpiSeries(products, logs);

  const cards = [
    { id: "prod", label: "Produtos", sub: "cadastrados", cor: "#f97316", icone: KPI_ICONES.caixa, d: s.total },
    { id: "est", label: "Em estoque", sub: "unidades", cor: "#2dd4bf", icone: KPI_ICONES.estoque, d: s.estoque },
    { id: "baixo", label: "Baixo estoque", sub: "produtos", cor: "#f59e0b", icone: KPI_ICONES.alerta, d: s.baixo, inverso: true },
    { id: "zero", label: "Zerados", sub: "produtos", cor: "#22d3ee", icone: KPI_ICONES.zero, d: s.zero, inverso: true },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
      gap: 14,
      marginBottom: 20,
    }}>
      {cards.map((c) => (
        <KpiCard key={c.id} id={c.id} label={c.label} sub={c.sub} cor={c.cor} icone={c.icone}
          inverso={c.inverso} valor={c.d.atual} variacao={kpiPct(c.d.atual, c.d.ant)} serie={c.d.serie} />
      ))}
    </div>
  );
}

// ============================================================
// GRÁFICO DE MOVIMENTAÇÃO (linhas suaves + área + tooltip)
// ============================================================
function MovChart({ data, series }) {
  const [hover, setHover] = useState(null);
  const n = data.length;
  const max = Math.max(...data.flatMap(d => series.map(s => d[s.key])), 1);
  const xs = (i) => ((i + 0.5) / n) * 100;
  const ys = (v) => 94 - (v / max) * 84;
  const clamp = (y) => Math.min(100, Math.max(0, y));

  const smooth = (pts) => {
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
      d += ` C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    return d;
  };

  return (
    <div>
      <div style={{ position: "relative", height: 170 }}>
        {/* linhas de grade */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`mov-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.28 }} />
                <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
              </linearGradient>
            ))}
          </defs>
          {[10, 38, 66, 94].map(y => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: "var(--border2, #30363d)", strokeWidth: 1, opacity: 0.7 }} />
          ))}
          {series.map(s => {
            const pts = data.map((d, i) => [xs(i), ys(d[s.key])]);
            const line = smooth(pts);
            return (
              <g key={s.key}>
                <path d={`${line} L ${pts[n - 1][0]},94 L ${pts[0][0]},94 Z`} fill={`url(#mov-${s.key})`} />
                <path d={line} fill="none" vectorEffect="non-scaling-stroke"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ stroke: s.color }} />
              </g>
            );
          })}
        </svg>

        {/* escala */}
        <div style={{ position: "absolute", left: 4, top: 0, fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)" }}>{max}</div>
        <div style={{ position: "absolute", left: 4, bottom: 2, fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)" }}>0</div>

        {/* pontos */}
        {series.map(s => data.map((d, i) => (
          <span key={`${s.key}-${i}`} style={{
            position: "absolute", left: `${xs(i)}%`, top: `${ys(d[s.key])}%`,
            width: hover === i ? 9 : 6, height: hover === i ? 9 : 6, borderRadius: "50%",
            background: s.color, transform: "translate(-50%, -50%)",
            opacity: d[s.key] || hover === i ? 1 : 0.35, transition: "all .12s", pointerEvents: "none",
          }} />
        )))}

        {/* colunas de hover + tooltip */}
        {data.map((d, i) => (
          <div key={i}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
            style={{
              position: "absolute", top: 0, bottom: 0, left: `${(i / n) * 100}%`, width: `${100 / n}%`,
              background: hover === i ? "rgba(255,255,255,0.04)" : "transparent",
            }}>
            {hover === i && (
              <div style={{
                position: "absolute", top: 4, zIndex: 2, whiteSpace: "nowrap",
                left: i === 0 ? 4 : i === n - 1 ? "auto" : "50%",
                right: i === n - 1 ? 4 : "auto",
                transform: i === 0 || i === n - 1 ? "none" : "translateX(-50%)",
                background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6,
                padding: "6px 10px", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text)",
              }}>
                <div style={{ color: "var(--text-dim)", marginBottom: 3 }}>{d.label}</div>
                {series.map(s => (
                  <div key={s.key} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                    <span style={{ color: s.color }}>■ {s.name}</span><strong>{d[s.key]}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* rótulos dos dias */}
      <div style={{ display: "flex", marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: hover === i ? "var(--text)" : "var(--text-dim)" }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// ANALYTICS
// ============================================================
export function Analytics({ setor, sectorObj, products, onRefresh, addToast }) {
  const [periodo, setPeriodo] = useState("semana");
  const [viewTab, setViewTab] = useState("geral"); // geral | rotatividade | requisicoes | produtos
  const [todos, setTodos] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Product Creation Fields
  const [showCreate, setShowCreate] = useState(false);
  const [prodNome, setProdNome] = useState("");
  const [prodPreco, setProdPreco] = useState("");
  const [prodQtd, setProdQtd] = useState("");
  const [prodQtdLoja, setProdQtdLoja] = useState("");
  const [prodBarcode, setProdBarcode] = useState("");
  const [prodCat, setProdCat] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  // Product Edit Modal Fields
  const [editProduct, setEditProduct] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editPreco, setEditPreco] = useState("");
  const [editQtd, setEditQtd] = useState("");
  const [editQtdLoja, setEditQtdLoja] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editCat, setEditCat] = useState("");
  const [updatingProduct, setUpdatingProduct] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Fetch system logs
    getDocs(query(collection(db, gc(setor, "log")), orderBy("ts", "desc"), limit(3000)))
      .then(s => setTodos(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setTodos([]))
      .finally(() => setLoading(false));

    // Fetch categories
    getDocs(collection(db, gc(setor, "categorias")))
      .then(s => {
        const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
        setCats(list);
        if (list.length > 0) setProdCat(list[0].nome);
      })
      .catch(() => setCats([]));
  }, [setor]);

  const agora = Date.now();
  const MS = { dia: 86400000, semana: 604800000, mes: 2592000000 };
  const cutoff = agora - (MS[periodo] || MS.semana);

  const todasSaidas = todos.filter(l => l.tipo === "saida" || l.tipo === "venda");
  const todasEntradas = todos.filter(l => l.tipo === "entrada");
  const saidasReq = todasSaidas.filter(l => l.origem === "requisicao");
  const saidasManuais = todasSaidas.filter(l => l.origem !== "requisicao");

  const saidasF = todasSaidas.filter(l => tsMs(l) >= cutoff);
  const entradasF = todasEntradas.filter(l => tsMs(l) >= cutoff);
  const saidasReqF = saidasReq.filter(l => tsMs(l) >= cutoff);
  const saidasManF = saidasManuais.filter(l => tsMs(l) >= cutoff);

  const totalS = saidasF.reduce((a, l) => a + (Number(l.quantidade || l.total) || 1), 0);
  const totalE = entradasF.reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
  const totalReq = saidasReqF.reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
  const totalMan = saidasManF.reduce((a, l) => a + (Number(l.quantidade || l.total) || 1), 0);

  const sMap = {};
  saidasF.forEach(l => {
    const qtd = Number(l.quantidade) || 1;
    if (!l.produto) return;
    if (!sMap[l.produto]) sMap[l.produto] = { nome: l.produto, cat: l.categoria || "", total: 0, req: 0, manual: 0 };
    sMap[l.produto].total += qtd;
    if (l.origem === "requisicao") sMap[l.produto].req += qtd;
    else sMap[l.produto].manual += qtd;
  });
  const topAll = Object.values(sMap).sort((a, b) => b.total - a.total).slice(0, 10);
  const q = search.toLowerCase();
  const topFiltro = q ? topAll.filter(i => i.nome.toLowerCase().includes(q) || i.cat.toLowerCase().includes(q)) : topAll;
  const maxS = topFiltro[0]?.total || topAll[0]?.total || 1;

  const dias7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(agora - (6 - i) * 86400000);
    return {
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }),
      ini: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
      fim: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime(),
    };
  });
  const grafico = dias7.map(d => ({
    label: d.label,
    e: todasEntradas.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade) || 1), 0),
    sMan: saidasManuais.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade || l.total) || 1), 0),
    sReq: saidasReq.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade) || 1), 0),
  }));
  const maxG = Math.max(...grafico.map(g => Math.max(g.e, g.sMan + g.sReq)), 1);

  const alertasAll = products.filter(p => (p.quantidade || 0) <= 5).sort((a, b) => (a.quantidade || 0) - (b.quantidade || 0));
  const alertas = q ? alertasAll.filter(p => p.nome?.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q)) : alertasAll;

  const rotatividade = products.map(p => {
    const diasGiro = calcDiasGiro(p.nome, p.quantidade || 0, todasSaidas, 30);
    const saidaTotal30d = todasSaidas
      .filter(l => l.produto === p.nome && tsMs(l) >= agora - 30 * 86400000)
      .reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
    const entradaTotal30d = todasEntradas
      .filter(l => l.produto === p.nome && tsMs(l) >= agora - 30 * 86400000)
      .reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
    const tendencia = calcTendencia(p.nome, todasSaidas, MS[periodo] || MS.semana);
    const reqTotal = todasSaidas.filter(l => l.produto === p.nome && l.origem === "requisicao").reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
    const manTotal = todasSaidas.filter(l => l.produto === p.nome && l.origem !== "requisicao").reduce((a, l) => a + (Number(l.quantidade) || 1), 0);
    return { ...p, diasGiro, saidaTotal30d, entradaTotal30d, tendencia, reqTotal, manTotal };
  }).filter(p => p.saidaTotal30d > 0 || p.quantidade > 0);

  const rotFiltro = q ? rotatividade.filter(p => p.nome?.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q)) : rotatividade;
  const rotSort = [...rotFiltro].sort((a, b) => b.saidaTotal30d - a.saidaTotal30d);

  const reqMap = {};
  saidasReqF.forEach(l => {
    if (!l.produto) return;
    if (!reqMap[l.produto]) reqMap[l.produto] = { nome: l.produto, cat: l.categoria || "", total: 0, pedidos: new Set() };
    reqMap[l.produto].total += Number(l.quantidade) || 1;
    if (l.reqCodigo) reqMap[l.produto].pedidos.add(l.reqCodigo);
  });
  const topReq = Object.values(reqMap).sort((a, b) => b.total - a.total).slice(0, 10);
  const topReqFilt = q ? topReq.filter(i => i.nome.toLowerCase().includes(q) || i.cat.toLowerCase().includes(q)) : topReq;
  const maxReq = topReqFilt[0]?.total || 1;

  // Manage Products Filtered
  const filteredProducts = products.filter(p =>
    (p.nome || "").toLowerCase().includes(q) || (p.categoria && p.categoria.toLowerCase().includes(q))
  );

  // Form handlers
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!prodNome.trim()) { addToast("Digite o nome do produto.", "error"); return; }
    if (!prodPreco || Number(prodPreco) <= 0) { addToast("Insira um preço de venda válido.", "error"); return; }
    if (!prodCat) { addToast("Selecione uma categoria.", "error"); return; }

    setSavingProduct(true);
    try {
      const docData = {
        nome: prodNome.trim(),
        precoVenda: Number(prodPreco),
        quantidade: Number(prodQtd) || 0,
        qtdLoja: Number(prodQtdLoja) || 0,
        codigoBarras: prodBarcode.trim(),
        categoria: prodCat,
        barcodes: prodBarcode.trim() ? [prodBarcode.trim()] : [],
        criadoEm: new Date().toISOString()
      };

      // 1. Save in products subcollection
      await addDoc(collection(db, gc(setor, "produtos")), docData);

      // 2. Save duplicate copy in default global templates
      await addDoc(collection(db, gc(setor, "produtos_padrao")), {
        nome: prodNome.trim(),
        precoVenda: Number(prodPreco),
        categoria: prodCat,
        criadoEm: new Date().toISOString()
      });

      // 3. Log
      await addDoc(collection(db, gc(setor, "log")), {
        tipo: "entrada",
        descricao: `Novo produto cadastrado: ${prodNome.trim()} (Estoque: ${Number(prodQtd) || 0})`,
        ts: serverTimestamp(),
        usuario: "Admin Web"
      });

      addToast("Produto criado com sucesso!", "success");
      setProdNome("");
      setProdPreco("");
      setProdQtd("");
      setProdQtdLoja("");
      setProdBarcode("");
      setShowCreate(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      addToast("Erro ao criar produto: " + err.message, "error");
    } finally {
      setSavingProduct(false);
    }
  };

  const handleOpenEdit = (p) => {
    setEditProduct(p);
    setEditNome(p.nome || "");
    setEditPreco(p.precoVenda || "");
    setEditQtd(p.quantidade || "");
    setEditQtdLoja(p.qtdLoja || "");
    setEditBarcode(p.codigoBarras || p.barcode || "");
    setEditCat(p.categoria || "");
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editProduct) return;
    setUpdatingProduct(true);
    try {
      const docRef = doc(db, gc(setor, "produtos"), editProduct.id);
      await updateDoc(docRef, {
        nome: editNome.trim(),
        precoVenda: Number(editPreco),
        quantidade: Number(editQtd) || 0,
        qtdLoja: Number(editQtdLoja) || 0,
        codigoBarras: editBarcode.trim(),
        barcodes: editBarcode.trim() ? [editBarcode.trim()] : [],
        categoria: editCat
      });

      addToast("Produto atualizado!", "success");
      setEditProduct(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      addToast("Erro ao salvar: " + err.message, "error");
    } finally {
      setUpdatingProduct(false);
    }
  };

  const handleDeleteProduct = async (p) => {
    if (!confirm(`Deseja mesmo excluir o produto "${p.nome}" definitivamente?`)) return;
    try {
      await deleteDoc(doc(db, gc(setor, "produtos"), p.id));
      addToast("Produto removido.", "success");
      if (onRefresh) onRefresh();
    } catch (err) {
      addToast("Erro ao excluir: " + err.message, "error");
    }
  };

  if (loading) return <div className="empty"><span className="spinner" /></div>;

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-title">ANALYTICS</div>
          <div className="page-sub">{sectorObj?.label || sectorObj?.id || setor} · {todos.length} registros totais</div>
        </div>

        <button className="btn btn-accent" onClick={() => setShowCreate(!showCreate)} style={{ fontSize: 11, padding: "8px 14px" }}>
          {showCreate ? "✕ Cancelar Cadastro" : "＋ Criar Novo Produto"}
        </button>
      </div>

      {/* CREATE PRODUCT FORM */}
      {showCreate && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 20, marginBottom: 18 }}>
          <h3 style={{ fontFamily: "var(--display)", fontSize: 18, marginBottom: 14, letterSpacing: 1 }}>NOVO PRODUTO NO SETOR</h3>
          <form onSubmit={handleCreateProduct} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>NOME DO PRODUTO</label>
              <input type="text" required placeholder="Ex: Coca-cola 2L" className="pos-search-input" style={{ width: "100%", padding: 8, fontSize: 13 }} value={prodNome} onChange={e => setProdNome(e.target.value)} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>PREÇO DE VENDA (R$)</label>
              <input type="number" step="0.01" min="0.01" required placeholder="Ex: 8.50" className="pos-search-input" style={{ width: "100%", padding: 8, fontSize: 13 }} value={prodPreco} onChange={e => setProdPreco(e.target.value)} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>QTD NO ESTOQUE GERAL</label>
              <input type="number" placeholder="Ex: 50" className="pos-search-input" style={{ width: "100%", padding: 8, fontSize: 13 }} value={prodQtd} onChange={e => setProdQtd(e.target.value)} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>QTD NA LOJA (POS)</label>
              <input type="number" placeholder="Ex: 10" className="pos-search-input" style={{ width: "100%", padding: 8, fontSize: 13 }} value={prodQtdLoja} onChange={e => setProdQtdLoja(e.target.value)} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>CÓDIGO DE BARRAS</label>
              <input type="text" placeholder="Código EAN" className="pos-search-input" style={{ width: "100%", padding: 8, fontSize: 13 }} value={prodBarcode} onChange={e => setProdBarcode(e.target.value)} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>CATEGORIA</label>
              <select className="pos-search-input" style={{ width: "100%", padding: 8, fontSize: 13 }} value={prodCat} onChange={e => setProdCat(e.target.value)}>
                {cats.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                {cats.length === 0 && <option value="">Sem categorias</option>}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button type="submit" className="btn btn-accent btn-lg" disabled={savingProduct}>
                {savingProduct ? "CADASTRANDO..." : "CADASTRAR PRODUTO"}
              </button>
            </div>
          </form>
        </div>
      )}

      <SearchA value={search} onChange={setSearch} placeholder="Filtrar produto ou categoria..." />

      {/* Tabs de view */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          ["geral", "📊 Geral"],
          ["rotatividade", "🔄 Rotatividade"],
          ["requisicoes", "📋 Por Requisição"],
          ["produtos", "⚙️ Preços & Estoque"]
        ].map(([k, l]) => (
          <button key={k} className={`btn ${viewTab === k ? "btn-accent" : "btn-outline"}`} style={{ fontSize: 11, padding: "7px 14px" }} onClick={() => setViewTab(k)}>{l}</button>
        ))}
      </div>

      {/* Período — apenas nas tabs que usam */}
      {viewTab !== "rotatividade" && viewTab !== "produtos" && (
        <div className="period-tabs">
          {[["dia", "Hoje"], ["semana", "Semana"], ["mes", "Mês"]].map(([k, l]) => (
            <button key={k} className={`ptab ${periodo === k ? "active" : ""}`} onClick={() => setPeriodo(k)}>{l}</button>
          ))}
        </div>
      )}

      {/* ══════════ TAB GERAL ══════════ */}
      {viewTab === "geral" && (
        <>
          {/* ─── Header Dashboard ─── */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "var(--display, sans-serif)", fontSize: 22, letterSpacing: "2px", lineHeight: 1, marginBottom: 4 }}>
              <span style={{ color: "var(--text, #fff)" }}>DASHBOARD </span>
              <span style={{ color: "#f97316" }}>ANALYTICS</span>
            </div>
            <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 11, color: "#8b949e" }}>
              Visão geral do seu estoque e movimentações
            </div>
          </div>

          {/* ─── KPI CARDS ─── */}
          <KpiCards products={products} logs={todos} />

          {!search && (
            <div className="table-card" style={{ marginBottom: 16 }}>
              <div className="table-card-header">
                <div className="table-card-title">MOVIMENTAÇÃO — 7 DIAS</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--success)" }}>■ Entrada</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)" }}>■ Saída Manual</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>■ Requisição</span>
                </div>
              </div>
              <div style={{ padding: "16px 12px" }}>
                <MovChart data={grafico} series={[
                  { key: "e", name: "Entrada", color: "var(--success)" },
                  { key: "sMan", name: "Saída Manual", color: "var(--danger)" },
                  { key: "sReq", name: "Requisição", color: "#f97316" },
                ]} />
              </div>
            </div>
          )}

          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-card-header">
              <div className="table-card-title">TOP SAÍDAS — {periodo.toUpperCase()}</div>
              {search && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>"{search}" · {topFiltro.length}</span>}
            </div>
            {topFiltro.length === 0
              ? <div className="empty">{search ? `Nenhum resultado para "${search}".` : "Sem saídas no período."}</div>
              : topFiltro.map((item, i) => (
                <div key={item.nome} className="rank-row">
                  <div className={`rank-num ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>{i + 1}</div>
                  <div className="rank-info">
                    <div className="rank-name">{item.nome}</div>
                    <div className="rank-cat">{item.cat}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                      {item.req > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>📋 {item.req} req.</span>}
                      {item.manual > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)" }}>✋ {item.manual} manual</span>}
                    </div>
                  </div>
                  <div className="rank-bar-wrap">
                    <div style={{ height: 5, background: "var(--border2)", borderRadius: 3, overflow: "hidden", marginBottom: 3, display: "flex" }}>
                      <div style={{ width: `${(item.req / maxS) * 100}%`, background: "#f97316", borderRadius: "3px 0 0 3px" }} />
                      <div style={{ width: `${(item.manual / maxS) * 100}%`, background: "var(--danger)" }} />
                    </div>
                    <div className="rank-sub">{item.total} un.</div>
                  </div>
                  <div className="rank-val">{item.total}</div>
                </div>
              ))}
          </div>

          {alertas.length > 0 && (
            <div className="table-card">
              <div className="table-card-header">
                <div className="table-card-title">ALERTAS DE ESTOQUE</div>
                {search && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>{alertas.length} result.</span>}
              </div>
              {alertas.map(p => (
                <div key={p.id} className="alert-row">
                  <div className="alert-days" style={{ color: (p.quantidade || 0) === 0 ? "var(--danger)" : "var(--accent)" }}>{p.quantidade || 0}</div>
                  <div className="alert-info"><div className="alert-name">{p.nome}</div><div className="alert-sub">{p.categoria}</div></div>
                  {statusLabel(getStatus(p.quantidade || 0, DEFAULT_THRESH))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════ TAB ROTATIVIDADE ══════════ */}
      {viewTab === "rotatividade" && (
        <>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", marginBottom: 14, padding: "10px 14px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
            Baseado nos últimos 30 dias. "Dias para zerar" = estoque atual ÷ média diária de saídas.
          </div>

          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-card-header">
              <div className="table-card-title">ROTATIVIDADE DE PRODUTOS</div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>30 dias</span>
            </div>
            {rotSort.length === 0
              ? <div className="empty">Sem dados suficientes.</div>
              : rotSort.map((p, i) => {
                const diasCorStr = p.diasGiro === null ? "—" : p.diasGiro > 999 ? "999+" : String(p.diasGiro);
                const diasColor = p.diasGiro === null ? "var(--text-dim)" : p.diasGiro <= 7 ? "var(--danger)" : p.diasGiro <= 30 ? "var(--warn)" : "var(--success)";
                const pctReq = (p.reqTotal + p.manTotal) > 0 ? Math.round((p.reqTotal / (p.reqTotal + p.manTotal)) * 100) : 0;
                const tend = p.tendencia;
                return (
                  <div key={p.id || p.nome} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div className={`rank-num ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`} style={{ fontSize: 16 }}>{i + 1}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--sans)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>{p.categoria}</div>
                      {(p.reqTotal + p.manTotal) > 0 && (
                        <div style={{ marginTop: 5 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <div style={{ flex: 1, height: 4, background: "var(--border2)", borderRadius: 2, overflow: "hidden", display: "flex" }}>
                              <div style={{ width: `${pctReq}%`, background: "#f97316" }} />
                              <div style={{ flex: 1, background: "var(--danger)" }} />
                            </div>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316", whiteSpace: "nowrap" }}>{pctReq}% req</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {p.reqTotal > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>📋 {p.reqTotal}</span>}
                            {p.manTotal > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)" }}>✋ {p.manTotal}</span>}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", marginBottom: 2 }}>30 DIAS</div>
                      <div style={{ fontFamily: "var(--display)", fontSize: 20, color: "var(--danger)" }}>{p.saidaTotal30d}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)" }}>saídas</div>
                    </div>

                    <div style={{ textAlign: "center", flexShrink: 0, minWidth: 40 }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", marginBottom: 2 }}>TEND.</div>
                      <div style={{ fontFamily: "var(--display)", fontSize: 16, color: tend > 0 ? "var(--danger)" : tend < 0 ? "var(--success)" : "var(--text-dim)" }}>
                        {tend > 0 ? `↑${tend}` : tend < 0 ? `↓${Math.abs(tend)}` : "—"}%
                      </div>
                    </div>

                    <div style={{ textAlign: "center", flexShrink: 0, minWidth: 52 }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", marginBottom: 2 }}>ZERA EM</div>
                      <div style={{ fontFamily: "var(--display)", fontSize: 22, color: diasColor }}>{diasCorStr}</div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)" }}>dias</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* ══════════ TAB REQUISIÇÕES ══════════ */}
      {viewTab === "requisicoes" && (
        <>
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <div className="stat-card" style={{ "--c": "#f97316" }}>
              <div className="stat-label">Saídas via Req.</div>
              <div className="stat-value" style={{ color: "#f97316" }}>{totalReq}</div>
              <div className="stat-sub">unidades</div>
            </div>
            <div className="stat-card" style={{ "--c": "var(--danger)" }}>
              <div className="stat-label">Saídas Manuais</div>
              <div className="stat-value" style={{ color: "var(--danger)" }}>{totalMan}</div>
              <div className="stat-sub">unidades</div>
            </div>
            <div className="stat-card" style={{ "--c": "var(--accent)" }}>
              <div className="stat-label">% Requisições</div>
              <div className="stat-value" style={{ color: "var(--accent)" }}>{totalS > 0 ? Math.round((totalReq / totalS) * 100) : 0}%</div>
              <div className="stat-sub">do total de saídas</div>
            </div>
            <div className="stat-card" style={{ "--c": "var(--success)" }}>
              <div className="stat-label">Produtos via Req.</div>
              <div className="stat-value" style={{ color: "var(--success)" }}>{Object.keys(reqMap).length}</div>
              <div className="stat-sub">SKUs distintos</div>
            </div>
          </div>

          {!search && (
            <div className="table-card" style={{ marginBottom: 16 }}>
              <div className="table-card-header">
                <div className="table-card-title">ORIGEM DAS SAÍDAS — 7 DIAS</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>■ Requisição</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)" }}>■ Manual</span>
                </div>
              </div>
              <div style={{ padding: "16px 12px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
                  {grafico.map((g, i) => {
                    const tot = g.sMan + g.sReq;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                        <div style={{ fontFamily: "var(--display)", fontSize: 9, color: "var(--text-dim)", minHeight: 14 }}>{tot || ""}</div>
                        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "stretch", height: 72, justifyContent: "flex-end" }}>
                          <div style={{ background: "#f97316", width: "100%", height: `${(g.sReq / maxG) * 100}%`, minHeight: g.sReq ? 2 : 0 }} />
                          <div style={{ background: "var(--danger)", width: "100%", height: `${(g.sMan / maxG) * 100}%`, minHeight: g.sMan ? 2 : 0 }} />
                        </div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--text-dim)" }}>{g.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="table-card" style={{ marginBottom: 16 }}>
            <div className="table-card-header">
              <div className="table-card-title">TOP PRODUTOS VIA REQUISIÇÃO — {periodo.toUpperCase()}</div>
              {search && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>{topReqFilt.length}</span>}
            </div>
            {topReqFilt.length === 0
              ? <div className="empty">Sem saídas por requisição no período.</div>
              : topReqFilt.map((item, i) => (
                <div key={item.nome} className="rank-row">
                  <div className={`rank-num ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>{i + 1}</div>
                  <div className="rank-info">
                    <div className="rank-name">{item.nome}</div>
                    <div className="rank-cat">{item.cat}</div>
                    {item.pedidos.size > 0 && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{item.pedidos.size} pedido{item.pedidos.size !== 1 ? "s" : ""}</div>}
                  </div>
                  <div className="rank-bar-wrap">
                    <div className="rank-bar-track"><div className="rank-bar-fill" style={{ width: `${(item.total / maxReq) * 100}%`, background: "#f97316" }} /></div>
                    <div className="rank-sub">{item.total} un.</div>
                  </div>
                  <div className="rank-val" style={{ color: "#f97316" }}>{item.total}</div>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ══════════ TAB PREÇOS & ESTOQUE ══════════ */}
      {viewTab === "produtos" && (
        <div className="table-card">
          <div className="table-card-header">
            <div className="table-card-title">LISTA DE PREÇOS E ESTOQUE</div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>Total: {filteredProducts.length} itens</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="empty">Nenhum produto cadastrado ou correspondente ao filtro.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filteredProducts.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--mono)", marginTop: 2 }}>
                      Cat: <strong>{p.categoria || "Geral"}</strong> | EAN: <strong>{p.codigoBarras || "—"}</strong>
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, fontFamily: "var(--mono)" }}>
                      <span>Geral: <strong style={{ color: (p.quantidade || 0) > 5 ? "var(--text)" : "var(--danger)" }}>{p.quantidade || 0}</strong></span>
                      <span>Loja POS: <strong style={{ color: (p.qtdLoja || 0) > 0 ? "var(--success)" : "var(--warn)" }}>{p.qtdLoja || 0}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--mono)" }}>PREÇO VENDA</div>
                      <div style={{ fontSize: 16, fontFamily: "var(--mono)", fontWeight: 600, color: "var(--accent)" }}>
                        R$ {Number(p.precoVenda || 0).toFixed(2)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: "6px 10px" }} onClick={() => handleOpenEdit(p)}>
                        <IcoEdit />
                      </button>
                      <button className="btn btn-outline" style={{ padding: "6px 10px", borderColor: "var(--danger)", color: "var(--danger)" }} onClick={() => handleDeleteProduct(p)}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* EDIT PRODUCT MODAL */}
      {editProduct && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r)", width: "90%", maxWidth: 440, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "var(--display)", fontSize: 20 }}>EDITAR PRODUTO</h3>
              <button onClick={() => setEditProduct(null)} style={{ background: "transparent", border: "none", fontSize: 16, cursor: "pointer", color: "var(--text)" }}>✕</button>
            </div>

            <form onSubmit={handleUpdateProduct} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>NOME DO PRODUTO</label>
                <input type="text" required className="pos-search-input" value={editNome} onChange={e => setEditNome(e.target.value)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>PREÇO DE VENDA (R$)</label>
                  <input type="number" step="0.01" min="0" required className="pos-search-input" value={editPreco} onChange={e => setEditPreco(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>CÓDIGO DE BARRAS (EAN)</label>
                  <input type="text" className="pos-search-input" value={editBarcode} onChange={e => setEditBarcode(e.target.value)} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>ESTOQUE GERAL</label>
                  <input type="number" className="pos-search-input" value={editQtd} onChange={e => setEditQtd(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>ESTOQUE LOJA (POS)</label>
                  <input type="number" className="pos-search-input" value={editQtdLoja} onChange={e => setEditQtdLoja(e.target.value)} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontFamily: "var(--mono)", color: "var(--text-dim)", marginBottom: 4 }}>CATEGORIA</label>
                <select className="pos-search-input" value={editCat} onChange={e => setEditCat(e.target.value)}>
                  {cats.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  {cats.length === 0 && <option value="">Sem categorias</option>}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1, padding: 10 }} onClick={() => setEditProduct(null)}>Cancelar</button>
                <button type="submit" className="btn btn-accent" style={{ flex: 1, padding: 10 }} disabled={updatingProduct}>
                  {updatingProduct ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;