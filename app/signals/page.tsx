'use client';
import React, { useEffect, useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MarketSymbol {
  symbol: string; label: string; price: number; change: number;
  open: number; high: number; low: number; prevClose: number;
  type: 'index' | 'etf' | 'stock' | 'crypto';
}

interface StockSetup {
  symbol: string; direction: 'LONG' | 'SHORT' | 'FLAT';
  entry: number; stopLoss: number; target1: number; target2: number;
  riskPts: number; rewardPts1: number; rewardPts2: number;
  rr1: number; rr2: number;
  note: string;
}

interface TimeContext {
  sessionName: string; sessionActive: boolean;
  phase: 'pre-market' | 'open' | 'power-hour' | 'after-hours' | 'closed';
  phaseLabel: string; phaseNote: string;
  etTime: string; timeInPhase: string;
  nextPhase: string; tradeabilityScore: number; // 0–100
}

interface SignalData {
  status: 'AGGRESSIVE' | 'STABLE' | 'DEFENSIVE' | 'OFFLINE';
  score: number; action: string; reasons: string[];
  market: MarketSymbol[];
  setups: StockSetup[];        // per-instrument trade plans
  timeContext: TimeContext;
  lastUpdated: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const TV: Record<string, string> = {
  SPY: 'AMEX:SPY', QQQ: 'NASDAQ:QQQ', NVDA: 'NASDAQ:NVDA',
  AAPL: 'NASDAQ:AAPL', TSLA: 'NASDAQ:TSLA',
  BTC: 'BINANCE:BTCUSDT', ETH: 'BINANCE:ETHUSDT',
};

const STATUS_HEX: Record<string, string> = {
  AGGRESSIVE: '#34d399', STABLE: '#fbbf24', DEFENSIVE: '#f87171', OFFLINE: '#475569',
};

const PHASE_COLOR: Record<string, string> = {
  'pre-market':  'text-amber-400',
  'open':        'text-emerald-400',
  'power-hour':  'text-cyan-400',
  'after-hours': 'text-purple-400',
  'closed':      'text-slate-500',
};

const fmtPrice = (n: number, dec = 2) =>
  n > 0 ? n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';

// ─── Sub-components ────────────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: color }} />
    </span>
  );
}

function Gauge({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const r = 36; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ * 0.75;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.05)"
        strokeWidth="6" strokeDasharray={`${circ * 0.75} ${circ}`}
        strokeDashoffset={circ * 0.125} strokeLinecap="round" />
      <circle cx="48" cy="48" r={r} fill="none" stroke={color}
        strokeWidth="6" strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.125} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="48" y="52" textAnchor="middle" fill="white"
        style={{ font: '700 18px monospace' }}>{value}</text>
    </svg>
  );
}

function Sparkline({ data, color, width = 72, height = 28 }: {
  data: number[]; color: string; width?: number; height?: number;
}) {
  if (data.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...data); const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RRBar({ rr, label }: { rr: number; label: string }) {
  const good = rr >= 2; const ok = rr >= 1.5;
  const color = good ? '#34d399' : ok ? '#fbbf24' : '#f87171';
  const pct = Math.min(100, (rr / 4) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-mono text-slate-500 uppercase">{label}</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>1 : {rr.toFixed(1)}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return <span className="font-mono text-xs text-slate-500 tabular-nums">{t.toLocaleTimeString('en-US', { hour12: false })}</span>;
}

// Time-of-day quality bar
function TradeabilityMeter({ score, phase }: { score: number; phase: string }) {
  const segs = 10;
  const filled = Math.round((score / 100) * segs);
  const color = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: segs }, (_, i) => (
          <div key={i} className="h-3 w-3.5 rounded-sm transition-all duration-300"
            style={{ background: i < filled ? color : 'rgba(255,255,255,0.05)' }} />
        ))}
      </div>
      <span className="text-[10px] font-mono" style={{ color }}>{score}%</span>
    </div>
  );
}

// Single stock setup card
function SetupCard({ setup, bankroll }: { setup: StockSetup; bankroll: number }) {
  const [expanded, setExpanded] = useState(false);
  const riskPct = 0.01; // 1% fixed for stock sizing
  const riskUSD = bankroll * riskPct;
  const shares = setup.riskPts > 0 ? Math.max(1, Math.floor(riskUSD / setup.riskPts)) : 0;
  const profitT1 = shares * setup.rewardPts1;
  const profitT2 = shares * setup.rewardPts2;
  const maxLoss  = shares * setup.riskPts;
  const isLong = setup.direction === 'LONG';
  const isFlat = setup.direction === 'FLAT';

  const borderColor = isFlat ? 'border-white/[0.06]'
    : isLong ? 'border-emerald-500/15' : 'border-rose-500/15';
  const bgColor = isFlat ? 'bg-white/[0.01]'
    : isLong ? 'bg-emerald-500/[0.03]' : 'bg-rose-500/[0.03]';
  const dirColor = isLong ? 'text-emerald-400' : isFlat ? 'text-slate-500' : 'text-rose-400';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all duration-200 ${borderColor} ${bgColor}`}>
      <button
        onClick={() => !isFlat && setExpanded(e => !e)}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white tracking-tight">{setup.symbol}</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                isFlat ? 'bg-white/5 text-slate-500'
                  : isLong ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}>{setup.direction}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{setup.note}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!isFlat && (
            <div className="text-right hidden sm:block">
              <p className="text-[9px] font-mono text-slate-500">Entry</p>
              <p className="text-xs font-bold font-mono text-white">${fmtPrice(setup.entry)}</p>
            </div>
          )}
          {!isFlat && (
            <div className="text-[10px] font-mono text-slate-600">{expanded ? '▲' : '▼'}</div>
          )}
        </div>
      </button>

      {expanded && !isFlat && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04]">
          {/* Price ladder */}
          <div className="pt-3 space-y-0">
            {[
              { l: 'Target 2', v: setup.target2, c: '#34d399', bar: 100 },
              { l: 'Target 1', v: setup.target1, c: '#6ee7b7', bar: 65  },
              { l: '── Entry ──', v: setup.entry, c: '#67e8f9', bar: null },
              { l: 'Stop Loss', v: setup.stopLoss, c: '#f87171', bar: null },
            ].map(row => (
              <div key={row.l} className={`flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0 ${
                row.l.includes('Entry') ? 'bg-white/[0.02] rounded-lg px-2 -mx-2' : ''
              }`}>
                <div className="flex items-center gap-2">
                  {row.bar !== null && (
                    <div className="w-8 h-0.5 rounded-full" style={{ background: row.c, opacity: row.bar / 100 }} />
                  )}
                  <span className="text-[10px] font-mono text-slate-500">{row.l}</span>
                </div>
                <span className="text-sm font-bold font-mono" style={{ color: row.c }}>${fmtPrice(row.v)}</span>
              </div>
            ))}
          </div>

          {/* R:R */}
          <div className="space-y-2">
            <RRBar rr={setup.rr1} label="T1 R:R" />
            <RRBar rr={setup.rr2} label="T2 R:R" />
          </div>

          {/* P&L for user's bankroll */}
          <div className="bg-black/30 rounded-xl p-3">
            <p className="text-[9px] font-mono text-slate-500 uppercase mb-2">
              {shares} shares @ 1% risk (${bankroll > 0 ? bankroll.toLocaleString() : '—'} account)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: 'Max Loss', v: -maxLoss,  c: '#f87171' },
                { l: 'Profit T1', v: profitT1, c: '#34d399' },
                { l: 'Profit T2', v: profitT2, c: '#86efac' },
              ].map(r => (
                <div key={r.l} className="text-center">
                  <p className="text-[8px] font-mono text-slate-600 mb-0.5">{r.l}</p>
                  <p className="text-xs font-bold font-mono" style={{ color: r.c }}>
                    {r.v >= 0 ? '+' : ''}${Math.abs(r.v).toFixed(0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function SignalCheckV7() {
  const [data, setData]         = useState<SignalData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [bankroll, setBankroll] = useState('25000');
  const [activeChart, setActiveChart] = useState('SPY');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing]   = useState(false);
  const [history, setHistory]   = useState<Record<string, number[]>>({});

  const sync = useCallback(async () => {
    setSyncing(true); setError(null);
    try {
      const res = await fetch('/api/signals', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SignalData = await res.json();
      if (json.status === 'OFFLINE') throw new Error('Feed offline');
      setData(json); setLastSync(new Date());
      setHistory(prev => {
        const next = { ...prev };
        json.market.forEach(s => {
          const arr = prev[s.symbol] ?? [];
          next[s.symbol] = [...arr, s.price].slice(-30);
        });
        return next;
      });
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally { setLoading(false); setSyncing(false); }
  }, []);

  useEffect(() => {
    sync();
    const id = setInterval(sync, 10_000);
    return () => clearInterval(id);
  }, [sync]);

  const br = parseFloat(bankroll.replace(/,/g, '')) || 0;

  if (loading) return (
    <div className="min-h-screen bg-[#080b10] flex flex-col items-center justify-center gap-4">
      <div className="flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="h-0.5 w-6 bg-emerald-500/40 rounded-full animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
      <p className="text-emerald-500/50 font-mono text-[10px] tracking-[0.5em] uppercase">Connecting…</p>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#080b10] flex flex-col items-center justify-center gap-3">
      <p className="text-rose-500 font-mono text-xs uppercase">{error}</p>
      <button onClick={sync} className="text-xs font-mono px-4 py-2 border border-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors">
        Retry
      </button>
    </div>
  );

  const sc = STATUS_HEX[data.status];
  const tc = data.timeContext;
  const phaseColor = PHASE_COLOR[tc?.phase] ?? 'text-slate-400';

  return (
    <div className="min-h-screen bg-[#080b10] text-slate-300"
      style={{ fontFamily: '"DM Mono", "Fira Code", "Cascadia Code", monospace' }}>

      {/* ══ TOPBAR ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 border-b border-white/[0.05]"
        style={{ background: 'rgba(8,11,16,0.96)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[1720px] mx-auto px-5 h-12 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-0.5 rounded-full" style={{ background: sc }} />
              <span className="text-white font-bold text-sm tracking-widest uppercase">Signal</span>
              <span className="text-[10px] text-slate-600 border border-white/[0.07] px-1.5 py-0.5 rounded">7.0</span>
            </div>
          </div>

          {/* Time context pill — the most important piece of info */}
          {tc && (
            <div className="hidden md:flex items-center gap-3 px-4 py-1.5 border border-white/[0.06] rounded-full"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <PulseDot color={tc.sessionActive ? '#34d399' : '#475569'} />
              <span className={`text-[10px] font-mono font-bold uppercase ${phaseColor}`}>{tc.phaseLabel}</span>
              <span className="text-[10px] text-slate-600">·</span>
              <span className="text-[10px] text-slate-500">{tc.phaseNote}</span>
              {tc.timeInPhase && (
                <>
                  <span className="text-[10px] text-slate-600">·</span>
                  <span className="text-[10px] text-slate-600">{tc.timeInPhase}</span>
                </>
              )}
            </div>
          )}

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <LiveClock />
            <PulseDot color={syncing ? '#fbbf24' : lastSync ? sc : '#475569'} />
            <button onClick={sync} disabled={syncing}
              className="text-[10px] text-slate-600 hover:text-slate-300 border border-white/[0.06] rounded-lg px-2.5 py-1 transition-colors disabled:opacity-30">
              ↻
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1720px] mx-auto px-4 lg:px-6 py-5">

        {/* ══ TOP ROW: Bias + Score + Time + Quick Stats ══════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-5">

          {/* Bias — big card */}
          <div className="col-span-2 lg:col-span-2 xl:col-span-2 relative overflow-hidden border border-white/[0.06] rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full blur-[80px] opacity-10 pointer-events-none"
              style={{ background: sc }} />
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.3em] mb-1">Execution Bias</p>
            <h2 className="text-4xl font-black tracking-tighter leading-none mb-2" style={{ color: sc }}>
              {data.status}
            </h2>
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{data.action}</p>
          </div>

          {/* Gauge */}
          <div className="flex flex-col items-center justify-center border border-white/[0.06] rounded-2xl py-3"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1">Confidence</p>
            <Gauge value={data.score} color={sc} />
          </div>

          {/* Tradeability */}
          <div className="border border-white/[0.06] rounded-2xl p-4 space-y-2 flex flex-col justify-center"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Time Quality</p>
            <TradeabilityMeter score={tc?.tradeabilityScore ?? 0} phase={tc?.phase ?? 'closed'} />
            <p className={`text-[10px] font-mono font-bold ${phaseColor}`}>{tc?.phaseLabel}</p>
            <p className="text-[9px] text-slate-600 leading-relaxed">{tc?.phaseNote}</p>
            {tc?.nextPhase && <p className="text-[9px] text-slate-700">Next: {tc.nextPhase}</p>}
          </div>

          {/* Account input */}
          <div className="border border-white/[0.06] rounded-2xl p-4 flex flex-col justify-center space-y-2"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Account Size</p>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" min={0} value={bankroll} onChange={e => setBankroll(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.07] text-white text-sm rounded-lg pl-6 pr-2 py-2 focus:outline-none focus:border-emerald-500/30 transition-colors font-mono" />
            </div>
            <p className="text-[9px] text-slate-700">
              1% risk = ${br > 0 ? (br * 0.01).toFixed(0) : '—'} / trade
            </p>
          </div>
        </div>

        {/* ══ MAIN GRID ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

          {/* ── LEFT: Chart + Setups ───────────────────────────────────────── */}
          <div className="xl:col-span-8 space-y-5">

            {/* Chart */}
            <div className="border border-white/[0.06] rounded-2xl overflow-hidden" style={{ background: '#000' }}>
              {/* Symbol tabs */}
              <div className="flex border-b border-white/[0.04] overflow-x-auto px-3 pt-2.5 gap-0.5">
                {Object.keys(TV).map(sym => {
                  const md = data.market.find(m => m.symbol === sym);
                  const up = (md?.change ?? 0) >= 0;
                  return (
                    <button key={sym} onClick={() => setActiveChart(sym)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg whitespace-nowrap text-[11px] font-mono transition-all ${
                        activeChart === sym
                          ? 'text-white border-b-2'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                      style={{ borderBottomColor: activeChart === sym ? sc : 'transparent' }}>
                      <span className="font-bold">{sym}</span>
                      {md && md.price > 0 && (
                        <span className={up ? 'text-emerald-500' : 'text-rose-500'}>
                          {up ? '+' : ''}{md.change.toFixed(2)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="h-[400px]">
                <iframe key={activeChart}
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_${activeChart}&symbol=${TV[activeChart]}&interval=5&hidesidetoolbar=0&hidetoptoolbar=0&symboledit=0&saveimage=0&toolbarbg=0a0e14&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&locale=en`}
                  className="w-full h-full border-none" title={`${activeChart} chart`} />
              </div>
            </div>

            {/* Trade Setups */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Trade Setups <span className="text-slate-700">({data.setups?.length ?? 0})</span>
                </p>
                {tc && !tc.sessionActive && (
                  <span className="text-[9px] font-mono text-amber-500/60 bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded-lg">
                    ⚠ Market closed — plan for tomorrow
                  </span>
                )}
              </div>

              {data.setups && data.setups.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.setups.map((s, i) => (
                    <SetupCard key={`${s.symbol}-${i}`} setup={s} bankroll={br} />
                  ))}
                </div>
              ) : (
                <div className="border border-white/[0.05] rounded-2xl p-5 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">⚖</div>
                  <p className="text-[11px] text-slate-500">No high-confidence setups at this time. Wait for clear price action signals.</p>
                </div>
              )}
            </div>

            {/* Signal Reasoning */}
            <div className="border border-cyan-500/[0.08] rounded-2xl p-5"
              style={{ background: 'rgba(6,182,212,0.02)' }}>
              <p className="text-[10px] font-mono text-cyan-600 uppercase tracking-widest mb-3">Signal Reasoning</p>
              <ul className="space-y-2">
                {data.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[11px] text-slate-400 leading-relaxed">
                    <span className="text-cyan-800 shrink-0 mt-0.5">›</span>{r}
                  </li>
                ))}
              </ul>
              {data.lastUpdated && (
                <p className="text-[9px] font-mono text-slate-700 mt-3 pt-3 border-t border-white/[0.03]">
                  Snapshot {data.lastUpdated}
                </p>
              )}
            </div>
          </div>

          {/* ── RIGHT: Market Watch + Session ─────────────────────────────── */}
          <div className="xl:col-span-4 space-y-5">

            {/* Market Watch — grouped */}
            <div className="border border-white/[0.06] rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Market Watch</p>

              {['index', 'etf', 'stock', 'crypto'].map(type => {
                const group = data.market.filter(m => m.type === type);
                if (!group.length) return null;
                const typeLabel: Record<string, string> = {
                  index: 'Indices', etf: 'ETFs', stock: 'Stocks', crypto: 'Crypto'
                };
                return (
                  <div key={type} className="mb-4 last:mb-0">
                    <p className="text-[8px] font-mono text-slate-700 uppercase tracking-widest mb-1.5">{typeLabel[type]}</p>
                    <div className="space-y-0.5">
                      {group.map(s => {
                        const up = s.change >= 0;
                        const isActive = activeChart === s.symbol;
                        const hist = history[s.symbol] ?? [];
                        return (
                          <button key={s.symbol}
                            onClick={() => TV[s.symbol] && setActiveChart(s.symbol)}
                            disabled={!TV[s.symbol]}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left ${
                              isActive
                                ? 'border border-white/[0.08]'
                                : 'hover:bg-white/[0.02] border border-transparent'
                            } ${!TV[s.symbol] ? 'cursor-default' : 'cursor-pointer'}`}
                            style={{ background: isActive ? 'rgba(255,255,255,0.03)' : '' }}>
                            <div className="flex items-center gap-2 min-w-0">
                              {isActive && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: sc }} />}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-white">{s.symbol}</span>
                                  <span className={`text-[9px] font-mono ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {up ? '+' : ''}{s.change.toFixed(2)}%
                                  </span>
                                </div>
                                {s.high > 0 && s.low > 0 && (
                                  <p className="text-[8px] text-slate-700 font-mono">
                                    {fmtPrice(s.low)} – {fmtPrice(s.high)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {hist.length > 4 && (
                                <Sparkline data={hist} color={up ? '#34d399' : '#f87171'} />
                              )}
                              <div className="text-right">
                                <p className="text-xs font-bold font-mono text-white">${fmtPrice(s.price)}</p>
                                {s.prevClose > 0 && (
                                  <p className="text-[8px] font-mono text-slate-700">
                                    pc {fmtPrice(s.prevClose)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <p className="text-[8px] font-mono text-slate-700 text-center mt-3">
                Tap to load chart · updates every 10s
              </p>
            </div>

            {/* Session Timeline */}
            <div className="border border-white/[0.05] rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.01)' }}>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Trading Hours (ET)</p>

              {[
                { phase: 'pre-market',  label: 'Pre-Market',  hours: '4:00 – 9:30 AM',  note: 'Thin volume, wide spreads. News/earnings reaction.' },
                { phase: 'open',        label: 'NY Open',      hours: '9:30 – 10:30 AM', note: 'Highest volatility. Institutional orders hit.' },
                { phase: 'open',        label: 'Mid-Day',      hours: '10:30 – 3:00 PM', note: 'Lower volume. Trend follow or avoid.' },
                { phase: 'power-hour',  label: 'Power Hour',   hours: '3:00 – 4:00 PM',  note: 'Volume surge. Day-trade exits, rebalancing.' },
                { phase: 'after-hours', label: 'After-Hours',  hours: '4:00 – 8:00 PM',  note: 'Earnings plays. Low liquidity.' },
              ].map(row => {
                const isCurrent = tc?.phase === row.phase;
                const rowColor = PHASE_COLOR[row.phase];
                return (
                  <div key={row.label}
                    className={`flex gap-3 py-2.5 border-b border-white/[0.03] last:border-0 transition-opacity ${
                      isCurrent ? 'opacity-100' : 'opacity-35'
                    }`}>
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <div className={`h-2 w-2 rounded-full ${isCurrent ? 'ring-2 ring-offset-1 ring-offset-[#080b10]' : ''}`}
                        style={{
                          background: isCurrent ? (PHASE_COLOR[row.phase].replace('text-', '').includes('emerald') ? '#34d399'
                            : row.phase === 'power-hour' ? '#22d3ee'
                            : row.phase === 'pre-market' ? '#fbbf24'
                            : row.phase === 'after-hours' ? '#a78bfa'
                            : '#475569') : '#1e293b',
                          ringColor: 'transparent'
                        }}
                      />
                      {row.label !== 'After-Hours' && (
                        <div className="w-px h-6 bg-white/[0.05]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-bold font-mono ${isCurrent ? rowColor : 'text-slate-500'}`}>
                          {row.label}
                        </span>
                        <span className="text-[9px] font-mono text-slate-700">{row.hours}</span>
                      </div>
                      <p className="text-[9px] text-slate-600 leading-relaxed">{row.note}</p>
                      {isCurrent && tc?.timeInPhase && (
                        <p className={`text-[9px] font-mono mt-0.5 ${rowColor}`}>● {tc.timeInPhase}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Disclaimer */}
            <p className="text-[9px] text-slate-700 font-mono leading-relaxed px-1">
              For educational purposes only. Not financial advice. Always use hard stop-losses. Past signals do not guarantee future performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}