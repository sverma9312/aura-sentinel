/**
 * Gemini AI Client — AURA SENTINEL
 * Uses Google Gemini Flash (free tier) to generate enhanced macro narrative summaries
 * from pre-processed news sentiment data.
 * Free Tier: 15 req/min, 1M tokens/day — no credit card required.
 */

const https = require('https');

const GEMINI_API_URL = 'generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-3.6-flash'; // Google Gemini 3.6 Flash model

/**
 * Makes a POST request to Gemini API.
 * @param {string} prompt - The prompt to send
 * @returns {Promise<string>} - The AI-generated text response
 */
function callGeminiApi(prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'PASTE_YOUR_KEY_HERE') {
      return reject(new Error('GEMINI_API_KEY not configured in .env file'));
    }

    const body = JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
        topP: 0.9
      }
    });

    const options = {
      hostname: GEMINI_API_URL,
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          // Handle API errors gracefully
          if (parsed.error) {
            return reject(new Error(`Gemini API error: ${parsed.error.message}`));
          }

          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            return reject(new Error('Gemini returned empty response'));
          }
          resolve(text.trim());
        } catch (e) {
          reject(new Error(`Failed to parse Gemini response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Gemini network error: ${err.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Gemini request timed out (30s)'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Generate a macro market intelligence narrative for a given region.
 * @param {string} region - 'india' or 'global'
 * @param {Array} topArticles - Array of top processed news articles
 * @param {number} overallScore - Overall sentiment score (-100 to +100)
 * @param {Array} sectors - Sector analysis results
 * @returns {Promise<string>} - AI-generated market narrative (2-3 sentences)
 */
async function generateMacroNarrative(region, topArticles, overallScore, sectors) {
  const regionLabel = region === 'india' ? 'Indian (NSE/BSE)' : 'Global (US & World)';

  // Build a compact news digest for the prompt (avoids large token usage)
  const headlines = topArticles
    .slice(0, 8)
    .map((a, i) => `${i + 1}. [${a.sentimentLabel || 'NEUTRAL'}] ${a.title}`)
    .join('\n');

  const topSectors = sectors
    .sort((a, b) => Math.abs(b.tailwindScore) - Math.abs(a.tailwindScore))
    .slice(0, 3)
    .map(s => `${s.sectorName}: ${s.stance} (score: ${s.tailwindScore})`)
    .join(', ');

  const prompt = `You are a Chief Financial Strategist analyzing ${regionLabel} financial markets.
Synthesize today's breaking news and sector sentiment data into a clear, insightful, and actionable macro market intelligence brief.

MARKET METRICS:
- Market Sentiment Score: ${overallScore}/100 (${overallScore >= 15 ? 'Bullish expansion' : overallScore <= -15 ? 'Defensive/Headwinds' : 'Neutral/Selective'})
- Leading Sectors with Tailwinds: ${topSectors}

KEY BREAKING HEADLINES TODAY:
${headlines}

INSTRUCTIONS FOR OUTPUT:
Write a cohesive 2 to 3-sentence executive summary that clearly explains:
1. The primary macroeconomic catalyst or policy driver from today's news.
2. How this catalyst specifically impacts key leading sectors (e.g. Infrastructure, Auto/EV, Defense, IT, or Banking).
3. The actionable takeaway or market outlook for equity investors.

Ensure the text is complete, professional, beautifully written in clear business English, and immediately understandable. Do NOT use bullet points or markdown headers.`;

  try {
    const narrative = await callGeminiApi(prompt);
    console.log('[GeminiClient] AI macro narrative generated successfully.');
    return narrative;
  } catch (err) {
    console.warn(`[GeminiClient] Narrative generation failed: ${err.message}. Using fallback.`);
    // Graceful fallback — does not break the app if Gemini fails
    const direction = overallScore > 10 ? 'bullish' : overallScore < -10 ? 'bearish' : 'mixed';
    return `${regionLabel} markets show ${direction} sentiment with an aggregate score of ${overallScore}. ` +
           `Key sector drivers: ${topSectors}. Analysis based on ${topArticles.length} live news articles.`;
  }
}

/**
 * Generate a stock-specific AI analysis.
 * @param {string} ticker - Stock ticker symbol
 * @param {string} region - 'india' or 'global'
 * @param {number} sentimentScore - Pre-computed NLP sentiment score
 * @param {Array} catalysts - Top news catalysts for this stock
 * @returns {Promise<string>} - AI-generated stock brief
 */
async function generateStockBrief(ticker, region, sentimentScore, catalysts) {
  if (!catalysts || catalysts.length === 0) {
    return null; // Skip if no news catalysts
  }

  const headlines = catalysts
    .slice(0, 4)
    .map((c, i) => `${i + 1}. ${c.title}`)
    .join('\n');

  const prompt = `You are a financial analyst. For the stock ${ticker} (${region === 'india' ? 'NSE/BSE listed' : 'US/Global listed'}), write a single sentence investment signal based on today's news:

Sentiment Score: ${sentimentScore} (positive = bullish, negative = bearish)
Recent Headlines:
${headlines}

Write ONE concise sentence (max 25 words) describing the current catalyst or risk for ${ticker}. Be specific and direct:`;

  try {
    return await callGeminiApi(prompt);
  } catch (err) {
    console.warn(`[GeminiClient] Stock brief failed for ${ticker}: ${err.message}`);
    return null; // Falls back silently, keeps existing NLP analysis
  }
}

module.exports = { generateMacroNarrative, generateStockBrief };
