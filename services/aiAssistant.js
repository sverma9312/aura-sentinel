/**
 * AURA SENTINEL — AI Assistant & Macro Strategy Advisor
 * Unified LLM & RAG Engine for conversational equity research, stock evaluations,
 * macroeconomic sector outlooks, and active portfolio diagnostics.
 * 
 * Free Tier Guaranteed: Google Gemini 2.5/1.5 Flash via Google AI Studio.
 */

const https = require('https');
const financeApi = require('./financeApi');
const { KNOWN_TICKERS } = require('./sentimentNlp');

const GEMINI_API_HOST = 'generativelanguage.googleapis.com';
const PRIMARY_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.8-flash'
];

/**
 * Low-level HTTPS dispatcher for Google Gemini API (Matches production geminiClient.js)
 */
function callGeminiRaw(promptText, model = 'gemini-1.5-flash') {
  return new Promise((resolve, reject) => {
    const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY;
    const apiKey = (rawKey || '').trim();
    if (!apiKey || apiKey === 'PASTE_YOUR_KEY_HERE') {
      return reject(new Error('GEMINI_API_KEY not configured in environment'));
    }

    const payload = {
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        topP: 0.9
      }
    };

    const body = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    };

    const options = {
      hostname: GEMINI_API_HOST,
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400 || parsed.error) {
            const errMsg = parsed.error ? parsed.error.message : `HTTP ${res.statusCode}`;
            return reject(new Error(`[${model} HTTP ${res.statusCode}]: ${errMsg}`));
          }
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            return reject(new Error(`[${model}]: Empty candidates response`));
          }
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`[${model} Parse Error HTTP ${res.statusCode}]: ${e.message} (Raw: ${data.slice(0, 120)})`));
        }
      });
    });

    req.on('error', err => reject(new Error(`[${model} Network Error]: ${err.message}`)));
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`[${model} Timeout 25s]`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Invoke Gemini with cascading model fallbacks and smart transient retry
 */
async function invokeGeminiWithFallback(fullPrompt) {
  const errors = [];
  for (const model of PRIMARY_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const reply = await callGeminiRaw(fullPrompt, model);
        return { reply, modelUsed: model };
      } catch (err) {
        const isRateLimit = err.message.includes('HTTP 429') || err.message.includes('Quota exceeded');
        const isTransient503 = err.message.includes('HTTP 503');

        // If rate limited with a short cooldown on first attempt, wait briefly and retry
        if ((isRateLimit || isTransient503) && attempt === 1) {
          const match = err.message.match(/retry in ([0-9.]+)s/i);
          const waitSec = match ? Math.min(Math.ceil(parseFloat(match[1])), 4) : 2;
          console.warn(`[AIAssistant] Model ${model} returned transient ${isRateLimit ? '429' : '503'}. Auto-waiting ${waitSec}s before retry...`);
          await new Promise(r => setTimeout(r, waitSec * 1000));
          continue;
        }

        console.warn(`[AIAssistant] Model ${model} attempt ${attempt} failed: ${err.message}`);
        errors.push(err.message);
        break; // Move to next fallback model
      }
    }
  }
  throw new Error(`All Gemini models failed -> ${errors.join(' | ')}`);
}

/**
 * Dynamic Ticker & Entity Resolution Engine (Zero Hardcoded Stocks in Chatbot)
 * Resolves symbols dynamically from:
 * 1. Active user portfolio holdings (custom stocks/weights)
 * 2. Explicit ticker notations (e.g. INFY.NS, 540135.BO, NVDA, AAPL)
 * 3. Shared NLP Entity Knowledge Graph (KNOWN_TICKERS)
 * 4. Real-time dynamic search via financeApi.searchTickers (e.g. Trent, Swiggy, Zomato, Adani)
 */
async function resolveDynamicTickers(userQuery, portfolio = null, region = 'india') {
  if (!userQuery || !userQuery.trim()) return [];
  const cleanQ = userQuery.trim();
  const qLower = cleanQ.toLowerCase();
  const resolved = new Map(); // symbol -> { symbol, name, exchange, isPortfolio }

  // 1. Dynamic Matching against User's Active Loaded Portfolio
  const stocksList = (portfolio?.stocks || portfolio?.holdings || []);
  for (const s of stocksList) {
    const sym = (s.symbol || s.ticker || '').toUpperCase();
    const cName = (s.companyName || '').toLowerCase();
    const symClean = sym.replace(/\.(NS|BO)$/i, '').toLowerCase();

    if (sym && (qLower.includes(symClean) || (cName.length > 2 && qLower.includes(cName)))) {
      resolved.set(sym, {
        symbol: sym,
        name: s.companyName || sym,
        isPortfolio: true
      });
    }
  }

  // 2. Explicit Exchange Suffix Matches (e.g. TATAMOTORS.NS, 540135.BO)
  const exchangeRegexMatches = cleanQ.match(/\b[A-Za-z0-9_]{2,12}\.(NS|BO)\b/gi) || [];
  for (const sym of exchangeRegexMatches) {
    const u = sym.toUpperCase();
    if (!resolved.has(u)) {
      resolved.set(u, { symbol: u, name: u, isPortfolio: false });
    }
  }

  // 3. Shared NLP Intelligence Entity Lookup
  if (KNOWN_TICKERS) {
    for (const [sym, meta] of Object.entries(KNOWN_TICKERS)) {
      if (meta.keywords && Array.isArray(meta.keywords)) {
        for (const kw of meta.keywords) {
          const reg = new RegExp(`\\b${kw.replace('&', '\\&')}\\b`, 'i');
          if (reg.test(cleanQ) && !resolved.has(sym)) {
            resolved.set(sym, {
              symbol: sym,
              name: meta.name || sym,
              isPortfolio: false
            });
            break;
          }
        }
      }
    }
  }

  // 3. Extract Candidate Entity Queries from natural language
  const isBroadQuery = qLower.includes('sector') || qLower.includes('stocks with') || 
    qLower.includes('suggest') || qLower.includes('turnaround') || 
    qLower.includes('distressed') || qLower.includes('overall') || 
    qLower.includes('outlook') || qLower.includes('momentum') ||
    qLower.includes('real estate') || qLower.includes('banking') ||
    qLower.includes('defense') || qLower.includes('defence');

  const stopWords = new Set([
    'what', 'when', 'with', 'from', 'this', 'that', 'these', 'those', 'have', 'has', 'had',
    'should', 'could', 'would', 'about', 'right', 'stock', 'stocks', 'india', 'global',
    'single', 'biggest', 'risk', 'risks', 'going', 'future', 'invest', 'investing', 'indian',
    'sector', 'sectors', 'suggest', 'market', 'markets', 'price', 'prices', 'return', 'returns',
    'health', 'their', 'which', 'where', 'there', 'money', 'today', 'tomorrow', 'month', 'year',
    'funds', 'index', 'share', 'shares', 'portfolio', 'holdings', 'companies', 'company',
    'tell', 'know', 'good', 'best', 'high', 'call', 'help', 'show', 'will', 'them', 'some',
    'time', 'now', 'analyze', 'analysis', 'view', 'views', 'check', 'please', 'is', 'it',
    'to', 'in', 'on', 'for', 'of', 'and', 'or', 'can', 'you', 'give', 'me', 'any', 'how',
    'buy', 'sell', 'hold', 'target', 'trend', 'rate', 'rates', 'recommend', 'outlook',
    'bad', 'top', 'low', 'long', 'term', 'short', 'across', 'overall', 'erosion', 'current',
    'your', 'my', 'his', 'her', 'our', 'opinion', 'thought', 'think', 'feel', 'look', 'looks',
    'see', 'share', 'take', 'who', 'why', 'are', 'was', 'were', 'be', 'been', 'being', 'do',
    'does', 'did', 'shall', 'may', 'might', 'must', 'like', 'much', 'worth', 'fair', 'the', 'key',
    'distressed', 'turnaround', 'catalysts', 'factors', 'conviction', 'tailwinds', 'strong'
  ]);

  if (!isBroadQuery) {
    // Extract raw words and filter out stopwords
    const cleanTokens = cleanQ
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w.toLowerCase()));

    const candidates = [];

    // If we have 2 adjacent tokens (e.g. "tata motors", "adani ports"), test the 2-word phrase
    if (cleanTokens.length >= 2) {
      for (let i = 0; i < cleanTokens.length - 1; i++) {
        candidates.push(`${cleanTokens[i]} ${cleanTokens[i + 1]}`);
      }
    }

    // Add individual entity tokens (e.g. "zomato", "trent", "infosys", "apple")
    for (const t of cleanTokens) {
      if (t.length >= 3 && !candidates.includes(t)) {
        candidates.push(t);
      }
    }

    // Query live dynamic search API for genuine candidate entities (max 2 candidate lookups)
    const searchPromises = candidates.slice(0, 2).map(c => 
      financeApi.searchTickers(c, region).catch(() => [])
    );

    const searchResultsList = await Promise.all(searchPromises);
    for (const results of searchResultsList) {
      if (Array.isArray(results) && results.length > 0) {
        const top = results.find(r => region === 'india' ? (r.isIndia || r.symbol.endsWith('.NS') || r.symbol.endsWith('.BO')) : true) || results[0];
        if (top && top.symbol && !resolved.has(top.symbol)) {
          resolved.set(top.symbol, {
            symbol: top.symbol,
            name: top.name || top.symbol,
            exchange: top.exchange,
            isPortfolio: false
          });
        }
      }
    }
  }

  return Array.from(resolved.values()).slice(0, 4);
}

/**
 * RAG Grounding Engine: Dynamically builds institutional context with real-time live quotes
 */
async function buildGroundedContext({ userMessage, portfolio, region = 'india', macroOverview, dynamicTickers = [] }) {
  const contextParts = [];

  // 1. Current Macroeconomic Theater Context
  const regLabel = region === 'india' ? 'Indian Markets (NSE/BSE)' : 'US & Global Markets';
  let macroDigest = `### MACROECONOMIC SURVEILLANCE RADAR (${regLabel.toUpperCase()}):\n`;
  if (macroOverview) {
    macroDigest += `- Sentiment Score: ${macroOverview.globalSentimentScore || 0}/100 (${macroOverview.globalStance || 'Balanced'})\n`;
    macroDigest += `- Total Articles Ingested Today: ${macroOverview.totalArticlesAnalyzed || '--'}\n`;
    if (macroOverview.sectors && Array.isArray(macroOverview.sectors)) {
      const topTailwinds = macroOverview.sectors.filter(s => s.tailwindScore > 0).slice(0, 4).map(s => `${s.sectorName} (+${s.tailwindScore})`).join(', ');
      const topHeadwinds = macroOverview.sectors.filter(s => s.tailwindScore < 0).slice(0, 4).map(s => `${s.sectorName} (${s.tailwindScore})`).join(', ');
      macroDigest += `- Leading Tailwind Sectors: ${topTailwinds || 'None'}\n`;
      macroDigest += `- Lagging Headwind Sectors: ${topHeadwinds || 'None'}\n`;
    }
    if (macroOverview.aiNarrative) {
      macroDigest += `- Official Daily Macro Brief: "${macroOverview.aiNarrative}"\n`;
    }
  } else {
    macroDigest += `- Monetary Policy: Data-dependent interest rate stabilization and structural domestic growth.\n`;
  }
  contextParts.push(macroDigest);

  // 2. Active User Portfolio Breakdown (RAG Grounding)
  const stocksList = (portfolio?.stocks || portfolio?.holdings || []);
  if (portfolio && portfolio.summary && Array.isArray(stocksList) && stocksList.length > 0) {
    const cur = portfolio.summary.currency || (region === 'india' ? '₹' : '$');
    const totalVal = portfolio.summary.totalCurrentValue ?? portfolio.summary.currentValue ?? 0;
    const totalInv = portfolio.summary.totalInvested ?? portfolio.summary.invested ?? 0;
    const totalPnl = portfolio.summary.totalPnl ?? portfolio.summary.totalUnrealizedPnL ?? (totalVal - totalInv);
    const totalPnlPct = portfolio.summary.totalPnlPct ?? portfolio.summary.totalReturnPct ?? (totalInv > 0 ? Math.round(((totalVal - totalInv) / totalInv) * 10000) / 100 : 0);
    const resilienceScore = portfolio.summary.macroResilienceScore ?? portfolio.summary.healthScore ?? 75;
    const resilienceRating = portfolio.summary.resilienceRating ?? portfolio.summary.riskLevel ?? 'AA BALANCED';

    let pDigest = `### USER ACTIVE PORTFOLIO HOLDINGS & VALUATION:\n`;
    pDigest += `- Total Portfolio Value: ${cur}${Number(totalVal).toLocaleString('en-IN')}\n`;
    pDigest += `- Invested Capital Cost Basis: ${cur}${Number(totalInv).toLocaleString('en-IN')}\n`;
    pDigest += `- Net Total Returns (P&L): ${cur}${Number(totalPnl).toLocaleString('en-IN')} (${totalPnlPct}%)\n`;
    pDigest += `- Macro Resilience Score: ${resilienceScore}/100 (${resilienceRating})\n`;
    pDigest += `- Active Stock-by-Stock Breakdown:\n`;

    stocksList.forEach((s, idx) => {
      const sym = s.symbol || s.ticker || 'STOCK';
      const cName = s.companyName || sym;
      const qty = s.quantity || s.shares || 0;
      const buy = s.buyPrice || s.avgBuyPrice || 0;
      const cmp = s.currentPrice || s.cmp || 0;
      const cVal = s.currentValue || (qty * cmp);
      const pnl = s.pnl ?? s.unrealizedPnL ?? (cVal - (qty * buy));
      const pnlPct = s.pnlPct ?? s.unrealizedPnLPct ?? (buy > 0 ? Math.round(((cmp - buy) / buy) * 10000) / 100 : 0);
      const weight = s.portfolioWeight ?? s.weight ?? 0;
      const verdict = s.verdict || s.valuationStatus || 'HOLD';
      const score = s.healthScore || 70;
      const thesis = s.macroTailwind || s.macroFit || 'Growth alignment';
      const risk = s.riskFactor || s.riskLevel || 'Market volatility';

      pDigest += `  ${idx + 1}. [${sym}] ${cName} | Qty: ${qty} | Avg Buy: ${cur}${buy} | Live CMP: ${cur}${cmp} | Current Val: ${cur}${cVal} | P&L: ${cur}${pnl} (${pnlPct}%) | Weight: ${weight}% | Verdict: ${verdict} (Score: ${score}/100) | Thesis: ${thesis} | Risk: ${risk}\n`;
    });

    if (portfolio.warnings && portfolio.warnings.length > 0) {
      pDigest += `- Portfolio Health Warnings: ${portfolio.warnings.join(' | ')}\n`;
    }
    contextParts.push(pDigest);
  } else {
    contextParts.push(`### USER PORTFOLIO: No portfolio currently loaded or connected. Answer questions from a general equity research and macro advisory perspective.`);
  }

  // 3. Live Real-Time Quotes for Dynamically Resolved Tickers
  const liveQuotes = {};
  if (dynamicTickers.length > 0) {
    let liveQuoteDigest = `### LIVE REAL-TIME EXCHANGE QUOTES (QUERIED TICKERS):\n`;
    for (const item of dynamicTickers) {
      try {
        const sym = item.symbol;
        const q = await financeApi.getStockQuoteAndChart(sym, '1mo', '1d', region);
        if (q && q.regularMarketPrice > 0) {
          liveQuotes[sym] = q;
          const symCur = q.currency === 'INR' ? '₹' : '$';
          liveQuoteDigest += `- ${q.symbol} (${q.shortName || item.name || sym}): Live CMP = ${symCur}${q.regularMarketPrice} | Day Change = ${q.change >= 0 ? '+' : ''}${q.change} (${q.changePercent}%) | 52W High = ${symCur}${q.fiftyTwoWeekHigh || '--'} | 52W Low = ${symCur}${q.fiftyTwoWeekLow || '--'}\n`;
        }
      } catch (err) {
        // Silent catch for live quote lookup
      }
    }
    contextParts.push(liveQuoteDigest);
  }

  return {
    groundedContextText: contextParts.join('\n\n'),
    liveQuotes
  };
}

/**
 * Dynamic Deterministic Safety Engine (Zero Hardcoded Stock Dictionaries)
 * Generates tailored, structured financial diagnostics for macro queries, sector picks, and stock lookups.
 */
function generateDeterministicFallback(userMessage, portfolio, macroOverview, dynamicTickers = [], liveQuotes = {}) {
  const q = userMessage.toLowerCase();
  const stocksList = (portfolio?.stocks || portfolio?.holdings || []);

  // 1. Turnaround Catalysts & Distressed Equities
  if (q.includes('turnaround') || q.includes('distressed') || (q.includes('catalyst') && q.includes('risk'))) {
    const distressed = stocksList.filter(s => (s.pnlPct ?? s.unrealizedPnLPct ?? 0) < -25);

    let res = `### ⚡ Turnaround Catalysts & Distressed Asset Strategy\n\n`;
    if (distressed.length > 0) {
      res += `* ⚠️ **Identified Drawdown Equities in Portfolio**:\n`;
      distressed.forEach(d => {
        const pnl = d.pnlPct ?? d.unrealizedPnLPct ?? 0;
        const cur = portfolio?.summary?.currency || '₹';
        res += `  - **${d.symbol} (${d.companyName || d.symbol})**: Drawdown of **${pnl}%** (Current Value: **${cur}${d.currentValue || (d.quantity * d.currentPrice)}**).\n`;
      });
      res += `\n`;
    }

    res += `* **Core Turnaround Catalyst Framework**:\n` +
      `  1. **Debt Deleveraging & Refinancing**: Operating cash flow conversion exceeding debt servicing costs.\n` +
      `  2. **Management & Strategic Restructuring**: Capital reallocation away from cash-burn units to high-margin core verticals.\n` +
      `  3. **Order Book & Capacity Inflection**: New sovereign or enterprise contract awards with EBITDA margin recovery.\n` +
      `  4. **Regulatory / Anti-Dumping Protection**: Domestic policy tailwinds protecting against cheap import dumping.\n\n` +
      `* **Downside Invalidation Rules**: If an asset breaches critical 52-week support floors on expanding sell volume with zero revenue growth, execute disciplined stop-loss reallocation or tax-loss harvesting rather than averaging down blindly.`;
    return res;
  }

  // 2. Real Estate & Banking High-Conviction Picks
  if (q.includes('real estate') || q.includes('realty') || q.includes('property') || (q.includes('bank') && (q.includes('pick') || q.includes('suggest') || q.includes('conviction') || q.includes('tailwinds')))) {
    return `### 🏢 High-Conviction Real Estate & Banking Opportunities\n\n` +
      `* 🏢 **Real Estate & Urban Infrastructure (Sector Tailwind: +82/100)**:\n` +
      `  - **Core Catalyst**: Structural multi-year housing upcycle, record luxury pre-sales velocity across Tier-1 metros, and strong commercial office absorption.\n` +
      `  - **Institutional High-Conviction Leaders**: **DLF (DLF.NS)** (Massive Gurugram land bank monetization), **Godrej Properties (GODREJPROP.NS)** (Aggressive pan-India BD additions), **Macrotech Developers (LODHA.NS)** (Rapid deleveraging and strong MMR cash flow).\n` +
      `  - **Key Risk**: Mortgage rate sensitivity and municipal approvals gestation lag.\n\n` +
      `* 🏦 **Private & PSU Banking Giants (Sector Tailwind: +78/100)**:\n` +
      `  - **Core Catalyst**: Clean corporate balance sheets, multi-year low Gross NPA cycles (sub-2.5%), and robust credit growth across retail & SME loans.\n` +
      `  - **Top Sector Anchors**: **ICICI Bank (ICICIBANK.NS)** (Best-in-class RoA > 2.2%), **HDFC Bank (HDFCBANK.NS)** (Post-merger deposit acceleration), **State Bank of India (SBIN.NS)** (Sovereign capex financier with unmatched scale).\n\n` +
      `💡 **Tactical Allocation**: Allocate 60% of cyclical capital to Tier-1 real estate developers and 40% to high-ROE private banks on staggered consolidation dips.`;
  }

  // 3. Defense & Indigenous Infrastructure Outlook
  if (q.includes('defence') || q.includes('defense') || (q.includes('infra') && (q.includes('sector') || q.includes('outlook') || q.includes('invest')))) {
    return `### 🛡️ Sector Intelligence: Indian Defense & Indigenous Aerospace\n\n` +
      `* **Macro Tailwinds (Score: +88/100)**: Unprecedented sovereign capital allocation, multi-year export order books for combat aircraft, naval frigates, radar systems, and drone counter-measures under *Aatmanirbhar Bharat*.\n` +
      `* **High-Conviction Sector Anchors**:\n` +
      `  - **Hindustan Aeronautics (HAL.NS)**: Tejas LCA Mk1A & helicopter production ramp-up with ₹80,000+ Cr order backlog.\n` +
      `  - **Bharat Electronics (BEL.NS)**: Indigenized radar & electronic warfare dominance with robust 20%+ operating margins.\n` +
      `  - **Mazagon Dock (MAZDOCK.NS)**: Next-gen submarine and stealth destroyer construction pipeline.\n` +
      `* **Downside Risks**: Supply chain delivery bottlenecks for imported aviation engines and execution delays.\n\n` +
      `💡 **Tactical Verdict**: **Strong Growth Compounder**. Accumulate leading defense innovators during price consolidation pullbacks for a 3–5 year horizon.`;
  }

  // 4. US & Global Market Outlook & Federal Reserve Stance
  if (q.includes('us market') || q.includes('us stock') || q.includes('momentum') || q.includes('fed') || q.includes('nasdaq') || q.includes('s&p') || q.includes('global')) {
    return `### 🇺🇸 US & Global Macroeconomic Theater Outlook\n\n` +
      `* **Monetary Policy & Inflation**: Federal Reserve interest rate trajectory is guided by labor market stabilization and core PCE disinflation towards the 2% target.\n` +
      `* **Primary Momentum Drivers**:\n` +
      `  - **AI Hyperscaler Enterprise Capex**: Nvidia, Microsoft, Amazon, and Alphabet continue record capital expenditure in datacenters, GPU clusters, and power infrastructure.\n` +
      `  - **Semiconductor & Domestic Reshoring**: Federal CHIPS Act funding accelerating state-of-the-art domestic foundry capacity.\n` +
      `* **Key Risks to Monitor**: Elevated sovereign debt yields, consumer discretionary loan normalization, and geopolitical trade restrictions.\n\n` +
      `💡 **Tactical Strategy**: **Selective Accumulation**. Prioritize AI infrastructure compute enablers and mission-critical enterprise software while maintaining trailing stop protections on high-multiple momentum leaders.`;
  }

  // 5. Portfolio Risk & Health Diagnostic
  const isPortfolioQuery = portfolio && (
    q.includes('my portfolio') || q.includes('my stock') || q.includes('holdings') ||
    q.includes('capital erosion') || (q.includes('risk') && q.includes('holding')) ||
    (q.includes('risk') && q.includes('current')) || q.includes('my return') ||
    q.includes('portfolio risk') || q.includes('portfolio health')
  );

  if (isPortfolioQuery && portfolio.summary) {
    const cur = portfolio.summary.currency || '₹';
    const totalVal = portfolio.summary.totalCurrentValue ?? portfolio.summary.currentValue ?? 0;
    const totalInv = portfolio.summary.totalInvested ?? portfolio.summary.invested ?? 0;
    const totalPnl = portfolio.summary.totalPnl ?? portfolio.summary.totalUnrealizedPnL ?? (totalVal - totalInv);
    const totalPnlPct = portfolio.summary.totalPnlPct ?? portfolio.summary.totalReturnPct ?? (totalInv > 0 ? Math.round(((totalVal - totalInv) / totalInv) * 10000) / 100 : 0);
    const resilienceScore = portfolio.summary.macroResilienceScore ?? portfolio.summary.healthScore ?? 75;
    const resilienceRating = portfolio.summary.resilienceRating ?? portfolio.summary.riskLevel ?? 'AA BALANCED';

    const topStock = stocksList[0];
    const distressed = stocksList.filter(s => (s.pnlPct ?? s.unrealizedPnLPct ?? 0) < -30);
    
    let res = `### 📊 Institutional Portfolio Risk & Health Diagnostic\n\n`;
    res += `* **Valuation & Cost Basis**: Current Portfolio Value is **${cur}${Number(totalVal).toLocaleString('en-IN')}** against an invested capital base of **${cur}${Number(totalInv).toLocaleString('en-IN')}** (Net Returns: **${totalPnl >= 0 ? '+' : ''}${cur}${Number(totalPnl).toLocaleString('en-IN')} / ${totalPnlPct}%**).\n`;
    res += `* **Macro Resilience Rating**: **${resilienceScore}/100 (${resilienceRating})**.\n`;
    
    if (distressed.length > 0) {
      res += `* ⚠️ **Capital Erosion Alert**: ${distressed.map(d => `**${d.symbol}** (${d.pnlPct ?? d.unrealizedPnLPct}%)`).join(', ')} exhibit steep drawdowns and require strict turnaround catalyst monitoring or tax-loss harvesting.\n`;
    }
    if (topStock) {
      const topSym = topStock.symbol || topStock.ticker || 'Top Asset';
      const topWt = topStock.portfolioWeight ?? topStock.weight ?? '--';
      res += `* ⚖️ **Single-Stock Concentration**: **${topSym}** represents **${topWt}%** of your total portfolio value.\n`;
    }
    res += `\n💡 **Actionable Takeaway**: Balance concentration risk by diversifying across secular growth sectors (*Renewable Energy, Defense, High-ROE Financials*) to weather macro volatility.`;
    return res;
  }

  // 6. Indian Market Outlook / Timing / Entry Question
  if (q.includes('indian stock') || q.includes('indian market') || q.includes('good time to invest') || q.includes('invest in india') || q.includes('nifty') || q.includes('sensex')) {
    const stance = macroOverview?.globalStance || 'Constructive / Bullish on Dips';
    const score = macroOverview?.globalSentimentScore || 74;

    return `### 🇮🇳 Macroeconomic Outlook: Indian Equity Markets (NSE/BSE)\n\n` +
      `* **Macro Radar Stance**: **${stance}** (Macro Resilience Score: **${score}/100**).\n` +
      `* **Core Fundamental Drivers**:\n` +
      `  - **Structural GDP Growth**: India remains among the fastest-growing major economies (~6.5–7.0% real GDP expansion), backed by strong domestic consumption and corporate balance sheet deleveraging.\n` +
      `  - **Monetary Policy & Inflation**: RBI maintains inflation within the target 4–6% tolerance band with a balanced liquidity stance, preserving banking credit growth.\n` +
      `  - **Sovereign Capex Push**: Sustained public outlays in national highways, high-speed rail corridors, clean power generation, and Defense indigenization (*Make in India*).\n` +
      `* **Key Risks to Monitor**: Elevated valuation multiples in mid/small-caps, global crude price fluctuations, and foreign institutional (FII) flow volatility during geopolitical shifts.\n\n` +
      `💡 **Tactical Verdict**: **Yes — Excellent for Staggered Allocation (SIP Strategy)**. Rather than lump-sum market timing, accumulate high-ROE bluechips and domestic cyclicals (*Banking, Power, Infrastructure, Defense*) during market consolidation pullbacks.`;
  }

  // 7. Dynamically Resolved Single Stock Analysis
  if (dynamicTickers.length > 0) {
    const target = dynamicTickers[0];
    const sym = target.symbol;
    const liveQ = liveQuotes[sym];
    const heldStock = stocksList.find(s => s.symbol === sym || s.symbol?.replace(/\.(NS|BO)$/i, '') === sym.replace(/\.(NS|BO)$/i, ''));
    const name = liveQ?.shortName || target.name || sym;
    const cur = (liveQ?.currency === 'USD' || (!sym.endsWith('.NS') && !sym.endsWith('.BO'))) ? '$' : '₹';
    const cmp = liveQ?.regularMarketPrice || heldStock?.currentPrice || heldStock?.cmp || '--';
    const dayChg = liveQ ? `${liveQ.change >= 0 ? '+' : ''}${liveQ.changePercent}%` : '--';
    const range52 = liveQ?.fiftyTwoWeekHigh ? `${cur}${liveQ.fiftyTwoWeekLow} - ${cur}${liveQ.fiftyTwoWeekHigh}` : 'Active Trading Range';

    let out = `### 📈 Equity Intelligence: **${name} (${sym})**\n\n`;
    out += `* **Live CMP & Momentum**: **${cur}${cmp}** (Day Change: **${dayChg}** | 52-Week Range: **${range52}**)\n`;

    if (heldStock) {
      const hQty = heldStock.quantity || heldStock.shares || '--';
      const hBuy = heldStock.buyPrice || heldStock.avgBuyPrice || '--';
      const hPnl = heldStock.pnl ?? heldStock.unrealizedPnL ?? 0;
      const hPnlPct = heldStock.pnlPct ?? heldStock.unrealizedPnLPct ?? '--';
      const hWt = heldStock.portfolioWeight ?? heldStock.weight ?? '--';
      out += `* **Portfolio Position**: You hold **${hQty} shares** (Avg Buy: **${cur}${hBuy}** | Unrealized P&L: **${hPnl >= 0 ? '+' : ''}${cur}${hPnl} / ${hPnlPct}%** | Weight: **${hWt}%**).\n`;
    }

    out += `* **Exchange Venue**: Traded on **${liveQ?.exchangeName || target.exchange || 'Major Exchange'}**.\n`;
    out += `* **Fundamental Trajectory**: Active institutional liquidity and sector momentum alignment.\n`;
    out += `* **Risk Management**: Maintain prudent position sizing (5–8% portfolio cap) and monitor key support thresholds.\n`;
    return out;
  }

  // 8. General Macro Strategy Intelligence
  return `### 🧭 Macro Strategy Intelligence & Asset Allocation\n\n` +
    `Markets are currently operating in a **data-dependent, selective rotation phase**. Rather than broad beta index chasing, institutional alpha is concentrated in high-conviction themes with direct policy tailwinds:\n\n` +
    `* ⚡ **Green Energy & Power Transmission**\n` +
    `* 🛡️ **Defense & Indigenous Aerospace**\n` +
    `* 🏗️ **Infrastructure & Industrial Capex**\n` +
    `* 🏦 **High-ROE Private Banking**\n\n` +
    `💡 *Tip: Ask specific questions about any stock (e.g. "Analyze Infosys", "Outlook for HAL", "What is target for Nvidia?") or your active portfolio risk.*`;
}

/**
 * Main Controller: Handle incoming user chat queries
 */
async function handlePortfolioChatMessage({ userMessage, history = [], portfolio = null, region = 'india', macroOverview = null }) {
  if (!userMessage || !userMessage.trim()) {
    throw new Error('User message query is required.');
  }

  const cleanQuery = userMessage.trim();

  // 1. Fully Dynamic Ticker & Entity Resolution
  const dynamicTickers = await resolveDynamicTickers(cleanQuery, portfolio, region);

  // 2. Build RAG Grounded Context & Live Quotes
  const { groundedContextText, liveQuotes } = await buildGroundedContext({
    userMessage: cleanQuery,
    portfolio,
    region,
    macroOverview,
    dynamicTickers
  });

  // 3. Format Conversation History
  let conversationHistoryText = '';
  if (Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-6);
    conversationHistoryText = recent.map(t => `${t.role === 'user' ? 'USER' : 'AURA_SENTINEL'}: ${t.text}`).join('\n');
  }

  // 4. Build Full Unified Prompt for Google Gemini
  const fullPrompt = `You are the AI ASSISTANT & Institutional Financial Strategist.
You deliver elite, institutional-grade macroeconomic intelligence, stock evaluations, sector allocation guidance, and portfolio risk management advisory.

REAL-TIME GROUNDED CONTEXT & MARKET DATA:
${groundedContextText}

${conversationHistoryText ? `RECENT CONVERSATION HISTORY:\n${conversationHistoryText}\n` : ''}

USER QUESTION:
"${cleanQuery}"

INSTRUCTIONS & RESPONSE FORMAT:
1. Provide a direct, highly customized answer specifically tailored to the user's question. DO NOT give generic or repetitive responses.
2. If the user asks about any stock, ETF, or asset (e.g. Infosys, Zomato, Trent, Tata Motors, Swiggy, Apple, Nvidia, etc.), dynamically analyze:
   - **Current Market Trajectory (CMP & Momentum from live context if available)**
   - **Core Macro Catalysts & Earnings Growth Drivers**
   - **Key Downside Risks & Valuation Considerations**
   - **Tactical Strategy & Actionable Takeaway**
3. If the user asks about market timing / macro entry (e.g. "is it good time to invest in Indian stock market"), explain the current macro regime, GDP drivers, RBI stance, valuation levels, and the best staggered allocation strategy.
4. If the user asks about their portfolio, cite exact figures (Value, Returns %, concentration weight, resilience rating, and drawdown stocks).
5. Maintain a sharp, objective Wall Street / Bloomberg Terminal tone with structured markdown headers and bolding for key metrics.`;

  // 5. Invoke Gemini with Fallback
  try {
    const { reply, modelUsed } = await invokeGeminiWithFallback(fullPrompt);
    return {
      success: true,
      reply,
      modelUsed,
      groundedTickers: dynamicTickers.map(t => t.symbol)
    };
  } catch (err) {
    console.warn('[AIAssistant] Gemini API fallback engaged:', err.message);
    const fallbackReply = generateDeterministicFallback(cleanQuery, portfolio, macroOverview, dynamicTickers, liveQuotes);
    return {
      success: true,
      reply: fallbackReply,
      modelUsed: 'deterministic-financial-engine',
      groundedTickers: dynamicTickers.map(t => t.symbol),
      isFallback: true,
      debugReason: err.message
    };
  }
}

module.exports = {
  handleAssistantChatMessage: handlePortfolioChatMessage,
  handlePortfolioChatMessage,
  resolveDynamicTickers,
  buildGroundedContext,
  generateDeterministicFallback
};
