/**
 * AURA SENTINEL — AI Portfolio Copilot & Macro Strategy Advisor
 * Dedicated LLM & RAG Engine for conversational portfolio diagnostics,
 * macro sector evaluations, and live stock intelligence.
 * 
 * Free Tier Guaranteed: Google Gemini 2.5/1.5 Flash via Google AI Studio.
 */

const https = require('https');
const financeApi = require('./financeApi');

const GEMINI_API_HOST = 'generativelanguage.googleapis.com';
const PRIMARY_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];

/**
 * Low-level HTTPS dispatcher for Google Gemini API
 */
function callGeminiRaw(contents, systemInstruction, model = 'gemini-2.5-flash') {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'PASTE_YOUR_KEY_HERE') {
      return reject(new Error('GEMINI_API_KEY not configured in environment'));
    }

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500,
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
async function invokeGeminiWithFallback(contents, systemInstruction) {
  let lastErr = null;
  for (const model of PRIMARY_MODELS) {
    try {
      const reply = await callGeminiRaw(contents, systemInstruction, model);
      return { reply, modelUsed: model };
    } catch (err) {
      console.warn(`[PortfolioChatbot] Model ${model} failed (${err.message}). Trying fallback...`);
      lastErr = err;
    }
  }
  throw lastErr || new Error('All Gemini models exhausted.');
}

/**
 * Extract stock tickers and company names mentioned in the user message
 */
function extractMentionedTickers(userQuery) {
  const q = (userQuery || '').toUpperCase();
  const knownKeywords = [
    { key: 'INFOSYS', sym: 'INFY.NS' },
    { key: 'INFY', sym: 'INFY.NS' },
    { key: 'TCS', sym: 'TCS.NS' },
    { key: 'TATA MOTORS', sym: 'TATAMOTORS.NS' },
    { key: 'TATAMOTORS', sym: 'TATAMOTORS.NS' },
    { key: 'TATA POWER', sym: 'TATAPOWER.NS' },
    { key: 'TATAPOWER', sym: 'TATAPOWER.NS' },
    { key: 'RELIANCE', sym: 'RELIANCE.NS' },
    { key: 'HDFC', sym: 'HDFCBANK.NS' },
    { key: 'HDFCBANK', sym: 'HDFCBANK.NS' },
    { key: 'ICICI', sym: 'ICICIBANK.NS' },
    { key: 'ICICIBANK', sym: 'ICICIBANK.NS' },
    { key: 'SBI', sym: 'SBIN.NS' },
    { key: 'SBIN', sym: 'SBIN.NS' },
    { key: 'L&T', sym: 'LT.NS' },
    { key: 'LT', sym: 'LT.NS' },
    { key: 'LARSEN', sym: 'LT.NS' },
    { key: 'HAL', sym: 'HAL.NS' },
    { key: 'BEL', sym: 'BEL.NS' },
    { key: 'BHARTI', sym: 'BHARTIARTL.NS' },
    { key: 'AIRTEL', sym: 'BHARTIARTL.NS' },
    { key: 'NTPC', sym: 'NTPC.NS' },
    { key: 'IREDA', sym: 'IREDA.NS' },
    { key: 'DLF', sym: 'DLF.NS' },
    { key: 'GODREJ', sym: 'GODREJPROP.NS' },
    { key: 'GVKPIL', sym: 'GVKPIL.NS' },
    { key: 'GVK', sym: 'GVKPIL.NS' },
    { key: 'ARCFIN', sym: '540135.BO' },
    { key: 'ARC FINANCE', sym: '540135.BO' },
    { key: 'JETAIRWAYS', sym: 'JETAIRWAYS.NS' },
    { key: 'JET AIRWAYS', sym: 'JETAIRWAYS.NS' },
    { key: 'NVDA', sym: 'NVDA' },
    { key: 'NVIDIA', sym: 'NVDA' },
    { key: 'TSLA', sym: 'TSLA' },
    { key: 'TESLA', sym: 'TSLA' },
    { key: 'AAPL', sym: 'AAPL' },
    { key: 'APPLE', sym: 'AAPL' },
    { key: 'MSFT', sym: 'MSFT' },
    { key: 'MICROSOFT', sym: 'MSFT' },
    { key: 'PLTR', sym: 'PLTR' },
    { key: 'PALANTIR', sym: 'PLTR' },
    { key: 'LMT', sym: 'LMT' }
  ];

  const matched = [];
  for (const item of knownKeywords) {
    const regex = new RegExp(`\\b${item.key.replace('&', '\\&')}\\b`, 'i');
    if (regex.test(q) && !matched.includes(item.sym)) {
      matched.push(item.sym);
    }
  }

  const stopWords = new Set([
    'WHAT', 'WHEN', 'WITH', 'FROM', 'THIS', 'THAT', 'HAVE', 'SHOULD', 'COULD', 'WOULD',
    'ABOUT', 'RIGHT', 'STOCK', 'STOCKS', 'INDIA', 'GLOBAL', 'SINGLE', 'BIGGEST', 'RISK',
    'RISKS', 'GOING', 'FUTURE', 'INVEST', 'INVESTING', 'INDIAN', 'SECTOR', 'SECTORS',
    'SUGGEST', 'MARKET', 'MARKETS', 'PRICE', 'PRICES', 'RETURN', 'RETURNS', 'HEALTH',
    'THEIR', 'WHICH', 'WHERE', 'THERE', 'MONEY', 'TODAY', 'TOMORROW', 'MONTH', 'YEAR',
    'FUNDS', 'INDEX', 'SHARE', 'SHARES', 'PORTFOLIO', 'HOLDINGS', 'COMPANIES', 'COMPANY',
    'TELL', 'KNOW', 'GOOD', 'BEST', 'HIGH', 'CALL', 'HELP', 'SHOW', 'WILL', 'THEM', 'SOME',
    'REAL', 'ESTATE', 'DEFENSE', 'DEFENCE', 'BANK', 'BANKS', 'TECH', 'AUTO', 'ENERGY'
  ]);

  const generalTickerRegex = /\b[A-Z]{3,7}(\.NS|\.BO)?\b/g;
  const rawMatches = q.match(generalTickerRegex) || [];
  for (const sym of rawMatches) {
    const cleanSym = sym.replace(/\.(NS|BO)$/i, '');
    if (!stopWords.has(cleanSym) && !stopWords.has(sym)) {
      if (!matched.includes(sym)) matched.push(sym);
    }
  }

  return matched.slice(0, 4);
}

/**
 * RAG Grounding Engine: Builds comprehensive institutional context
 */
async function buildGroundedContext({ userMessage, portfolio, region = 'india', macroOverview }) {
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
    macroDigest += `- Monetary Policy: Neutral/Data-dependent. Interest rates stabilizing.\n`;
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
      const qty = s.quantity || 0;
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

  // 3. Real-Time Exchange Quotes for Tickers Detected in Query
  const mentionedTickers = extractMentionedTickers(userMessage);
  if (mentionedTickers.length > 0) {
    let liveQuoteDigest = `### LIVE REAL-TIME EXCHANGE QUOTES (QUERIED TICKERS):\n`;
    for (const t of mentionedTickers) {
      try {
        const q = await financeApi.getStockQuoteAndChart(t, '1mo', '1d', region);
        if (q && q.regularMarketPrice > 0) {
          const symCur = q.currency === 'INR' ? '₹' : '$';
          liveQuoteDigest += `- ${q.symbol} (${q.shortName || t}): Live CMP = ${symCur}${q.regularMarketPrice} | Day Change = ${q.change >= 0 ? '+' : ''}${q.change} (${q.changePercent}%) | 52W High = ${symCur}${q.fiftyTwoWeekHigh || '--'} | 52W Low = ${symCur}${q.fiftyTwoWeekLow || '--'}\n`;
        }
      } catch (err) {
        // Silent catch for quote lookup
      }
    }
    contextParts.push(liveQuoteDigest);
  }

  return contextParts.join('\n\n');
}

/**
 * Deterministic Analytical Safety Fallback
 */
function generateDeterministicFallback(userMessage, portfolio, macroOverview) {
  const q = userMessage.toLowerCase();
  const stocksList = (portfolio?.stocks || portfolio?.holdings || []);

  // If user asks about their own portfolio
  if (portfolio && portfolio.summary && (q.includes('my portfolio') || q.includes('my stock') || q.includes('holdings') || q.includes('risk') || q.includes('returns'))) {
    const cur = portfolio.summary.currency || '₹';
    const totalVal = portfolio.summary.totalCurrentValue ?? portfolio.summary.currentValue ?? 0;
    const totalInv = portfolio.summary.totalInvested ?? portfolio.summary.invested ?? 0;
    const totalPnl = portfolio.summary.totalPnl ?? portfolio.summary.totalUnrealizedPnL ?? (totalVal - totalInv);
    const totalPnlPct = portfolio.summary.totalPnlPct ?? portfolio.summary.totalReturnPct ?? (totalInv > 0 ? Math.round(((totalVal - totalInv) / totalInv) * 10000) / 100 : 0);
    const resilienceScore = portfolio.summary.macroResilienceScore ?? portfolio.summary.healthScore ?? 75;
    const resilienceRating = portfolio.summary.resilienceRating ?? portfolio.summary.riskLevel ?? 'AA BALANCED';

    const topStock = stocksList[0];
    const distressed = stocksList.filter(s => (s.pnlPct ?? s.unrealizedPnLPct ?? 0) < -30);
    
    let res = `### 📊 Portfolio Macro Diagnostic Brief:\n\n`;
    res += `* **Total Valuation**: Your portfolio is currently valued at **${cur}${Number(totalVal).toLocaleString('en-IN')}** against an invested capital base of **${cur}${Number(totalInv).toLocaleString('en-IN')}** (Net Returns: **${totalPnl >= 0 ? '+' : ''}${cur}${Number(totalPnl).toLocaleString('en-IN')} / ${totalPnlPct}%**).\n`;
    res += `* **Resilience Score**: Rated at **${resilienceScore}/100 (${resilienceRating})**.\n`;
    
    if (distressed.length > 0) {
      res += `* **Capital Erosion Watchlist**: ${distressed.map(d => `**${d.symbol}** (${d.pnlPct ?? d.unrealizedPnLPct}%)`).join(', ')} require active stop-loss monitoring due to heavy drawdowns.\n`;
    }
    if (topStock) {
      const topSym = topStock.symbol || topStock.ticker || 'Top Asset';
      const topWt = topStock.portfolioWeight ?? topStock.weight ?? '--';
      res += `* **Top Allocation**: **${topSym}** represents **${topWt}%** of your equity exposure.\n`;
    }
    res += `\n*Actionable Takeaway*: Review sector diversification to balance cyclical risks against macro policy tailwinds.`;
    return res;
  }

  // If user asks about defense sector
  if (q.includes('defence') || q.includes('defense') || q.includes('hal') || q.includes('bel')) {
    return `### 🛡️ Indian Defense & Aerospace Sector Outlook:\n\n` +
      `* **Macro Tailwinds**: Strong sovereign defense budget allocation, multi-year export order books for fighter aircraft (LCA Tejas), radar systems, and indigenous naval platforms.\n` +
      `* **Key Bellwethers**: **HAL (Hindustan Aeronautics)** and **BEL (Bharat Electronics)** maintain robust order backlogs exceeding 3x annual revenues.\n` +
      `* **Tactical Verdict**: **Bullish / Growth Compounder** on dips, with strong sovereign earnings visibility through 2028.`;
  }

  // If user asks about US market
  if (q.includes('us market') || q.includes('us stock') || q.includes('fed') || q.includes('nasdaq') || q.includes('s&p')) {
    return `### 🇺🇸 US & Global Market Stance:\n\n` +
      `* **Monetary Policy**: Federal Reserve interest rate trajectory is focused on inflation moderation and labor market equilibrium.\n` +
      `* **Key Growth Drivers**: AI enterprise hyperscaler capex (**NVDA**, **MSFT**, **TSM**) continues to anchor tech earnings.\n` +
      `* **Tactical Verdict**: Selective accumulation on structural mega-trends (AI Infrastructure & Defense); manage exposure to high-multiple consumer cyclicals.`;
  }

  // General fallback
  return `### 🧭 Macro Strategy Intelligence:\n\n` +
    `Markets are currently operating in a **data-dependent, selective rotation phase**. Focus on equities with strong balance sheets, pricing power, and clear policy tailwinds (e.g., Infrastructure, Green Energy, Defense, and High-ROE Financials).\n\n` +
    `*Tip: You can ask specific questions about individual stocks (e.g., "Analyze Infosys" or "What is the turnaround thesis for GVKPIL?").*`;
}

/**
 * Main Controller: Handle incoming user chat queries
 */
async function handlePortfolioChatMessage({ userMessage, history = [], portfolio = null, region = 'india', macroOverview = null }) {
  if (!userMessage || !userMessage.trim()) {
    throw new Error('User message query is required.');
  }

  const cleanQuery = userMessage.trim();

  // 1. Build RAG Grounded Context
  const groundedContext = await buildGroundedContext({
    userMessage: cleanQuery,
    portfolio,
    region,
    macroOverview
  });

  // 2. Build Structured System Instructions
  const systemInstruction = `You are the AURA SENTINEL AI Portfolio Copilot & Chief Financial Strategist.
You provide institutional-grade macroeconomic intelligence, stock evaluations, sector allocation guidance, and portfolio risk management advisory.

DATA GROUNDING & REAL-TIME CONTEXT:
${groundedContext}

CORE INSTRUCTIONS & RESPONSE FORMAT:
1. Ground every answer in the real-time context provided above (live CMPs, monetary policy stance, user holdings, and sector scores).
2. If the user asks about their portfolio, quote exact figures (Total Value, P&L %, Health scores, specific stock weights, and risk verdicts).
3. If the user asks about specific stocks or sectors, break down:
   - **Current Market Trajectory (CMP & Momentum)**
   - **Core Macro Catalysts & Earnings Drivers**
   - **Key Downside Risks & Valuation Considerations**
   - **Tactical Strategy / Actionable Takeaway**
4. Maintain an elite, objective, Wall Street / Bloomberg Terminal tone.
5. Use clear markdown headers, bolding for ticker symbols and currency amounts, and structured bullet points for readability.
6. Provide clear educational and risk management framing (stop-loss discipline, diversification principles).`;

  // 3. Format Conversation History for Gemini Multi-Turn
  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    const recentHistory = history.slice(-6); // Last 3 user/model turns
    for (const turn of recentHistory) {
      if (turn.role === 'user' || turn.role === 'model') {
        contents.push({
          role: turn.role,
          parts: [{ text: String(turn.text || '') }]
        });
      }
    }
  }

  // Add the current user query
  contents.push({
    role: 'user',
    parts: [{ text: cleanQuery }]
  });

  // 4. Invoke Gemini with Fallback
  try {
    const { reply, modelUsed } = await invokeGeminiWithFallback(contents, systemInstruction);
    return {
      success: true,
      reply,
      modelUsed,
      groundedTickers: extractMentionedTickers(cleanQuery)
    };
  } catch (err) {
    console.warn('[PortfolioChatbot] Gemini API unavailable or quota limit reached. Using deterministic safety engine:', err.message);
    const fallbackReply = generateDeterministicFallback(cleanQuery, portfolio, macroOverview);
    return {
      success: true,
      reply: fallbackReply,
      modelUsed: 'deterministic-financial-engine',
      groundedTickers: extractMentionedTickers(cleanQuery),
      isFallback: true
    };
  }
}

module.exports = {
  handlePortfolioChatMessage,
  extractMentionedTickers,
  buildGroundedContext
};
