'use client';

import React, { useEffect, useMemo, useState } from 'react';

type SignalStatus = 'AGGRESSIVE' | 'BUILD' | 'DEFENSIVE';

type QuoteData = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
};

type SignalPayload = {
  status: SignalStatus;
  score: number;
  trend: string;
  momentum: string;
  volatility: string;
  breadth: string;
  reasons: string[];
  action: string;
  spy: QuoteData;
  mes: QuoteData;
  vix: QuoteData;
  news: any[];
};

const FALLBACK_DATA: SignalPayload = {
  status: 'DEFENSIVE',
  score: 0,
  trend: 'NEUTRAL',
  momentum: 'MIXED',
  volatility: 'ELEVATED',
  breadth: 'MIXED',
  reasons: ['Connecting to market data...'],
  action: 'Initializing...',
  spy: { symbol: 'SPY', price: 0, change: 0, changePercent: 0, updatedAt: new Date().toISOString() },
  mes: { symbol: 'MES', price: 0, change: 0, changePercent: 0, updatedAt: new Date().toISOString() },
  vix: { symbol: 'VIX', price: 0, change: 0, changePercent: 0, updatedAt: new Date().toISOString() },
  news: [],
};

// --- PATCHED UTILITIES ---
function formatCurrency(v: number) { 
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0); 
}

function formatPercent(v: number) { 
  if (v === undefined || v === null) return '0.00%';
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`; 
}

function statusStyles(status: SignalStatus) {
  const map = {
    AGGRESSIVE: { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', panel: 'from-emerald-50 to-white', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    BUILD: { badge: 'bg-amber-100 text-amber-700 border-amber-200', panel: 'from-amber-50 to-white', dot: 'bg-amber-500', text: 'text-amber-700' },
    DEFENSIVE: { badge: 'bg-rose-100 text-rose-700 border-rose-200', panel: 'from-rose-50 to-white', dot: 'bg-rose-500', text: 'text-rose-700' },
  };
  return map[status] || map.DEFENSIVE;
}

function MetricCard({ label, value, detail, loading }: any) {
  return (
    <div className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${loading ? 'animate-pulse' : ''}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{loading ? '---' : value}</p>
      {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

function MarketCard({ quote }: { quote: QuoteData }) {
  const isPos = (quote?.changePercent || 0) >= 0;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400">{quote?.symbol || '???'}</p>
          <p className="mt-1 text-xl font-semibold">
            {quote?.symbol === 'VIX' ? (quote?.price || 0).toFixed(2) : formatCurrency(quote?.price || 0)}
          </p>
        </div>
        <div className={`rounded-full px-2 py-1 text-xs font-bold ${isPos ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {formatPercent(quote?.changePercent)}
        </div>
      </div>
    </div>
  );
}

export default function SignalsPage() {
  const [data, setData] = useState<SignalPayload>(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/signals');
      const json = await res.json();
      if (!json.error) {
        setData(json);
      }
    } catch (e) { 
      console.error("Fetch Error:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60000);
    return () => clearInterval(id);
  }, []);

  const styles = useMemo(() => statusStyles(data.status), [data.status]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4 flex justify-between items-center">
          <span className="text-xl font-bold tracking-tighter text-slate-950">SIGNALCHECK</span>
          <div className={`rounded-full border px-4 py-1 text-xs font-bold uppercase tracking-widest ${styles.badge}`}>
            {data.status}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 pt-12">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight text-slate-950 leading-tight">
              Market Risk: <br/><span className={styles.text}>{data.status}</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 max-w-md">
              Automated scoring based on SPY trend and VIX volatility. Use this to remove emotion from your MES trades.
            </p>

            <div className={`mt-10 rounded-[40px] border border-slate-200 bg-gradient-to-br ${styles.panel} p-8 shadow-xl`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`h-2 w-2 rounded-full ${styles.dot} ${data.status !== 'DEFENSIVE' ? 'animate-ping' : ''}`} />
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Live Strategy</span>
              </div>
              <h2 className="text-4xl font-bold text-slate-900">{data.score}% Confidence</h2>
              <p className="mt-4 text-slate-700 leading-relaxed font-medium">{data.action}</p>
              
              <div className="mt-8 h-4 w-full rounded-full bg-slate-200/50 overflow-hidden">
                <div className="h-full bg-slate-950 transition-all duration-1000" style={{ width: `${data.score}%` }} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <MetricCard label="Trend" value={data.trend} loading={loading} />
              <MetricCard label="Volatility" value={data.volatility} loading={loading} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-lg font-bold mb-6">Market Watch</h3>
              <div className="grid gap-4">
                <MarketCard quote={data.spy} />
                <MarketCard quote={data.vix} />
                <MarketCard quote={data.mes} />
              </div>
              
              <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">Why this signal?</p>
                <ul className="space-y-2">
                  {data.reasons.map((r, i) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span>•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <section className="mt-16">
          <h3 className="text-2xl font-bold mb-8">Macro Context</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.news && data.news.length > 0 ? data.news.map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noreferrer" className="group rounded-3xl border border-slate-200 bg-white p-6 hover:border-slate-400 transition-all">
                <span className="text-[10px] font-bold uppercase text-slate-400">{item.source}</span>
                <h4 className="mt-2 font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">{item.headline}</h4>
                <p className="mt-3 text-sm text-slate-500 line-clamp-3">{item.summary}</p>
              </a>
            )) : <p className="text-slate-400">No recent news found.</p>}
          </div>
        </section>
      </div>

      <footer className="mt-20 border-t border-slate-200 py-10 text-center text-slate-400 text-xs">
        <p>© {new Date().getFullYear()} SIGNALCHECK • BY SUJITH</p>
      </footer>
    </main>
  );
}