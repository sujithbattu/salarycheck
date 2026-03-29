import { NextResponse } from 'next/server';

// ── Cache ────────────────────────────────────────────────────────────────────
let cache: { quotes: any[]; ts: number } | null = null;
const CACHE_TTL = 25_000;

// ── Symbol config ─────────────────────────────────────────────────────────────
// Indexes, ETFs, Stocks, Crypto — with type labels
const INSTRUMENTS = [
  // Broad market (indexes / ETFs)
  { sym: 'SPY',             display: 'SPY',  label: 'S&P 500 ETF',       type: 'etf'   },
  { sym: 'QQQ',             display: 'QQQ',  label: 'Nasdaq 100 ETF',     type: 'etf'   },
  // Individual stocks
  { sym: 'NVDA',            display: 'NVDA', label: 'NVIDIA Corp',        type: 'stock' },
  { sym: 'AAPL',            display: 'AAPL', label: 'Apple Inc',          type: 'stock' },
  { sym: 'TSLA',            display: 'TSLA', label: 'Tesla Inc',          type: 'stock' },
  // Crypto
  { sym: 'BINANCE:BTCUSDT', display: 'BTC',  label: 'Bitcoin',            type: 'crypto' },
  { sym: 'BINANCE:ETHUSDT', display: 'ETH',  label: 'Ethereum',           type: 'crypto' },
] as const;

interface Quote {
  c: number; d: number; dp: number; h: number; l: number; o: number; pc: number;
}

// ── Time context ──────────────────────────────────────────────────────────────
function getTimeContext() {
  const now = new Date();
  // Convert to US Eastern Time (approximate: UTC-4 EDT / UTC-5 EST)
  // We use getTimezoneOffset to do it cleanly
  const utcMs  = now.getTime() + now.getTimezoneOffset() * 60000;
  // EST = UTC-5, EDT = UTC-4. Approximate by checking if current date is in summer.
  const month = now.getUTCMonth(); // 0-indexed
  const isDST = month >= 2 && month <= 10; // March–November approx
  const etOffset = isDST ? -4 : -5;
  const etMs = utcMs + etOffset * 3600000;
  const et = new Date(etMs);
  const h = et.getHours() + et.getMinutes() / 60;
  const etTime = et.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Phase detection
  type Phase = 'pre-market' | 'open' | 'power-hour' | 'after-hours' | 'closed';
  let phase: Phase = 'closed';
  let phaseLabel = 'Market Closed';
  let phaseNote  = 'US equities closed. Review positions and plan for tomorrow.';
  let sessionActive = false;
  let tradeabilityScore = 10;

  if (h >= 4 && h < 9.5) {
    phase = 'pre-market'; phaseLabel = 'Pre-Market';
    phaseNote = 'Thin volume and wide spreads. Only trade earnings/news catalysts.';
    tradeabilityScore = 35; sessionActive = true;
  } else if (h >= 9.5 && h < 10.5) {
    phase = 'open'; phaseLabel = 'Opening Bell';
    phaseNote = 'First hour: highest institutional flow and volatility. Best setups here.';
    tradeabilityScore = 95; sessionActive = true;
  } else if (h >= 10.5 && h < 15) {
    phase = 'open'; phaseLabel = 'Mid-Day';
    phaseNote = 'Lower volume. Trend-following works; avoid scalping in choppy conditions.';
    tradeabilityScore = 60; sessionActive = true;
  } else if (h >= 15 && h < 16) {
    phase = 'power-hour'; phaseLabel = 'Power Hour';
    phaseNote = 'Volume surges into close. Strong trend continuation and reversals.';
    tradeabilityScore = 85; sessionActive = true;
  } else if (h >= 16 && h < 20) {
    phase = 'after-hours'; phaseLabel = 'After-Hours';
    phaseNote = 'Earnings reactions and news plays. Low liquidity — wider stops required.';
    tradeabilityScore = 25; sessionActive = true;
  } else {
    tradeabilityScore = 5;
  }

  // Time in current phase
  const phaseStarts: Record<Phase | 'closed', number> = {
    'pre-market': 4, 'open': 9.5, 'power-hour': 15, 'after-hours': 16, 'closed': 20,
  };
  const pStart = phaseStarts[phase];
  const elapsed = Math.max(0, h - pStart);
  const eHours = Math.floor(elapsed);
  const eMins  = Math.floor((elapsed - eHours) * 60);
  const timeInPhase = pStart >= 0 && sessionActive
    ? (eHours > 0 ? `${eHours}h ${eMins}m in` : `${eMins}m in`)
    : '';

  // Next phase
  const phases = [
    { phase: 'Pre-Market', start: 4 },
    { phase: 'NY Open',    start: 9.5 },
    { phase: 'Power Hour', start: 15 },
    { phase: 'After-Hours',start: 16 },
  ];
  const next = phases.find(p => p.start > h);
  const nextPhase = next
    ? `${next.phase} in ${Math.floor(next.start - h)}h ${Math.floor(((next.start - h) % 1) * 60)}m`
    : '';

  return {
    sessionName: phaseLabel, sessionActive, phase, phaseLabel, phaseNote,
    etTime, timeInPhase, nextPhase, tradeabilityScore,
  };
}

// ── Build per-instrument trade plan ──────────────────────────────────────────
function buildSetup(
  sym: string,
  q: Quote | null,
  marketBias: 'AGGRESSIVE' | 'STABLE' | 'DEFENSIVE'
) {
  if (!q || q.c <= 0 || marketBias === 'DEFENSIVE') {
    return {
      symbol: sym, direction: 'FLAT' as const,
      entry: 0, stopLoss: 0, target1: 0, target2: 0,
      riskPts: 0, rewardPts1: 0, rewardPts2: 0, rr1: 0, rr2: 0,
      note: marketBias === 'DEFENSIVE' ? 'No trade — risk-off signal' : 'Insufficient data',
    };
  }

  const price = q.c;
  // ATR proxy: use intraday range if available, else 0.5% of price
  const range = (q.h > 0 && q.l > 0) ? (q.h - q.l) : price * 0.005;
  const atr   = Math.max(range * 1.3, price * 0.003);

  // Direction: follow change — but crypto can diverge from equities
  const direction = q.dp >= 0 ? 'LONG' as const : 'SHORT' as const;
  const sign = direction === 'LONG' ? 1 : -1;

  // Entry: just beyond current price in the direction (assumes confirmation trigger)
  const entry    = parseFloat((price + sign * atr * 0.05).toFixed(2));
  const stopLoss = parseFloat((entry - sign * atr * 0.5).toFixed(2));
  const target1  = parseFloat((entry + sign * atr * 1.0).toFixed(2));
  const target2  = parseFloat((entry + sign * atr * 2.0).toFixed(2));

  const riskPts    = Math.abs(entry - stopLoss);
  const rewardPts1 = Math.abs(target1 - entry);
  const rewardPts2 = Math.abs(target2 - entry);
  const rr1 = parseFloat((rewardPts1 / riskPts).toFixed(2));
  const rr2 = parseFloat((rewardPts2 / riskPts).toFixed(2));

  // Short note
  const changeStr = `${q.dp >= 0 ? '+' : ''}${q.dp.toFixed(2)}%`;
  const note = direction === 'LONG'
    ? `Bullish ${changeStr} — buy pullback to VWAP / ${fmtP(entry)}`
    : `Bearish ${changeStr} — short bounce to ${fmtP(entry)}`;

  return {
    symbol: sym, direction, entry, stopLoss, target1, target2,
    riskPts: parseFloat(riskPts.toFixed(3)),
    rewardPts1: parseFloat(rewardPts1.toFixed(3)),
    rewardPts2: parseFloat(rewardPts2.toFixed(3)),
    rr1, rr2, note,
  };
}

const fmtP = (n: number) => n.toFixed(2);

// ── Route ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ status: 'OFFLINE', score: 0, action: 'API key missing.',
      reasons: [], market: [], setups: [], lastUpdated: '', timeContext: {} }, { status: 500 });
  }

  let quotes: (Quote | null)[] = new Array(INSTRUMENTS.length).fill(null);

  try {
    const results = await Promise.allSettled(
      INSTRUMENTS.map(({ sym }) =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        }).then(r => r.ok ? r.json() as Promise<Quote> : null)
      )
    );
    quotes = results.map(r => r.status === 'fulfilled' ? r.value : null);
  } catch { /* fall through to cache */ }

  // Integrity: SPY price must be sane
  const spyPrice = quotes[0]?.c ?? 0;
  const isValid  = spyPrice > 100;

  if (isValid) {
    cache = { quotes: quotes.map(q => q ?? null), ts: Date.now() };
  } else if (cache && Date.now() - cache.ts < CACHE_TTL) {
    quotes = quotes.map((q, i) => (q && q.c > 0 ? q : cache!.quotes[i]));
  }

  // Build market array
  const market = INSTRUMENTS.map(({ display, label, type }, i) => {
    const q = quotes[i];
    return {
      symbol: display, label, type,
      price:     q?.c  ?? 0,
      change:    q?.dp ?? 0,
      open:      q?.o  ?? 0,
      high:      q?.h  ?? 0,
      low:       q?.l  ?? 0,
      prevClose: q?.pc ?? 0,
    };
  });

  const [spy, qqq, nvda, aapl, tsla, btc, eth] = market;

  // ── Signal logic ──────────────────────────────────────────────────────────
  const spyRange = spy.open > 0 ? ((spy.high - spy.low) / spy.open) * 100 : 0;
  let status: 'AGGRESSIVE' | 'STABLE' | 'DEFENSIVE' = 'STABLE';
  let score = 50;
  const reasons: string[] = [];

  // Market-wide risk checks
  if (!isValid) {
    status = 'DEFENSIVE'; score = 5;
    reasons.push('Price feed returned invalid data. Cannot verify market levels — standing down.');
  } else if (spy.change < -1.8) {
    status = 'DEFENSIVE'; score = 12;
    reasons.push(`SPY is down ${spy.change.toFixed(2)}% — significant broad market sell-off in progress.`);
    reasons.push('Risk-off conditions: avoid new longs. Wait for stabilization.');
  } else if (spy.change < -1.0 && qqq.change < -1.0) {
    status = 'DEFENSIVE'; score = 22;
    reasons.push(`Both SPY (${spy.change.toFixed(2)}%) and QQQ (${qqq.change.toFixed(2)}%) declining — institutional distribution.`);
    reasons.push('Reduce exposure. Do not buy dips until market stabilizes.');
  } else if (spyRange > 1.8) {
    status = 'STABLE'; score = 35;
    reasons.push(`High intraday SPY range (${spyRange.toFixed(1)}%) — whipsaw conditions. Size down.`);
    reasons.push('Wait for hourly range to compress or a clear level break with volume.');
  } else {
    // Build positive score
    if (spy.change > 0.8 && qqq.change > 0.8) {
      status = 'AGGRESSIVE'; score = 70;
      reasons.push(`Strong broad bid: SPY +${spy.change.toFixed(2)}% and QQQ +${qqq.change.toFixed(2)}% both trending up.`);
    } else if (spy.change > 0.3) {
      score = 58;
      reasons.push(`SPY up ${spy.change.toFixed(2)}% — mild positive bias. Selectivity required.`);
    } else if (spy.change < -0.3) {
      score = 42;
      reasons.push(`SPY down ${spy.change.toFixed(2)}% — slight headwind for long positions.`);
    } else {
      score = 50;
      reasons.push(`SPY near flat (${spy.change.toFixed(2)}%) — neutral market. No directional edge.`);
    }

    // Individual movers
    const moverNotes: string[] = [];
    if (nvda.change > 2.5)  moverNotes.push(`NVDA +${nvda.change.toFixed(2)}% (AI/semis leading)`);
    if (aapl.change > 1.5)  moverNotes.push(`AAPL +${aapl.change.toFixed(2)}% (mega-cap strength)`);
    if (tsla.change > 3)    moverNotes.push(`TSLA +${tsla.change.toFixed(2)}% (momentum in EVs)`);
    if (nvda.change < -2.5) moverNotes.push(`NVDA ${nvda.change.toFixed(2)}% (tech sector weakness)`);
    if (aapl.change < -2)   moverNotes.push(`AAPL ${aapl.change.toFixed(2)}% (mega-cap selling)`);
    if (moverNotes.length)  reasons.push(`Notable movers: ${moverNotes.join(', ')}.`);

    // Score adjustments
    if (nvda.change > 2)  score += 8;
    if (nvda.change < -2) score -= 8;
    if (aapl.change > 1)  score += 4;
    if (btc.change > 3)   { score += 4; reasons.push(`BTC +${btc.change.toFixed(2)}% — risk appetite elevated across assets.`); }
    if (btc.change < -4)  { score -= 6; reasons.push(`BTC ${btc.change.toFixed(2)}% — crypto risk-off may spill into equities.`); }

    // Divergence
    if (spy.change > 0.5 && qqq.change < 0) {
      score -= 5;
      reasons.push('SPY/QQQ divergence: rotation from tech into value. Be sector-selective.');
    }

    if (score >= 65) status = 'AGGRESSIVE';
    else if (score <= 38) status = 'DEFENSIVE';
    else status = 'STABLE';
  }

  if (reasons.length === 0) {
    reasons.push('All major indices are within normal range. No strong directional catalyst detected.');
    reasons.push('Monitor SPY for a break above/below today\'s opening range with volume confirmation.');
  }

  score = Math.min(100, Math.max(0, score));

  const action =
    status === 'AGGRESSIVE'
      ? 'RISK-ON: Strong broad market bid. Buy high-momentum stocks on pullbacks to key levels.'
    : status === 'DEFENSIVE'
      ? 'RISK-OFF: Avoid new longs. Protect capital. Consider partial hedges or cash.'
      : 'SELECTIVE: Mixed signals. Focus only on the strongest setups with 2:1+ R:R.';

  // ── Per-instrument setups ────────────────────────────────────────────────
  const setupInstruments = [
    { display: 'SPY',  idx: 0 },
    { display: 'QQQ',  idx: 1 },
    { display: 'NVDA', idx: 2 },
    { display: 'AAPL', idx: 3 },
    { display: 'TSLA', idx: 4 },
    { display: 'BTC',  idx: 5 },
  ];

  const setups = setupInstruments.map(({ display, idx }) =>
    buildSetup(display, quotes[idx], status)
  ).filter(s => s.direction !== 'FLAT' || status === 'DEFENSIVE');

  const timeContext = getTimeContext();

  return NextResponse.json({
    status, score, action, reasons, market, setups, timeContext,
    lastUpdated: new Date().toLocaleTimeString('en-US', {
      hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit',
    }),
  });
}