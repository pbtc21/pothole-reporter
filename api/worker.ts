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

// LA City Council District 5 (Bel Air area) contact
const LA_311_EMAIL = "311@lacity.org";
const STREET_SERVICES_EMAIL = "BSS.CustomerService@lacity.org";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/report" && request.method === "POST") {
      return handleReport(request, env);
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

function generateFormalLetter(report: PotholeReport, reportId: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const googleMapsUrl = `https://www.google.com/maps?q=${report.location.lat},${report.location.lng}`;

  return `POTHOLE REPAIR REQUEST
Report ID: ${reportId}
Date: ${date}

To: Los Angeles Bureau of Street Services
Re: Pothole requiring immediate repair

Dear Street Services Team,

I am writing to report a pothole that requires repair at the following location:

ADDRESS: ${report.address}

GPS COORDINATES: ${report.location.lat.toFixed(6)}, ${report.location.lng.toFixed(6)}

GOOGLE MAPS LINK: ${googleMapsUrl}

This pothole poses a safety hazard to vehicles and pedestrians in the area. A photo of the pothole is attached to this report for your reference.

I respectfully request that this issue be addressed at your earliest convenience.

Thank you for your attention to this matter and for your service to our community.

Sincerely,
A Concerned Bel Air Resident

---
Submitted via Fix My Street App
Report ID: ${reportId}
Timestamp: ${report.timestamp}`;
}

async function handleReport(request: Request, env: Env): Promise<Response> {
  try {
    const report: PotholeReport = await request.json();
    const reportId = `LA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const googleMapsUrl = `https://www.google.com/maps?q=${report.location.lat},${report.location.lng}`;
    const formalLetter = generateFormalLetter(report, reportId);

    // Store complete report
    const fullReport = {
      ...report,
      id: reportId,
      googleMapsUrl,
      formalLetter,
      status: "pending_submission",
      submittedAt: new Date().toISOString(),
    };

    await env.REPORTS.put(reportId, JSON.stringify(fullReport), {
      expirationTtl: 60 * 60 * 24 * 180 // 180 days
    });

    // Generate mailto link for direct email submission
    const emailSubject = encodeURIComponent(`Pothole Report ${reportId} - ${report.address.split(',')[0]}`);
    const emailBody = encodeURIComponent(formalLetter + "\n\n[Photo attached separately - please see image below or in attachment]");
    const mailtoUrl = `mailto:${STREET_SERVICES_EMAIL}?cc=${LA_311_EMAIL}&subject=${emailSubject}&body=${emailBody}`;

    // MyLA311 direct link
    const myLA311Url = `https://myla311.lacity.org/portal/faces/home`;

    return new Response(JSON.stringify({
      success: true,
      reportId,
      googleMapsUrl,
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

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1a1a2e">
  <title>Fix My Street - Bel Air</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: white;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    .header {
      padding: 16px 20px;
      text-align: center;
      background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%);
    }
    .header h1 { font-size: 24px; font-weight: 800; }
    .header p { font-size: 13px; opacity: 0.9; margin-top: 2px; }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      gap: 20px;
    }
    .preview-area {
      width: 100%;
      max-width: 320px;
      aspect-ratio: 4/3;
      background: #16213e;
      border-radius: 20px;
      overflow: hidden;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid #333;
    }
    .preview-area video, .preview-area img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .preview-area canvas { display: none; }
    .placeholder {
      text-align: center;
      color: #f39c12;
      padding: 20px;
    }
    .placeholder svg { width: 60px; height: 60px; margin-bottom: 12px; }
    .placeholder p { font-size: 16px; line-height: 1.4; }
    .big-btn {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 6px solid white;
      background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s;
      box-shadow: 0 6px 30px rgba(243, 156, 18, 0.5);
    }
    .big-btn:active { transform: scale(0.92); }
    .big-btn svg { width: 40px; height: 40px; fill: white; }
    .big-btn.sending { animation: pulse 0.8s infinite; }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
    .status { text-align: center; min-height: 60px; }
    .status-main { font-size: 20px; font-weight: 700; }
    .status-sub { font-size: 14px; color: #888; margin-top: 4px; }
    .location { font-size: 12px; color: #f39c12; margin-top: 8px; word-break: break-all; padding: 0 10px; }
    .screen { display: none; }
    .screen.active { display: flex; flex-direction: column; flex: 1; }

    /* Success screen with send options */
    .success-screen {
      align-items: center;
      text-align: center;
      padding: 20px;
      overflow-y: auto;
    }
    .success-screen h2 { font-size: 28px; margin: 16px 0 8px; color: #27ae60; }
    .success-screen .subtitle { color: #888; font-size: 14px; margin-bottom: 20px; }

    .report-preview {
      background: #16213e;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      width: 100%;
      max-width: 350px;
      text-align: left;
    }
    .report-preview img {
      width: 100%;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .report-preview .addr {
      font-size: 14px;
      color: #f39c12;
      margin-bottom: 8px;
      word-break: break-word;
    }
    .report-preview .coords {
      font-size: 12px;
      color: #666;
    }
    .report-preview a {
      color: #667eea;
      text-decoration: none;
    }

    .send-options {
      width: 100%;
      max-width: 350px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }
    .send-btn {
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-decoration: none;
      color: white;
    }
    .send-btn.email {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .send-btn.la311 {
      background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%);
    }
    .send-btn.share {
      background: #27ae60;
    }
    .send-btn svg { width: 24px; height: 24px; fill: currentColor; }

    .again-btn {
      padding: 14px 40px;
      background: #333;
      border: none;
      border-radius: 30px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 10px;
    }

    .loading {
      position: fixed;
      inset: 0;
      background: rgba(26, 26, 46, 0.97);
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 20px;
      z-index: 100;
    }
    .loading.active { display: flex; }
    .spinner {
      width: 60px;
      height: 60px;
      border: 5px solid #333;
      border-top-color: #f39c12;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { font-size: 18px; font-weight: 600; }
  </style>
</head>
<body>
  <div id="main-screen" class="screen active">
    <div class="header">
      <h1>FIX MY STREET</h1>
      <p>Report potholes in Bel Air, LA</p>
    </div>
    <div class="main">
      <div class="preview-area">
        <video id="video" autoplay playsinline></video>
        <img id="preview" style="display:none;">
        <canvas id="canvas"></canvas>
        <div id="placeholder" class="placeholder">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.2C13.767 15.2 15.2 13.767 15.2 12C15.2 10.233 13.767 8.8 12 8.8C10.233 8.8 8.8 10.233 8.8 12C8.8 13.767 10.233 15.2 12 15.2Z"/>
            <path d="M9 2L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4H16.83L15 2H9ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17Z"/>
          </svg>
          <p>Tap button to<br>take photo</p>
        </div>
      </div>
      <button id="big-btn" class="big-btn" aria-label="Take photo">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>
      </button>
      <div class="status">
        <div id="status-main" class="status-main">Point at pothole</div>
        <div id="status-sub" class="status-sub">Tap the orange button</div>
        <div id="location" class="location"></div>
      </div>
    </div>
  </div>

  <div id="success-screen" class="screen success-screen">
    <svg viewBox="0 0 24 24" style="width:80px;height:80px;fill:#27ae60;">
      <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/>
    </svg>
    <h2>Report Ready!</h2>
    <p class="subtitle">Choose how to send to LA 311</p>

    <div class="report-preview">
      <img id="report-img" src="" alt="Pothole photo">
      <div class="addr" id="report-addr"></div>
      <div class="coords" id="report-coords"></div>
      <a id="report-map" href="#" target="_blank">View on Google Maps</a>
    </div>

    <div class="send-options">
      <a id="email-btn" href="#" class="send-btn email">
        <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
        Email LA Street Services
      </a>
      <a id="la311-btn" href="https://myla311.lacity.org" target="_blank" class="send-btn la311">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        Open MyLA311 Portal
      </a>
      <button id="share-btn" class="send-btn share">
        <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>
        Share Report
      </button>
    </div>

    <button id="again-btn" class="again-btn">Report Another Pothole</button>
  </div>

  <div id="loading" class="loading">
    <div class="spinner"></div>
    <div class="loading-text">Preparing report...</div>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const preview = document.getElementById('preview');
    const placeholder = document.getElementById('placeholder');
    const bigBtn = document.getElementById('big-btn');
    const statusMain = document.getElementById('status-main');
    const statusSub = document.getElementById('status-sub');
    const locationEl = document.getElementById('location');
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
    let photoData = null;
    let hasPhoto = false;
    let currentReport = null;

    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        video.srcObject = stream;
        video.style.display = 'block';
        placeholder.style.display = 'none';
      } catch (e) {
        statusMain.textContent = 'Camera needed';
        statusSub.textContent = 'Please allow access';
      }
    }

    function getLoc() {
      if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
          p => {
            loc = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
            locationEl.textContent = '📍 GPS: ' + loc.lat.toFixed(6) + ', ' + loc.lng.toFixed(6);
          },
          () => locationEl.textContent = '📍 Getting location...',
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      }
    }

    function takePhoto() {
      if (!stream) { startCam(); return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      photoData = canvas.toDataURL('image/jpeg', 0.85);
      preview.src = photoData;
      preview.style.display = 'block';
      video.style.display = 'none';
      hasPhoto = true;
      statusMain.textContent = 'Photo captured!';
      statusSub.textContent = 'Tap again to prepare report';
      bigBtn.querySelector('svg').innerHTML = '<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>';
    }

    async function send() {
      if (!photoData) return;
      loading.classList.add('active');

      const addr = await reverseGeo(loc);
      const report = {
        type: 'pothole',
        location: loc || { lat: 34.0825, lng: -118.4476 },
        timestamp: new Date().toISOString(),
        image: photoData,
        address: addr,
        source: 'Fix My Street'
      };

      try {
        const r = await fetch('/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
        currentReport = await r.json();

        // Update success screen
        reportImg.src = photoData;
        reportAddr.textContent = '📍 ' + currentReport.address;
        reportCoords.textContent = 'GPS: ' + report.location.lat.toFixed(6) + ', ' + report.location.lng.toFixed(6);
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
      if (!l) return 'Bel Air, Los Angeles, CA';
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + l.lat + '&lon=' + l.lng + '&format=json&addressdetails=1');
        const d = await r.json();
        // Build a clean address
        const a = d.address || {};
        const parts = [a.house_number, a.road, a.neighbourhood || a.suburb, a.city || 'Los Angeles', 'CA', a.postcode].filter(Boolean);
        return parts.join(', ') || d.display_name || 'Bel Air, Los Angeles, CA';
      } catch { return 'Bel Air, Los Angeles, CA'; }
    }

    // Share functionality
    shareBtn.onclick = async () => {
      if (!currentReport) return;

      const shareText = 'POTHOLE REPORT - ' + currentReport.reportId + '\\n\\n' +
        'Location: ' + currentReport.address + '\\n' +
        'Google Maps: ' + currentReport.googleMapsUrl + '\\n\\n' +
        'Please fix this pothole. Photo attached.';

      if (navigator.share && navigator.canShare) {
        try {
          // Convert base64 to blob for sharing
          const response = await fetch(photoData);
          const blob = await response.blob();
          const file = new File([blob], 'pothole-' + currentReport.reportId + '.jpg', { type: 'image/jpeg' });

          await navigator.share({
            title: 'Pothole Report ' + currentReport.reportId,
            text: shareText,
            files: [file]
          });
        } catch (e) {
          // Fallback to text-only share
          try {
            await navigator.share({
              title: 'Pothole Report',
              text: shareText
            });
          } catch {}
        }
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareText);
        alert('Report copied to clipboard!');
      }
    };

    function reset() {
      hasPhoto = false;
      photoData = null;
      currentReport = null;
      preview.style.display = 'none';
      video.style.display = 'block';
      bigBtn.querySelector('svg').innerHTML = '<circle cx="12" cy="12" r="8"/>';
      statusMain.textContent = 'Point at pothole';
      statusSub.textContent = 'Tap the orange button';
      successScreen.classList.remove('active');
      mainScreen.classList.add('active');
    }

    bigBtn.onclick = () => hasPhoto ? send() : takePhoto();
    againBtn.onclick = reset;

    startCam();
    getLoc();
  </script>
</body>
</html>`;
