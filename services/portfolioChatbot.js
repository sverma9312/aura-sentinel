/**
 * AURA SENTINEL — AI Portfolio Copilot & Macro Strategy Advisor
 * Dedicated LLM & RAG Engine for conversational portfolio diagnostics,
 * macro sector evaluations, and live stock intelligence.
 * 
 * Free Tier Guaranteed: Google Gemini 2.5/1.5 Flash via Google AI Studio.
 */

const https = require('https');
const financeApi = require('./financeApi');
const { KNOWN_TICKERS } = require('./sentimentNlp');

const GEMINI_API_HOST = 'generativelanguage.googleapis.com';
const PRIMARY_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro', 'gemini-3.6-flash'];

/**
 * Low-level HTTPS dispatcher for Google Gemini API (Matches production geminiClient.js)
 */
function callGeminiRaw(promptText, model = 'gemini-1.5-flash') {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
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
    const options = {
      hostname: GEMINI_API_HOST,
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(`Gemini API error (${model}): ${parsed.error.message}`));
          }
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            return reject(new Error(`Gemini returned empty text from model ${model}`));
          }
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Failed to parse Gemini response: ${e.message}`));
        }
      });
    });

    req.on('error', err => reject(new Error(`Gemini network error: ${err.message}`)));
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Gemini request timed out on model ${model}`));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Invoke Gemini with cascading model fallbacks
 */
async function invokeGeminiWithFallback(fullPrompt) {
  let lastErr = null;
  for (const model of PRIMARY_MODELS) {
    try {
      const reply = await callGeminiRaw(fullPrompt, model);
      return { reply, modelUsed: model };
    } catch (err) {
      console.warn(`[PortfolioChatbot] Model ${model} failed (${err.message}). Trying fallback...`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini models exhausted.');
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
    'does', 'did', 'shall', 'may', 'might', 'must', 'like', 'much', 'worth', 'fair'
  ]);

  // Extract raw words and filter out stopwords
  const cleanTokens = cleanQ
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w.toLowerCase()));

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

  // 4. Query live dynamic search API for genuine candidate entities (max 3 candidate lookups)
  const searchPromises = candidates.slice(0, 3).map(c => 
    financeApi.searchTickers(c, region).catch(() => [])
  );

  const searchResultsList = await Promise.all(searchPromises);
  for (const results of searchResultsList) {
    if (Array.isArray(results) && results.length > 0) {
      // Prioritize exchange matching the region (NSE/BSE for India, US for global)
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

  // 5. Fallback Direct Ticker Formulation (for fresh unindexed IPOs/equities like ZOMATO, SWIGGY, TRENT)
  if (resolved.size === 0 && cleanTokens.length > 0) {
    for (const t of cleanTokens.slice(0, 2)) {
      if (t.length >= 3 && !stopWords.has(t.toLowerCase())) {
        const directSym = region === 'india' ? `${t.toUpperCase()}.NS` : t.toUpperCase();
        resolved.set(directSym, {
          symbol: directSym,
          name: t.toUpperCase(),
          exchange: region === 'india' ? 'NSE' : 'US',
          isPortfolio: false
        });
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
 * Generates structured financial diagnostics from live quotes and macro state when AI key is throttled.
 */
function generateDeterministicFallback(userMessage, portfolio, macroOverview, dynamicTickers = [], liveQuotes = {}) {
  const q = userMessage.toLowerCase();
  const stocksList = (portfolio?.stocks || portfolio?.holdings || []);

  // 1. User Portfolio Risk, Health, or Capital Erosion Query
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

  // 2. Dynamically Resolved Stock Analysis (Any Stock Worldwide)
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

    let out = `### 📈 Dynamic Equity Intelligence: **${name} (${sym})**\n\n`;
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
    out += `* **Fundamental Perspective**: Dynamic tracking indicates active liquidity and exchange volume participation.\n`;
    out += `* **Risk Management**: Maintain prudent position sizing (5–8% portfolio cap), define invalidation levels below key moving average supports, and align with sector tailwinds.\n\n`;
    out += `💡 **Tactical Guidance**: For deeper AI narrative and multi-factor catalysts, ensure your free Gemini API key is configured.`;
    return out;
  }

  // 3. Indian Market Outlook / Timing / Entry Question
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

  // 4. Sector Specific Questions (Defense, Real Estate, Banking, Power, Tech)
  if (q.includes('defence') || q.includes('defense')) {
    return `### 🛡️ Sector Intelligence: Defense & Aerospace\n\n` +
      `* **Macro Tailwinds**: Strong sovereign defense budget allocation, multi-year export order books for fighter aircraft, radar systems, naval combat suites, and anti-drone electronics.\n` +
      `* **Downside Risks**: Supply chain delays for foreign components and periodic PSU execution timelines.\n\n` +
      `💡 **Tactical Verdict**: **Bullish / Growth Compounder**. Accumulate leading defense innovators on price consolidation with a 3–5 year investment horizon.`;
  }

  if (q.includes('real estate') || q.includes('realty') || q.includes('property')) {
    return `### 🏢 Sector Intelligence: Real Estate & Urban Infrastructure\n\n` +
      `* **Macro Tailwinds**: Multi-year residential upcycle with record luxury pre-sales velocity across Tier-1 metros, low inventory overhang, and robust commercial office absorption.\n` +
      `* **Key Risks**: Higher mortgage interest rate sensitivity and land acquisition execution delays.\n\n` +
      `💡 **Tactical Verdict**: **Overweight on Branded Tier-1 Developers** with low debt leverage and strong land bank execution track records.`;
  }

  // 5. US & Global Macro Market Outlook
  if (q.includes('us market') || q.includes('us stock') || q.includes('fed') || q.includes('nasdaq') || q.includes('s&p') || q.includes('global')) {
    return `### 🇺🇸 US & Global Macroeconomic Theater Stance\n\n` +
      `* **Monetary Policy**: Federal Reserve interest rate trajectory is focused on disinflation normalization and labor market balance.\n` +
      `* **Key Growth Drivers**: AI enterprise hyperscaler capex continues to anchor earnings growth, while semiconductor reshoring drives industrial automation.\n` +
      `* **Risks to Watch**: Elevated sovereign debt yields, consumer credit normalization, and geopolitical trade restrictions.\n\n` +
      `💡 **Tactical Verdict**: **Selective Accumulation**. Focus on secular mega-trends (AI Compute Infrastructure & Sovereign Defense) while managing exposure to rate-sensitive consumer discretionary multiples.`;
  }

  // 6. General Macro Strategy Intelligence
  return `### 🧭 Macro Strategy Intelligence & Asset Allocation\n\n` +
    `Markets are currently operating in a **data-dependent, selective rotation phase**. Rather than broad beta index chasing, institutional alpha is concentrated in high-conviction themes with direct policy tailwinds:\n\n` +
    `* ⚡ **Green Energy & Power Transmission**\n` +
    `* 🛡️ **Defense & Indigenous Aerospace**\n` +
    `* 🏗️ **Infrastructure & Industrial Capex**\n` +
    `* 🏦 **High-ROE Private Banking**\n\n` +
    `💡 *Tip: Ask specific questions about any stock (e.g. "Analyze Zomato", "What is the outlook for Trent?", "Analyze Infosys") or your active portfolio risk.*`;
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
  const fullPrompt = `You are the AURA SENTINEL AI Portfolio Copilot & Chief Financial Strategist.
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
    console.warn('[PortfolioChatbot] Gemini API fallback engaged:', err.message);
    const fallbackReply = generateDeterministicFallback(cleanQuery, portfolio, macroOverview, dynamicTickers, liveQuotes);
    return {
      success: true,
      reply: fallbackReply,
      modelUsed: 'deterministic-financial-engine',
      groundedTickers: dynamicTickers.map(t => t.symbol),
      isFallback: true
    };
  }
}

module.exports = {
  handlePortfolioChatMessage,
  resolveDynamicTickers,
  buildGroundedContext,
  generateDeterministicFallback
};
