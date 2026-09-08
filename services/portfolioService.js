/**
 * AURA SENTINEL - Portfolio Analytics & Broker Integration Engine
 * Connects to Groww, Zerodha Kite, Upstox, Angel One, Dhan, Fyers, and CSV imports.
 * Evaluates stock-by-stock macro health, sector concentration, and portfolio resilience.
 */

const https = require('https');
const XLSX = require('xlsx');
const financeApi = require('./financeApi');
const macroEngine = require('./macroEngine');

/**
 * Utility to make HTTPS JSON requests
 */
function makeHttpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Broker API request timed out.'));
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

/**
 * Fetch holdings from Groww Trade API
 */
async function fetchGrowwHoldings(apiAuthToken, apiKey = '', apiSecret = '') {
  const token = (apiAuthToken || apiKey || '').trim();
  if (!token) throw new Error('Groww API Key or Access Token is required.');

  // Demo / Sample Token check
  if (token.toLowerCase().startsWith('demo') || token.toLowerCase().startsWith('test')) {
    return getSampleHoldings('Groww Trade API');
  }

  const endpoints = [
    { hostname: 'api.groww.in', path: '/v1/holdings/user' },
    { hostname: 'api.groww.in', path: '/v1/holdings' },
    { hostname: 'groww.in', path: '/v1/holdings/user' },
    { hostname: 'groww.in', path: '/trade-api/v1/holdings/user' }
  ];

  let lastStatus = 404;
  let lastMessage = '';

  for (const ep of endpoints) {
    try {
      const options = {
        hostname: ep.hostname,
        path: ep.path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-VERSION': '1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'AuraSentinel/2.0'
        },
        timeout: 9000
      };

      const res = await makeHttpsRequest(options);
      lastStatus = res.status;

      if (res.status === 200 && res.data) {
        const payload = res.data.payload || res.data;
        const rawList = payload.holdings || payload.user_holdings || payload.data || payload.results || (Array.isArray(payload) ? payload : (Array.isArray(res.data) ? res.data : []));

        if (Array.isArray(rawList) && rawList.length > 0) {
          return rawList.map(h => {
            const qty = Number(h.quantity || h.net_quantity || h.total_quantity || 0);
            let cp = Number(h.close_price || h.ltp || h.last_price || h.current_price || h.market_price || h.cmp || 0);
            if (cp <= 0 && h.market_value && qty > 0) {
              cp = Number(h.market_value) / qty;
            } else if (cp <= 0 && h.current_value && qty > 0) {
              cp = Number(h.current_value) / qty;
            }

            return {
              symbol: h.trading_symbol || h.tradingsymbol || h.symbol || h.isin || 'EQUITY',
              quantity: qty,
              buyPrice: Number(h.average_price || h.buy_price || h.cost_price || h.buyPrice || 0),
              closingPrice: cp,
              isin: h.isin || '',
              exchange: h.exchange || 'NSE',
              source: 'Groww Trade API'
            };
          }).filter(h => h.quantity > 0);
        } else if (Array.isArray(rawList) && rawList.length === 0) {
          console.log('[GrowwAPI] Empty holdings list in response payload:', JSON.stringify(res.data));
          throw new Error('Connected to Groww Trade API successfully, but zero active stock holdings were returned in your account.');
        }
      } else if (res.status === 401 || res.status === 403) {
        throw new Error('Groww authentication failed. Your access token may have expired or is invalid.');
      } else if (res.data?.message) {
        lastMessage = res.data.message;
      }
    } catch (e) {
      if (e.message.includes('authentication failed') || e.message.includes('zero active stock holdings')) {
        throw e;
      }
      console.warn(`[GrowwAPI] Attempt on ${ep.hostname}${ep.path} failed:`, e.message);
    }
  }

  throw new Error(lastMessage || `Groww Trade API responded with status ${lastStatus}. Please verify your Access Token permissions.`);
}

/**
 * Fetch holdings from Zerodha Kite Connect v3
 */
async function fetchZerodhaHoldings(apiKey, accessToken) {
  if (!apiKey || !accessToken) throw new Error('Zerodha API Key and Access Token are required.');

  if (apiKey.toLowerCase().startsWith('demo') || accessToken.toLowerCase().startsWith('demo')) {
    return getSampleHoldings('Zerodha Kite');
  }

  try {
    const options = {
      hostname: 'api.kite.trade',
      path: '/portfolio/holdings',
      method: 'GET',
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${apiKey.trim()}:${accessToken.trim()}`,
        'User-Agent': 'AuraSentinel/2.0'
      },
      timeout: 8000
    };

    const res = await makeHttpsRequest(options);
    if (res.status === 200 && res.data && res.data.data && Array.isArray(res.data.data)) {
      return res.data.data.map(h => ({
        symbol: h.tradingsymbol,
        quantity: Number(h.quantity || 0),
        buyPrice: Number(h.average_price || 0),
        exchange: h.exchange || 'NSE',
        source: 'Zerodha Kite'
      }));
    }
    throw new Error(res.data?.message || `Zerodha API returned status ${res.status}`);
  } catch (err) {
    throw new Error(`Zerodha Connection Error: ${err.message}`);
  }
}

/**
 * Fetch holdings from Upstox API v2
 */
async function fetchUpstoxHoldings(accessToken) {
  if (!accessToken) throw new Error('Upstox Access Token is required.');

  if (accessToken.toLowerCase().startsWith('demo')) {
    return getSampleHoldings('Upstox');
  }

  try {
    const options = {
      hostname: 'api.upstox.com',
      path: '/v2/portfolio/long-term-holdings',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken.trim()}`,
        'User-Agent': 'AuraSentinel/2.0'
      },
      timeout: 8000
    };

    const res = await makeHttpsRequest(options);
    if (res.status === 200 && res.data && res.data.data && Array.isArray(res.data.data)) {
      return res.data.data.map(h => ({
        symbol: h.tradingsymbol || h.company_name,
        quantity: Number(h.quantity || 0),
        buyPrice: Number(h.average_price || 0),
        exchange: h.exchange || 'NSE',
        source: 'Upstox v2'
      }));
    }
    throw new Error(res.data?.message || `Upstox API returned status ${res.status}`);
  } catch (err) {
    throw new Error(`Upstox Connection Error: ${err.message}`);
  }
}

/**
 * Fetch holdings from Angel One SmartAPI
 */
async function fetchAngelOneHoldings(apiKey, clientCode, jwtToken) {
  if (!apiKey || !jwtToken) throw new Error('Angel One API Key and JWT Session Token are required.');

  if (apiKey.toLowerCase().startsWith('demo')) {
    return getSampleHoldings('Angel One');
  }

  try {
    const options = {
      hostname: 'apiconnect.angelbroking.com',
      path: '/rest/secure/angelbroking/portfolio/v1/getAllHolding',
      method: 'GET',
      headers: {
        'X-PrivateKey': apiKey.trim(),
        'Authorization': `Bearer ${jwtToken.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AuraSentinel/2.0'
      },
      timeout: 8000
    };

    const res = await makeHttpsRequest(options);
    if (res.status === 200 && res.data && res.data.data && Array.isArray(res.data.data.holdings)) {
      return res.data.data.holdings.map(h => ({
        symbol: h.tradingsymbol || h.symbolname,
        quantity: Number(h.quantity || 0),
        buyPrice: Number(h.avgprice || 0),
        exchange: h.exchange || 'NSE',
        source: 'Angel One SmartAPI'
      }));
    }
    throw new Error(res.data?.message || `Angel One returned status ${res.status}`);
  } catch (err) {
    throw new Error(`Angel One Connection Error: ${err.message}`);
  }
}

/**
 * Fetch holdings from DhanHQ API v2
 */
async function fetchDhanHoldings(clientId, accessToken) {
  if (!clientId || !accessToken) throw new Error('Dhan Client ID and Access Token are required.');

  if (clientId.toLowerCase().startsWith('demo')) {
    return getSampleHoldings('Dhan');
  }

  try {
    const options = {
      hostname: 'api.dhan.co',
      path: '/v2/holdings',
      method: 'GET',
      headers: {
        'access-token': accessToken.trim(),
        'client-id': clientId.trim(),
        'Content-Type': 'application/json',
        'User-Agent': 'AuraSentinel/2.0'
      },
      timeout: 8000
    };

    const res = await makeHttpsRequest(options);
    if (res.status === 200 && res.data && Array.isArray(res.data)) {
      return res.data.map(h => ({
        symbol: h.tradingSymbol || h.customSymbol,
        quantity: Number(h.totalQty || h.quantity || 0),
        buyPrice: Number(h.avgCostPrice || h.averagePrice || 0),
        exchange: h.exchange || 'NSE',
        source: 'DhanHQ API'
      }));
    }
    throw new Error(res.data?.message || `Dhan API returned status ${res.status}`);
  } catch (err) {
    throw new Error(`Dhan Connection Error: ${err.message}`);
  }
}

/**
 * Fetch holdings from Fyers Data API v3
 */
async function fetchFyersHoldings(appId, accessToken) {
  if (!appId || !accessToken) throw new Error('Fyers App ID and Access Token are required.');

  if (appId.toLowerCase().startsWith('demo')) {
    return getSampleHoldings('Fyers');
  }

  try {
    const options = {
      hostname: 'api-t1.fyers.in',
      path: '/api/v3/holdings',
      method: 'GET',
      headers: {
        'Authorization': `${appId.trim()}:${accessToken.trim()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AuraSentinel/2.0'
      },
      timeout: 8000
    };

    const res = await makeHttpsRequest(options);
    if (res.status === 200 && res.data && res.data.holdings && Array.isArray(res.data.holdings)) {
      return res.data.holdings.map(h => ({
        symbol: (h.symbol || '').replace(/^NSE:|-EQ$/g, ''),
        quantity: Number(h.quantity || 0),
        buyPrice: Number(h.costPrice || 0),
        exchange: 'NSE',
        source: 'Fyers API'
      }));
    }
    throw new Error(res.data?.message || `Fyers API returned status ${res.status}`);
  } catch (err) {
    throw new Error(`Fyers Connection Error: ${err.message}`);
  }
}

/**
 * Universal CSV / Excel (XLSX, XLS) Parser for Groww, Zerodha, Upstox, ICICI Direct, Angel One exports
 */
function parseHoldingsCsv(contentOrBuffer) {
  if (!contentOrBuffer) {
    throw new Error('No holdings data provided. Please select a CSV or Excel file.');
  }

  let workbook;
  try {
    if (typeof contentOrBuffer === 'string') {
      if (contentOrBuffer.startsWith('data:') && contentOrBuffer.includes('base64,')) {
        const b64 = contentOrBuffer.split('base64,')[1];
        workbook = XLSX.read(Buffer.from(b64, 'base64'), { type: 'buffer' });
      } else if (contentOrBuffer.startsWith('PK\x03\x04') || contentOrBuffer.startsWith('UEsDB')) {
        workbook = XLSX.read(Buffer.from(contentOrBuffer, contentOrBuffer.startsWith('UEsDB') ? 'base64' : 'binary'), { type: 'buffer' });
      } else {
        workbook = XLSX.read(contentOrBuffer, { type: 'string' });
      }
    } else if (Buffer.isBuffer(contentOrBuffer)) {
      workbook = XLSX.read(contentOrBuffer, { type: 'buffer' });
    } else {
      throw new Error('Unsupported file format.');
    }
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }

  const sheetName = workbook.SheetNames && workbook.SheetNames[0];
  if (!sheetName) throw new Error('No worksheet found in uploaded file.');

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawRows || rawRows.length < 1) {
    throw new Error('The uploaded spreadsheet or CSV is empty.');
  }

  // Find header row by searching for standard column keywords
  let headerRowIdx = -1;
  let symCol = -1;
  let qtyCol = -1;
  let priceCol = -1;
  let nameCol = -1;
  let closeCol = -1;

  for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
    const row = rawRows[r].map(c => String(c || '').toLowerCase().trim());
    const sIdx = row.findIndex(c => c === 'symbol' || c === 'stock symbol' || c === 'ticker' || c === 'instrument' || c === 'scrip' || c === 'trading symbol' || c === 'stock' || c.includes('symbol'));
    const qIdx = row.findIndex(c => c === 'qty' || c === 'quantity' || c === 'shares' || c === 'units' || c === 'total qty' || c.includes('qty') || c.includes('quantity'));
    const pIdx = row.findIndex(c => c === 'avg price' || c === 'avg cost' || c === 'avg. price' || c === 'buy price' || c === 'average buy price' || c === 'cost price' || c === 'average price' || c.includes('avg') || c.includes('buy price') || c.includes('cost'));
    const nIdx = row.findIndex(c => c === 'stock name' || c === 'company' || c === 'company name' || c === 'instrument name' || c.includes('stock name') || c.includes('company'));
    const cIdx = row.findIndex(c => c === 'closing price' || c === 'ltp' || c === 'last price' || c === 'current price' || c.includes('closing price') || c.includes('ltp'));

    if ((sIdx !== -1 || nIdx !== -1) && qIdx !== -1) {
      headerRowIdx = r;
      symCol = sIdx !== -1 ? sIdx : nIdx;
      nameCol = nIdx;
      qtyCol = qIdx;
      priceCol = pIdx;
      closeCol = cIdx;
      break;
    }
  }

  const holdings = [];
  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    let symbol = '';
    let quantity = 0;
    let buyPrice = 0;
    let closingPrice = 0;

    if (headerRowIdx !== -1) {
      symbol = String(row[symCol] || '').trim();
      if (!symbol && nameCol !== -1) {
        symbol = String(row[nameCol] || '').trim();
      }
      quantity = parseFloat(String(row[qtyCol] || '').replace(/,/g, '')) || 0;
      if (priceCol !== -1) {
        buyPrice = parseFloat(String(row[priceCol] || '').replace(/[₹$,]/g, '')) || 0;
      }
      if (closeCol !== -1) {
        closingPrice = parseFloat(String(row[closeCol] || '').replace(/[₹$,]/g, '')) || 0;
      }
    } else {
      symbol = String(row[0] || '').trim();
      quantity = parseFloat(String(row[1] || '').replace(/,/g, '')) || 0;
      buyPrice = parseFloat(String(row[2] || '').replace(/[₹$,]/g, '')) || 0;
    }

    const cleanSym = symbol
      .replace(/^NSE:|^BSE:/i, '')
      .replace(/-EQ$|-BE$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();

    if (!cleanSym || cleanSym.startsWith('TOTAL') || cleanSym.startsWith('GRAND') || cleanSym.startsWith('SUMMARY') || cleanSym.startsWith('DISCLAIMER') || isNaN(quantity) || quantity <= 0) {
      continue;
    }

    holdings.push({
      symbol: cleanSym,
      quantity,
      buyPrice: isNaN(buyPrice) ? 0 : buyPrice,
      closingPrice: isNaN(closingPrice) ? 0 : closingPrice,
      exchange: 'NSE',
      source: 'CSV / Excel Import'
    });
  }

  if (holdings.length === 0) {
    throw new Error('No valid stock holding rows found. Ensure the file contains stock symbols and quantities.');
  }

  return holdings;
}

/**
 * High-Caliber Sample Portfolio for Instant Demo Exploration
 */
function getSampleHoldings(brokerName = 'Demo Portfolio') {
  return [
    { symbol: 'HAL', quantity: 25, buyPrice: 4250.00, exchange: 'NSE', source: brokerName },
    { symbol: 'BEL', quantity: 120, buyPrice: 245.50, exchange: 'NSE', source: brokerName },
    { symbol: 'TCS', quantity: 30, buyPrice: 3820.00, exchange: 'NSE', source: brokerName },
    { symbol: 'RELIANCE', quantity: 40, buyPrice: 2850.00, exchange: 'NSE', source: brokerName },
    { symbol: 'HDFCBANK', quantity: 50, buyPrice: 1540.00, exchange: 'NSE', source: brokerName },
    { symbol: 'TATAMOTORS', quantity: 65, buyPrice: 890.00, exchange: 'NSE', source: brokerName },
    { symbol: 'NTPC', quantity: 150, buyPrice: 340.00, exchange: 'NSE', source: brokerName }
  ];
}

/**
 * ============================================================================
 * PORTFOLIO MACRO HEALTH & STOCK-BY-STOCK DIAGNOSTIC ENGINE
 * ============================================================================
 */
async function analyzePortfolio(holdings, region = 'india') {
  if (!Array.isArray(holdings) || holdings.length === 0) {
    throw new Error('No holdings provided for portfolio analysis.');
  }

  let totalInvested = 0;
  let totalCurrentValue = 0;
  const analyzedStocks = [];
  const sectorDistribution = {};

  // Sector dictionary mapping for major Indian equities
  const sectorLookup = {
    'HAL': { sector: 'Defense & Aerospace', icon: '🛡️', beta: 1.15, macroTailwind: 'Record defense modernization capex and multi-year LCA Tejas/Prachand export order book.' },
    'BEL': { sector: 'Defense Electronics', icon: '🛡️', beta: 1.05, macroTailwind: 'Indigenous radar, electronic warfare, and naval defense systems mandate.' },
    'TCS': { sector: 'Technology & AI Services', icon: '💻', beta: 0.85, macroTailwind: 'Large deal TCV expansion and enterprise generative AI cloud transformation.' },
    'INFY': { sector: 'Technology & Digital', icon: '💻', beta: 0.90, macroTailwind: 'Margin resilience and BFSI client discretionary spend recovery.' },
    'RELIANCE': { sector: 'Energy & Digital Conglomerate', icon: '⚡', beta: 1.02, macroTailwind: 'Green hydrogen capex, retail expansion, and 5G subscriber ARPU compounding.' },
    'NTPC': { sector: 'Power & Green Energy', icon: '☢️', beta: 0.95, macroTailwind: 'Thermal base load expansion + rapid 60GW green hydrogen renewable pipeline.' },
    'HDFCBANK': { sector: 'Private Banking & Financials', icon: '🏦', beta: 0.98, macroTailwind: 'Post-merger loan growth normalization, deposit franchise, and pristine asset quality.' },
    'ICICIBANK': { sector: 'Private Banking & Credit', icon: '🏦', beta: 1.05, macroTailwind: 'Industry-leading ROA (>2.3%), robust NIMs, and digital underwriting dominance.' },
    'TATAMOTORS': { sector: 'Auto & EV Mobility', icon: '🚗', beta: 1.25, macroTailwind: 'JLR debt reduction, EV market leadership, and commercial vehicle margin expansion.' },
    'L&T': { sector: 'Infrastructure & Capital Goods', icon: '⚓', beta: 1.10, macroTailwind: '₹4.5 Lakh Cr record order book powered by Middle East hydrocarbon and domestic rail/ports.' },
    'LT': { sector: 'Infrastructure & Capital Goods', icon: '⚓', beta: 1.10, macroTailwind: '₹4.5 Lakh Cr record order book powered by Middle East hydrocarbon and domestic rail/ports.' }
  };

  // Dynamic sector & company classifier
  function resolveSectorMeta(symbol, companyName = '') {
    const sym = (symbol || '').toUpperCase();
    const name = (companyName || '').toUpperCase();
    const fullText = `${sym} ${name}`;

    if (sectorLookup[sym]) return sectorLookup[sym];

    // Aviation & Airlines
    if (fullText.includes('AIRWAYS') || fullText.includes('AVIATION') || fullText.includes('SPICEJET') || fullText.includes('INDIGO') || fullText.includes('INTERGLOBE')) {
      return {
        sector: 'Aviation & Logistics',
        icon: '✈️',
        beta: 1.35,
        macroTailwind: 'High sensitivity to crude oil (ATF) commodity prices, foreign exchange fluctuations, and heavy lease debt.'
      };
    }
    // Power, Energy & Infrastructure
    if (fullText.includes('GVK') || fullText.includes('POWER') || fullText.includes('ENERGY') || fullText.includes('ADANIPOWER') || fullText.includes('TATAPOWER') || fullText.includes('INFRA')) {
      return {
        sector: 'Power & Infrastructure',
        icon: '⚡',
        beta: 1.20,
        macroTailwind: 'Capital-intensive asset base; sensitive to interest rate policy, fuel supply reliability, and state DISCOM receivables.'
      };
    }
    // Financials & NBFC
    if (fullText.includes('FINANCE') || fullText.includes('CAPITAL') || fullText.includes('HOLDINGS') || fullText.includes('SECURITIES') || fullText.includes('INVEST') || fullText.includes('BANK')) {
      return {
        sector: 'Financial Services & NBFC',
        icon: '💳',
        beta: 1.15,
        macroTailwind: 'Monitored for credit cost of funds, liquidity headroom, and asset quality stress.'
      };
    }
    // Defense / Aerospace
    if (fullText.includes('DEFENCE') || fullText.includes('DEFENSE') || fullText.includes('AEROSPACE') || fullText.includes('DYNAMICS')) {
      return {
        sector: 'Defense & Aerospace',
        icon: '🛡️',
        beta: 1.15,
        macroTailwind: 'Record defense modernization capex and multi-year sovereign export order book.'
      };
    }
    // IT / Technology
    if (fullText.includes('TECH') || fullText.includes('SOFTWARE') || fullText.includes('INFOSYS') || fullText.includes('WIPRO') || fullText.includes('SYSTEMS')) {
      return {
        sector: 'Technology & AI Services',
        icon: '💻',
        beta: 0.90,
        macroTailwind: 'Enterprise generative AI cloud transformation and global IT spending recovery.'
      };
    }
    // Auto & Mobility
    if (fullText.includes('MOTORS') || fullText.includes('AUTO') || fullText.includes('VEHICLE') || fullText.includes('MAHINDRA') || fullText.includes('MARUTI')) {
      return {
        sector: 'Automotive & EV Mobility',
        icon: '🚗',
        beta: 1.10,
        macroTailwind: 'Premiumization trends, EV battery localization, and domestic rural recovery.'
      };
    }

    return {
      sector: 'Diversified / Midcap',
      icon: '📈',
      beta: 1.0,
      macroTailwind: 'Domestic consumer consumption and manufacturing capex cycle tailwinds.'
    };
  }

  // ISIN to Ticker & Name mapping dictionary
  const isinMap = {
    'INE802G01018': { symbol: 'JETAIRWAYS', name: 'Jet Airways (India) Ltd', ticker: 'JETAIRWAYS.NS' },
    'INE034L01014': { symbol: 'ARCFIN', name: 'ARC Finance Limited', ticker: '540135.BO' },
    'ARCFIN': { symbol: 'ARCFIN', name: 'ARC Finance Limited', ticker: '540135.BO' },
    'ARCFINANCE': { symbol: 'ARCFIN', name: 'ARC Finance Limited', ticker: '540135.BO' },
    'INE251H01024': { symbol: 'GVKPIL', name: 'GVK Power & Infra Ltd', ticker: 'GVKPIL.NS' },
    'INE251H01016': { symbol: 'GVKPIL', name: 'GVK Power & Infra Ltd', ticker: 'GVKPIL.NS' },
    'GVKPIL': { symbol: 'GVKPIL', name: 'GVK Power & Infra Ltd', ticker: 'GVKPIL.NS' }
  };

  // Evaluate each holding
  for (const item of holdings) {
    const rawSym = (item.symbol || '').toUpperCase().trim();
    const isinInfo = isinMap[rawSym] || isinMap[item.isin];

    let baseSymbol = rawSym;
    let compDisplayName = item.companyName || '';
    let lookupTicker = rawSym;

    if (isinInfo) {
      baseSymbol = isinInfo.symbol;
      compDisplayName = isinInfo.name;
      lookupTicker = isinInfo.ticker;
    } else {
      baseSymbol = rawSym.replace(/\.(NS|BO)$/, '');
      lookupTicker = baseSymbol.endsWith('.NS') || baseSymbol.endsWith('.BO') ? baseSymbol : `${baseSymbol}.NS`;
    }

    let quote = null;
    try {
      quote = await financeApi.getStockQuoteAndChart(lookupTicker, '1mo', '1d', region);
    } catch (e) {
      console.warn(`[PortfolioAnalysis] Quote lookup failed for ${lookupTicker}:`, e.message);
    }

    // Price Resolution: Live market quote > statement reported price > cost basis
    const statementPrice = Number(item.closingPrice || 0);
    let currentPrice = statementPrice > 0 ? statementPrice : (item.buyPrice || 100);

    if (quote && quote.regularMarketPrice > 0 && !quote.isSynthetic) {
      currentPrice = quote.regularMarketPrice;
    } else if (statementPrice > 0) {
      currentPrice = statementPrice;
    }

    const qty = item.quantity || 1;
    const buyPrice = item.buyPrice || currentPrice;
    const invested = Math.round(qty * buyPrice * 100) / 100;
    const currVal = Math.round(qty * currentPrice * 100) / 100;
    const pnl = Math.round((currVal - invested) * 100) / 100;
    const pnlPct = invested > 0 ? Math.round(((currVal - invested) / invested) * 10000) / 100 : 0;

    totalInvested += invested;
    totalCurrentValue += currVal;

    // Macro metadata lookup
    const compName = compDisplayName || quote?.shortName || item.companyName || baseSymbol;
    const meta = resolveSectorMeta(baseSymbol, compName);

    sectorDistribution[meta.sector] = (sectorDistribution[meta.sector] || 0) + currVal;

    // =========================================================================
    // DYNAMIC CONTINUOUS MULTI-FACTOR MACRO HEALTH SCORING ENGINE
    // =========================================================================
    const baseScore = 70;

    // Factor 1: Continuous P&L & Drawdown Curve
    let pnlAdjustment = 0;
    if (pnlPct >= 50) {
      pnlAdjustment = 25;
    } else if (pnlPct >= 20) {
      pnlAdjustment = 15 + ((pnlPct - 20) / 30) * 10;
    } else if (pnlPct >= 0) {
      pnlAdjustment = (pnlPct / 20) * 15;
    } else if (pnlPct >= -15) {
      pnlAdjustment = (pnlPct / 15) * 10;
    } else if (pnlPct >= -45) {
      pnlAdjustment = -10 + ((pnlPct + 15) / 30) * 15;
    } else if (pnlPct >= -75) {
      pnlAdjustment = -25 + ((pnlPct + 45) / 30) * 17;
    } else {
      pnlAdjustment = -42 + Math.max(-15, ((pnlPct + 75) / 25) * 10);
    }

    // Factor 2: Penny Stock & Microcap Liquidity Penalty
    let pennyPenalty = 0;
    if (currentPrice < 2.0) {
      pennyPenalty = -12;
    } else if (currentPrice < 10.0) {
      pennyPenalty = -6;
    }

    // Factor 3: Sector Macro Sensitivity
    let sectorBonus = 0;
    if (meta.sector.includes('Defense') || meta.sector.includes('Aerospace')) {
      sectorBonus = 8;
    } else if (meta.sector.includes('Technology') || meta.sector.includes('Power')) {
      sectorBonus = 3;
    } else if (meta.sector.includes('Aviation')) {
      sectorBonus = -4;
    }

    // Combine into final 1-100 Score
    const rawScore = Math.round(baseScore + pnlAdjustment + pennyPenalty + sectorBonus);
    const healthScore = Math.max(15, Math.min(98, rawScore));

    // Determine Verdict, Stars, and Actionable Risk Advisory
    let verdict = 'HOLD / CONSOLIDATING';
    let verdictClass = 'neutral';
    let stars = '⭐⭐⭐';
    let riskFactor = 'Near-term consolidation; monitor support levels and earnings catalysts.';

    if (healthScore >= 90) {
      verdict = 'STRONG OUTPERFORM / HIGH CONVICTION';
      verdictClass = 'strong-bullish';
      stars = '⭐⭐⭐⭐⭐';
      riskFactor = 'High relative strength; maintain trailing stops to capture compounding.';
    } else if (healthScore >= 78) {
      verdict = 'OUTPERFORM / GROWTH COMPOUNDER';
      verdictClass = 'bullish';
      stars = '⭐⭐⭐⭐';
      riskFactor = 'Solid fundamentals; monitor quarterly earnings consistency.';
    } else if (healthScore >= 62) {
      verdict = 'ACCUMULATE / BALANCED CORE';
      verdictClass = 'bullish';
      stars = '⭐⭐⭐⭐';
      riskFactor = 'Manage normal volatility and sector rotation cycles.';
    } else if (healthScore >= 48) {
      verdict = 'UNDERPERFORM / MACRO HEADWIND';
      verdictClass = 'neutral';
      stars = '⭐⭐⭐';
      riskFactor = 'Loss of upward momentum; evaluate rebalancing or catalyst verification.';
    } else if (healthScore >= 30) {
      verdict = 'HIGH RISK / CAPITAL EROSION';
      verdictClass = 'bearish';
      stars = '⭐⭐';
      riskFactor = 'Elevated capital drawdown & liquidity risk; consider stop-loss or exit strategy.';
    } else {
      verdict = 'CRITICAL DISTRESS / SEVERE IMPAIRMENT';
      verdictClass = 'bearish';
      stars = '⭐';
      riskFactor = 'Severe value erosion (>60% drop); high risk of permanent capital loss.';
    }

    analyzedStocks.push({
      symbol: baseSymbol,
      fullSymbol: lookupTicker,
      companyName: compName,
      sector: meta.sector,
      icon: meta.icon,
      quantity: qty,
      buyPrice,
      currentPrice,
      investedValue: invested,
      currentValue: currVal,
      pnl,
      pnlPct,
      portfolioWeight: 0, // Computed in next pass
      healthScore,
      verdict,
      verdictClass,
      stars,
      macroTailwind: meta.macroTailwind,
      riskFactor,
      sparkline: quote?.sparkline || []
    });
  }

  // Calculate Portfolio Weights and Concentration Warnings
  const warnings = [];
  analyzedStocks.forEach(stock => {
    stock.portfolioWeight = totalCurrentValue > 0 ? Math.round((stock.currentValue / totalCurrentValue) * 1000) / 10 : 0;
    if (stock.portfolioWeight > 25) {
      warnings.push(`⚠️ High Single-Stock Concentration: ${stock.symbol} accounts for ${stock.portfolioWeight}% of your portfolio.`);
    }
  });

  // Calculate Sector Weights
  const sectorBreakdown = Object.keys(sectorDistribution).map(sector => ({
    sector,
    value: Math.round(sectorDistribution[sector]),
    percentage: totalCurrentValue > 0 ? Math.round((sectorDistribution[sector] / totalCurrentValue) * 1000) / 10 : 0
  })).sort((a, b) => b.percentage - a.percentage);

  if (sectorBreakdown.length > 0 && sectorBreakdown[0].percentage > 40) {
    warnings.push(`⚠️ Sector Overweight: ${sectorBreakdown[0].sector} makes up ${sectorBreakdown[0].percentage}% of total equity allocation.`);
  }

  const totalPnl = Math.round((totalCurrentValue - totalInvested) * 100) / 100;
  const totalPnlPct = totalInvested > 0 ? Math.round(((totalCurrentValue - totalInvested) / totalInvested) * 10000) / 100 : 0;

  // Aggregate Portfolio Macro Resilience Score (0 to 100)
  const avgHealth = analyzedStocks.length > 0 
    ? Math.round(analyzedStocks.reduce((acc, s) => acc + (s.healthScore * (s.portfolioWeight / 100)), 0))
    : 70;

  return {
    summary: {
      totalHoldingsCount: analyzedStocks.length,
      totalInvested: Math.round(totalInvested),
      totalCurrentValue: Math.round(totalCurrentValue),
      totalPnl,
      totalPnlPct,
      macroResilienceScore: Math.min(100, Math.max(10, avgHealth)),
      resilienceRating: avgHealth >= 85 ? 'AAA DEFENSIVE & COMPOUNDING' : avgHealth >= 70 ? 'AA BALANCED ALPHA' : 'BBB CYCLICAL VULNERABILITY',
      currency: region === 'india' ? '₹' : '$',
      analyzedAt: new Date().toISOString()
    },
    stocks: analyzedStocks.sort((a, b) => b.currentValue - a.currentValue),
    sectorBreakdown,
    warnings
  };
}

module.exports = {
  fetchGrowwHoldings,
  fetchZerodhaHoldings,
  fetchUpstoxHoldings,
  fetchAngelOneHoldings,
  fetchDhanHoldings,
  fetchFyersHoldings,
  parseHoldingsCsv,
  getSampleHoldings,
  analyzePortfolio
};
