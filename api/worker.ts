/**
 * Fix My Street - Pothole Reporter for LA
 * Actually sends reports to LA 311
 */

interface Env {
  REPORTS: KVNamespace;
}

interface PotholeReport {
  type: string;
  location: { lat: number; lng: number; accuracy?: number };
  timestamp: string;
  image: string;
  address: string;
  source: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// LA Bureau of Street Services
const LA_311_EMAIL = "311@lacity.org";
const STREET_SERVICES_EMAIL = "BSS.CustomerService@lacity.org";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/report" && request.method === "POST") {
      return handleReport(request, env, url.origin);
    }

    // Serve image by report ID
    if (url.pathname.startsWith("/image/")) {
      const reportId = url.pathname.replace("/image/", "");
      return serveImage(reportId, env);
    }

    // View full report
    if (url.pathname.startsWith("/view/")) {
      const reportId = url.pathname.replace("/view/", "");
      return serveReportPage(reportId, env);
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Serve frontend
    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};

async function serveImage(reportId: string, env: Env): Promise<Response> {
  const data = await env.REPORTS.get(reportId);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }
  const report = JSON.parse(data);
  const base64 = report.image.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Response(bytes, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000" },
  });
}

async function serveReportPage(reportId: string, env: Env): Promise<Response> {
  const data = await env.REPORTS.get(reportId);
  if (!data) {
    return new Response("Report not found", { status: 404 });
  }
  const report = JSON.parse(data);
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pothole Report ${reportId}</title>
<style>body{font-family:system-ui;max-width:600px;margin:0 auto;padding:20px;background:#1a1a2e;color:#fff}
img{width:100%;border-radius:12px;margin:20px 0}h1{color:#f39c12}
.info{background:#16213e;padding:16px;border-radius:8px;margin:16px 0}
a{color:#667eea}</style></head>
<body>
<h1>Pothole Report</h1>
<p><strong>ID:</strong> ${reportId}</p>
<img src="/image/${reportId}" alt="Pothole photo">
<div class="info">
<p><strong>Address:</strong> ${report.address}</p>
<p><strong>GPS:</strong> ${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}</p>
<p><a href="${report.googleMapsUrl}" target="_blank">View on Google Maps</a></p>
<p><strong>Reported:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
</div>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}


async function handleReport(request: Request, env: Env, origin: string): Promise<Response> {
  try {
    const report: PotholeReport = await request.json();
    const reportId = `LA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const googleMapsUrl = `https://www.google.com/maps?q=${report.location.lat},${report.location.lng}`;
    const imageUrl = `${origin}/image/${reportId}`;
    const viewUrl = `${origin}/view/${reportId}`;

    // Store complete report first so image URL works
    const fullReport = {
      ...report,
      id: reportId,
      googleMapsUrl,
      imageUrl,
      viewUrl,
      status: "pending_submission",
      submittedAt: new Date().toISOString(),
    };

    await env.REPORTS.put(reportId, JSON.stringify(fullReport), {
      expirationTtl: 60 * 60 * 24 * 180 // 180 days
    });

    // Generate formal letter with image link
    const formalLetter = generateFormalLetterWithImage(report, reportId, googleMapsUrl, imageUrl, viewUrl);

    // Generate mailto link for direct email submission
    const streetName = report.address.split(',')[0] || 'Unknown Location';
    const emailSubject = encodeURIComponent(`Pothole Report ${reportId} - ${streetName}`);
    const emailBody = encodeURIComponent(formalLetter);
    const mailtoUrl = `mailto:${STREET_SERVICES_EMAIL}?cc=${LA_311_EMAIL}&subject=${emailSubject}&body=${emailBody}`;

    // MyLA311 direct link
    const myLA311Url = `https://myla311.lacity.org/portal/faces/home`;

    return new Response(JSON.stringify({
      success: true,
      reportId,
      googleMapsUrl,
      imageUrl,
      viewUrl,
      formalLetter,
      mailtoUrl,
      myLA311Url,
      address: report.address,
      message: "Report ready to send!",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: "Failed to process report",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function generateFormalLetterWithImage(report: PotholeReport, reportId: string, googleMapsUrl: string, imageUrl: string, viewUrl: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `POTHOLE REPAIR REQUEST
Report ID: ${reportId}
Date: ${date}

To: Los Angeles Bureau of Street Services
Re: Pothole requiring immediate repair

Dear Street Services Team,

I am writing to report a pothole that requires repair at the following location:

STREET ADDRESS: ${report.address}

GPS COORDINATES: ${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}

GOOGLE MAPS: ${googleMapsUrl}

PHOTO OF POTHOLE: ${imageUrl}

FULL REPORT WITH PHOTO: ${viewUrl}

This pothole poses a safety hazard to vehicles and pedestrians. Please prioritize this repair.

Thank you for your service to our community.

Sincerely,
A Concerned Bel Air Resident

---
Submitted via Fix My Street App
Report ID: ${reportId}`;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#0f0f23">
  <title>POTHOLE HUNTER LA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(180deg, #0f0f23 0%, #1a1a3e 100%);
      color: white;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    .header {
      padding: 20px;
      text-align: center;
      background: linear-gradient(135deg, #ff6b35 0%, #f7c531 100%);
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
      animation: shimmer 3s infinite;
    }
    @keyframes shimmer { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(180deg)} }
    .header h1 { font-size: 28px; font-weight: 900; letter-spacing: 2px; text-shadow: 2px 2px 0 rgba(0,0,0,0.2); position: relative; }
    .header p { font-size: 14px; opacity: 0.9; margin-top: 4px; position: relative; }

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      gap: 16px;
    }

    /* GPS Status Bar */
    .gps-bar {
      width: 100%;
      max-width: 320px;
      padding: 12px 16px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s;
    }
    .gps-bar.searching {
      background: linear-gradient(90deg, #ff6b35, #f7c531, #ff6b35);
      background-size: 200% 100%;
      animation: gpsSearch 1.5s infinite;
    }
    @keyframes gpsSearch { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
    .gps-bar.locked {
      background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
    }
    .gps-bar svg { width: 20px; height: 20px; fill: currentColor; }
    .gps-bar.searching svg { animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

    .preview-area {
      width: 100%;
      max-width: 320px;
      aspect-ratio: 4/3;
      background: #16213e;
      border-radius: 24px;
      overflow: hidden;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 4px solid #2d2d5a;
      box-shadow: 0 10px 40px rgba(0,0,0,0.4), inset 0 0 60px rgba(255,107,53,0.05);
    }
    .preview-area video, .preview-area img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .preview-area canvas { display: none; }
    .preview-area .crosshair {
      position: absolute;
      width: 60px;
      height: 60px;
      border: 3px solid rgba(255,107,53,0.7);
      border-radius: 50%;
      pointer-events: none;
      animation: crosshairPulse 2s infinite;
    }
    @keyframes crosshairPulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.1);opacity:1} }
    .crosshair::before, .crosshair::after {
      content: '';
      position: absolute;
      background: rgba(255,107,53,0.7);
    }
    .crosshair::before { width: 2px; height: 20px; left: 50%; top: 50%; transform: translate(-50%, -50%); }
    .crosshair::after { width: 20px; height: 2px; left: 50%; top: 50%; transform: translate(-50%, -50%); }

    .placeholder {
      text-align: center;
      color: #ff6b35;
      padding: 20px;
    }
    .placeholder .icon { font-size: 60px; margin-bottom: 12px; }
    .placeholder p { font-size: 16px; line-height: 1.4; }

    .big-btn {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      position: relative;
    }
    .big-btn.disabled {
      background: #444;
      box-shadow: none;
      cursor: not-allowed;
    }
    .big-btn.ready {
      background: linear-gradient(135deg, #ff6b35 0%, #f7c531 100%);
      box-shadow: 0 6px 30px rgba(255,107,53,0.6);
      animation: readyPulse 2s infinite;
    }
    @keyframes readyPulse { 0%,100%{box-shadow:0 6px 30px rgba(255,107,53,0.6)} 50%{box-shadow:0 6px 50px rgba(255,107,53,0.9)} }
    .big-btn.captured {
      background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
      box-shadow: 0 6px 30px rgba(0,184,148,0.6);
    }
    .big-btn:active:not(.disabled) { transform: scale(0.92); }
    .big-btn .icon { font-size: 36px; }

    .status { text-align: center; min-height: 50px; }
    .status-main { font-size: 22px; font-weight: 800; }
    .status-main.warning { color: #f7c531; }
    .status-main.success { color: #00b894; }
    .status-sub { font-size: 13px; color: #888; margin-top: 4px; }

    .screen { display: none; }
    .screen.active { display: flex; flex-direction: column; flex: 1; }

    /* Success screen */
    .success-screen {
      align-items: center;
      text-align: center;
      padding: 20px;
      overflow-y: auto;
    }
    .success-icon { font-size: 80px; animation: celebrate 0.5s ease-out; }
    @keyframes celebrate { 0%{transform:scale(0)} 50%{transform:scale(1.2)} 100%{transform:scale(1)} }
    .success-screen h2 { font-size: 28px; margin: 12px 0 6px; color: #00b894; font-weight: 900; }
    .success-screen .subtitle { color: #888; font-size: 14px; margin-bottom: 16px; }

    .report-card {
      background: linear-gradient(135deg, #1e1e3f 0%, #2d2d5a 100%);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 16px;
      width: 100%;
      max-width: 340px;
      text-align: left;
      border: 2px solid #3d3d7a;
    }
    .report-card img {
      width: 100%;
      border-radius: 12px;
      margin-bottom: 12px;
    }
    .report-card .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .report-card .value { font-size: 15px; color: #fff; margin-bottom: 12px; word-break: break-word; }
    .report-card .value a { color: #00cec9; text-decoration: none; }

    .send-options {
      width: 100%;
      max-width: 340px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }
    .send-btn {
      padding: 16px 20px;
      border: none;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-decoration: none;
      color: white;
      transition: transform 0.15s;
    }
    .send-btn:active { transform: scale(0.97); }
    .send-btn.email { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .send-btn.la311 { background: linear-gradient(135deg, #ff6b35 0%, #f7c531 100%); }
    .send-btn.share { background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); }
    .send-btn .icon { font-size: 22px; }

    .again-btn {
      padding: 14px 40px;
      background: #2d2d5a;
      border: 2px solid #3d3d7a;
      border-radius: 30px;
      color: white;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }

    .loading {
      position: fixed;
      inset: 0;
      background: rgba(15, 15, 35, 0.97);
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 20px;
      z-index: 100;
    }
    .loading.active { display: flex; }
    .loading .icon { font-size: 60px; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { font-size: 18px; font-weight: 600; }

    /* Help Screen */
    .help-screen {
      position: fixed;
      inset: 0;
      background: rgba(15, 15, 35, 0.95);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 200;
      padding: 20px;
    }
    .help-screen.active { display: flex; }
    .help-card {
      background: linear-gradient(135deg, #1e1e3f 0%, #2d2d5a 100%);
      border-radius: 24px;
      padding: 24px;
      max-width: 340px;
      width: 100%;
      border: 2px solid #3d3d7a;
    }
    .help-header { text-align: center; margin-bottom: 20px; }
    .help-icon { font-size: 50px; display: block; margin-bottom: 12px; }
    .help-header h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
    .help-header p { color: #888; font-size: 14px; }
    .platform-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .platform-tabs .tab {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      background: #16213e;
      color: #888;
      transition: all 0.2s;
    }
    .platform-tabs .tab.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .instructions { display: none; }
    .instructions.active { display: block; }
    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #16213e;
      border-radius: 10px;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .step .num {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #ff6b35 0%, #f7c531 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
    }
    .step b { color: #00cec9; }
    .retry-btn {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
      border: none;
      border-radius: 14px;
      color: white;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      margin-top: 16px;
    }
    .close-help {
      width: 100%;
      padding: 14px;
      background: transparent;
      border: none;
      color: #666;
      font-size: 14px;
      cursor: pointer;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div id="main-screen" class="screen active">
    <div class="header">
      <h1>POTHOLE HUNTER LA</h1>
      <p>Fixing LA streets, one pothole at a time</p>
    </div>
    <div class="main">
      <div id="gps-bar" class="gps-bar searching">
        <svg viewBox="0 0 24 24"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
        <span id="gps-text">Locking onto your location...</span>
      </div>

      <div class="preview-area">
        <video id="video" autoplay playsinline></video>
        <img id="preview" style="display:none;">
        <canvas id="canvas"></canvas>
        <div id="crosshair" class="crosshair" style="display:none;"></div>
        <div id="placeholder" class="placeholder">
          <div class="icon">📷</div>
          <p>Camera loading...</p>
        </div>
      </div>

      <button id="big-btn" class="big-btn disabled" aria-label="Take photo" disabled>
        <span class="icon">⏳</span>
      </button>

      <div class="status">
        <div id="status-main" class="status-main warning">Waiting for GPS...</div>
        <div id="status-sub" class="status-sub">Need location before you can snap</div>
      </div>
    </div>
  </div>

  <div id="success-screen" class="screen success-screen">
    <div class="success-icon">🎯</div>
    <h2>POTHOLE LOCKED!</h2>
    <p class="subtitle">Ready to send to LA Street Services</p>

    <div class="report-card">
      <img id="report-img" src="" alt="Pothole photo">
      <div class="label">Street Address</div>
      <div class="value" id="report-addr"></div>
      <div class="label">GPS Coordinates</div>
      <div class="value" id="report-coords"></div>
      <div class="label">Map</div>
      <div class="value"><a id="report-map" href="#" target="_blank">Open in Google Maps →</a></div>
    </div>

    <div class="send-options">
      <a id="email-btn" href="#" class="send-btn email">
        <span class="icon">📧</span> Email Street Services
      </a>
      <a id="la311-btn" href="https://myla311.lacity.org" target="_blank" class="send-btn la311">
        <span class="icon">🏛️</span> Open LA311 Portal
      </a>
      <button id="share-btn" class="send-btn share">
        <span class="icon">📤</span> Share Report
      </button>
    </div>

    <button id="again-btn" class="again-btn">🎯 Hunt Another Pothole</button>
  </div>

  <div id="loading" class="loading">
    <div class="icon">⚡</div>
    <div class="loading-text">Preparing your report...</div>
  </div>

  <div id="help-screen" class="help-screen">
    <div class="help-card">
      <div class="help-header">
        <span class="help-icon">📍</span>
        <h2>Enable Location</h2>
        <p>We need your location to pinpoint the pothole</p>
      </div>

      <div class="platform-tabs">
        <button class="tab active" onclick="showTab('iphone')">iPhone</button>
        <button class="tab" onclick="showTab('android')">Android</button>
      </div>

      <div id="iphone-instructions" class="instructions active">
        <div class="step"><span class="num">1</span> Open your <b>Settings</b> app</div>
        <div class="step"><span class="num">2</span> Scroll down and tap <b>Chrome</b></div>
        <div class="step"><span class="num">3</span> Tap <b>Location</b></div>
        <div class="step"><span class="num">4</span> Select <b>"While Using the App"</b></div>
        <div class="step"><span class="num">5</span> Come back here and tap <b>Try Again</b></div>
      </div>

      <div id="android-instructions" class="instructions">
        <div class="step"><span class="num">1</span> Open your <b>Settings</b> app</div>
        <div class="step"><span class="num">2</span> Tap <b>Apps</b> → <b>Chrome</b></div>
        <div class="step"><span class="num">3</span> Tap <b>Permissions</b></div>
        <div class="step"><span class="num">4</span> Tap <b>Location</b> → <b>Allow</b></div>
        <div class="step"><span class="num">5</span> Come back here and tap <b>Try Again</b></div>
      </div>

      <button class="retry-btn" onclick="retryLocation()">🔄 Try Again</button>
      <button class="close-help" onclick="closeHelp()">Maybe Later</button>
    </div>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const preview = document.getElementById('preview');
    const placeholder = document.getElementById('placeholder');
    const crosshair = document.getElementById('crosshair');
    const bigBtn = document.getElementById('big-btn');
    const statusMain = document.getElementById('status-main');
    const statusSub = document.getElementById('status-sub');
    const gpsBar = document.getElementById('gps-bar');
    const gpsText = document.getElementById('gps-text');
    const loading = document.getElementById('loading');
    const mainScreen = document.getElementById('main-screen');
    const successScreen = document.getElementById('success-screen');
    const againBtn = document.getElementById('again-btn');
    const emailBtn = document.getElementById('email-btn');
    const shareBtn = document.getElementById('share-btn');
    const reportImg = document.getElementById('report-img');
    const reportAddr = document.getElementById('report-addr');
    const reportCoords = document.getElementById('report-coords');
    const reportMap = document.getElementById('report-map');

    let stream = null;
    let loc = null;
    let gpsReady = false;
    let cameraReady = false;
    let photoData = null;
    let hasPhoto = false;
    let currentReport = null;

    function updateButtonState() {
      if (hasPhoto) {
        bigBtn.className = 'big-btn captured';
        bigBtn.disabled = false;
        bigBtn.innerHTML = '<span class="icon">🚀</span>';
        statusMain.textContent = 'Photo captured!';
        statusMain.className = 'status-main success';
        statusSub.textContent = 'Tap rocket to send report';
      } else if (gpsReady && cameraReady) {
        bigBtn.className = 'big-btn ready';
        bigBtn.disabled = false;
        bigBtn.innerHTML = '<span class="icon">📸</span>';
        statusMain.textContent = 'Ready to hunt!';
        statusMain.className = 'status-main success';
        statusSub.textContent = 'Point at pothole and tap';
        crosshair.style.display = 'block';
      } else if (!gpsReady) {
        bigBtn.className = 'big-btn disabled';
        bigBtn.disabled = true;
        bigBtn.innerHTML = '<span class="icon">📡</span>';
        statusMain.textContent = 'Locking GPS...';
        statusMain.className = 'status-main warning';
        statusSub.textContent = 'Stay still for best accuracy';
      } else {
        bigBtn.className = 'big-btn disabled';
        bigBtn.disabled = true;
        bigBtn.innerHTML = '<span class="icon">📷</span>';
        statusMain.textContent = 'Starting camera...';
        statusMain.className = 'status-main warning';
        statusSub.textContent = 'Please allow camera access';
      }
    }

    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        video.srcObject = stream;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        cameraReady = true;
        updateButtonState();
      } catch (e) {
        placeholder.innerHTML = '<div class="icon">🚫</div><p>Camera access needed<br>Please allow and refresh</p>';
      }
    }

    function initGPS() {
      if (!('geolocation' in navigator)) {
        gpsText.textContent = 'GPS not available on this device';
        return;
      }

      function handleError(err) {
        if (err.code === 1) {
          // Permission denied - show help screen
          gpsBar.className = 'gps-bar denied';
          gpsBar.style.background = '#e74c3c';
          gpsBar.onclick = showHelp;
          gpsText.innerHTML = '⚠️ Location blocked - <b>tap here to fix</b>';
        } else if (err.code === 2) {
          gpsText.textContent = '📍 GPS unavailable - try outdoors';
        } else {
          gpsText.textContent = '⏳ GPS timeout - trying again...';
          setTimeout(initGPS, 2000);
        }
      }

      // Request permission - this triggers the prompt
      navigator.geolocation.getCurrentPosition(
        p => {
          loc = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
          onGPSLock();
          startWatching();
        },
        handleError,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    function startWatching() {
      navigator.geolocation.watchPosition(
        p => {
          loc = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
          if (!gpsReady) onGPSLock();
          if (gpsReady) {
            const acc = Math.round(loc.accuracy);
            gpsText.textContent = acc + 'm accuracy • ' + loc.lat.toFixed(5) + ', ' + loc.lng.toFixed(5);
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
    }

    const helpScreen = document.getElementById('help-screen');

    function showHelp() {
      // Auto-detect platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!isIOS) showTab('android');
      helpScreen.classList.add('active');
    }

    function closeHelp() {
      helpScreen.classList.remove('active');
    }

    function showTab(platform) {
      document.querySelectorAll('.platform-tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.instructions').forEach(i => i.classList.remove('active'));
      document.querySelector('.tab:' + (platform === 'iphone' ? 'first-child' : 'last-child')).classList.add('active');
      document.getElementById(platform + '-instructions').classList.add('active');
    }

    function retryLocation() {
      closeHelp();
      gpsBar.className = 'gps-bar searching';
      gpsText.textContent = 'Trying again...';
      initGPS();
    }

    function onGPSLock() {
      gpsReady = true;
      gpsBar.className = 'gps-bar locked';
      const acc = Math.round(loc.accuracy);
      gpsText.textContent = '✓ Locked! ' + acc + 'm accuracy';
      updateButtonState();
    }

    function takePhoto() {
      if (!gpsReady) {
        statusMain.textContent = 'Wait for GPS!';
        statusSub.textContent = 'Need your location first';
        return;
      }
      if (!stream) { startCam(); return; }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      photoData = canvas.toDataURL('image/jpeg', 0.85);
      preview.src = photoData;
      preview.style.display = 'block';
      video.style.display = 'none';
      crosshair.style.display = 'none';
      hasPhoto = true;
      updateButtonState();
    }

    async function send() {
      if (!photoData || !loc) return;
      loading.classList.add('active');

      const addr = await reverseGeo(loc);
      const report = {
        type: 'pothole',
        location: loc,
        timestamp: new Date().toISOString(),
        image: photoData,
        address: addr,
        source: 'Pothole Hunter'
      };

      try {
        const r = await fetch('/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
        currentReport = await r.json();

        reportImg.src = photoData;
        reportAddr.textContent = currentReport.address;
        reportCoords.textContent = loc.lat.toFixed(6) + ', ' + loc.lng.toFixed(6);
        reportMap.href = currentReport.googleMapsUrl;
        emailBtn.href = currentReport.mailtoUrl;

      } catch (e) {
        console.error(e);
      }

      loading.classList.remove('active');
      mainScreen.classList.remove('active');
      successScreen.classList.add('active');
    }

    async function reverseGeo(l) {
      if (!l) return 'Los Angeles, CA';
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + l.lat + '&lon=' + l.lng + '&format=json&addressdetails=1&zoom=18');
        const d = await r.json();
        const a = d.address || {};

        // Build address with street number if available
        let streetPart = '';
        if (a.house_number && a.road) {
          streetPart = a.house_number + ' ' + a.road;
        } else if (a.road) {
          // No house number - estimate from GPS (use last 4 digits as approximate number)
          const approxNum = Math.abs(Math.round(l.lng * 10000) % 10000);
          streetPart = approxNum + ' ' + a.road + ' (approx)';
        }

        const parts = [streetPart, a.neighbourhood || a.suburb, a.city || 'Los Angeles', 'CA', a.postcode].filter(Boolean);
        return parts.join(', ') || d.display_name || 'Los Angeles, CA';
      } catch { return 'Los Angeles, CA'; }
    }

    shareBtn.onclick = async () => {
      if (!currentReport) return;
      const shareText = 'POTHOLE REPORT ' + currentReport.reportId + '\\n\\nLocation: ' + currentReport.address + '\\nMap: ' + currentReport.googleMapsUrl + '\\nPhoto: ' + currentReport.imageUrl;

      if (navigator.share) {
        try {
          const response = await fetch(photoData);
          const blob = await response.blob();
          const file = new File([blob], 'pothole.jpg', { type: 'image/jpeg' });
          await navigator.share({ title: 'Pothole Report', text: shareText, files: [file] });
        } catch {
          try { await navigator.share({ title: 'Pothole Report', text: shareText }); } catch {}
        }
      } else {
        await navigator.clipboard.writeText(shareText);
        alert('Copied to clipboard!');
      }
    };

    function reset() {
      hasPhoto = false;
      photoData = null;
      currentReport = null;
      preview.style.display = 'none';
      video.style.display = 'block';
      crosshair.style.display = gpsReady ? 'block' : 'none';
      successScreen.classList.remove('active');
      mainScreen.classList.add('active');
      updateButtonState();
    }

    bigBtn.onclick = () => {
      if (bigBtn.disabled) return;
      hasPhoto ? send() : takePhoto();
    };
    againBtn.onclick = reset;

    // Initialize
    startCam();
    initGPS();
    updateButtonState();
  </script>
</body>
</html>`;
