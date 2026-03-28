import { NextResponse } from 'next/server';

type FinnhubQuote = {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number;
  l: number;
  o: number;
  pc: number; // previous close
  t: number; // timestamp
};

type FinnhubNewsItem = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  image?: string;
  datetime: number;
};

function toIso(tsSeconds?: number) {
  if (!tsSeconds) return new Date().toISOString();
  return new Date(tsSeconds * 1000).toISOString();
}

function classifySignal({
  spyChangePct,
  spyVsPrevClose,
}: {
  spyChangePct: number;
  spyVsPrevClose: number;
}) {
  let score = 50;
  let trend: 'BULLISH' | 'NEUTRAL' | 'BEARISH' = 'NEUTRAL';
  let momentum: 'STRONG' | 'MIXED' | 'WEAK' = 'MIXED';
  let volatility: 'CALM' | 'ELEVATED' | 'HIGH' = 'ELEVATED';
  let breadth: 'STRONG' | 'MIXED' | 'WEAK' = 'MIXED';
  const reasons: string[] = [];

  if (spyVsPrevClose > 0) {
    trend = 'BULLISH';
    score += 18;
    reasons.push('SPY is trading above the previous close, which supports a bullish trend bias.');
  } else if (spyVsPrevClose < 0) {
    trend = 'BEARISH';
    score -= 18;
    reasons.push('SPY is trading below the previous close, which weakens the trend picture.');
  } else {
    reasons.push('SPY is near the previous close, which suggests a neutral trend read.');
  }

  if (spyChangePct >= 1.0) {
    momentum = 'STRONG';
    score += 18;
    reasons.push('SPY has strong positive daily momentum.');
  } else if (spyChangePct <= -1.0) {
    momentum = 'WEAK';
    score -= 18;
    reasons.push('SPY has weak negative daily momentum.');
  } else {
    reasons.push('SPY momentum is present but not decisive.');
  }

  // Temporary placeholder until VIX is wired.
  if (spyChangePct > 0.75) {
    volatility = 'CALM';
    score += 8;
    reasons.push('Price action is favoring offense more than defense right now.');
  } else if (spyChangePct < -0.75) {
    volatility = 'HIGH';
    score -= 8;
    reasons.push('Recent price action suggests a more defensive volatility environment.');
  } else {
    reasons.push('Volatility conditions look mixed, not ideal for max aggression.');
  }

  if (trend === 'BULLISH' && momentum === 'STRONG') {
    breadth = 'STRONG';
    score += 6;
    reasons.push('Trend and momentum are aligned, which usually improves signal quality.');
  } else if (trend === 'BEARISH' && momentum === 'WEAK') {
    breadth = 'WEAK';
    score -= 6;
    reasons.push('Trend and momentum are aligned to the downside, so caution is warranted.');
  } else {
    reasons.push('Market participation looks mixed.');
  }

  score = Math.max(0, Math.min(100, score));

  let status: 'AGGRESSIVE' | 'BUILD' | 'DEFENSIVE' = 'BUILD';
  let action =
    'Keep investing normally, but do not rush into aggressive MES exposure yet.';

  if (score >= 70) {
    status = 'AGGRESSIVE';
    action =
      'Conditions are favorable enough to consider offensive risk. If you trade MES, keep sizing controlled and follow stop rules.';
  } else if (score <= 40) {
    status = 'DEFENSIVE';
    action =
      'Avoid aggressive MES entries. Keep building cash and let the market improve first.';
  }

  return { status, score, trend, momentum, volatility, breadth, reasons, action };
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing FINNHUB_API_KEY' },
      { status: 500 }
    );
  }

  try {
    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=SPY&token=${apiKey}`,
      { cache: 'no-store' }
    );

    const newsRes = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`,
      { cache: 'no-store' }
    );

    if (!quoteRes.ok || !newsRes.ok) {
      throw new Error('Failed to fetch Finnhub data');
    }

    const quote = (await quoteRes.json()) as FinnhubQuote;
    const news = (await newsRes.json()) as FinnhubNewsItem[];

    const signal = classifySignal({
      spyChangePct: quote.dp ?? 0,
      spyVsPrevClose: (quote.c ?? 0) - (quote.pc ?? 0),
    });

    const trimmedNews = (news || []).slice(0, 6).map((item) => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      datetime: item.datetime,
    }));

    return NextResponse.json({
      ...signal,
      spy: {
        symbol: 'SPY',
        price: quote.c ?? 0,
        change: quote.d ?? 0,
        changePercent: quote.dp ?? 0,
        updatedAt: toIso(quote.t),
      },
      // Placeholder until Polygon is added.
      mes: {
        symbol: 'MES',
        price: 0,
        change: 0,
        changePercent: 0,
        updatedAt: toIso(),
      },
      // Placeholder until Polygon indices/VIX is added.
      vix: {
        symbol: 'VIX',
        price: 0,
        change: 0,
        changePercent: 0,
        updatedAt: toIso(),
      },
      news: trimmedNews,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}