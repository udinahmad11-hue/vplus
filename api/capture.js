const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const url = req.url;
    
    // Jika ada parameter action=run, jalankan capture
    if (url.includes('action=run')) {
      try {
        console.log('🎯 Starting capture process...');
        const result = await captureHeaders();
        return res.status(200).json(result);
      } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({
          status: 'error',
          message: error.message,
          stack: error.stack
        });
      }
    }
    
    // Tampilkan halaman HTML
    const html = getHtml();
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }

  res.status(404).json({ error: 'Not found' });
};

async function captureHeaders() {
  console.log('🚀 Starting capture...');
  
  const CHANNEL_ID = "1";
  let captured = null;
  let browser = null;

  try {
    // Dapatkan executable path Chromium
    console.log('📥 Getting Chromium executable...');
    const executablePath = await chromium.executablePath();
    console.log('✅ Chromium path:', executablePath);

    // Launch browser
    console.log('🔄 Launching browser...');
    browser = await puppeteer.launch({
      executablePath: executablePath,
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--single-process',
        '--no-zygote'
      ],
      headless: true,
      defaultViewport: {
        width: 1280,
        height: 720
      }
    });

    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Monitor requests
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = request.url();
      
      // Cek apakah ini request ke API play
      if (url.includes('contentcdn.visionplus.id/v2/play') &&
          url.includes(`channel_id=${CHANNEL_ID}`) &&
          !captured) {
        
        console.log('✅ API Play captured!');
        captured = {
          url: url,
          method: request.method(),
          headers: request.headers()
        };
      }
      
      request.continue();
    });

    console.log(`📺 Opening channel ID: ${CHANNEL_ID}`);
    
    // Navigate to page
    await page.goto(`https://preview.visionplus.id/free/livetv?channel=${CHANNEL_ID}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Tunggu API call (max 25 detik)
    console.log('⏳ Waiting for API call...');
    for (let i = 0; i < 50 && !captured; i++) {
      await new Promise(r => setTimeout(r, 500));
    }

    await browser.close();
    console.log('🔒 Browser closed');

  } catch (error) {
    console.error('❌ Error in capture:', error);
    if (browser) await browser.close();
    throw error;
  }

  // Process result
  if (!captured) {
    return {
      status: 'error',
      message: 'API tidak tertangkap dalam batas waktu',
      channel_id: CHANNEL_ID
    };
  }

  // Filter headers
  const importantHeaders = [
    'accept', 'accept-language', 'authorization', 'device-id',
    'origin', 'partner', 'referer', 'request-token', 'user-agent',
    'x-signature', 'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'
  ];

  const filteredHeaders = {};
  for (const [k, v] of Object.entries(captured.headers)) {
    if (importantHeaders.includes(k.toLowerCase())) {
      filteredHeaders[k] = v;
    }
  }

  return {
    status: 'success',
    channel_id: CHANNEL_ID,
    request_url: captured.url,
    method: captured.method,
    headers: filteredHeaders,
    timestamp: new Date().toISOString()
  };
}

function getHtml() {
  return `<!DOCTYPE html>
<html>
<head>
    <title>VisionPlus Headers Capture</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #0a0f1e; 
            color: #e0e0e0;
            line-height: 1.6;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
        }
        h1 { 
            color: #00d4ff; 
            border-bottom: 2px solid #2a3a5a; 
            padding-bottom: 15px;
        }
        button { 
            background: #0055ff; 
            color: white; 
            border: none; 
            padding: 15px 30px; 
            font-size: 18px; 
            border-radius: 8px; 
            cursor: pointer; 
            font-weight: bold;
            transition: all 0.3s;
            margin: 20px 0;
        }
        button:hover { 
            background: #0044cc; 
            transform: translateY(-2px);
        }
        button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .loading { 
            display: none;
            margin-left: 15px;
            color: #ffaa00;
            font-weight: bold;
        }
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,170,0,0.3);
            border-radius: 50%;
            border-top-color: #ffaa00;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        pre { 
            background: #1a1f30; 
            padding: 20px; 
            border-radius: 10px; 
            overflow: auto; 
            border: 1px solid #2a3a5a;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            white-space: pre-wrap;
        }
        .curl-box {
            background: #1e2a3a;
            border-left: 4px solid #00d4ff;
            margin: 20px 0;
            padding: 15px;
            border-radius: 5px;
        }
        .curl-box h3 {
            margin: 0 0 10px 0;
            color: #00d4ff;
        }
        .curl-box pre {
            background: #0a1a2a;
            color: #ffaa00;
            margin: 0;
        }
        .info {
            background: #1a2a3a;
            padding: 10px 15px;
            border-radius: 5px;
            margin: 10px 0;
            color: #88aaff;
        }
        .warning {
            background: #332a1a;
            color: #ffaa00;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
            border-left: 4px solid #ffaa00;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 VisionPlus Headers Capture (Vercel)</h1>
        
        <div class="warning">
            ⚠️ Vercel memiliki batas waktu 60 detik. Jika timeout, coba lagi.
        </div>
        
        <div class="info">
            📍 Channel ID: 1 
        </div>
        
        <div>
            <button onclick="capture()" id="captureBtn">🔥 Capture Headers Now</button>
            <span class="loading" id="loading">
                <span class="spinner"></span>
                Processing... (30-60 detik)
            </span>
        </div>

        <div id="curlContainer" class="curl-box" style="display: none;">
            <h3>📋 CURL Format</h3>
            <pre id="curlOutput"></pre>
        </div>

        <div>
            <h3>📊 JSON Output</h3>
            <pre id="result">Klik tombol untuk mulai capture...</pre>
        </div>
    </div>

    <script>
        async function capture() {
            const btn = document.getElementById('captureBtn');
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');
            const curlContainer = document.getElementById('curlContainer');
            const curlOutput = document.getElementById('curlOutput');
            
            btn.disabled = true;
            loading.style.display = 'inline';
            result.textContent = '⏳ Mengambil data...';
            curlContainer.style.display = 'none';
            
            try {
                const response = await fetch('/api/capture?action=run&t=' + Date.now());
                const data = await response.json();
                
                if (data.status === 'success' && data.headers) {
                    let curlCmd = \`curl '\${data.request_url}' \\\\\n\`;
                    for (const [key, value] of Object.entries(data.headers)) {
                        curlCmd += \`  -H '\${key}: \${value}' \\\\\n\`;
                    }
                    curlOutput.textContent = curlCmd;
                    curlContainer.style.display = 'block';
                }
                
                result.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                result.textContent = '❌ Error: ' + error.message;
            } finally {
                btn.disabled = false;
                loading.style.display = 'none';
            }
        }
    </script>
</body>
</html>`;
}
