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
 * Knowledge Base for Institutional Equity & Sector Coverage
 */
const STOCK_INTELLIGENCE_REGISTRY = {
  'INFY.NS': {
    name: 'Infosys Limited',
    sector: 'Information Technology / Enterprise Cloud',
    thesis: 'Global digital transformation powerhouse with rapid enterprise AI adoption via Topaz platform and expanding large deal contract pipeline ($10B+ TCV). Resilient operating margins with strong Rupee depreciation hedging.',
    catalysts: 'Accelerating AI workflow integration, cost-efficiency deal consolidation in Europe/US, and dividend/buyback capital returns.',
    risks: 'Discretionary enterprise IT budget deferrals among US BFSI clients and high-skilled wage inflation.',
    verdict: 'Accumulate on Dips / Long-Term Compounding Leader',
    macroFit: 'Export Technology & Dollar Earner'
  },
  'TATAMOTORS.NS': {
    name: 'Tata Motors Limited',
    sector: 'Automotive & Electric Mobility',
    thesis: 'Domestic passenger vehicle market share leader in Electric Vehicles (4W EV) coupled with high-margin Jaguar Land Rover (JLR) order book recovery and profitable commercial vehicle fleet modernization.',
    catalysts: 'Demerger into separate Commercial & Passenger Vehicle entities unlocking shareholder value, battery localization via Agratas, and new EV model launches (Curvv, Harrier EV).',
    risks: 'European EV market competition, global luxury tariff exposures, and raw material lithium/semiconductor lead times.',
    verdict: 'Bullish / Cyclical Structural Outperformer',
    macroFit: 'Domestic Consumption & Clean Energy Mobility'
  },
  'RELIANCE.NS': {
    name: 'Reliance Industries Limited',
    sector: 'Energy, Retail & Telecommunications',
    thesis: 'Diversified mega-conglomerate with stable cash flows from Oil-to-Chemicals (O2C) funding hyper-growth in Jio 5G monetisation, nationwide retail network expansion, and multi-gigawatt Green Energy Gigafactories in Jamnagar.',
    catalysts: 'Potential value-unlocking IPO listings for Reliance Retail and Jio, solar module manufacturing commencement, and 5G tariff ARPU hikes.',
    risks: 'Global crude gross refining margin (GRM) volatility and high capital expenditure payback timelines.',
    verdict: 'Core Portfolio Anchor / High-Resilience Bluechip',
    macroFit: 'Indian Macro GDP & Energy Transition Bellwether'
  },
  'TATAPOWER.NS': {
    name: 'Tata Power Company Limited',
    sector: 'Utilities & Renewable Generation',
    thesis: 'Integrated utility transition leader aggressively expanding utility-scale solar/wind portfolios, dominating rooftop solar installations under PM Surya Ghar Yojana, and building India-wide public EV charging infrastructure.',
    catalysts: 'Exponential renewable capacity additions targeting 500 GW national target and robust transmission grid project wins.',
    risks: 'Transmission line right-of-way permissions and state power distribution company (DISCOM) payment delays.',
    verdict: 'Growth Compounder on Energy Transition',
    macroFit: 'Clean Energy & Industrial Power Demand'
  },
  'HDFCBANK.NS': {
    name: 'HDFC Bank Limited',
    sector: 'Banking & Financial Services',
    thesis: 'India’s premier private lender benefiting from post-merger branch distribution scale, low-cost CASA deposit mobilization, pristine non-performing asset (NPA) quality, and expanding corporate lending.',
    catalysts: 'Credit-to-deposit (LDR) ratio normalization, margin expansion, and steady double-digit credit growth in retail mortgages.',
    risks: 'Net interest margin (NIM) compression during interest rate transition cycles.',
    verdict: 'Strong Buy / Premier Compounding Anchor',
    macroFit: 'Credit Growth & Sovereign GDP Multiplier'
  },
  'SBIN.NS': {
    name: 'State Bank of India',
    sector: 'Public Sector Banking',
    thesis: 'Largest financial institution with massive corporate lending pipeline in national infrastructure and energy projects, multi-decade low gross NPAs, and unmatched retail reach through YONO app.',
    catalysts: 'Sovereign infrastructure capex acceleration and expanding return on equity (ROE > 16%).',
    risks: 'Priority sector provisioning requirements during economic stress cycles.',
    verdict: 'Value Accumulate / Sovereign Credit Engine',
    macroFit: 'National Infrastructure & Capital Investment'
  },
  'LT.NS': {
    name: 'Larsen & Toubro Limited',
    sector: 'Infrastructure & Capital Goods',
    thesis: 'Uncontested infrastructure titan with an all-time record order book exceeding ₹4.7+ Lakh Crores across domestic rail, Middle East energy/hydrocarbons, semiconductors, and green hydrogen electrolyzers.',
    catalysts: 'Multi-year public capex push across transport, water, defense, and high-tech manufacturing.',
    risks: 'Fixed-price contract cost overruns from steel/cement inflation and Middle East geopolitical stability.',
    verdict: 'Institutional Core Holding / Macro Titan',
    macroFit: 'Direct National Infrastructure Proxy'
  },
  'HAL.NS': {
    name: 'Hindustan Aeronautics Limited',
    sector: 'Defense & Aerospace',
    thesis: 'Monopoly sovereign defense platform supplier with multi-year order backlog for LCA Tejas Mk1A, Su-30MKI upgrades, and Light Combat Helicopters (Prachand). Backed by Defense Acquisition Council indigenization mandates.',
    catalysts: 'Export order wins to friendly foreign nations and indigenous aero-engine technology transfer.',
    risks: 'US GE-F404 engine supply delivery schedules and PSU execution milestones.',
    verdict: 'Strategic Growth Asset / Multi-Year Order Compounder',
    macroFit: 'Make in India & Geopolitical Re-Armament'
  },
  'BEL.NS': {
    name: 'Bharat Electronics Limited',
    sector: 'Defense Electronics & Avionics',
    thesis: 'Dominant Navratna defense electronics manufacturer with order book exceeding 3x annual revenues across airborne radars, missile electronic suites (Akash, QRSAM), anti-drone defense systems, and smart rail telemetry.',
    catalysts: 'Surging electronic content in sovereign weapons platforms and expanding civil aerospace orders.',
    risks: 'Semiconductor component import lead times and contract billing cycles.',
    verdict: 'High-Conviction Defensive Compounder',
    macroFit: 'Defense Modernization & Electronic Warfare'
  },
  'DLF.NS': {
    name: 'DLF Limited',
    sector: 'Real Estate & Urban Development',
    thesis: 'Leading premium real estate developer witnessing unprecedented luxury residential pre-sales velocity, low leverage balance sheet, and recurring rental income expansion from DLF CyberCity (DCCDL) office assets.',
    catalysts: 'New luxury project pipeline in NCR, high cash generation, and rising rental yields.',
    risks: 'Interest rate sensitive housing demand and municipal land acquisition timelines.',
    verdict: 'Top Tier Real Estate Play / Cyclical Leader',
    macroFit: 'Urbanization & High-Net-Worth Wealth Creation'
  },
  'GVKPIL.NS': {
    name: 'GVK Power & Infrastructure Ltd',
    sector: 'Infrastructure & Special Situations',
    thesis: 'Special situations and debt restructuring turnaround play in transportation and power generation assets. Subject to corporate resolution processes and asset liquidation recovery valuations.',
    catalysts: 'Debt resolution agreements, court settlements, and infrastructure asset monetisation.',
    risks: 'High speculative volatility, liquidity constraints, and debt overhang.',
    verdict: 'High-Risk Speculative Turnaround / Active Stop-Loss Required',
    macroFit: 'Stressed Asset Resolution'
  },
  'NVDA': {
    name: 'NVIDIA Corporation',
    sector: 'Semiconductors & AI Accelerated Compute',
    thesis: 'Global monopoly in GPU hardware (Blackwell B200 / Hopper) and CUDA software ecosystem powering all major AI hyperscalers (Microsoft, Meta, Google, AWS, Oracle).',
    catalysts: 'Multi-hundred billion dollar global AI datacenter capital expenditure wave and sovereign AI infrastructure builds.',
    risks: 'China export control restrictions and high baseline valuation expectations.',
    verdict: 'Generational AI Infrastructure Leader',
    macroFit: 'Global AI Capex Mega-Trend'
  }
};

/**
 * Extract stock tickers and company names mentioned in the user message
 */
function extractMentionedTickers(userQuery) {
  if (!userQuery) return [];
  const qUpper = userQuery.toUpperCase();
  const knownKeywords = [
    { key: 'INFOSYS', sym: 'INFY.NS' },
    { key: 'INFY', sym: 'INFY.NS' },
    { key: 'TCS', sym: 'TCS.NS' },
    { key: 'TATA MOTORS', sym: 'TATAMOTORS.NS' },
    { key: 'TATAMOTORS', sym: 'TATAMOTORS.NS' },
    { key: 'TATA POWER', sym: 'TATAPOWER.NS' },
    { key: 'TATAPOWER', sym: 'TATAPOWER.NS' },
    { key: 'RELIANCE', sym: 'RELIANCE.NS' },
    { key: 'HDFC BANK', sym: 'HDFCBANK.NS' },
    { key: 'HDFCBANK', sym: 'HDFCBANK.NS' },
    { key: 'HDFC', sym: 'HDFCBANK.NS' },
    { key: 'ICICI BANK', sym: 'ICICIBANK.NS' },
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
    if (regex.test(userQuery) && !matched.includes(item.sym)) {
      matched.push(item.sym);
    }
  }

  // Explicit symbols with exchange suffixes like INFY.NS, 540135.BO
  const exchangeMatches = userQuery.match(/\b[A-Za-z0-9_]{2,10}\.(NS|BO)\b/gi) || [];
  for (const sym of exchangeMatches) {
    const u = sym.toUpperCase();
    if (!matched.includes(u)) matched.push(u);
  }

  // Explicit known uppercase symbols in query
  const explicitCaps = userQuery.match(/\b[A-Z]{2,6}\b/g) || [];
  const validCapsTickers = new Set(['NVDA', 'TSLA', 'AAPL', 'MSFT', 'PLTR', 'LMT', 'TSM', 'ASML', 'CCJ', 'LLY', 'NVO', 'INFY', 'TCS', 'SBIN', 'HAL', 'BEL', 'NTPC', 'DLF', 'ITC', 'LT']);
  for (const sym of explicitCaps) {
    if (validCapsTickers.has(sym)) {
      const fullSym = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'PLTR', 'LMT', 'TSM', 'ASML', 'CCJ', 'LLY', 'NVO'].includes(sym) ? sym : `${sym}.NS`;
      if (!matched.includes(fullSym)) matched.push(fullSym);
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
    macroDigest += `- Monetary Policy: RBI Repo Rate steady; Liquidity neutral with structural growth in domestic retail participation.\n`;
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

  // 3. Real-Time Exchange Quotes for Tickers Detected in Query
  const mentionedTickers = extractMentionedTickers(userMessage);
  const liveQuotes = {};
  if (mentionedTickers.length > 0) {
    let liveQuoteDigest = `### LIVE REAL-TIME EXCHANGE QUOTES (QUERIED TICKERS):\n`;
    for (const t of mentionedTickers) {
      try {
        const q = await financeApi.getStockQuoteAndChart(t, '1mo', '1d', region);
        if (q && q.regularMarketPrice > 0) {
          liveQuotes[t] = q;
          const symCur = q.currency === 'INR' ? '₹' : '$';
          liveQuoteDigest += `- ${q.symbol} (${q.shortName || t}): Live CMP = ${symCur}${q.regularMarketPrice} | Day Change = ${q.change >= 0 ? '+' : ''}${q.change} (${q.changePercent}%) | 52W High = ${symCur}${q.fiftyTwoWeekHigh || '--'} | 52W Low = ${symCur}${q.fiftyTwoWeekLow || '--'}\n`;
        }
      } catch (err) {
        // Silent catch for quote lookup
      }
    }
    contextParts.push(liveQuoteDigest);
  }

  return {
    groundedContextText: contextParts.join('\n\n'),
    mentionedTickers,
    liveQuotes
  };
}

/**
 * Rich Deterministic Financial Safety Engine
 * Produces institutional, dynamic, stock-specific & macro-specific answers even if Gemini is throttled.
 */
function generateDeterministicFallback(userMessage, portfolio, macroOverview, mentionedTickers = [], liveQuotes = {}) {
  const q = userMessage.toLowerCase();
  const stocksList = (portfolio?.stocks || portfolio?.holdings || []);

  // 1. Portfolio Risk, Health, or Capital Erosion Query (Prioritize if user asks about their own portfolio)
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

  // 2. Specific Stock Inquiry (e.g. Infosys, Tata Motors, Reliance, DLF, etc.)
  for (const t of mentionedTickers) {
    const intel = STOCK_INTELLIGENCE_REGISTRY[t] || STOCK_INTELLIGENCE_REGISTRY[`${t}.NS`];
    const liveQ = liveQuotes[t] || liveQuotes[`${t}.NS`];
    const heldStock = stocksList.find(s => s.symbol === t || s.symbol === `${t}.NS` || s.symbol?.replace('.NS', '') === t.replace('.NS', ''));

    if (intel || liveQ || heldStock) {
      const sym = liveQ?.symbol || heldStock?.symbol || t;
      const name = intel?.name || heldStock?.companyName || liveQ?.shortName || sym;
      const cur = (liveQ?.currency === 'USD' || !sym.endsWith('.NS')) && !sym.includes('.BO') ? '$' : '₹';
      const cmp = liveQ?.regularMarketPrice || heldStock?.currentPrice || heldStock?.cmp || '--';
      const dayChg = liveQ ? `${liveQ.change >= 0 ? '+' : ''}${liveQ.changePercent}%` : '--';
      const range52 = liveQ?.fiftyTwoWeekHigh ? `${cur}${liveQ.fiftyTwoWeekLow} - ${cur}${liveQ.fiftyTwoWeekHigh}` : 'Active Trading Range';

      let out = `### 📈 Comprehensive Equity Diagnostic: **${name} (${sym})**\n\n`;
      out += `* **Live CMP & Momentum**: **${cur}${cmp}** (Day Change: **${dayChg}** | 52-Week Range: **${range52}**)\n`;
      
      if (heldStock) {
        const hQty = heldStock.quantity || heldStock.shares || '--';
        const hBuy = heldStock.buyPrice || heldStock.avgBuyPrice || '--';
        const hPnl = heldStock.pnl ?? heldStock.unrealizedPnL ?? 0;
        const hPnlPct = heldStock.pnlPct ?? heldStock.unrealizedPnLPct ?? '--';
        const hWt = heldStock.portfolioWeight ?? heldStock.weight ?? '--';
        out += `* **Portfolio Position**: You hold **${hQty} shares** (Avg Buy: **${cur}${hBuy}** | Unrealized P&L: **${hPnl >= 0 ? '+' : ''}${cur}${hPnl} / ${hPnlPct}%** | Weight: **${hWt}%**).\n`;
      }

      if (intel) {
        out += `* **Core Growth Catalysts**: ${intel.thesis}\n`;
        out += `* **Upcoming Triggers**: ${intel.catalysts}\n`;
        out += `* **Downside Risk Factors**: ${intel.risks}\n`;
        out += `* **Institutional Verdict**: **${intel.verdict}** (Macro Fit: *${intel.macroFit}*).\n\n`;
        out += `💡 **Tactical Takeaway**: Ideal for staggered entry or accumulation on support pullbacks with prudent portfolio position sizing (max 5–8% equity allocation).`;
      } else {
        out += `* **Market Thesis**: Liquid institutional asset exhibiting active daily exchange participation.\n`;
        out += `* **Actionable Guidance**: Maintain strict risk-reward discipline and monitor upcoming quarterly earnings releases and macro sector tailwinds.`;
      }

      return out;
    }
  }

  // 2. Indian Market Outlook / Timing / Entry Question
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

  // 3. Indian Defense Sector Outlook
  if (q.includes('defence') || q.includes('defense') || q.includes('hal') || q.includes('bel')) {
    return `### 🛡️ Sector Intelligence: Indian Defense & Aerospace\n\n` +
      `* **Macro Tailwinds**: Strong sovereign defense budget allocation, multi-year export order books for fighter aircraft (LCA Tejas Mk1A), radar systems, naval combat suites, and anti-drone electronics.\n` +
      `* **Key Bellwethers**: **HAL (Hindustan Aeronautics)** and **BEL (Bharat Electronics)** maintain robust order backlogs exceeding 3x annual revenues with sovereign visibility through 2028.\n` +
      `* **Downside Risks**: Supply chain delays for foreign components (e.g. US GE jet engines) and periodic PSU execution timelines.\n\n` +
      `💡 **Tactical Verdict**: **Bullish / Growth Compounder**. Accumulate leading defense innovators on price consolidation with a 3–5 year investment horizon.`;
  }

  // 4. Real Estate & Urban Infrastructure Outlook
  if (q.includes('real estate') || q.includes('realty') || q.includes('property') || q.includes('dlf') || q.includes('godrej')) {
    return `### 🏢 Sector Intelligence: Indian Real Estate & Urban Infrastructure\n\n` +
      `* **Macro Tailwinds**: Multi-year residential upcycle with record luxury pre-sales velocity across Tier-1 metros (NCR, Mumbai, Bangalore), low inventory overhang, and robust commercial office absorption (GCC expansion).\n` +
      `* **Top Quality Picks**: **DLF Limited (DLF.NS)**, **Godrej Properties (GODREJPROP.NS)**, and **Oberoi Realty**.\n` +
      `* **Key Risks**: Higher mortgage interest rate sensitivity and land acquisition execution delays.\n\n` +
      `💡 **Tactical Verdict**: **Overweight on Branded Tier-1 Developers** with low debt leverage and strong land bank execution track records.`;
  }

  // 5. US & Global Macro Market Outlook
  if (q.includes('us market') || q.includes('us stock') || q.includes('fed') || q.includes('nasdaq') || q.includes('s&p') || q.includes('global')) {
    return `### 🇺🇸 US & Global Macroeconomic Theater Stance\n\n` +
      `* **Monetary Policy**: Federal Reserve interest rate trajectory is focused on disinflation normalization and labor market balance.\n` +
      `* **Key Growth Drivers**: AI enterprise hyperscaler capex (**NVDA**, **MSFT**, **TSM**, **AMZN**) continues to anchor earnings growth, while semiconductor reshoring drives industrial automation.\n` +
      `* **Risks to Watch**: Elevated sovereign debt yields, consumer credit normalization, and geopolitical trade restrictions.\n\n` +
      `💡 **Tactical Verdict**: **Selective Accumulation**. Focus on secular mega-trends (AI Compute Infrastructure & Sovereign Defense) while managing exposure to rate-sensitive consumer discretionary multiples.`;
  }

  // 6. User Portfolio Risk & Health Diagnostic
  if (portfolio && portfolio.summary && (q.includes('my portfolio') || q.includes('my stock') || q.includes('holdings') || q.includes('risk') || q.includes('returns') || q.includes('capital erosion') || q.includes('health'))) {
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

  // 7. General Macro Strategy Intelligence
  return `### 🧭 Macro Strategy Intelligence & Asset Allocation\n\n` +
    `Markets are currently operating in a **data-dependent, selective rotation phase**. Rather than broad beta index chasing, institutional alpha is concentrated in high-conviction themes with direct policy tailwinds:\n\n` +
    `* ⚡ **Green Energy & Power Transmission**: *Tata Power, NTPC Green, IREDA*\n` +
    `* 🛡️ **Defense & Indigenous Aerospace**: *HAL, BEL*\n` +
    `* 🏗️ **Infrastructure & Industrial Capex**: *Larsen & Toubro, Siemens*\n` +
    `* 🏦 **High-ROE Private Banking**: *HDFC Bank, ICICI Bank, SBI*\n\n` +
    `💡 *Tip: Ask specific questions about any stock (e.g. "Analyze Infosys", "Is Tata Motors a good buy?", "Analyze DLF") or your active portfolio risk.*`;
}

/**
 * Main Controller: Handle incoming user chat queries
 */
async function handlePortfolioChatMessage({ userMessage, history = [], portfolio = null, region = 'india', macroOverview = null }) {
  if (!userMessage || !userMessage.trim()) {
    throw new Error('User message query is required.');
  }

  const cleanQuery = userMessage.trim();

  // 1. Build RAG Grounded Context & Extract Tickers
  const { groundedContextText, mentionedTickers, liveQuotes } = await buildGroundedContext({
    userMessage: cleanQuery,
    portfolio,
    region,
    macroOverview
  });

  // 2. Format Conversation History
  let conversationHistoryText = '';
  if (Array.isArray(history) && history.length > 0) {
    const recent = history.slice(-6);
    conversationHistoryText = recent.map(t => `${t.role === 'user' ? 'USER' : 'AURA_SENTINEL'}: ${t.text}`).join('\n');
  }

  // 3. Build Full Unified Prompt for Google Gemini
  const fullPrompt = `You are the AURA SENTINEL AI Portfolio Copilot & Chief Financial Strategist.
You deliver elite, institutional-grade macroeconomic intelligence, stock evaluations, sector allocation guidance, and portfolio risk management advisory.

REAL-TIME GROUNDED CONTEXT & MARKET DATA:
${groundedContextText}

${conversationHistoryText ? `RECENT CONVERSATION HISTORY:\n${conversationHistoryText}\n` : ''}

USER QUESTION:
"${cleanQuery}"

INSTRUCTIONS & RESPONSE FORMAT:
1. Provide a direct, highly customized answer specifically tailored to the user's question. DO NOT give generic or repetitive responses.
2. If the user asks about a specific stock (e.g. Infosys, Tata Motors, Reliance, DLF, etc.), provide:
   - **Current Market Trajectory (CMP & Momentum)**
   - **Core Macro Catalysts & Earnings Growth Drivers**
   - **Key Downside Risks & Valuation Considerations**
   - **Tactical Strategy & Actionable Takeaway**
3. If the user asks about market timing / macro entry (e.g. "is it good time to invest in Indian stock market"), explain the current macro regime, GDP drivers, RBI stance, valuation levels, and the best staggered allocation strategy.
4. If the user asks about their portfolio, cite exact figures (Value, Returns %, concentration weight, resilience rating, and drawdown stocks).
5. Maintain a sharp, objective Wall Street / Bloomberg Terminal tone with structured markdown headers and bolding for key metrics.`;

  // 4. Invoke Gemini with Fallback
  try {
    const { reply, modelUsed } = await invokeGeminiWithFallback(fullPrompt);
    return {
      success: true,
      reply,
      modelUsed,
      groundedTickers: mentionedTickers
    };
  } catch (err) {
    console.warn('[PortfolioChatbot] Gemini API fallback engaged:', err.message);
    const fallbackReply = generateDeterministicFallback(cleanQuery, portfolio, macroOverview, mentionedTickers, liveQuotes);
    return {
      success: true,
      reply: fallbackReply,
      modelUsed: 'deterministic-financial-engine',
      groundedTickers: mentionedTickers,
      isFallback: true
    };
  }
}

module.exports = {
  handlePortfolioChatMessage,
  extractMentionedTickers,
  buildGroundedContext,
  generateDeterministicFallback,
  STOCK_INTELLIGENCE_REGISTRY
};
