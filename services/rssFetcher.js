/**
 * Multi-Source Global & India RSS & News Aggregator
 * Robust, zero-external-dependency XML parser for real-time financial and macroeconomic feeds.
 */

const https = require('https');
const http = require('http');

const NEWS_FEEDS_GLOBAL = [
  {
    name: 'Google News - Global Macro & Economy',
    url: 'https://news.google.com/rss/search?q=geopolitics+OR+economy+OR+central+bank+OR+interest+rates+when:3d&hl=en-US&gl=US&ceid=US:en',
    category: 'macro'
  },
  {
    name: 'Google News - Tech & Chips',
    url: 'https://news.google.com/rss/search?q=semiconductor+OR+artificial+intelligence+chips+OR+ASML+OR+NVIDIA+when:3d&hl=en-US&gl=US&ceid=US:en',
    category: 'tech'
  },
  {
    name: 'Google News - Defense & Global Security',
    url: 'https://news.google.com/rss/search?q=defense+spending+OR+military+nato+OR+Lockheed+OR+geopolitical+conflict+when:3d&hl=en-US&gl=US&ceid=US:en',
    category: 'defense'
  },
  {
    name: 'Google News - Energy & Commodities',
    url: 'https://news.google.com/rss/search?q=crude+oil+OR+uranium+OR+nuclear+energy+OR+OPEC+when:3d&hl=en-US&gl=US&ceid=US:en',
    category: 'energy'
  },
  {
    name: 'Yahoo Finance Top News',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'markets'
  }
];

const NEWS_FEEDS_INDIA = [
  {
    name: 'Google News - India Economy & RBI Policy',
    url: 'https://news.google.com/rss/search?q=India+economy+OR+RBI+repo+rate+OR+Sensex+OR+Nifty+OR+FII+inflow+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'macro_india'
  },
  {
    name: 'Google News - India Defense & Make in India',
    url: 'https://news.google.com/rss/search?q=India+defense+spending+OR+Make+in+India+OR+HAL+OR+BEL+OR+Mazagon+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'defense_india'
  },
  {
    name: 'Google News - India Energy, Solar & Grid Capex',
    url: 'https://news.google.com/rss/search?q=India+renewable+energy+OR+Tata+Power+OR+IREDA+OR+NTPC+OR+solar+grid+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'energy_india'
  },
  {
    name: 'Google News - India Infrastructure & Rail Capex',
    url: 'https://news.google.com/rss/search?q=India+infrastructure+capex+OR+Larsen+Toubro+OR+railway+vande+bharat+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'infra_india'
  },
  {
    name: 'Google News - India IT Services & Corporate Deals',
    url: 'https://news.google.com/rss/search?q=TCS+OR+Infosys+OR+HCLTech+OR+India+IT+exports+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'tech_india'
  }
];

/**
 * Clean XML entities and HTML tags from string
 */
function cleanXmlText(str) {
  if (!str) return '';
  let text = str.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
  // First unescape all standard HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Thoroughly strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fetch data over HTTP/HTTPS with timeout and follow redirects
 */
function fetchUrl(url, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error('Too many redirects'));
    }

    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SentinelMacro/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      timeout: 8000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const parsed = new URL(url);
          redirectUrl = new URL(redirectUrl, parsed.origin).href;
        }
        return fetchUrl(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP status ${res.statusCode}`));
      }

      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => resolve(rawData));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', err => reject(err));
  });
}

/**
 * Parse XML items from RSS payload
 */
function parseRssXml(xmlString, feedSource, category) {
  const items = [];
  const itemMatches = xmlString.match(/<item[\s>](.*?)<\/item>/gs);

  if (!itemMatches) return items;

  for (const itemXml of itemMatches) {
    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/s);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/s);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/s);
    const descMatch = itemXml.match(/<description>(.*?)<\/description>/s);
    const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/s);

    const title = cleanXmlText(titleMatch ? titleMatch[1] : '');
    const link = linkMatch ? linkMatch[1].trim() : '';
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toUTCString();
    const description = cleanXmlText(descMatch ? descMatch[1] : '');
    const source = cleanXmlText(sourceMatch ? sourceMatch[1] : feedSource);

    if (title && title.length > 5) {
      items.push({
        id: Buffer.from(title + pubDate).toString('base64').substring(0, 16),
        title,
        description,
        source: source || feedSource,
        link,
        pubDate: new Date(pubDate).toISOString() || new Date().toISOString(),
        feedCategory: category,
        rawText: `${title}. ${description}`
      });
    }
  }

  return items;
}

/**
 * Fetch all RSS feeds in parallel based on region ('global' or 'india')
 */
async function fetchAllGlobalNews(region = 'global') {
  const feeds = region === 'india' ? NEWS_FEEDS_INDIA : NEWS_FEEDS_GLOBAL;
  const allArticles = [];
  const errors = [];

  const promises = feeds.map(async feed => {
    try {
      const xml = await fetchUrl(feed.url);
      const parsed = parseRssXml(xml, feed.name, feed.category);
      return parsed;
    } catch (err) {
      errors.push({ feed: feed.name, error: err.message });
      return [];
    }
  });

  const results = await Promise.allSettled(promises);
  results.forEach(res => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      allArticles.push(...res.value);
    }
  });

  const uniqueArticles = [];
  const seenTitles = new Set();

  for (const article of allArticles) {
    const norm = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 45);
    if (!seenTitles.has(norm)) {
      seenTitles.add(norm);
      uniqueArticles.push(article);
    }
  }

  return {
    articles: uniqueArticles,
    totalFetched: uniqueArticles.length,
    errors,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Targeted News Query for Stock Search Deep Dive
 */
async function fetchTargetedStockNews(ticker, companyName, region = 'global') {
  const cleanTicker = ticker.replace(/\.(NS|BO)/i, '');
  const locationParam = region === 'india' ? '&hl=en-IN&gl=IN&ceid=IN:en' : '&hl=en-US&gl=US&ceid=US:en';
  const query = encodeURIComponent(`${cleanTicker} OR "${companyName}" stock market news`);
  const url = `https://news.google.com/rss/search?q=${query}+when:7d${locationParam}`;

  try {
    const xml = await fetchUrl(url);
    const parsed = parseRssXml(xml, `Live Feed (${cleanTicker})`, 'stock_search');
    return parsed.slice(0, 12);
  } catch (err) {
    console.warn(`Targeted news fetch failed for ${ticker}:`, err.message);
    return [];
  }
}

module.exports = {
  fetchAllGlobalNews,
  fetchTargetedStockNews,
  NEWS_FEEDS_GLOBAL,
  NEWS_FEEDS_INDIA
};
