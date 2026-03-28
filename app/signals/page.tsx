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
  trend: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  momentum: 'STRONG' | 'MIXED' | 'WEAK';
  volatility: 'CALM' | 'ELEVATED' | 'HIGH';
  breadth: 'STRONG' | 'MIXED' | 'WEAK';
  reasons: string[];
  action: string;
  spy: QuoteData;
  mes: QuoteData;
  vix: QuoteData;
  news: {
    headline: string;
    summary: string;
    source: string;
    url: string;
    datetime: number;
  }[];
};

const FALLBACK_DATA: SignalPayload = {
  status: 'DEFENSIVE',
  score: 34,
  trend: 'BEARISH',
  momentum: 'WEAK',
  volatility: 'ELEVATED',
  breadth: 'WEAK',
  reasons: [
    'SPY is below the long-term trend line.',
    'Momentum is weak with recent lower highs.',
    'Volatility is elevated, which is bad for leverage.',
    'Broad participation is not strong enough yet.',
  ],
  action:
    'Keep building cash and avoid aggressive MES entries until trend and volatility improve.',
  spy: {
    symbol: 'SPY',
    price: 0,
    change: 0,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
  },
  mes: {
    symbol: 'MES',
    price: 0,
    change: 0,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
  },
  vix: {
    symbol: 'VIX',
    price: 0,
    change: 0,
    changePercent: 0,
    updatedAt: new Date().toISOString(),
  },
  news: [],
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function statusStyles(status: SignalStatus) {
  if (status === 'AGGRESSIVE') {
    return {
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      panel: 'from-emerald-50 to-white',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
    };
  }

  if (status === 'BUILD') {
    return {
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
      panel: 'from-amber-50 to-white',
      dot: 'bg-amber-500',
      text: 'text-amber-700',
    };
  }

  return {
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
    panel: 'from-rose-50 to-white',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
  };
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      {detail ? <p className="mt-2 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}

function MarketCard({ quote }: { quote: QuoteData }) {
  const positive = quote.changePercent >= 0;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{quote.symbol}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {quote.symbol === 'VIX' ? formatNumber(quote.price) : formatCurrency(quote.price)}
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            positive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {formatPercent(quote.changePercent)}
        </div>
      </div>
      <p className={`mt-3 text-sm ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
        {positive ? '+' : ''}
        {formatNumber(quote.change)} today
      </p>
    </div>
  );
}

export default function SignalsPage() {
  const [data, setData] = useState<SignalPayload>(FALLBACK_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSignals() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/signals', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Unable to fetch market signals.');
        }

        const json = (await res.json()) as SignalPayload;

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setData(FALLBACK_DATA);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSignals();
    const id = setInterval(loadSignals, 60_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const styles = useMemo(() => statusStyles(data.status), [data.status]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_28%),linear-gradient(to_bottom,_#f8fafc,_#ffffff,_#eef2ff)] text-slate-900">
      <section className="border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-slate-950">SignalCheck</p>
            <p className="mt-1 text-sm text-slate-500">
              Your market dashboard for SPY, VIX, and MES timing
            </p>
          </div>
          <div
            className={`hidden rounded-full border px-4 py-2 text-sm font-medium md:block ${styles.badge}`}
          >
            {data.status}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
        <div>
          <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm shadow-slate-200/50">
            Real-time signal engine for aggressive vs defensive risk
          </div>

          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 md:text-7xl md:leading-[1.02]">
            Know when to wait, build, or go aggressive.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
            This page is built to stop emotional entries. It checks market trend, momentum,
            volatility, and breadth, then gives you one clean answer.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <MetricCard label="Signal status" value={data.status} detail="Main action state" />
            <MetricCard
              label="Signal score"
              value={`${data.score}/100`}
              detail="Higher score = safer offense"
            />
            <MetricCard label="Refresh" value="60 sec" detail="Auto-refreshing dashboard" />
          </div>

          <div
            className={`mt-8 rounded-[30px] border border-slate-200 bg-gradient-to-br ${styles.panel} p-6 shadow-sm shadow-slate-200/60`}
          >
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${styles.dot}`} />
              <p className={`text-sm font-medium ${styles.text}`}>Current system state</p>
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {data.status}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{data.action}</p>

            <div className="mt-5 h-3 rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-slate-950 transition-all"
                style={{ width: `${data.score}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-500">
              <span>Defensive</span>
              <span>Build</span>
              <span>Aggressive</span>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-950">Signal inputs</h2>
          <p className="mt-2 text-sm text-slate-500">
            These are the four ingredients behind the signal.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <MetricCard label="Trend" value={data.trend} detail="SPY vs long-term direction" />
            <MetricCard
              label="Momentum"
              value={data.momentum}
              detail="Higher highs vs choppy action"
            />
            <MetricCard
              label="Volatility"
              value={data.volatility}
              detail="Lower is better for leverage"
            />
            <MetricCard
              label="Breadth"
              value={data.breadth}
              detail="How broad the move is"
            />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-700">Reason summary</p>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              {data.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>

          {loading ? <p className="mt-4 text-sm text-slate-500">Refreshing live data…</p> : null}
          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 lg:px-8">
        <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                Relevant market news
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Live headlines that can affect your risk posture.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            {data.news?.length ? (
              data.news.map((item) => (
                <a
                  key={`${item.url}-${item.datetime}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-3xl border border-slate-200 p-5 transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {item.source}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(item.datetime * 1000).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                    {item.headline}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
                </a>
              ))
            ) : (
              <p className="text-sm text-slate-500">No live news available right now.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 lg:px-8 lg:pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Live market board
              </h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                {new Date(data.spy.updatedAt).toLocaleString()}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MarketCard quote={data.spy} />
              <MarketCard quote={data.mes} />
              <MarketCard quote={data.vix} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900">What you do now</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{data.action}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900">MES rule reminder</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Only consider 1 MES contract when the signal is AGGRESSIVE, the score is strong,
                  and your cash buffer is ready.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                How to use it
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>• AGGRESSIVE → strongest conditions, consider offense</li>
                <li>• BUILD → keep investing, prepare cash, no rush</li>
                <li>• DEFENSIVE → avoid aggressive MES entries</li>
              </ul>
            </div>

            <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-200/60">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                What to wire next
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>• Real market data API in <code>/api/signals</code></li>
                <li>• Vercel Cron refresh and caching</li>
                <li>• Email alerts when the status changes</li>
                <li>• Trade journal for your MES entries and exits</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-6 text-sm text-slate-500 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} SignalCheck. Informational only, not investment advice.</p>
          <p>Built by Sujith</p>
        </div>
      </footer>
    </main>
  );
}