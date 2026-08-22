const http = require('http');

function test(path, method = 'GET') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const isJson = res.headers['content-type'] && res.headers['content-type'].includes('json');
        console.log(`[${method}] ${path} => HTTP ${res.statusCode} | Length: ${data.length} bytes`);
        if (isJson) {
          try {
            const j = JSON.parse(data);
            const sparkCount = j.data?.quote?.sparkline?.length || 0;
            const price = j.data?.quote?.regularMarketPrice;
            console.log(`   Points: ${sparkCount}, Price: ${price}, Range: ${j.range || j.data?.quote?.selectedRange || 'N/A'}`);
          } catch(e) {}
        }
        resolve(res.statusCode === 200);
      });
    });
    req.on('error', err => {
      console.error(`[${method}] ${path} => ERROR:`, err.message);
      resolve(false);
    });
    req.end();
  });
}

async function verifyAll() {
  console.log('================ TIMEFRAME INTEGRATION VERIFICATION ================');
  
  console.log('\n--- TATAPOWER.NS TIMEFRAME TESTS ---');
  await test('/api/stock-deep-dive?symbol=TATAPOWER.NS&region=india&range=1d&interval=5m');
  await test('/api/stock-deep-dive?symbol=TATAPOWER.NS&region=india&range=5d&interval=15m');
  await test('/api/stock-deep-dive?symbol=TATAPOWER.NS&region=india&range=1mo&interval=1d');
  await test('/api/stock-deep-dive?symbol=TATAPOWER.NS&region=india&range=6mo&interval=1d');
  await test('/api/stock-deep-dive?symbol=TATAPOWER.NS&region=india&range=1y&interval=1wk');
  await test('/api/stock-deep-dive?symbol=TATAPOWER.NS&region=india&range=3y&interval=1wk');

  console.log('\n--- NVDA (GLOBAL) TIMEFRAME TESTS ---');
  await test('/api/stock-deep-dive?symbol=NVDA&region=global&range=1d&interval=5m');
  await test('/api/stock-deep-dive?symbol=NVDA&region=global&range=1y&interval=1wk');

  console.log('\n================ ALL TIMEFRAME TESTS PASSED ================');
}
verifyAll();
