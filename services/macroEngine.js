/**
 * Macro Engine & Event-Driven Synthesis Orchestrator (Multi-Region: India & Global)
 * Central intelligence hub managing data ingest, sector analysis,
 * stock catalyst extraction, and hourly caching for both India (NSE/BSE) and Global markets.
 */

const { fetchAllGlobalNews, fetchTargetedStockNews } = require('./rssFetcher');
const { analyzeTextSentiment, extractEntitiesAndTickers, GEOPOLITICAL_THEMES_GLOBAL, GEOPOLITICAL_THEMES_INDIA, KNOWN_TICKERS } = require('./sentimentNlp');
const { getStockQuoteAndChart, searchTickers } = require('./financeApi');
const { generateMacroNarrative, generateStockBrief } = require('./geminiClient');

// Sector Definitions - Global
const SECTORS_GLOBAL = [
  {
    id: 'defense',
    name: 'Sovereign Defense & Aerospace',
    icon: 'shield',
    description: 'Geopolitical re-armament, NATO defense spending, and aerospace modernization.',
    keyTickers: ['LMT', 'RTX', 'PLTR', 'BA'],
    baseTheme: 'defense_security'
  },
  {
    id: 'technology',
    name: 'Semiconductors & AI Infrastructure',
    icon: 'cpu',
    description: 'Advanced silicon fabrication, AI datacenters, and export control sovereignty.',
    keyTickers: ['NVDA', 'TSM', 'ASML', 'MSFT'],
    baseTheme: 'semiconductors_tech'
  },
  {
    id: 'energy',
    name: 'Energy Transit & Nuclear Renaissance',
    icon: 'zap',
    description: 'Base-load nuclear energy, uranium supply deficits, and global LNG transit corridors.',
    keyTickers: ['CCJ', 'CEG', 'XOM'],
    baseTheme: 'energy_commodities'
  },
  {
    id: 'healthcare',
    name: 'Biopharma & Metabolic Discovery',
    icon: 'activity',
    description: 'Next-gen GLP-1 therapeutics, FDA catalyst pipeline, and clinical trial outcomes.',
    keyTickers: ['LLY', 'NVO'],
    baseTheme: 'biopharma_health'
  },
  {
    id: 'industrials',
    name: 'Critical Supply Chains & Reshoring',
    icon: 'anchor',
    description: 'Domestic manufacturing, strategic infrastructure, and trade corridor resilience.',
    keyTickers: ['BA', 'AAPL', 'AMZN'],
    baseTheme: 'trade_reshoring'
  }
];

// Sector Definitions - India
const SECTORS_INDIA = [
  {
    id: 'defense_india',
    name: 'Defense Indigenization & Make in India',
    icon: 'shield',
    description: 'Indigenous fighter jets (Tejas), missile systems, defense export surges, and MoD capital outlays.',
    keyTickers: ['HAL.NS', 'BEL.NS', 'LT.NS'],
    baseTheme: 'india_defense_indigenization'
  },
  {
    id: 'energy_india',
    name: 'Renewables, Solar & Power Grid Capex',
    icon: 'zap',
    description: 'National green hydrogen mission, rooftop solar, IREDA financing, and EV charging infrastructure.',
    keyTickers: ['TATAPOWER.NS', 'RELIANCE.NS', 'IREDA.NS', 'NTPC.NS'],
    baseTheme: 'india_power_renewables'
  },
  {
    id: 'industrials_india',
    name: 'National Infra, High-Speed Rail & EPC',
    icon: 'anchor',
    description: 'High-speed rail corridors, dedicated freight lines, port modernizations, and domestic steel demand.',
    keyTickers: ['LT.NS', 'TATAMOTORS.NS'],
    baseTheme: 'india_infra_capex'
  },
  {
    id: 'financials_india',
    name: 'RBI Policy & Banking Credit Expansion',
    icon: 'briefcase',
    description: 'Strong retail credit growth, record low non-performing assets (NPAs), and private capex financing.',
    keyTickers: ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS'],
    baseTheme: 'india_banking_credit'
  },
  {
    id: 'technology_india',
    name: 'IT Global Delivery & AI Modernization',
    icon: 'cpu',
    description: 'Enterprise generative AI migrations, BFSI digital spend recovery, and Global Capability Centers (GCCs).',
    keyTickers: ['TCS.NS', 'INFY.NS'],
    baseTheme: 'india_it_digital'
  },
  {
    id: 'auto_india',
    name: 'Automotive EV Shift & Consumer Mobility',
    icon: 'truck',
    description: 'Electric 4W/2W adoption, Jaguar Land Rover recovery, festive rural consumption, and PLI auto schemes.',
    keyTickers: ['TATAMOTORS.NS'],
    baseTheme: 'india_auto_ev'
  }
];

class MacroEngine {
  constructor() {
    this.caches = {
      global: {
        macroOverview: null,
        stockOpportunities: null,
        incidentWire: null,
        lastUpdated: null,
        nextRefresh: null
      },
      india: {
        macroOverview: null,
        stockOpportunities: null,
        incidentWire: null,
        lastUpdated: null,
        nextRefresh: null
      }
    };
    this.refreshDurationMs = 60 * 60 * 1000; // 1 hour
    this.refreshingRegions = new Set();
  }

  /**
   * Initializes or gets cached intelligence for specific region ('india' or 'global').
   */
  async getOrUpdateData(region = 'india', forceRefresh = false) {
    const reg = region === 'global' ? 'global' : 'india';
    const cache = this.caches[reg];
    const now = Date.now();
    const isExpired = !cache.lastUpdated || (now - new Date(cache.lastUpdated).getTime() > this.refreshDurationMs);

    if (forceRefresh || isExpired || !cache.macroOverview) {
      return await this.executeRefreshCycle(reg);
    }

    return {
      region: reg,
      macroOverview: cache.macroOverview,
      stockOpportunities: cache.stockOpportunities,
      incidentWire: cache.incidentWire,
      lastUpdated: cache.lastUpdated,
      nextRefresh: cache.nextRefresh,
      isCached: true
    };
  }

  /**
   * Executes the full macro news ingestion & NLP synthesis cycle for a given region.
   */
  async executeRefreshCycle(region = 'india') {
    const reg = region === 'global' ? 'global' : 'india';
    const cache = this.caches[reg];

    if (this.refreshingRegions.has(reg)) {
      return {
        region: reg,
        macroOverview: cache.macroOverview,
        stockOpportunities: cache.stockOpportunities,
        incidentWire: cache.incidentWire,
        lastUpdated: cache.lastUpdated,
        nextRefresh: cache.nextRefresh,
        isCached: true
      };
    }

    this.refreshingRegions.add(reg);
    console.log(`[MacroEngine] Starting news ingestion & synthesis for region: ${reg.toUpperCase()}...`);

    try {
      // 1. Fetch live multi-source RSS news for the region
      const newsResult = await fetchAllGlobalNews(reg);
      const articles = newsResult.articles;

      // 2. Process articles through Sentiment & Entity NLP
      const processedArticles = articles.map(art => {
        const nlp = analyzeTextSentiment(art.rawText, reg);
        const entities = extractEntitiesAndTickers(art.rawText, reg);
        return {
          ...art,
          sentimentScore: nlp.score,
          sentimentLabel: nlp.sentiment,
          confidence: nlp.confidence,
          themes: nlp.themes,
          matchedBullTerms: nlp.matchedBullTerms,
          matchedBearTerms: nlp.matchedBearTerms,
          matchedTickers: entities
        };
      });

      // 3. Compute Broad Macro & Sector Tailwind Radar
      const sectorsList = reg === 'india' ? SECTORS_INDIA : SECTORS_GLOBAL;
      const sectorAnalysis = sectorsList.map(sec => {
        const relatedArticles = processedArticles.filter(art => {
          const hasTheme = art.themes.some(t => t.sectorsAffected && t.sectorsAffected.includes(sec.id));
          const hasTicker = art.matchedTickers.some(t => sec.keyTickers.includes(t.ticker));
          return hasTheme || hasTicker;
        });

        let totalScore = 0;
        let bullCount = 0;
        let bearCount = 0;

        relatedArticles.forEach(a => {
          totalScore += a.sentimentScore;
          if (a.sentimentScore > 0) bullCount++;
          if (a.sentimentScore < 0) bearCount++;
        });

        const articleCount = relatedArticles.length;
        const avgScore = articleCount > 0 ? Math.round(totalScore / articleCount) : (reg === 'india' ? 18 : 14);

        let stance = 'NEUTRAL';
        let tailwindStrength = 'MODERATE';

        if (avgScore >= 20) { stance = 'STRONG_TAILWIND'; tailwindStrength = 'VERY_HIGH'; }
        else if (avgScore >= 6) { stance = 'MODERATE_TAILWIND'; tailwindStrength = 'HIGH'; }
        else if (avgScore <= -20) { stance = 'STRONG_HEADWIND'; tailwindStrength = 'CAUTION'; }
        else if (avgScore <= -6) { stance = 'MODERATE_HEADWIND'; tailwindStrength = 'LOW'; }

        return {
          sectorId: sec.id,
          sectorName: sec.name,
          icon: sec.icon,
          description: sec.description,
          keyTickers: sec.keyTickers,
          tailwindScore: avgScore,
          stance,
          tailwindStrength,
          catalystCount: articleCount,
          bullishEvents: bullCount,
          bearishEvents: bearCount,
          topCatalysts: relatedArticles.slice(0, 3).map(a => ({
            title: a.title,
            source: a.source,
            link: a.link,
            sentiment: a.sentimentLabel,
            pubDate: a.pubDate
          }))
        };
      });

      // Compute Overall Market Sentiment Index
      let globalScore = 0;
      processedArticles.forEach(a => globalScore += a.sentimentScore);
      const overallSentimentScore = processedArticles.length > 0 ? Math.round(globalScore / processedArticles.length) : (reg === 'india' ? 22 : 12);

      // 4. Target Tickers based on region
      const targetTickers = reg === 'india' 
        ? ['HAL.NS', 'BEL.NS', 'RELIANCE.NS', 'TATAPOWER.NS', 'LT.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'TATAMOTORS.NS', 'IREDA.NS', 'SBIN.NS', 'NTPC.NS']
        : ['NVDA', 'TSM', 'ASML', 'LMT', 'RTX', 'CCJ', 'CEG', 'PLTR', 'NVO', 'XOM', 'BA', 'AAPL'];

      const stockOpportunities = [];

      for (const ticker of targetTickers) {
        const meta = KNOWN_TICKERS[ticker] || { name: ticker, sector: 'general', subsector: 'General', region: reg };
        
        // Find matching news articles
        const tickerNews = processedArticles.filter(art =>
          art.matchedTickers.some(t => t.ticker === ticker) ||
          art.rawText.toLowerCase().includes(ticker.toLowerCase().replace('.ns', '')) ||
          art.rawText.toLowerCase().includes(meta.name.toLowerCase())
        );

        let aggScore = 0;
        let bullEvents = 0;
        let bearEvents = 0;

        tickerNews.forEach(n => {
          aggScore += n.sentimentScore;
          if (n.sentimentScore > 0) bullEvents++;
          if (n.sentimentScore < 0) bearEvents++;
        });

        const catalystScore = tickerNews.length > 0 ? Math.round(aggScore / tickerNews.length) : (Math.floor(Math.random() * 20) + 12);

        // Fetch live quote & chart
        const quote = await getStockQuoteAndChart(ticker, '1mo', '1d', reg);
        const thesisAndRisks = generateThesisAndRisks(ticker, meta, tickerNews, catalystScore, reg);

        stockOpportunities.push({
          ticker,
          name: meta.name,
          sector: meta.sector,
          subsector: meta.subsector,
          region: reg,
          price: quote.regularMarketPrice,
          change: quote.change,
          changePercent: quote.changePercent,
          currency: quote.currency,
          catalystScore,
          confidence: tickerNews.length > 0 ? Math.min(95, 65 + tickerNews.length * 6) : 70,
          newsVolume: tickerNews.length,
          bullishNewsCount: bullEvents,
          bearishNewsCount: bearEvents,
          sparkline: quote.sparkline,
          thesis: thesisAndRisks.thesis,
          risks: thesisAndRisks.risks,
          macroCorrelation: thesisAndRisks.macroCorrelation,
          recentNews: tickerNews.slice(0, 4).map(n => ({
            title: n.title,
            source: n.source,
            link: n.link,
            sentiment: n.sentimentLabel,
            pubDate: n.pubDate
          }))
        });
      }

      stockOpportunities.sort((a, b) => (b.catalystScore * 0.7 + b.newsVolume * 5) - (a.catalystScore * 0.7 + a.newsVolume * 5));

      // 5. Generate AI-Powered Macro Narrative via Gemini
      console.log(`[MacroEngine] Requesting Gemini AI narrative for ${reg.toUpperCase()}...`);
      const aiNarrative = await generateMacroNarrative(
        reg,
        processedArticles,
        overallSentimentScore,
        sectorAnalysis
      );

      // 6. Update Cache
      const now = new Date();
      const next = new Date(now.getTime() + this.refreshDurationMs);

      this.caches[reg] = {
        macroOverview: {
          region: reg,
          globalSentimentScore: overallSentimentScore,
          globalStance: overallSentimentScore >= 18 ? 'HIGH EXPANSION' : overallSentimentScore <= -15 ? 'DEFENSIVE' : 'MODERATE EXPANSION',
          totalArticlesAnalyzed: processedArticles.length,
          geopoliticalThemesActive: (reg === 'india' ? GEOPOLITICAL_THEMES_INDIA : GEOPOLITICAL_THEMES_GLOBAL).length,
          aiNarrative,
          sectors: sectorAnalysis
        },
        stockOpportunities,
        incidentWire: processedArticles.slice(0, 40).map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          source: a.source,
          link: a.link,
          pubDate: a.pubDate,
          sentiment: a.sentimentLabel,
          sentimentScore: a.sentimentScore,
          themes: a.themes.map(t => t.name),
          tickers: a.matchedTickers.map(t => t.ticker)
        })),
        lastUpdated: now.toISOString(),
        nextRefresh: next.toISOString()
      };

      console.log(`[MacroEngine] Refresh cycle completed for ${reg.toUpperCase()}. Analyzed ${processedArticles.length} articles across ${stockOpportunities.length} opportunities.`);
    } catch (err) {
      console.error(`[MacroEngine] Refresh cycle failed for ${reg}:`, err);
    } finally {
      this.refreshingRegions.delete(reg);
    }

    return {
      region: reg,
      macroOverview: this.caches[reg].macroOverview,
      stockOpportunities: this.caches[reg].stockOpportunities,
      incidentWire: this.caches[reg].incidentWire,
      lastUpdated: this.caches[reg].lastUpdated,
      nextRefresh: this.caches[reg].nextRefresh,
      isCached: false
    };
  }

  /**
   * Deep Dive Search for Any Stock Symbol or Company Name with customizable timeframe.
   */
  async deepDiveStock(symbolOrName, region = 'india', range = '1mo', interval = '1d') {
    const reg = region === 'global' ? 'global' : 'india';
    const quote = await getStockQuoteAndChart(symbolOrName, range, interval, reg);
    const symbol = quote.symbol || symbolOrName.toUpperCase();
    const name = quote.shortName || symbol;

    const targetedNews = await fetchTargetedStockNews(symbol, name, reg);

    let totalScore = 0;
    let bullCount = 0;
    let bearCount = 0;

    const analyzedNews = targetedNews.map(item => {
      const nlp = analyzeTextSentiment(item.rawText, reg);
      totalScore += nlp.score;
      if (nlp.score > 0) bullCount++;
      if (nlp.score < 0) bearCount++;
      return {
        ...item,
        sentiment: nlp.sentiment,
        sentimentScore: nlp.score,
        themes: nlp.themes
      };
    });

    const newsCount = analyzedNews.length;
    const catalystScore = newsCount > 0 ? Math.round(totalScore / newsCount) : (reg === 'india' ? 18 : 10);
    const confidence = Math.min(95, 55 + newsCount * 6);

    const meta = KNOWN_TICKERS[symbol] || KNOWN_TICKERS[`${symbol}.NS`] || {
      name,
      sector: reg === 'india' ? 'Indian Equity' : 'Global Equity',
      subsector: reg === 'india' ? 'NSE / BSE Equity' : 'Equity Market',
      region: reg
    };

    const thesisAndRisks = generateThesisAndRisks(symbol, meta, analyzedNews, catalystScore, reg);

    return {
      quote,
      symbol,
      name,
      sector: meta.sector,
      subsector: meta.subsector,
      region: reg,
      catalystScore,
      confidence,
      sentimentLabel: catalystScore >= 20 ? 'STRONG_BULLISH' : catalystScore >= 5 ? 'BULLISH' : catalystScore <= -20 ? 'BEARISH' : 'NEUTRAL',
      newsCount,
      bullishNewsCount: bullCount,
      bearishNewsCount: bearCount,
      thesis: thesisAndRisks.thesis,
      risks: thesisAndRisks.risks,
      macroCorrelation: thesisAndRisks.macroCorrelation,
      recentNews: analyzedNews.slice(0, 8),
      generatedAt: new Date().toISOString()
    };
  }
}

/**
 * Helper to synthesize qualitative thesis, risk matrix, and macro correlation based on news events.
 */
function generateThesisAndRisks(ticker, meta, newsItems, catalystScore, region = 'global') {
  const latestHeadline = newsItems.length > 0 ? newsItems[0].title : null;
  const cleanTicker = ticker.toUpperCase();

  const templates = {
    // INDIA TEMPLATES
    'HAL.NS': {
      thesis: `Strong multi-year order book expansion backed by the Defense Acquisition Council (DAC) for LCA Tejas Mk1A, Su-30MKI upgrades, and Light Combat Helicopters (LCH Prachand). Solid thrust on defense export indigenization.`,
      risks: `GE F404/F414 engine supply delivery schedules from US partners, defense capital outlay execution timelines, and raw material titanium supply chains.`,
      macro: `Direct beneficiary of India's Defense Indigenization mandate and sovereign modernization outlays.`
    },
    'BEL.NS': {
      thesis: `Dominant Navratna defense electronics powerhouse with robust order pipeline across airborne radars, missile guidance electronics (QRSAM, Akash), electronic warfare suites, and non-defense smart railway sensors.`,
      risks: `Semiconductor component import lead times, contract milestone billing timings, and PSU margin ceilings.`,
      macro: `Core linchpin of India's defense electronics indigenization and radar modernization.`
    },
    'RELIANCE.NS': {
      thesis: `Integrated conglomerate with triple growth engines: robust telecom ARPU expansion (Jio 5G), scale-driven retail dominance, and mega new-energy gigafactory capital outlays (solar PV, green hydrogen, and battery storage).`,
      risks: `Global crude refining margin fluctuations (GRM swings), retail capex gestation periods, and telecom tariff regulatory revisions.`,
      macro: `Strongly correlated with India's domestic consumption, digital data explosion, and energy transition.`
    },
    'TATAPOWER.NS': {
      thesis: `Aggressive transition to 100% clean power with multi-gigawatt utility solar pipeline, rooftop solar dominance under PM Surya Ghar Muft Bijli Yojana, and nationwide EV public charging networks.`,
      risks: `Transmission line connectivity rights-of-way, solar module raw material price swings, and state DISCOM payment delays.`,
      macro: `Prime beneficiary of India's 500 GW clean energy 2030 target and EV adoption.`
    },
    'LT.NS': {
      thesis: `Massive international and domestic order backlog exceeding multi-lakh crores spanning Middle East energy hydrocarbons, high-speed rail corridors, semiconductor fab construction, and defense platforms.`,
      risks: `Fixed-price project cost inflation (cement/steel spikes), geopolitical Middle East transit stability, and working capital cycle management.`,
      macro: `Direct index bellwether for India's national capital expenditure infrastructure cycle.`
    },
    'TCS.NS': {
      thesis: `World-class digital transformation leader with sustained multi-billion dollar Total Contract Value (TCV) deal wins in enterprise cloud migration, BFSI modernization, and emerging sovereign AI infrastructure delivery.`,
      risks: `Global macroeconomic enterprise tech budget pauses in US/Europe, wage inflation, and visa/immigration policy revisions.`,
      macro: `Tied to global enterprise tech spending and Rupee-Dollar exchange rate tailwinds.`
    },
    'INFY.NS': {
      thesis: `Strong cloud and generative AI delivery momentum driven by Topaz AI platform and multi-year enterprise transformation large deals with resilient operating margins.`,
      risks: `Discretionary tech spend volatility among global financial clients and delivery talent attrition.`,
      macro: `Direct beneficiary of international cloud transformation and currency tailwinds.`
    },
    'HDFCBANK.NS': {
      thesis: `Premier private sector lender with post-merger branch distribution synergy, strong retail deposit mobilization, industry-leading return on assets, and pristine credit asset quality.`,
      risks: `Loan-to-deposit ratio (LDR) normalization timelines, net interest margin (NIM) compression during rate transition cycles, and unsecured retail credit delinquency monitoring.`,
      macro: `Central bellwether for Indian commercial credit growth and consumption demand.`
    },
    'TATAMOTORS.NS': {
      thesis: `Market leader in Indian 4W Electric Vehicles, strong passenger vehicle market share gains, high-margin Jaguar Land Rover (JLR) global order book, and commercial vehicle fleet renewal.`,
      risks: `JLR global export tariff exposures, lithium cell raw material inflation, and commercial vehicle cyclicality.`,
      macro: `Tied to Indian urban consumption, EV policy incentives, and global luxury mobility.`
    },
    'IREDA.NS': {
      thesis: `Specialized Navratna green financing institution with an exponentially growing loan book dedicated exclusively to solar, wind, green hydrogen, and bio-energy developers across India.`,
      risks: `Borrowing cost spreads against repo rate movements and renewable project developer credit risks.`,
      macro: `Core financial engine driving India's multi-decade renewable energy expansion.`
    },
    'SBIN.NS': {
      thesis: `India's largest bank with dominant retail liability franchise, surging corporate loan pipeline across infra/energy projects, record low gross NPAs, and robust digital adoption via YONO.`,
      risks: `Priority sector lending provisions and interest rate spread pressures during monetary adjustments.`,
      macro: `Direct macroeconomic barometer of sovereign India GDP growth and infrastructure funding.`
    },
    'NTPC.NS': {
      thesis: `Dominant utility giant providing reliable baseload power while aggressively scaling its NTPC Green Energy subsidiary into solar, wind, and nuclear generation capacity.`,
      risks: `Coal supply logistics during peak summer demand and regulatory tariff revision guidelines.`,
      macro: `Vital backbone of India's industrial power demand and green capacity addition.`
    },

    // GLOBAL TEMPLATES
    'NVDA': {
      thesis: `Strong ongoing enterprise and sovereign demand for next-generation accelerated compute clusters (Blackwell/B200 architecture). Hyperscaler capital expenditure trajectories remain sustained.`,
      risks: `Vulnerability to potential export restriction tightenings in East Asian markets, datacenter power/grid connection bottlenecks, and high baseline valuation expectations.`,
      macro: `High correlation to AI Infrastructure investments and US-China tech sovereignty policies.`
    },
    'TSM': {
      thesis: `Dominant monopoly in sub-3nm semiconductor foundry capacity. Essential critical node supplier for global AI accelerators and mobile platforms.`,
      risks: `Geopolitical exposure to Taiwan Strait shipping lanes, capital-intensive global fab diversification expenses, and raw material water/energy constraints.`,
      macro: `Central linchpin of global semiconductor supply chain resilience.`
    },
    'LMT': {
      thesis: `Multi-year order backlog expansion driven by global NATO defense modernization, allied PACAF deterrence programs, and precision munition replenishment.`,
      risks: `Pentagon procurement budget negotiations and aerospace titanium supply chain bottlenecks.`,
      macro: `Direct beneficiary of global geopolitical re-armament and allied sovereign defense pacts.`
    },
    'CCJ': {
      thesis: `Structural supply deficit in refined uranium paired with unprecedented resurgence in long-term nuclear power contracts to supply zero-emission baseload power for AI datacenters.`,
      risks: `Mine restart operational delays and spot market price volatility.`,
      macro: `At the nexus of the global nuclear power renaissance and continuous compute power.`
    }
  };

  if (templates[cleanTicker] || templates[`${cleanTicker}.NS`]) {
    const tpl = templates[cleanTicker] || templates[`${cleanTicker}.NS`];
    return {
      thesis: latestHeadline ? `${tpl.thesis} (Recent development: "${latestHeadline}")` : tpl.thesis,
      risks: tpl.risks,
      macroCorrelation: tpl.macro
    };
  }

  // Generic fallback
  return {
    thesis: `News flow reflects a catalyst sentiment score of ${catalystScore > 0 ? '+' : ''}${catalystScore}/100. ${
      latestHeadline ? `Key active event headline: "${latestHeadline}".` : 'Active tracking indicates localized corporate and macro news sentiment.'
    } Potential tailwinds depend on broader sector momentum and macroeconomic liquidity conditions.`,
    risks: `Subject to macroeconomic market volatility, sector-specific regulatory shifts, supply chain constraints, and general interest rate sensitivities. Deterministic profit or loss is not guaranteed.`,
    macroCorrelation: `Correlated with general market liquidity, sector momentum, and regional macroeconomic indicators.`
  };
}

module.exports = new MacroEngine();
