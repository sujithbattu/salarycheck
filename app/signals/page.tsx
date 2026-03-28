'use client';
import React, { useEffect, useState, useRef } from 'react';

export default function SignalCheckV4() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bankroll, setBankroll] = useState(10000);
  const [journal, setJournal] = useState<any[]>([]);
  const [tape, setTape] = useState<{id: number, side: string, sz: number, pr: string}[]>([]);

  // Simulated Live Tape Effect
  useEffect(() => {
    const interval = setInterval(() => {
      const newTrade = {
        id: Math.random(),
        side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        sz: Math.floor(Math.random() * 10) + 1,
        pr: (data?.market[0]?.price + (Math.random() - 0.5)).toFixed(2)
      };
      setTape(prev => [newTrade, ...prev].slice(0, 8));
    }, 2000);
    return () => clearInterval(interval);
  }, [data]);

  useEffect(() => {
    const fetcher = () => fetch('/api/signals').then(r => r.json()).then(setData).finally(() => setLoading(false));
    fetcher();
    const id = setInterval(fetcher, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading || !data) return (
    <div className="min-h-screen bg-[#020408] flex items-center justify-center font-mono">
      <div className="text-cyan-500 text-sm tracking-[0.5em] animate-pulse">INITIALIZING CORE_SYSTEM_V4</div>
    </div>
  );

  // Position Sizing Logic
  const riskPerTrade = isNaN(bankroll) ? 0 : bankroll * (data.score / 1000); // 10% risk at 100% confidence
  const mesContracts = Math.max(1, Math.floor(riskPerTrade / 50)); 

  return (
    <div className="min-h-screen bg-[#020408] text-slate-300 p-4 lg:p-8 font-sans selection:bg-cyan-500/30">
      
      {/* HEADER PROTOCOL */}
      <header className="max-w-[1600px] mx-auto mb-8 flex justify-between items-end border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white flex items-center gap-2">
            <span className="bg-cyan-600 h-5 w-1 rounded-full"></span>
            SIGNALCHECK <span className="text-cyan-500 text-xs">V4.0_PRO</span>
          </h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">Institutional Grade Sentiment Analysis</p>
        </div>
        <div className="text-right font-mono">
          <p className="text-[10px] text-slate-600 uppercase">Latency: 24ms</p>
          <p className="text-xs text-cyan-400">{new Date().toLocaleTimeString()}</p>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: THE COMMANDER (SIGNAL) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative overflow-hidden bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
            {/* Background Glow */}
            <div className={`absolute -top-24 -left-24 h-64 w-64 blur-[120px] rounded-full opacity-20 ${data.status === 'AGGRESSIVE' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div>
                <span className="text-[10px] font-mono text-cyan-500 uppercase tracking-[0.3em] mb-4 block">Execution bias</span>
                <h2 className={`text-9xl font-black tracking-tighter leading-none mb-6 ${data.status === 'AGGRESSIVE' ? 'text-emerald-400' : data.status === 'DEFENSIVE' ? 'text-rose-500' : 'text-amber-400'}`}>
                  {data.status}
                </h2>
                <p className="text-xl text-slate-400 font-medium max-w-xl">{data.action}</p>
              </div>
              <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 text-center min-w-[180px]">
                <span className="text-[10px] font-mono text-slate-500 uppercase block mb-2">Confidence</span>
                <span className="text-5xl font-black text-white">{data.score}%</span>
              </div>
            </div>

            <div className="mt-12 space-y-2">
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 shadow-[0_0_20px] ${data.status === 'AGGRESSIVE' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-rose-500 shadow-rose-500/50'}`} 
                  style={{ width: `${data.score}%` }} 
                />
              </div>
            </div>
          </div>

          {/* SECOND ROW: RISK CALCULATOR & WHY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/20 border border-white/5 rounded-[2rem] p-8">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Auto-Position Sizer</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase block mb-2">Account Balance (USD)</label>
                  <input 
                    type="number" 
                    value={bankroll} 
                    onChange={e => setBankroll(parseInt(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-cyan-400 font-mono focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Recommended Size</span>
                    <span className="text-xl font-bold text-white font-mono">{mesContracts} MES</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Risk Allocation</span>
                    <span className="text-xl font-bold text-white font-mono">${riskPerTrade.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-cyan-500/[0.03] border border-cyan-500/20 rounded-[2rem] p-8">
              <h3 className="text-xs font-bold text-cyan-500 uppercase tracking-widest mb-6">Alpha Logic</h3>
              <ul className="space-y-4">
                {data.reasons.map((r: string, i: number) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-3 italic">
                    <span className="text-cyan-500 font-bold">»</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* RIGHT: WATCHLIST & NEWS */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/40 border border-white/10 rounded-[2.5rem] p-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Market Watch</h3>
            <div className="space-y-5">
              {data.market.map((s: any) => (
                <div key={s.symbol} className="flex justify-between items-center group cursor-crosshair">
                  <div className="flex items-center gap-3">
                    <div className={`h-1.5 w-1.5 rounded-full ${s.change >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="font-bold text-slate-200">{s.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-white">${s.price.toFixed(2)}</p>
                    <p className={`text-[10px] font-bold ${s.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-8 overflow-hidden relative">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Live Tape Feed</h3>
            <div className="space-y-2 font-mono text-[10px]">
              {tape.map(t => (
                <div key={t.id} className="flex justify-between animate-in fade-in slide-in-from-right-2 duration-500">
                  <span className={t.side === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}>{t.side}</span>
                  <span className="text-slate-400">{t.sz} LOTS</span>
                  <span className="text-slate-500">@{t.pr}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/20 border border-white/5 rounded-[2.5rem] p-8">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Intell-Feed</h3>
            <div className="space-y-5">
              {data.news.map((n: any, i: number) => (
                <a key={i} href={n.url} target="_blank" className="group block">
                  <div className="flex justify-between text-[9px] font-mono text-slate-600 mb-1 uppercase">
                    <span>{n.source}</span>
                    <span>{n.time}</span>
                  </div>
                  <h4 className="text-[11px] font-semibold text-slate-400 group-hover:text-cyan-400 transition-colors line-clamp-2 leading-snug">
                    {n.headline}
                  </h4>
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 text-center text-[10px] font-mono text-slate-700 uppercase tracking-[0.4em]">
        Proprietary System // SignalCheck v4.0.2 // Secure Session
      </footer>
    </div>
  );
}