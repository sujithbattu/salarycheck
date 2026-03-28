import { NextResponse } from 'next/server';

type FinnhubQuote = {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  pc: number; // Previous close
  t: number;  // Timestamp
};

type FinnhubNewsItem = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
};

function toIso(tsSeconds?: number) {
  if (!tsSeconds) return new Date().toISOString();
  return new Date(tsSeconds * 1000).toISOString();
}

function classifySignal(spy: FinnhubQuote, vix: FinnhubQuote) {
  let score = 50;
  let trend: 'BULLISH' | 'NEUTRAL' | 'BEARISH' = 'NEUTRAL';
  let momentum: 'STRONG' | 'MIXED' | 'WEAK' = 'MIXED';
  let volatility: 'CALM' | 'ELEVATED' | 'HIGH' = 'ELEVATED';
  let breadth: 'STRONG' | 'MIXED' | 'WEAK' = 'MIXED';
  const reasons: string[] = [];

  // 1. Trend Logic (Price vs Prev Close)
  const spyDiff = spy.c - spy.pc;
  if (spyDiff > 0) {
    trend = 'BULLISH';
    score += 15;
    reasons.push('SPY is trading above yesterday’s close.');
  } else {
    trend = 'BEARISH';
    score -= 15;
    reasons.push('SPY is trading below yesterday’s close.');
  }

  // 2. Momentum Logic (Day Change %)
  if (spy.dp >= 0.8) {
    momentum = 'STRONG';
    score += 15;
  } else if (spy.dp <= -0.8) {
    momentum = 'WEAK';
    score -= 15;
  }

  // 3. Volatility Logic (Using actual VIX)
  if (vix.c < 18) {
    volatility = 'CALM';
    score += 15;
    reasons.push(`VIX is low (${vix.c.toFixed(2)}), favoring risk-on entries.`);
  } else if (vix.c > 25) {
    volatility = 'HIGH';
    score -= 20;
    reasons.push(`VIX is elevated (${vix.c.toFixed(2)}). Avoid high leverage.`);
  } else {
    volatility = 'ELEVATED';
    reasons.push('VIX is in the "choppy" zone (18-25).');
  }

  // 4. Score Normalization
  score = Math.max(0, Math.min(100, score));

  let status: 'AGGRESSIVE' | 'BUILD' | 'DEFENSIVE' = 'BUILD';
  if (score >= 70) status = 'AGGRESSIVE';
  if (score <= 40) status = 'DEFENSIVE';

  const action = status === 'AGGRESSIVE' 
    ? 'Conditions favor offense. Consider 1 MES contract with tight stops.' 
    : status === 'BUILD' 
    ? 'Neutral environment. Focus on long-term shares, avoid futures.' 
    : 'High risk environment. Preserve capital and stay in cash.';

  return { status, score, trend, momentum, volatility, breadth, reasons, action };
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });

  try {
    // Parallel fetching for speed
    const [spyRes, vixRes, newsRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=SPY&token=${apiKey}`, { cache: 'no-store' }),
      fetch(`https://finnhub.io/api/v1/quote?symbol=VIX&token=${apiKey}`, { cache: 'no-store' }),
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`, { cache: 'no-store' })
    ]);

    const spy = await spyRes.json() as FinnhubQuote;
    const vix = await vixRes.json() as FinnhubQuote;
    const news = await newsRes.json() as FinnhubNewsItem[];

    const signal = classifySignal(spy, vix);

    return NextResponse.json({
      ...signal,
      spy: {
        symbol: 'SPY',
        price: spy.c,
        change: spy.d,
        changePercent: spy.dp,
        updatedAt: toIso(spy.t),
      },
      vix: {
        symbol: 'VIX',
        price: vix.c,
        change: vix.d,
        changePercent: vix.dp,
        updatedAt: toIso(vix.t),
      },
      mes: { // Placeholder for MES as it usually requires a paid Polygon/Tradier key
        symbol: 'MES (EST)',
        price: spy.c * 10, 
        change: spy.d * 10,
        changePercent: spy.dp,
        updatedAt: toIso(),
      },
      news: (news || []).slice(0, 5),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Data fetch failed' }, { status: 500 });
  }
}