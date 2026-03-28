import { NextResponse } from 'next/server';

const symbols = ['SPY', 'VIX', 'QQQ', 'NVDA', 'TSLA', 'BTC-USD'];

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });

  try {
    const [quotesRes, newsRes] = await Promise.all([
      Promise.all(symbols.map(s => 
        fetch(`https://finnhub.io/api/v1/quote?symbol=${s}&token=${apiKey}`, { cache: 'no-store' }).then(r => r.json())
      )),
      fetch(`https://finnhub.io/api/v1/news?category=business&token=${apiKey}`, { cache: 'no-store' }).then(r => r.json())
    ]);

    const [spy, vix, qqq, nvda, tsla, btc] = quotesRes;
    
    let score = 50;
    const reasons: string[] = [];
    
    // Logic 1: Price Action
    const spyState = spy.c > spy.pc;
    score += spyState ? 20 : -20;
    reasons.push(spyState ? "Momentum: Price sustaining above daily pivot." : "Momentum: Sell-side pressure dominant.");

    // Logic 2: Volatility
    const vVal = vix.c || 16.42;
    if (vVal > 20) { score -= 15; reasons.push("Volatility: VIX expansion detected."); }
    else { score += 10; reasons.push("Volatility: Low IV environment."); }

    // Logic 3: Correlation
    if (qqq.dp < spy.dp) { score -= 10; reasons.push("Divergence: Tech lagging broad market."); }

    score = Math.max(0, Math.min(100, score));
    const status = score > 75 ? 'AGGRESSIVE' : score > 45 ? 'BUILD' : 'DEFENSIVE';

    return NextResponse.json({
      status, score, reasons,
      action: status === 'AGGRESSIVE' ? 'STRATEGY: FULL OFFENSE. SCALE INTO MES.' : status === 'BUILD' ? 'STRATEGY: NEUTRAL. PROTECT CAPITAL.' : 'STRATEGY: HIGH RISK. SHORT BIAS OR CASH.',
      market: [
        { symbol: 'SPY', price: spy.c, change: spy.dp, group: 'Index' },
        { symbol: 'QQQ', price: qqq.c, change: qqq.dp, group: 'Tech' },
        { symbol: 'VIX', price: vVal, change: vix.dp || 0, group: 'Vol' },
        { symbol: 'NVDA', price: nvda.c, change: nvda.dp, group: 'AI' },
        { symbol: 'BTC', price: btc?.c || 0, change: btc?.dp || 0, group: 'Crypto' }
      ],
      news: (newsRes || []).slice(0, 5).map((n: any) => ({
        source: n.source, headline: n.headline, url: n.url,
        time: new Date(n.datetime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    });
  } catch (err) {
    return NextResponse.json({ error: 'System Error' }, { status: 500 });
  }
}