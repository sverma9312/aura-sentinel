const https = require('https');
const ranges = [
  { range: '1d', interval: '5m' },
  { range: '5d', interval: '15m' },
  { range: '1mo', interval: '1d' },
  { range: '6mo', interval: '1d' },
  { range: '1y', interval: '1wk' },
  { range: '3y', interval: '1wk' }
];

async function testRanges() {
  for (const r of ranges) {
    await new Promise((resolve) => {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/TATAPOWER.NS?interval=' + r.interval + '&range=' + r.range;
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (resp) => {
        let raw = '';
        resp.on('data', c => raw += c);
        resp.on('end', () => {
          try {
            const j = JSON.parse(raw);
            const count = j.chart?.result?.[0]?.timestamp?.length || 0;
            console.log('Range: ' + r.range.padEnd(4) + ' Interval: ' + r.interval.padEnd(4) + ' -> Status: ' + resp.statusCode + ', Points: ' + count);
          } catch(e) {
            console.log('Range: ' + r.range + ' -> Parse error');
          }
          resolve();
        });
      }).on('error', e => { console.log('Err:', e.message); resolve(); });
    });
  }
}
testRanges();
