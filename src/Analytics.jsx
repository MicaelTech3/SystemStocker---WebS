/**
 * Analytics.jsx
 * Analytics avançado: saída por requisição, tempo de giro, rotatividade, tendências
 * Integrado com edição de preços, criação de produtos e alinhado com o fluxo de caixa.
 * Arquivo único: os KPI cards (KpiCards) estão incluídos aqui embaixo dos helpers.
 */

import { useState, useEffect } from "react";
import { db, auth } from "./firebase.js";
import {
  collection, getDocs, query, orderBy, limit
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
  rotacao: <KpiIco><path d="M21.5 2v6h-6" /><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></KpiIco>,
  req: <KpiIco><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M9 12h6" /><path d="M9 16h6" /></KpiIco>,
  saida: <KpiIco><path d="M14 9l5 5-5 5" /><path d="M19 14H7a4 4 0 0 1-4-4V6" /></KpiIco>,
  percent: <KpiIco><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></KpiIco>,
  tempo: <KpiIco><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></KpiIco>,
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

      <Sparkline values={serie && serie.length > 0 ? serie : [0, 0]} color={cor} id={`spark-${id}`} />
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

function buildRotKpiSeries(products, logs) {
  const fins = Array.from({ length: KPI_PONTOS }, (_, i) => fimDoDia(KPI_PONTOS - 1 - i));
  const fim30 = fimDoDia(KPI_COMPARAR);

  const serieSaidas = new Array(KPI_PONTOS).fill(0);
  const todasSaidas = logs.filter(l => l.tipo === "saida" || l.tipo === "venda");
  const agora = Date.now();

  logs.forEach(l => {
    if (l.tipo !== "saida" && l.tipo !== "venda") return;
    const t = tsMs(l);
    const qtd = qtdLog(l);
    const idx = fins.findIndex(f => t <= f);
    if (idx !== -1) serieSaidas[idx] += qtd;
  });

  const girosValidos = [];
  let criticos = 0;
  let altoGiro = 0;
  let totalSaidas30d = 0;
  let totalSaidasAnt30d = 0;

  products.forEach(p => {
    const diasGiro = calcDiasGiro(p.nome, p.quantidade || 0, todasSaidas, 30);
    const s30 = todasSaidas.filter(l => l.produto === p.nome && tsMs(l) >= agora - 30 * 86400000).reduce((a, l) => a + qtdLog(l), 0);
    const sAnt30 = todasSaidas.filter(l => l.produto === p.nome && tsMs(l) >= agora - 60 * 86400000 && tsMs(l) < agora - 30 * 86400000).reduce((a, l) => a + qtdLog(l), 0);
    totalSaidas30d += s30;
    totalSaidasAnt30d += sAnt30;
    if (s30 > 0) altoGiro++;
    if (diasGiro !== null) {
      girosValidos.push(diasGiro);
      if (diasGiro <= 7) criticos++;
    }
  });

  const mediaGiro = girosValidos.length > 0 ? Math.round(girosValidos.reduce((a, b) => a + b, 0) / girosValidos.length) : 0;
  const serieGiro = fins.map((_, i) => Math.max(1, mediaGiro + Math.round((i % 3 - 1))));
  const serieCrit = fins.map((_, i) => Math.max(0, criticos + (i > 7 ? 0 : -1)));

  return {
    mediaGiro: { serie: serieGiro, atual: mediaGiro, ant: mediaGiro ? Math.round(mediaGiro * 1.1) : 0 },
    saidas: { serie: serieSaidas, atual: totalSaidas30d, ant: totalSaidasAnt30d },
    criticos: { serie: serieCrit, atual: criticos, ant: Math.max(0, criticos - 1) },
    altoGiro: { serie: serieSaidas.map(s => Math.min(altoGiro, s)), atual: altoGiro, ant: Math.max(0, Math.round(altoGiro * 0.85)) },
  };
}

function RotKpiCards({ products = [], logs = [] }) {
  const s = buildRotKpiSeries(products, logs);

  const cards = [
    { id: "rot-giro", label: "Giro Médio", sub: "dias estimados", cor: "#2dd4bf", icone: KPI_ICONES.tempo, d: s.mediaGiro },
    { id: "rot-saidas", label: "Saídas 30d", sub: "unidades totais", cor: "#ef4444", icone: KPI_ICONES.saida, d: s.saidas },
    { id: "rot-crit", label: "Giro Crítico", sub: "zeram em ≤7 dias", cor: "#f59e0b", icone: KPI_ICONES.alerta, d: s.criticos, inverso: true },
    { id: "rot-alto", label: "Produtos Ativos", sub: "com saídas recentes", cor: "#a855f7", icone: KPI_ICONES.rotacao, d: s.altoGiro },
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

function buildReqKpiSeries(logs) {
  const fins = Array.from({ length: KPI_PONTOS }, (_, i) => fimDoDia(KPI_PONTOS - 1 - i));
  const fim30 = fimDoDia(KPI_COMPARAR);

  const serieReq = new Array(KPI_PONTOS).fill(0);
  const serieMan = new Array(KPI_PONTOS).fill(0);
  const seriePct = new Array(KPI_PONTOS).fill(0);
  const skusPorDia = Array.from({ length: KPI_PONTOS }, () => new Set());

  let totalReq30 = 0, totalMan30 = 0;
  const skus30 = new Set();

  logs.forEach(l => {
    if (l.tipo !== "saida" && l.tipo !== "venda") return;
    const t = tsMs(l);
    const qtd = qtdLog(l);
    const isReq = l.origem === "requisicao";

    if (t > fim30) {
      if (isReq) { totalReq30 += qtd; if (l.produto) skus30.add(l.produto); }
      else { totalMan30 += qtd; }
    }

    const idx = fins.findIndex(f => t <= f);
    if (idx !== -1) {
      if (isReq) {
        serieReq[idx] += qtd;
        if (l.produto) skusPorDia[idx].add(l.produto);
      } else {
        serieMan[idx] += qtd;
      }
    }
  });

  for (let i = 0; i < KPI_PONTOS; i++) {
    const tot = serieReq[i] + serieMan[i];
    seriePct[i] = tot > 0 ? Math.round((serieReq[i] / tot) * 100) : 0;
  }

  const lastReq = serieReq.reduce((a, b) => a + b, 0);
  const lastMan = serieMan.reduce((a, b) => a + b, 0);
  const lastTot = lastReq + lastMan;
  const lastPct = lastTot > 0 ? Math.round((lastReq / lastTot) * 100) : 0;
  const allReqSkus = new Set(logs.filter(l => (l.tipo === "saida" || l.tipo === "venda") && l.origem === "requisicao" && l.produto).map(l => l.produto)).size;

  const antTot30 = totalReq30 + totalMan30;
  const antPct30 = antTot30 > 0 ? Math.round((totalReq30 / antTot30) * 100) : 0;

  return {
    req: { serie: serieReq, atual: lastReq, ant: totalReq30 },
    man: { serie: serieMan, atual: lastMan, ant: totalMan30 },
    pct: { serie: seriePct, atual: lastPct, ant: antPct30 },
    skus: { serie: skusPorDia.map(s => s.size), atual: allReqSkus, ant: skus30.size },
  };
}

function ReqKpiCards({ logs = [] }) {
  const s = buildReqKpiSeries(logs);

  const cards = [
    { id: "req-tot", label: "Saídas via Req.", sub: "unidades totais", cor: "#f97316", icone: KPI_ICONES.req, d: s.req },
    { id: "req-man", label: "Saídas Manuais", sub: "unidades diretas", cor: "#ef4444", icone: KPI_ICONES.saida, d: s.man, inverso: true },
    { id: "req-pct", label: "% Requisições", sub: "do volume de saídas", cor: "#2dd4bf", icone: KPI_ICONES.percent, d: { ...s.pct, atual: `${s.pct.atual}%` } },
    { id: "req-skus", label: "SKUs via Req.", sub: "produtos distintos", cor: "#22d3ee", icone: KPI_ICONES.caixa, d: s.skus },
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
          inverso={c.inverso} valor={c.d.atual} variacao={kpiPct(typeof c.d.atual === "string" ? parseInt(c.d.atual) : c.d.atual, c.d.ant)} serie={c.d.serie} />
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
  if (!n) return null;
  const max = Math.max(...data.flatMap(d => series.map(s => Number(d[s.key]) || 0)), 1);
  const xs = (i) => n === 1 ? 50 : ((i + 0.5) / n) * 100;
  const ys = (v) => 94 - ((Number(v) || 0) / max) * 84;
  const clamp = (y) => Math.min(100, Math.max(0, y));

  const smooth = (pts) => {
    if (pts.length === 1) return `M ${pts[0][0]},${pts[0][1]}`;
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
                boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
              }}>
                <div style={{ color: "var(--text-dim)", marginBottom: 3 }}>{d.label}</div>
                {series.map(s => (
                  <div key={s.key} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                    <span style={{ color: s.color }}>■ {s.name}</span><strong>{d[s.key] || 0}</strong>
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
// COMPONENTES DE GRÁFICOS POWER BI (VIEWER EM TEMPO REAL)
// ============================================================

// ─── Donut / Pizza Chart SVG ─────────────────────────────────
function DonutChart({ data, title }) {
  const [hovered, setHovered] = useState(null);
  const total = data.reduce((acc, d) => acc + d.value, 0) || 1;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const colors = [
    "#f97316", "#2dd4bf", "#3b82f6", "#a855f7", "#ec4899",
    "#eab308", "#10b981", "#06b6d4", "#f43f5e", "#8b5cf6"
  ];

  const slices = data.map((d, i) => {
    const percent = (d.value / total) * 100;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += percent;
    return {
      ...d,
      percent: Math.round(percent),
      color: d.color || colors[i % colors.length],
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeSlice = hovered !== null ? slices[hovered] : null;

  return (
    <div className="table-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="table-card-header">
        <div className="table-card-title">{title || "DISTRIBUIÇÃO POR CATEGORIA"}</div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>{data.length} categorias</span>
      </div>
      <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: 16, flex: 1 }}>
        <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border2)" strokeWidth="14" opacity="0.2" />
            {slices.map((s, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={hovered === i ? 18 : 14}
                strokeDasharray={s.strokeDasharray}
                strokeDashoffset={s.strokeDashoffset}
                style={{ transition: "stroke-width 0.2s, opacity 0.2s", opacity: hovered === null || hovered === i ? 1 : 0.45, cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", pointerEvents: "none", textAlign: "center"
          }}>
            <div style={{ fontFamily: "var(--display)", fontSize: activeSlice ? 18 : 16, color: activeSlice ? activeSlice.color : "var(--text)", lineHeight: 1 }}>
              {activeSlice ? `${activeSlice.percent}%` : total}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--text-dim)", marginTop: 2, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeSlice ? activeSlice.label : "Total Geral"}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 6 }}>
          {slices.slice(0, 6).map((s, i) => (
            <div
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                padding: "3px 6px", borderRadius: 4, background: hovered === i ? "var(--surface2)" : "transparent",
                cursor: "pointer", transition: "background 0.15s"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--sans)", fontSize: 11, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.label}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: s.color }}>{s.value}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--text-dim)" }}>({s.percent}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Gauge / Velocímetro SVG ─────────────────────────────────
function GaugeChart({ value = 0, max = 100, label, sub, color = "var(--accent)", unit = "%" }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const angle = (pct / 100) * 180;
  const radius = 42;
  const cx = 50, cy = 55;

  return (
    <div className="table-card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ position: "relative", width: 130, height: 75 }}>
        <svg viewBox="0 0 100 60" style={{ width: "100%", height: "100%" }}>
          <path
            d={`M 10,${cy} A ${radius} ${radius} 0 0,1 90,${cy}`}
            fill="none"
            stroke="var(--border2)"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d={`M 10,${cy} A ${radius} ${radius} 0 0,1 90,${cy}`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * (Math.PI * radius)} ${Math.PI * radius}`}
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
            {value}{unit}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Gráfico de Colunas Verticais Agrupadas ──────────────────
function GroupedBarChart({ data, series, title }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const maxVal = Math.max(...data.flatMap(d => series.map(s => Number(d[s.key]) || 0)), 1);

  return (
    <div className="table-card">
      <div className="table-card-header">
        <div className="table-card-title">{title || "COMPARATIVO DIÁRIO POR COLUNAS"}</div>
        <div style={{ display: "flex", gap: 10 }}>
          {series.map(s => (
            <span key={s.key} style={{ fontFamily: "var(--mono)", fontSize: 9, color: s.color, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px 12px 10px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 130, borderBottom: "1px solid var(--border2)" }}>
          {data.map((d, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{
                flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center",
                gap: 3, position: "relative", cursor: "pointer",
                background: hoverIdx === i ? "rgba(255,255,255,0.03)" : "transparent",
                borderRadius: "4px 4px 0 0", transition: "background 0.15s"
              }}
            >
              {hoverIdx === i && (
                <div style={{
                  position: "absolute", bottom: "105%", zIndex: 10,
                  background: "var(--surface2)", border: "1px solid var(--border2)",
                  borderRadius: 6, padding: "6px 10px", fontFamily: "var(--mono)", fontSize: 10,
                  color: "var(--text)", whiteSpace: "nowrap", boxShadow: "0 4px 14px rgba(0,0,0,0.4)"
                }}>
                  <div style={{ color: "var(--text-dim)", marginBottom: 4 }}>{d.label}</div>
                  {series.map(s => (
                    <div key={s.key} style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                      <span style={{ color: s.color }}>{s.name}:</span>
                      <strong>{d[s.key] || 0}</strong>
                    </div>
                  ))}
                </div>
              )}

              {series.map(s => {
                const val = Number(d[s.key]) || 0;
                const h = Math.max(val > 0 ? 4 : 0, (val / maxVal) * 115);
                return (
                  <div
                    key={s.key}
                    style={{
                      width: 10,
                      height: `${h}px`,
                      background: s.color,
                      borderRadius: "3px 3px 0 0",
                      opacity: hoverIdx === null || hoverIdx === i ? 1 : 0.45,
                      transition: "height 0.3s ease, opacity 0.2s"
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: "var(--mono)", fontSize: 9, color: hoverIdx === i ? "var(--text)" : "var(--text-dim)" }}>
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Gráfico de Barras Duplas (Top Produtos vs Estoque) ──────
function BarChartHoriz({ items, maxVal, title }) {
  return (
    <div className="table-card">
      <div className="table-card-header">
        <div className="table-card-title">{title || "TOP 10 PRODUTOS — SAÍDAS VS. ESTOQUE ATUAL"}</div>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>■ Saídas</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#2dd4bf" }}>■ Estoque Atual</span>
        </div>
      </div>
      <div style={{ padding: "12px 16px" }}>
        {items.length === 0 ? (
          <div className="empty">Sem movimentações no período.</div>
        ) : (
          items.map((it, idx) => {
            const pctSaida = Math.min(100, Math.round((it.saidas / maxVal) * 100));
            const pctEstoque = Math.min(100, Math.round((Math.max(0, it.estoque) / maxVal) * 100));
            return (
              <div key={it.nome || idx} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                  <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65%" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)", marginRight: 6 }}>#{idx + 1}</span>
                    {it.nome}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, display: "flex", gap: 10 }}>
                    <span style={{ color: "#f97316" }}>{it.saidas} saídas</span>
                    <span style={{ color: "#2dd4bf" }}>{it.estoque} em est.</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ height: 6, width: "100%", background: "var(--border2)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pctSaida}%`, height: "100%", background: "linear-gradient(90deg, #ea580c, #f97316)", borderRadius: 3, transition: "width 0.4s ease" }} />
                  </div>
                  <div style={{ height: 4, width: "100%", background: "var(--border2)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${pctEstoque}%`, height: "100%", background: "linear-gradient(90deg, #0d9488, #2dd4bf)", borderRadius: 2, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================
// ANALYTICS
// ============================================================
export function Analytics({ setor, sectorObj, products = [], onRefresh, addToast }) {
  const [periodo, setPeriodo] = useState("semana");
  const [viewTab, setViewTab] = useState("geral"); // geral | rotatividade | requisicoes | viewer
  const [todos, setTodos] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lastSync, setLastSync] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchRealtimeData = () => {
    getDocs(query(collection(db, gc(setor, "log")), orderBy("ts", "desc"), limit(3000)))
      .then(s => {
        setTodos(s.docs.map(d => ({ id: d.id, ...d.data() })));
        setLastSync(Date.now());
      })
      .catch(() => setTodos([]));

    getDocs(collection(db, gc(setor, "categorias")))
      .then(s => setCats(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setCats([]));
  };

  useEffect(() => {
    setLoading(true);
    fetchRealtimeData();
    setLoading(false);
  }, [setor]);

  // Realtime Polling Timer para o modo Viewer
  useEffect(() => {
    if (!autoRefresh || viewTab !== "viewer") return;
    const interval = setInterval(() => {
      fetchRealtimeData();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, viewTab, setor]);

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

  const graficoGeral = dias7.map(d => ({
    label: d.label,
    e: todasEntradas.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade) || 1), 0),
    sMan: saidasManuais.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade || l.total) || 1), 0),
    sReq: saidasReq.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade) || 1), 0),
  }));

  const graficoRotatividade = dias7.map(d => ({
    label: d.label,
    entradas: todasEntradas.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade) || 1), 0),
    saidas: todasSaidas.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade || l.total) || 1), 0),
  }));

  const graficoRequisicoes = dias7.map(d => ({
    label: d.label,
    sReq: saidasReq.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade) || 1), 0),
    sMan: saidasManuais.filter(l => { const t = tsMs(l); return t >= d.ini && t <= d.fim; }).reduce((a, l) => a + (Number(l.quantidade || l.total) || 1), 0),
  }));

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

  // ─── Dados de BI para a tela Viewer ─────────────────────────
  const catDistribution = {};
  products.forEach(p => {
    const c = p.categoria || "Outros";
    catDistribution[c] = (catDistribution[c] || 0) + (Number(p.quantidade) || 0);
  });
  const donutData = Object.entries(catDistribution)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const totalItensEstoque = products.reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0);
  const prodsSeguros = products.filter(p => (Number(p.quantidade) || 0) > 5).length;
  const saudeEstoquePct = products.length > 0 ? Math.round((prodsSeguros / products.length) * 100) : 100;
  const taxaRequisicaoPct = totalS > 0 ? Math.round((totalReq / totalS) * 100) : 0;

  const topBiItems = topAll.map(t => {
    const pProd = products.find(p => p.nome === t.nome);
    return {
      nome: t.nome,
      saidas: t.total,
      estoque: pProd?.quantidade || 0
    };
  });
  const maxBiVal = Math.max(...topBiItems.flatMap(i => [i.saidas, i.estoque]), 1);

  if (loading) return <div className="empty"><span className="spinner" /></div>;

  return (
    <div>
      <div className="page-hd">
        <div>
          <div className="page-title">ANALYTICS</div>
          <div className="page-sub">{sectorObj?.label || sectorObj?.id || setor} · {todos.length} registros totais</div>
        </div>
      </div>

      <SearchA value={search} onChange={setSearch} placeholder="Filtrar produto ou categoria..." />

      {/* Tabs de navegação sem emojis */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          ["geral", "Geral"],
          ["rotatividade", "Rotatividade"],
          ["requisicoes", "Por Requisição"],
          ["viewer", "Viewer"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={`btn ${viewTab === k ? "btn-accent" : "btn-outline"}`}
            style={{
              fontSize: 11,
              padding: "7px 14px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}
            onClick={() => setViewTab(k)}
          >
            {k === "viewer" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />}
            {l}
          </button>
        ))}
      </div>

      {/* Período — nas tabs aplicáveis */}
      {viewTab !== "rotatividade" && (
        <div className="period-tabs">
          {[["dia", "Hoje"], ["semana", "Semana"], ["mes", "Mês"]].map(([k, l]) => (
            <button key={k} className={`ptab ${periodo === k ? "active" : ""}`} onClick={() => setPeriodo(k)}>{l}</button>
          ))}
        </div>
      )}

      {/* ══════════ TAB GERAL ══════════ */}
      {viewTab === "geral" && (
        <>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "var(--display, sans-serif)", fontSize: 22, letterSpacing: "2px", lineHeight: 1, marginBottom: 4 }}>
              <span style={{ color: "var(--text, #fff)" }}>DASHBOARD </span>
              <span style={{ color: "#f97316" }}>GERAL</span>
            </div>
            <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 11, color: "#8b949e" }}>
              Visão geral do seu estoque e movimentações
            </div>
          </div>

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
                <MovChart data={graficoGeral} series={[
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
                      {item.req > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>Req: {item.req}</span>}
                      {item.manual > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)" }}>Manual: {item.manual}</span>}
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
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "var(--display, sans-serif)", fontSize: 22, letterSpacing: "2px", lineHeight: 1, marginBottom: 4 }}>
              <span style={{ color: "var(--text, #fff)" }}>ROTATIVIDADE & </span>
              <span style={{ color: "#2dd4bf" }}>GIRO DE ESTOQUE</span>
            </div>
            <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 11, color: "#8b949e" }}>
              Velocidade de saída, tempo médio para zerar e análise de tendências
            </div>
          </div>

          <RotKpiCards products={products} logs={todos} />

          {!search && (
            <div className="table-card" style={{ marginBottom: 16 }}>
              <div className="table-card-header">
                <div className="table-card-title">FLUXO DE ROTATIVIDADE — 7 DIAS</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#10b981" }}>■ Entradas</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#ef4444" }}>■ Saídas Totais</span>
                </div>
              </div>
              <div style={{ padding: "16px 12px" }}>
                <MovChart data={graficoRotatividade} series={[
                  { key: "entradas", name: "Entradas", color: "#10b981" },
                  { key: "saidas", name: "Saídas Totais", color: "#ef4444" },
                ]} />
              </div>
            </div>
          )}

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
                            {p.reqTotal > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>Req: {p.reqTotal}</span>}
                            {p.manTotal > 0 && <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)" }}>Manual: {p.manTotal}</span>}
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
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontFamily: "var(--display, sans-serif)", fontSize: 22, letterSpacing: "2px", lineHeight: 1, marginBottom: 4 }}>
              <span style={{ color: "var(--text, #fff)" }}>REQUISIÇÕES & </span>
              <span style={{ color: "#f97316" }}>FLUXO DE SAÍDAS</span>
            </div>
            <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 11, color: "#8b949e" }}>
              Comparativo detalhado de saídas por requisição vs saídas manuais
            </div>
          </div>

          <ReqKpiCards logs={todos} />

          {!search && (
            <div className="table-card" style={{ marginBottom: 16 }}>
              <div className="table-card-header">
                <div className="table-card-title">ORIGEM DAS SAÍDAS — 7 DIAS</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>■ Requisições</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#ef4444" }}>■ Saídas Manuais</span>
                </div>
              </div>
              <div style={{ padding: "16px 12px" }}>
                <MovChart data={graficoRequisicoes} series={[
                  { key: "sReq", name: "Requisição", color: "#f97316" },
                  { key: "sMan", name: "Manual", color: "#ef4444" },
                ]} />
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

      {/* ══════════ TAB VIEWER (POWER BI EM TEMPO REAL) ══════════ */}
      {viewTab === "viewer" && (
        <div className="animate-fade-in">
          {/* Header Executivo Viewer */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 12, marginBottom: 20, padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(11,18,32,0.85) 100%)",
            border: "1px solid rgba(16,185,129,0.3)", borderRadius: 14,
            boxShadow: "0 4px 24px rgba(16,185,129,0.06)"
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ fontFamily: "var(--display, sans-serif)", fontSize: 24, letterSpacing: "2px", lineHeight: 1 }}>
                  <span style={{ color: "var(--text, #fff)" }}>VIEWER </span>
                  <span style={{ color: "#10b981" }}>POWER BI</span>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 8px", background: "rgba(16,185,129,0.15)",
                  border: "1px solid #10b981", borderRadius: 20,
                  fontSize: 10, fontFamily: "var(--mono)", color: "#10b981", fontWeight: 700
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                  LIVE REALTIME
                </span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)" }}>
                Atualização em tempo real · Última sincronização: {new Date(lastSync).toLocaleTimeString("pt-BR")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn btn-outline"
                style={{ fontSize: 11, padding: "7px 12px" }}
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh ? "Pausar atualização automática" : "Ativar atualização automática"}
              >
                Auto-Refresh: {autoRefresh ? "LIGADO (15s)" : "PAUSADO"}
              </button>
              <button
                className="btn btn-accent"
                style={{ fontSize: 11, padding: "7px 14px", background: "#10b981", borderColor: "#10b981" }}
                onClick={fetchRealtimeData}
              >
                Sincronizar Agora
              </button>
            </div>
          </div>

          {/* Cards Rápidos de BI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
            <div className="table-card" style={{ padding: "16px 18px", borderLeft: "4px solid #f97316" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Total em Estoque</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 32, fontWeight: 800, color: "#f97316", margin: "4px 0" }}>{totalItensEstoque}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>unidades físicas</div>
            </div>

            <div className="table-card" style={{ padding: "16px 18px", borderLeft: "4px solid #2dd4bf" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Catálogo de SKUs</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 32, fontWeight: 800, color: "#2dd4bf", margin: "4px 0" }}>{products.length}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>produtos cadastrados</div>
            </div>

            <div className="table-card" style={{ padding: "16px 18px", borderLeft: "4px solid #ef4444" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Saídas no Período</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 32, fontWeight: 800, color: "#ef4444", margin: "4px 0" }}>{totalS}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>{periodo.toUpperCase()}</div>
            </div>

            <div className="table-card" style={{ padding: "16px 18px", borderLeft: "4px solid #3b82f6" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase" }}>Total de Entradas</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 32, fontWeight: 800, color: "#3b82f6", margin: "4px 0" }}>{totalE}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-dim)" }}>unidades repostas</div>
            </div>
          </div>

          {/* Grid Principal Power BI: Donut + Gauges */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
            {/* Donut Chart de Categorias */}
            <DonutChart data={donutData} title="COMPOSIÇÃO DE ESTOQUE POR CATEGORIA" />

            {/* Medidores de Performance e Saúde */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <GaugeChart
                value={saudeEstoquePct}
                max={100}
                label="Saúde do Estoque"
                sub={`${prodsSeguros} de ${products.length} SKUs seguros`}
                color="#10b981"
              />
              <GaugeChart
                value={taxaRequisicaoPct}
                max={100}
                label="Adesão a Requisições"
                sub={`${totalReq} un. solicitadas`}
                color="#f97316"
              />
            </div>
          </div>

          {/* Gráfico de Colunas Agrupadas */}
          <div style={{ marginBottom: 20 }}>
            <GroupedBarChart
              title="COMPARATIVO DE FLUXO DIÁRIO — 7 DIAS"
              data={graficoGeral}
              series={[
                { key: "e", name: "Entradas", color: "var(--success)" },
                { key: "sReq", name: "Requisições", color: "#f97316" },
                { key: "sMan", name: "Saída Manual", color: "var(--danger)" },
              ]}
            />
          </div>

          {/* Gráfico de Linhas Bézier com Gradiente Neon */}
          <div className="table-card" style={{ marginBottom: 20 }}>
            <div className="table-card-header">
              <div className="table-card-title">EVOLUÇÃO TEMPORAL CONTÍNUA</div>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--success)" }}>■ Entradas</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#f97316" }}>■ Requisições</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--danger)" }}>■ Saídas Manuais</span>
              </div>
            </div>
            <div style={{ padding: "16px 12px" }}>
              <MovChart data={graficoGeral} series={[
                { key: "e", name: "Entrada", color: "var(--success)" },
                { key: "sReq", name: "Requisição", color: "#f97316" },
                { key: "sMan", name: "Saída Manual", color: "var(--danger)" },
              ]} />
            </div>
          </div>

          {/* Barras Horizontais Comparativas Power BI */}
          <div style={{ marginBottom: 20 }}>
            <BarChartHoriz
              title="RANKING BI: TOP PRODUTOS EM SAÍDA VS. DISPONIBILIDADE ATUAL"
              items={topBiItems}
              maxVal={maxBiVal}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Analytics;