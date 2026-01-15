/**
 * POTHOLE LA - Bauhaus Edition
 * Reports potholes to LA 311 with interpolated street addresses
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

    if (url.pathname.startsWith("/image/")) {
      const reportId = url.pathname.replace("/image/", "");
      return serveImage(reportId, env);
    }

    if (url.pathname.startsWith("/view/")) {
      const reportId = url.pathname.replace("/view/", "");
      return serveReportPage(reportId, env);
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // OG Image - Bauhaus style
    if (url.pathname === "/og.png") {
      return serveOGImage();
    }

    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};

function serveOGImage(): Response {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect fill="#FFFEF0" width="1200" height="630"/>
    <rect fill="#1a1a1a" x="0" y="0" width="1200" height="120"/>
    <circle cx="60" cy="60" r="20" fill="#E53935"/>
    <circle cx="110" cy="60" r="20" fill="#FFC107"/>
    <circle cx="160" cy="60" r="20" fill="#1565C0"/>
    <text x="220" y="72" font-family="system-ui,sans-serif" font-size="32" font-weight="900" fill="#FFFEF0" letter-spacing="6">POTHOLE LA</text>
    <circle cx="300" cy="380" r="180" fill="none" stroke="#E53935" stroke-width="16"/>
    <line x1="300" y1="200" x2="300" y2="560" stroke="#E53935" stroke-width="8"/>
    <line x1="120" y1="380" x2="480" y2="380" stroke="#E53935" stroke-width="8"/>
    <rect x="600" y="200" width="500" height="80" fill="#1a1a1a"/>
    <text x="620" y="255" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#FFFEF0">SNAP</text>
    <rect x="600" y="300" width="500" height="80" fill="#FFC107"/>
    <text x="620" y="355" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#1a1a1a">LOCATE</text>
    <rect x="600" y="400" width="500" height="80" fill="#1565C0"/>
    <text x="620" y="455" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#FFFEF0">REPORT</text>
    <text x="600" y="550" font-family="system-ui,sans-serif" font-size="18" fill="#666" letter-spacing="2">POTHOLELA.COM</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400"
    }
  });
}

async function serveImage(reportId: string, env: Env): Promise<Response> {
  const data = await env.REPORTS.get(reportId);
  if (!data) return new Response("Not found", { status: 404 });
  const report = JSON.parse(data);
  const base64 = report.image.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000" },
  });
}

async function serveReportPage(reportId: string, env: Env): Promise<Response> {
  const data = await env.REPORTS.get(reportId);
  if (!data) return new Response("Report not found", { status: 404 });
  const report = JSON.parse(data);
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report ${reportId}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;background:#FFFEF0;color:#1a1a1a;min-height:100vh;padding:24px}
.container{max-width:480px;margin:0 auto}
h1{font-size:14px;font-weight:900;letter-spacing:4px;text-transform:uppercase;margin-bottom:24px;display:flex;align-items:center;gap:12px}
h1::before{content:'';width:24px;height:24px;background:#E53935;border-radius:50%}
img{width:100%;aspect-ratio:4/3;object-fit:cover;border:4px solid #1a1a1a;margin-bottom:24px}
.info{border:4px solid #1a1a1a;padding:20px;margin-bottom:16px}
.label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#666;margin-bottom:4px}
.value{font-size:18px;font-weight:700;margin-bottom:16px}
.value:last-child{margin-bottom:0}
a{color:#1565C0;text-decoration:none;border-bottom:2px solid currentColor}
</style></head>
<body>
<div class="container">
<h1>Pothole Report</h1>
<img src="/image/${reportId}" alt="Pothole">
<div class="info">
<div class="label">Report ID</div>
<div class="value">${reportId}</div>
<div class="label">Address</div>
<div class="value">${report.address}</div>
<div class="label">Coordinates</div>
<div class="value">${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}</div>
<div class="label">Map</div>
<div class="value"><a href="${report.googleMapsUrl}" target="_blank">View on Google Maps</a></div>
</div>
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
      expirationTtl: 60 * 60 * 24 * 180
    });

    const formalLetter = generateFormalLetter(report, reportId, googleMapsUrl, imageUrl, viewUrl);
    const streetName = report.address.split(',')[0] || 'Unknown Location';
    const emailSubject = encodeURIComponent(`Pothole Report ${reportId} - ${streetName}`);
    const emailBody = encodeURIComponent(formalLetter);
    const mailtoUrl = `mailto:${STREET_SERVICES_EMAIL}?cc=${LA_311_EMAIL}&subject=${emailSubject}&body=${emailBody}`;

    return new Response(JSON.stringify({
      success: true,
      reportId,
      googleMapsUrl,
      imageUrl,
      viewUrl,
      formalLetter,
      mailtoUrl,
      myLA311Url: "https://myla311.lacity.org/portal/faces/home",
      address: report.address,
      message: "Report ready!",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Failed to process report" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

function generateFormalLetter(report: PotholeReport, reportId: string, googleMapsUrl: string, imageUrl: string, viewUrl: string): string {
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
A Concerned LA Resident

---
Submitted via POTHOLE LA
Report ID: ${reportId}`;
}

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#FFFEF0">
  <title>POTHOLE LA</title>
  <meta name="description" content="Report LA potholes with GPS precision. Snap, locate, report.">
  <meta property="og:title" content="POTHOLE LA">
  <meta property="og:description" content="Report LA potholes with GPS precision. Bauhaus-inspired civic tech.">
  <meta property="og:image" content="https://potholela.com/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%231a1a1a' width='100' height='100'/><circle cx='30' cy='50' r='15' fill='%23E53935'/><circle cx='50' cy='50' r='15' fill='%23FFC107'/><circle cx='70' cy='50' r='15' fill='%231565C0'/></svg>">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    :root {
      --red: #E53935;
      --blue: #1565C0;
      --yellow: #FFC107;
      --black: #1a1a1a;
      --cream: #FFFEF0;
    }

    body {
      font-family: 'DM Sans', -apple-system, sans-serif;
      background: var(--cream);
      color: var(--black);
      min-height: 100vh;
      min-height: 100dvh;
    }

    /* HEADER - Bauhaus geometric */
    .header {
      background: var(--black);
      color: var(--cream);
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .logo {
      display: flex;
      gap: 6px;
    }
    .logo span {
      width: 16px;
      height: 16px;
      border-radius: 50%;
    }
    .logo span:nth-child(1) { background: var(--red); }
    .logo span:nth-child(2) { background: var(--yellow); }
    .logo span:nth-child(3) { background: var(--blue); }
    .header h1 {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    /* GPS BAR */
    .gps-bar {
      padding: 16px 24px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 4px solid var(--black);
    }
    .gps-bar.searching {
      background: var(--yellow);
      color: var(--black);
    }
    .gps-bar.locked {
      background: var(--blue);
      color: white;
    }
    .gps-bar.error {
      background: var(--red);
      color: white;
      cursor: pointer;
    }
    .gps-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1s infinite;
    }
    .gps-bar.locked .gps-dot { animation: none; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

    /* MAIN */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      gap: 24px;
    }

    /* VIEWFINDER */
    .viewfinder {
      width: 100%;
      max-width: 360px;
      aspect-ratio: 4/3;
      background: var(--black);
      position: relative;
      border: 4px solid var(--black);
    }
    .viewfinder video, .viewfinder img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .viewfinder canvas { display: none; }

    /* Bauhaus crosshair */
    .crosshair {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      display: none;
    }
    .crosshair .circle {
      width: 60px;
      height: 60px;
      border: 3px solid var(--red);
      border-radius: 50%;
    }
    .crosshair .h-line, .crosshair .v-line {
      position: absolute;
      background: var(--red);
    }
    .crosshair .h-line {
      width: 80px;
      height: 3px;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .crosshair .v-line {
      width: 3px;
      height: 80px;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #666;
      gap: 8px;
    }
    .placeholder-icon {
      width: 48px;
      height: 48px;
      border: 3px solid #666;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    /* BIG BUTTON - Bauhaus circle */
    .capture-btn {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 4px solid var(--black);
      background: var(--cream);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      position: relative;
    }
    .capture-btn::before {
      content: '';
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #ccc;
      transition: all 0.15s;
    }
    .capture-btn.ready::before { background: var(--red); }
    .capture-btn.captured::before { background: var(--blue); }
    .capture-btn:active { transform: scale(0.95); }
    .capture-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .capture-btn:disabled:active { transform: none; }

    /* STATUS */
    .status {
      text-align: center;
    }
    .status-main {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .status-sub {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
      letter-spacing: 1px;
    }

    /* SCREENS */
    .screen { display: none; }
    .screen.active { display: flex; flex-direction: column; min-height: 100vh; }

    /* SUCCESS SCREEN */
    .success-header {
      background: var(--blue);
      color: white;
      padding: 24px;
      text-align: center;
    }
    .success-header h2 {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 4px;
      text-transform: uppercase;
    }

    .report-card {
      padding: 24px;
    }
    .report-card img {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: cover;
      border: 4px solid var(--black);
      margin-bottom: 24px;
    }
    .field {
      margin-bottom: 20px;
    }
    .field-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    .field-value {
      font-size: 16px;
      font-weight: 700;
    }
    .field-value a {
      color: var(--blue);
      text-decoration: none;
      border-bottom: 2px solid currentColor;
    }

    /* ACTION BUTTONS */
    .actions {
      padding: 0 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      border: 4px solid var(--black);
      background: var(--cream);
      font-family: inherit;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-decoration: none;
      color: var(--black);
      cursor: pointer;
      transition: all 0.1s;
      -webkit-appearance: none;
      appearance: none;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    .action-btn:active {
      transform: translate(2px, 2px);
    }
    .action-btn.primary {
      background: var(--red);
      color: white;
      border-color: var(--red);
    }
    .action-btn.secondary {
      background: var(--blue);
      color: white;
      border-color: var(--blue);
    }
    .action-btn .icon {
      font-size: 18px;
    }

    .again-btn {
      margin: 24px;
      padding: 16px;
      background: transparent;
      border: 2px solid #ccc;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #666;
      cursor: pointer;
    }

    /* LOADING */
    .loading {
      position: fixed;
      inset: 0;
      background: var(--cream);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      z-index: 100;
    }
    .loading.active { display: flex; }
    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--black);
      border-top-color: var(--red);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    /* HELP MODAL */
    .modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 200;
    }
    .modal.active { display: flex; }
    .modal-card {
      background: var(--cream);
      border: 4px solid var(--black);
      padding: 24px;
      max-width: 320px;
      width: 100%;
    }
    .modal-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .modal-icon {
      width: 48px;
      height: 48px;
      background: var(--yellow);
      border-radius: 50%;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .modal-header h3 {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .tab {
      flex: 1;
      padding: 12px;
      border: 2px solid var(--black);
      background: transparent;
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      cursor: pointer;
    }
    .tab.active {
      background: var(--black);
      color: white;
    }
    .steps { display: none; }
    .steps.active { display: block; }
    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: white;
      border: 2px solid #eee;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .step-num {
      width: 24px;
      height: 24px;
      background: var(--black);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .modal-actions {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  </style>
</head>
<body>

<div id="main-screen" class="screen active">
  <div class="header">
    <div class="logo"><span></span><span></span><span></span></div>
    <h1>Pothole LA</h1>
  </div>

  <div id="gps-bar" class="gps-bar searching">
    <div class="gps-dot"></div>
    <span id="gps-text">Acquiring location...</span>
  </div>

  <div class="main">
    <div class="viewfinder">
      <video id="video" autoplay playsinline style="display:none"></video>
      <img id="preview" style="display:none">
      <canvas id="canvas"></canvas>
      <div id="placeholder" class="placeholder">
        <div class="placeholder-icon">?</div>
        <span style="font-size:12px;letter-spacing:1px">CAMERA LOADING</span>
      </div>
      <div id="crosshair" class="crosshair">
        <div class="circle"></div>
        <div class="h-line"></div>
        <div class="v-line"></div>
      </div>
    </div>

    <button id="capture-btn" class="capture-btn" disabled></button>

    <div class="status">
      <div id="status-main" class="status-main">Waiting</div>
      <div id="status-sub" class="status-sub">Need GPS lock first</div>
    </div>
  </div>
</div>

<div id="success-screen" class="screen">
  <div class="success-header">
    <h2>Report Ready</h2>
  </div>

  <div class="report-card">
    <img id="report-img" src="" alt="Pothole">
    <div class="field">
      <div class="field-label">Address</div>
      <div class="field-value" id="report-addr"></div>
    </div>
    <div class="field">
      <div class="field-label">Coordinates</div>
      <div class="field-value" id="report-coords"></div>
    </div>
    <div class="field">
      <div class="field-label">Map</div>
      <div class="field-value"><a id="report-map" href="#" target="_blank">Open in Google Maps</a></div>
    </div>
  </div>

  <div class="actions">
    <button id="email-btn" class="action-btn primary">
      <span class="icon">✉</span> Email Street Services
    </button>
    <a href="https://myla311.lacity.org" target="_blank" class="action-btn secondary">
      <span class="icon">☎</span> Open LA311 Portal
    </a>
    <button id="share-btn" class="action-btn">
      <span class="icon">↗</span> Share Report
    </button>
  </div>

  <button id="again-btn" class="again-btn">Report Another</button>
</div>

<div id="loading" class="loading">
  <div class="loading-spinner"></div>
  <div class="loading-text">Processing...</div>
</div>

<div id="help-modal" class="modal">
  <div class="modal-card">
    <div class="modal-header">
      <div class="modal-icon">!</div>
      <h3>Enable Location</h3>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="showTab('ios')">iPhone</button>
      <button class="tab" onclick="showTab('android')">Android</button>
    </div>
    <div id="ios-steps" class="steps active">
      <div class="step"><span class="step-num">1</span> Open Settings</div>
      <div class="step"><span class="step-num">2</span> Tap Safari/Chrome</div>
      <div class="step"><span class="step-num">3</span> Tap Location</div>
      <div class="step"><span class="step-num">4</span> Select "While Using"</div>
    </div>
    <div id="android-steps" class="steps">
      <div class="step"><span class="step-num">1</span> Open Settings</div>
      <div class="step"><span class="step-num">2</span> Apps → Chrome</div>
      <div class="step"><span class="step-num">3</span> Permissions</div>
      <div class="step"><span class="step-num">4</span> Location → Allow</div>
    </div>
    <div class="modal-actions">
      <button class="action-btn primary" onclick="retryGPS()">Try Again</button>
      <button class="action-btn" onclick="closeHelp()">Cancel</button>
    </div>
  </div>
</div>

<script>
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const preview = document.getElementById('preview');
const placeholder = document.getElementById('placeholder');
const crosshair = document.getElementById('crosshair');
const captureBtn = document.getElementById('capture-btn');
const statusMain = document.getElementById('status-main');
const statusSub = document.getElementById('status-sub');
const gpsBar = document.getElementById('gps-bar');
const gpsText = document.getElementById('gps-text');
const loading = document.getElementById('loading');
const mainScreen = document.getElementById('main-screen');
const successScreen = document.getElementById('success-screen');
const helpModal = document.getElementById('help-modal');

let stream = null;
let loc = null;
let gpsReady = false;
let cameraReady = false;
let photoData = null;
let hasPhoto = false;
let currentReport = null;

function updateUI() {
  if (hasPhoto) {
    captureBtn.className = 'capture-btn captured';
    captureBtn.disabled = false;
    statusMain.textContent = 'Captured';
    statusSub.textContent = 'Tap to send report';
  } else if (gpsReady && cameraReady) {
    captureBtn.className = 'capture-btn ready';
    captureBtn.disabled = false;
    statusMain.textContent = 'Ready';
    statusSub.textContent = 'Tap to photograph';
    crosshair.style.display = 'block';
  } else if (!gpsReady) {
    captureBtn.className = 'capture-btn';
    captureBtn.disabled = true;
    statusMain.textContent = 'Waiting';
    statusSub.textContent = 'Acquiring GPS...';
  } else {
    captureBtn.className = 'capture-btn';
    captureBtn.disabled = true;
    statusMain.textContent = 'Camera';
    statusSub.textContent = 'Please allow access';
  }
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    cameraReady = true;
    updateUI();
  } catch (e) {
    placeholder.innerHTML = '<div class="placeholder-icon">✕</div><span style="font-size:12px">CAMERA BLOCKED</span>';
  }
}

function initGPS() {
  if (!navigator.geolocation) {
    gpsText.textContent = 'GPS not available';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      gpsReady = true;
      gpsBar.className = 'gps-bar locked';
      gpsText.textContent = Math.round(loc.accuracy) + 'm accuracy';
      updateUI();
      watchGPS();
    },
    err => {
      if (err.code === 1) {
        gpsBar.className = 'gps-bar error';
        gpsText.textContent = 'Location blocked — tap to fix';
        gpsBar.onclick = () => helpModal.classList.add('active');
      } else {
        gpsText.textContent = 'GPS error — retrying...';
        setTimeout(initGPS, 2000);
      }
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function watchGPS() {
  navigator.geolocation.watchPosition(
    pos => {
      loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      gpsText.textContent = Math.round(loc.accuracy) + 'm • ' + loc.lat.toFixed(5) + ', ' + loc.lng.toFixed(5);
    },
    () => {},
    { enableHighAccuracy: true }
  );
}

function showTab(platform) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.steps').forEach(s => s.classList.remove('active'));
  document.querySelector('.tab:' + (platform === 'ios' ? 'first-child' : 'last-child')).classList.add('active');
  document.getElementById(platform + '-steps').classList.add('active');
}

function retryGPS() {
  helpModal.classList.remove('active');
  gpsBar.className = 'gps-bar searching';
  gpsText.textContent = 'Retrying...';
  initGPS();
}

function closeHelp() {
  helpModal.classList.remove('active');
}

function takePhoto() {
  if (!stream) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  photoData = canvas.toDataURL('image/jpeg', 0.85);
  preview.src = photoData;
  preview.style.display = 'block';
  video.style.display = 'none';
  crosshair.style.display = 'none';
  hasPhoto = true;
  updateUI();
}

async function sendReport() {
  if (!photoData || !loc) return;
  loading.classList.add('active');

  const addr = await getAddress(loc);
  const report = {
    type: 'pothole',
    location: loc,
    timestamp: new Date().toISOString(),
    image: photoData,
    address: addr,
    source: 'POTHOLE LA'
  };

  try {
    const res = await fetch('/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    currentReport = await res.json();

    document.getElementById('report-img').src = photoData;
    document.getElementById('report-addr').textContent = currentReport.address;
    document.getElementById('report-coords').textContent = loc.lat.toFixed(6) + ', ' + loc.lng.toFixed(6);
    document.getElementById('report-map').href = currentReport.googleMapsUrl;
    // mailtoUrl stored in currentReport for click handler

  } catch (e) {
    console.error(e);
  }

  loading.classList.remove('active');
  mainScreen.classList.remove('active');
  successScreen.classList.add('active');
}

// Improved address interpolation using block numbers
async function getAddress(l) {
  if (!l) return 'Los Angeles, CA';

  try {
    // Get street info from Nominatim
    const res = await fetch(
      'https://nominatim.openstreetmap.org/reverse?lat=' + l.lat + '&lon=' + l.lng +
      '&format=json&addressdetails=1&zoom=18&extratags=1'
    );
    const data = await res.json();
    const addr = data.address || {};
    const road = addr.road || addr.street || '';

    if (!road) return data.display_name || 'Los Angeles, CA';

    // Try to get nearby addresses to interpolate
    let streetNum = addr.house_number;

    if (!streetNum) {
      // Query for nearby addresses on this street
      streetNum = await interpolateAddress(l, road);
    }

    const parts = [];
    if (streetNum && road) {
      parts.push(streetNum + ' ' + road);
    } else if (road) {
      parts.push(road);
    }

    if (addr.neighbourhood) parts.push(addr.neighbourhood);
    else if (addr.suburb) parts.push(addr.suburb);

    parts.push(addr.city || 'Los Angeles');
    parts.push('CA');
    if (addr.postcode) parts.push(addr.postcode);

    return parts.join(', ');

  } catch (e) {
    console.error('Geocoding error:', e);
    return 'Los Angeles, CA';
  }
}

// Interpolate street number from nearby addresses
async function interpolateAddress(loc, streetName) {
  try {
    // Search for nearby addresses on this street
    const searchUrl = 'https://nominatim.openstreetmap.org/search?street=' +
      encodeURIComponent(streetName) +
      '&city=Los+Angeles&state=CA&format=json&limit=10&addressdetails=1';

    const res = await fetch(searchUrl);
    const places = await res.json();

    // Filter places with house numbers
    const withNumbers = places.filter(p => p.address && p.address.house_number)
      .map(p => ({
        num: parseInt(p.address.house_number),
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lon)
      }))
      .filter(p => !isNaN(p.num));

    if (withNumbers.length < 2) {
      // Fallback: estimate based on typical LA block numbering
      // LA uses 100 addresses per block, baseline varies by area
      return estimateFromBlock(loc, streetName);
    }

    // Sort by distance to our location
    withNumbers.sort((a, b) => {
      const distA = Math.hypot(a.lat - loc.lat, a.lng - loc.lng);
      const distB = Math.hypot(b.lat - loc.lat, b.lng - loc.lng);
      return distA - distB;
    });

    // Take two closest points to interpolate
    const p1 = withNumbers[0];
    const p2 = withNumbers[1] || withNumbers[0];

    if (p1 === p2) return p1.num.toString();

    // Linear interpolation based on position
    const totalDist = Math.hypot(p2.lat - p1.lat, p2.lng - p1.lng);
    const ourDist = Math.hypot(loc.lat - p1.lat, loc.lng - p1.lng);
    const ratio = Math.min(1, Math.max(0, ourDist / totalDist));

    let interpolated = Math.round(p1.num + (p2.num - p1.num) * ratio);

    // Round to nearest even or odd based on side of street
    // (In LA, even/odd typically alternates by side)
    const bearing = Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat);
    const perpendicular = bearing + Math.PI / 2;
    const side = Math.sign(
      (loc.lat - p1.lat) * Math.cos(perpendicular) +
      (loc.lng - p1.lng) * Math.sin(perpendicular)
    );

    // Adjust to match street side convention
    if (side > 0 && interpolated % 2 === 0) interpolated++;
    else if (side < 0 && interpolated % 2 === 1) interpolated++;

    return interpolated.toString();

  } catch (e) {
    console.error('Interpolation error:', e);
    return estimateFromBlock(loc, streetName);
  }
}

// Estimate address from LA's block numbering system
function estimateFromBlock(loc, streetName) {
  // LA's address grid:
  // - Downtown (Main St/1st St) is the baseline
  // - Numbers increase 100 per block going outward
  // - Rough estimates based on distance from downtown

  const dtLat = 34.0522;  // Downtown LA latitude
  const dtLng = -118.2437; // Downtown LA longitude

  // Distance in "blocks" (roughly 1/8 mile = 0.002 degrees)
  const blockSize = 0.002;

  // Calculate blocks from downtown
  const latBlocks = Math.abs(loc.lat - dtLat) / blockSize;
  const lngBlocks = Math.abs(loc.lng - dtLng) / blockSize;

  // Determine if street runs N-S or E-W based on name
  const nsPatterns = /^[NSEW]\\s|\\s(Ave|Avenue|St|Street|Blvd|Boulevard|Dr|Drive)$/i;
  const isNS = streetName.match(/^(N|S|North|South)/i) ||
               streetName.match(/(Ave|Avenue|Way|Place|Pl)$/i);

  // Use appropriate axis for address
  const blocks = isNS ? lngBlocks : latBlocks;

  // Base address + 100 per block
  let estimate = Math.round(100 + blocks * 100);

  // Round to nearest 10 for realism
  estimate = Math.round(estimate / 10) * 10;

  // Add some randomness within the block (±50)
  estimate += Math.floor(Math.random() * 50);

  return estimate.toString() + ' (approx)';
}

document.getElementById('share-btn').onclick = async () => {
  if (!currentReport) return;
  const text = 'POTHOLE REPORT ' + currentReport.reportId +
    '\\n' + currentReport.address +
    '\\n' + currentReport.googleMapsUrl;

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Pothole Report', text });
    } catch {}
  } else {
    await navigator.clipboard.writeText(text);
    alert('Copied!');
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
  updateUI();
}

captureBtn.onclick = () => {
  if (captureBtn.disabled) return;
  hasPhoto ? sendReport() : takePhoto();
};

document.getElementById('again-btn').onclick = reset;

const emailBtn = document.getElementById('email-btn');
function handleEmailClick(e) {
  e.preventDefault();
  if (currentReport && currentReport.mailtoUrl) {
    window.location.href = currentReport.mailtoUrl;
  }
}
emailBtn.addEventListener('click', handleEmailClick);
emailBtn.addEventListener('touchend', handleEmailClick);

// Init
startCamera();
initGPS();
updateUI();
</script>
</body>
</html>`;
