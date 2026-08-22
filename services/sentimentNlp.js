/**
 * Sentiment & Geopolitical Incident NLP Engine
 * Implements Loughran-McDonald financial domain sentiment dictionary +
 * Geopolitical entity & catalyst classification for both GLOBAL and INDIA markets.
 */

// Loughran-McDonald & Financial Market Lexicons
const BULLISH_LEXICON = [
  'surge', 'jump', 'gain', 'rally', 'breakthrough', 'expansion', 'record', 'soar',
  'outperform', 'upgrade', 'contract', 'partnership', 'dividend', 'buyback', 'acquisition',
  'tailwind', 'stimulus', 'approval', 'patent', 'profit', 'revenue beat', 'growth',
  'demand surge', 'bullish', 'invest', 'funding', 'deal', 'sanction-resistant',
  'defense modernization', 'reshoring', 'domestic supply', 'clean energy incentive',
  'rate cut', 'easing', 'de-escalation', 'trade pact', 'production hike', 'milestone',
  'strategic reserve', 'innovation', 'upside', 'solid', 'stronger', 'optimism', 'boom',
  // India-Specific Macro Bullish Terms
  'make in india', 'pli scheme', 'capex boost', 'order book expansion', 'indigenization',
  'fii inflow', 'dii inflow', 'record gst collection', 'defense export surge',
  'nifty all-time high', 'sensex rally', 'monsoon surplus', 'rural recovery',
  'sovereign rating upgrade', 'production linked incentive', 'infra allocation'
];

const BEARISH_LEXICON = [
  'slump', 'plunge', 'drop', 'decline', 'tumble', 'crash', 'loss', 'downside',
  'headwind', 'tariff', 'sanction', 'blockade', 'embargo', 'shortage', 'halt',
  'investigation', 'subpoena', 'lawsuit', 'downgrade', 'strike', 'protest', 'conflict',
  'war', 'missile', 'disruption', 'inflation spike', 'rate hike', 'tightening',
  'default', 'bankruptcy', 'recession', 'layoff', 'curb', 'export restriction',
  'antitrust', 'penalty', 'cyberattack', 'outage', 'breach', 'boycott', 'crisis',
  'selloff', 'weakness', 'pessimism', 'escalation', 'vulnerability', 'deficit',
  // India-Specific Macro Bearish Terms
  'fii outflow', 'rupee depreciation', 'crude spike import bill', 'monsoon deficit',
  'rbi rate hike', 'sebi scrutiny', 'promoter pledge', 'npa surge', 'trade deficit widening'
];

// Global Geopolitical Themes
const GEOPOLITICAL_THEMES_GLOBAL = [
  {
    id: 'defense_security',
    name: 'Sovereign Defense & Geopolitical Security',
    keywords: ['defense', 'military', 'nato', 'pentagon', 'weapon', 'missile', 'drone', 're-armament', 'taiwan strait', 'middle east', 'red sea', 'ukraine', 'deterrence', 'airspace'],
    sectorsAffected: ['defense', 'cybersecurity', 'aerospace']
  },
  {
    id: 'semiconductors_tech',
    name: 'Semiconductor Sovereignty & AI Infrastructure',
    keywords: ['chip', 'semiconductor', 'foundry', 'asml', 'gpu', 'ai cluster', 'data center', 'chips act', 'export control', 'advanced node', 'tsmc', 'hbm', 'packaging'],
    sectorsAffected: ['technology', 'semiconductors', 'hardware']
  },
  {
    id: 'energy_commodities',
    name: 'Energy Transit, Critical Minerals & Nuclear',
    keywords: ['crude', 'oil', 'opec', 'lng', 'natural gas', 'nuclear', 'uranium', 'smr', 'refinery', 'strait of hormuz', 'pipeline', 'lithium', 'copper', 'rare earth'],
    sectorsAffected: ['energy', 'utilities', 'materials']
  },
  {
    id: 'macro_monetary',
    name: 'Central Bank Policy & Global Liquidity',
    keywords: ['fed', 'interest rate', 'federal reserve', 'ecb', 'inflation', 'cpi', 'powell', 'rate cut', 'rate hike', 'bond yield', 'treasury', 'dollar index'],
    sectorsAffected: ['financials', 'growth_tech']
  },
  {
    id: 'biopharma_health',
    name: 'Global Healthcare & Bio-Innovation',
    keywords: ['fda', 'approval', 'clinical trial', 'glp-1', 'biotech', 'vaccine', 'oncology', 'drug pricing', 'patent cliff', 'gene therapy', 'pharmaceutical'],
    sectorsAffected: ['healthcare', 'biotech']
  },
  {
    id: 'trade_reshoring',
    name: 'Global Supply Chains & Strategic Reshoring',
    keywords: ['tariff', 'trade war', 'reshoring', 'nearshoring', 'supply chain', 'friendshoring', 'customs', 'shipping route', 'panama canal', 'freight'],
    sectorsAffected: ['industrials', 'transportation']
  }
];

// India Geopolitical & Macro Themes
const GEOPOLITICAL_THEMES_INDIA = [
  {
    id: 'india_defense_indigenization',
    name: 'Defense Indigenization & Make in India',
    keywords: ['defense ministry', 'make in india', 'hal', 'bel', 'tejas', 'dac approval', 'indigenous weapon', 'defense export', 'mazagon dock', 'cochin shipyard', 'pinaka', 'brahmos', 'modi defense'],
    sectorsAffected: ['defense_india', 'aerospace_india']
  },
  {
    id: 'india_power_renewables',
    name: 'Energy Transition, Solar & Power Grid',
    keywords: ['renewable energy', 'solar', 'tata power', 'green hydrogen', 'ireda', 'ntpc', 'adani green', 'power grid', 'cea', 'ev charging', 'coal india', 'battery storage'],
    sectorsAffected: ['energy_india', 'utilities_india']
  },
  {
    id: 'india_infra_capex',
    name: 'National Infra, High-Speed Rail & Capex',
    keywords: ['capex', 'infrastructure', 'l&t', 'railway', 'vande bharat', 'nhai', 'irfc', 'rvnl', 'dedicate freight corridor', 'port expansion', 'smart city', 'steel demand'],
    sectorsAffected: ['industrials_india', 'infrastructure_india']
  },
  {
    id: 'india_banking_credit',
    name: 'RBI Monetary Stance & Credit Expansion',
    keywords: ['rbi', 'repo rate', 'das', 'monetary policy committee', 'credit growth', 'npa', 'hdfc bank', 'sbi', 'icici bank', 'fii', 'dii', 'liquidity deficit', 'nifty bank'],
    sectorsAffected: ['financials_india', 'banking_india']
  },
  {
    id: 'india_it_digital',
    name: 'IT Global Delivery, Digital & Cloud Exports',
    keywords: ['tcs', 'infosys', 'it export', 'digital transformation', 'hcltech', 'wipro', 'bfsi tech spend', 'cloud deal', 'gcc', 'global capability center', 'ai solution'],
    sectorsAffected: ['technology_india', 'it_services_india']
  },
  {
    id: 'india_auto_ev',
    name: 'Auto Modernization, EV Adoption & Consumer',
    keywords: ['tata motors', 'mahindra', 'maruti', 'auto sales', 'ev registration', 'festive demand', 'rural consumption', 'commercial vehicle', 'passenger vehicle', 'pli auto'],
    sectorsAffected: ['auto_india', 'consumer_india']
  }
];

// Stock Entity Mapping dictionary (Global + India) - 20 Tickers Per Theater
const KNOWN_TICKERS = {
  // Global Tickers (Top 20)
  'NVDA': { name: 'NVIDIA Corp', sector: 'technology', subsector: 'Semiconductors & AI', region: 'global', keywords: ['nvidia', 'nvda', 'jensen huang', 'blackwell', 'cuda', 'h100', 'b200'] },
  'TSM': { name: 'Taiwan Semiconductor Mfg', sector: 'technology', subsector: 'Foundry & Chips', region: 'global', keywords: ['tsmc', 'tsm', 'taiwan semi', 'arizona fab', '2nm'] },
  'ASML': { name: 'ASML Holding NV', sector: 'technology', subsector: 'Lithography Equipment', region: 'global', keywords: ['asml', 'euv', 'high-na', 'lithography'] },
  'LMT': { name: 'Lockheed Martin Corp', sector: 'defense', subsector: 'Defense & Aerospace', region: 'global', keywords: ['lockheed', 'lmt', 'f-35', 'himars', 'missile defense'] },
  'RTX': { name: 'RTX Corporation', sector: 'defense', subsector: 'Aerospace & Defense', region: 'global', keywords: ['rtx', 'raytheon', 'pratt & whitney', 'patriot missile'] },
  'PLTR': { name: 'Palantir Technologies', sector: 'technology', subsector: 'Defense AI & Data', region: 'global', keywords: ['palantir', 'pltr', 'karp', 'aip', 'gotham'] },
  'MSFT': { name: 'Microsoft Corp', sector: 'technology', subsector: 'Cloud & Enterprise AI', region: 'global', keywords: ['microsoft', 'msft', 'azure', 'copilot', 'satya nadella'] },
  'AAPL': { name: 'Apple Inc.', sector: 'technology', subsector: 'Consumer Tech & AI', region: 'global', keywords: ['apple', 'aapl', 'iphone', 'tim cook', 'apple intelligence'] },
  'GOOGL': { name: 'Alphabet Inc.', sector: 'technology', subsector: 'Cloud, AI & Search', region: 'global', keywords: ['google', 'alphabet', 'googl', 'gemini ai', 'sundar pichai', 'google cloud'] },
  'AMZN': { name: 'Amazon.com Inc.', sector: 'industrials', subsector: 'Cloud Infrastructure & Logistics', region: 'global', keywords: ['amazon', 'amzn', 'aws', 'andy jassy', 'amazon web services'] },
  'META': { name: 'Meta Platforms Inc.', sector: 'technology', subsector: 'AI Infrastructure & Platforms', region: 'global', keywords: ['meta', 'meta platforms', 'mark zuckerberg', 'llama', 'ai datacenter'] },
  'AMD': { name: 'Advanced Micro Devices', sector: 'technology', subsector: 'Datacenter GPU & Silicon', region: 'global', keywords: ['amd', 'lisa su', 'mi300', 'ryzen', 'epyc'] },
  'QCOM': { name: 'Qualcomm Inc.', sector: 'technology', subsector: 'Edge AI & Mobile Silicon', region: 'global', keywords: ['qualcomm', 'qcom', 'snapdragon', 'ai pc', '5g chipset'] },
  'CCJ': { name: 'Cameco Corporation', sector: 'energy', subsector: 'Uranium & Nuclear Fuel', region: 'global', keywords: ['cameco', 'ccj', 'uranium', 'nuclear fuel', 'kazatomprom'] },
  'CEG': { name: 'Constellation Energy Corp', sector: 'energy', subsector: 'Nuclear Baseload Clean Energy', region: 'global', keywords: ['constellation energy', 'ceg', 'three mile island', 'nuclear power datacenter'] },
  'XOM': { name: 'Exxon Mobil Corp', sector: 'energy', subsector: 'Integrated Oil & Gas', region: 'global', keywords: ['exxon', 'xom', 'guyana oil', 'permian', 'lng export'] },
  'NVO': { name: 'Novo Nordisk', sector: 'healthcare', subsector: 'Biopharma & GLP-1', region: 'global', keywords: ['novo nordisk', 'nvo', 'wegovy', 'ozempic', 'semaglutide'] },
  'LLY': { name: 'Eli Lilly and Company', sector: 'healthcare', subsector: 'Metabolic & Therapeutics', region: 'global', keywords: ['eli lilly', 'lly', 'mounjaro', 'zepbound', 'glp-1 pipeline'] },
  'BA': { name: 'Boeing Company', sector: 'industrials', subsector: 'Commercial & Defense Aviation', region: 'global', keywords: ['boeing', 'ba', '737 max', 'faa', 'starliner'] },
  'CAT': { name: 'Caterpillar Inc.', sector: 'industrials', subsector: 'Global Heavy Machinery & Infra', region: 'global', keywords: ['caterpillar', 'cat', 'construction machinery', 'mining equipment', 'infrastructure capex'] },
  'ARM': { name: 'Arm Holdings plc', sector: 'technology', subsector: 'Semiconductor IP & AI Architecture', region: 'global', keywords: ['arm holdings', 'arm architecture', 'rene haas', 'v9 architecture', 'edge compute'] },

  // India Tickers (Top 21 NSE)
  'HAL.NS': { name: 'Hindustan Aeronautics Ltd', sector: 'defense_india', subsector: 'Defense Aerospace & Fighter Jets', region: 'india', keywords: ['hindustan aeronautics', 'hal', 'tejas mk1a', 'lch prachand', 'su-30mki', 'ge f404 engine'] },
  'BEL.NS': { name: 'Bharat Electronics Ltd', sector: 'defense_india', subsector: 'Defense Radar & Avionics', region: 'india', keywords: ['bharat electronics', 'bel', 'radar', 'electronic warfare', 'defense avionics', 'qrsam'] },
  'MAZDOCK.NS': { name: 'Mazagon Dock Shipbuilders', sector: 'defense_india', subsector: 'Defense Warships & Submarines', region: 'india', keywords: ['mazagon dock', 'mazdock', 'scorpene submarine', 'destroyer warship', 'defense shipbuilding'] },
  'RELIANCE.NS': { name: 'Reliance Industries Ltd', sector: 'energy_india', subsector: 'Energy, Retail & Telecom', region: 'india', keywords: ['reliance', 'mukesh ambani', 'jio', 'reliance retail', 'jamnagar refinery', 'green energy gigafactory'] },
  'TATAPOWER.NS': { name: 'Tata Power Co Ltd', sector: 'energy_india', subsector: 'Renewables & Power Distribution', region: 'india', keywords: ['tata power', 'solar rooftop', 'ev charging network', 'renewable capacity', 'transmission line'] },
  'LT.NS': { name: 'Larsen & Toubro Ltd', sector: 'industrials_india', subsector: 'Mega EPC & Defense Infra', region: 'india', keywords: ['larsen & toubro', 'l&t', 'subramanian sarma', 'high speed rail', 'middle east epc', 'defense submarine'] },
  'TCS.NS': { name: 'Tata Consultancy Services', sector: 'technology_india', subsector: 'IT Services & AI Engineering', region: 'india', keywords: ['tcs', 'tata consultancy', 'krithi krithivasan', 'ai enterprise', 'bfsi cloud deal', 'it hiring'] },
  'INFY.NS': { name: 'Infosys Limited', sector: 'technology_india', subsector: 'Digital Cloud & IT Services', region: 'india', keywords: ['infosys', 'infy', 'salil parekh', 'topaz ai', 'large deal tcv', 'cloud transformation'] },
  'HDFCBANK.NS': { name: 'HDFC Bank Ltd', sector: 'financials_india', subsector: 'Private Banking & Retail Credit', region: 'india', keywords: ['hdfc bank', 'sashidhar jagdishan', 'merger integration', 'loan growth', 'deposit franchise'] },
  'ICICIBANK.NS': { name: 'ICICI Bank Ltd', sector: 'financials_india', subsector: 'Private Banking & Corporate Credit', region: 'india', keywords: ['icici bank', 'sandeep bakhshi', 'digital banking', 'net interest margin', 'retail loan'] },
  'SBIN.NS': { name: 'State Bank of India', sector: 'financials_india', subsector: 'Public Sector Banking Leader', region: 'india', keywords: ['state bank of india', 'sbi', 'dinesh khara', 'yono', 'public sector bank', 'credit outlay'] },
  'TATAMOTORS.NS': { name: 'Tata Motors Ltd', sector: 'auto_india', subsector: 'EV, Commercial & JLR', region: 'india', keywords: ['tata motors', 'jlr', 'jaguar land rover', 'tata ev', 'nexon ev', 'curvv', 'commercial vehicle demand'] },
  'IREDA.NS': { name: 'Indian Renewable Energy Dev', sector: 'energy_india', subsector: 'Green Energy Financing', region: 'india', keywords: ['ireda', 'green financing', 'renewable loan book', 'solar project funding', 'navratna psu'] },
  'NTPC.NS': { name: 'NTPC Limited', sector: 'energy_india', subsector: 'Power Generation & Green Energy', region: 'india', keywords: ['ntpc', 'green energy ipo', 'thermal power capacity', 'nuclear power project', 'renewable target'] },
  'BHARTIARTL.NS': { name: 'Bharti Airtel Ltd', sector: 'technology_india', subsector: 'Telecom, 5G & Digital Data', region: 'india', keywords: ['bharti airtel', 'airtel', 'sunil mittal', 'arpu growth', '5g network roll out', 'airtel payments'] },
  'ITC.NS': { name: 'ITC Limited', sector: 'industrials_india', subsector: 'Consumer Goods, Agri & Hotels', region: 'india', keywords: ['itc', 'sanjiv puri', 'fmcg expansion', 'hotel demerger', 'cigarette tax', 'agri business'] },
  'SUNPHARMA.NS': { name: 'Sun Pharmaceutical Ind', sector: 'healthcare_india', subsector: 'Global Specialty & Generics', region: 'india', keywords: ['sun pharma', 'dilip shanghvi', 'specialty pharma', 'illuymya', 'us fda inspection', 'dermatology pipeline'] },
  'ADANIPORTS.NS': { name: 'Adani Ports and SEZ', sector: 'industrials_india', subsector: 'Port Logistics & Maritime Infrastructure', region: 'india', keywords: ['adani ports', 'karan adani', 'mundra port', 'container volume', 'port expansion'] },
  'BAJFINANCE.NS': { name: 'Bajaj Finance Ltd', sector: 'financials_india', subsector: 'Consumer Credit & Digital NBFC', region: 'india', keywords: ['bajaj finance', 'rajeev jain', 'omnichannel app', 'unsecured loan', 'assets under management'] },
  'ONGC.NS': { name: 'Oil & Natural Gas Corp', sector: 'energy_india', subsector: 'Oil Exploration & Offshore Gas', region: 'india', keywords: ['ongc', 'crude oil production', 'kg basin gas', 'offshore drilling', 'petroleum ministry'] },
  'KOTAKBANK.NS': { name: 'Kotak Mahindra Bank', sector: 'financials_india', subsector: 'Private Banking & Wealth Management', region: 'india', keywords: ['kotak bank', 'uday kotak', 'ashok vaswani', '811 digital banking', 'wealth management'] }
};

/**
 * Analyzes raw text from news articles or headlines.
 */
function analyzeTextSentiment(text, region = 'global') {
  if (!text) return { score: 0, confidence: 50, sentiment: 'NEUTRAL', themes: [], matchedBullTerms: [], matchedBearTerms: [] };
  
  const lower = text.toLowerCase();
  let bullHits = 0;
  let bearHits = 0;
  const matchedBullTerms = [];
  const matchedBearTerms = [];

  BULLISH_LEXICON.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) {
      bullHits += matches.length;
      matchedBullTerms.push(term);
    }
  });

  BEARISH_LEXICON.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) {
      bearHits += matches.length;
      matchedBearTerms.push(term);
    }
  });

  const total = bullHits + bearHits;
  let score = 0;
  let confidence = 50;

  if (total > 0) {
    score = Math.round(((bullHits - bearHits) / total) * 100);
    confidence = Math.min(95, 55 + total * 8);
  }

  // Select appropriate theme set
  const themeCatalog = region === 'india' ? GEOPOLITICAL_THEMES_INDIA : GEOPOLITICAL_THEMES_GLOBAL;
  const matchedThemes = [];

  themeCatalog.forEach(theme => {
    const foundKeywords = theme.keywords.filter(kw => lower.includes(kw));
    if (foundKeywords.length > 0) {
      matchedThemes.push({
        id: theme.id,
        name: theme.name,
        matchCount: foundKeywords.length,
        sectorsAffected: theme.sectorsAffected,
        keywords: foundKeywords
      });
    }
  });

  let sentiment = 'NEUTRAL';
  if (score >= 25) sentiment = 'STRONG_BULLISH';
  else if (score >= 8) sentiment = 'BULLISH';
  else if (score <= -25) sentiment = 'STRONG_BEARISH';
  else if (score <= -8) sentiment = 'BEARISH';

  return {
    score,
    confidence,
    sentiment,
    totalSignals: total,
    matchedBullTerms: [...new Set(matchedBullTerms)],
    matchedBearTerms: [...new Set(matchedBearTerms)],
    themes: matchedThemes
  };
}

/**
 * Maps news items to known ticker entities.
 */
function extractEntitiesAndTickers(text, region = 'global') {
  const lower = text.toLowerCase();
  const matchedTickers = [];

  for (const [ticker, data] of Object.entries(KNOWN_TICKERS)) {
    if (region && data.region !== region) continue;

    const hit = data.keywords.some(kw => {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(lower);
    });

    if (hit) {
      matchedTickers.push({
        ticker,
        name: data.name,
        sector: data.sector,
        subsector: data.subsector,
        region: data.region
      });
    }
  }

  return matchedTickers;
}

/**
 * Dynamically discovers tickers with active catalysts from news stream at runtime
 */
function discoverActiveTickersFromNews(processedArticles, region = 'india') {
  const tickerMap = new Map();

  // 1. First gather all tickers matched via NLP entity mapping
  processedArticles.forEach(art => {
    (art.matchedTickers || []).forEach(t => {
      if (region && t.region && t.region !== region) return;
      
      const key = t.ticker;
      if (!tickerMap.has(key)) {
        tickerMap.set(key, {
          ticker: key,
          name: t.name,
          sector: t.sector,
          subsector: t.subsector,
          region: t.region,
          mentionCount: 0,
          totalSentiment: 0,
          articles: []
        });
      }

      const entry = tickerMap.get(key);
      entry.mentionCount++;
      entry.totalSentiment += (art.sentimentScore || 0);
      entry.articles.push(art);
    });
  });

  // Convert to array sorted by mention count and catalyst strength
  const discovered = Array.from(tickerMap.values());
  discovered.sort((a, b) => (b.mentionCount * 10 + Math.abs(b.totalSentiment)) - (a.mentionCount * 10 + Math.abs(a.totalSentiment)));

  return discovered;
}

module.exports = {
  analyzeTextSentiment,
  extractEntitiesAndTickers,
  discoverActiveTickersFromNews,
  GEOPOLITICAL_THEMES_GLOBAL,
  GEOPOLITICAL_THEMES_INDIA,
  KNOWN_TICKERS
};
