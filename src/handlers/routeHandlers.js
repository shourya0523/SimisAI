import { handleMessage } from "./messageHandler.js";
import { sendText } from "../services/twilioService.js";

// QR configuration state
let qrConfig = {
  phone: "14155238886",
  prefill: "join find-hold",
  title: "Try SimisAI",
  subtitle: "Scan to start the demo on WhatsApp",
};

/**
 * Handle SMS/WhatsApp webhook from Twilio
 */
export async function handleSmsWebhook(req, res) {
  try {
    res.set("Content-Type", "text/xml");
    res.status(200).send("<Response></Response>");
  } catch (e) {
    console.error("Failed to send Twilio ack:", e);
  }

  const from = req.body?.From?.replace("whatsapp:", "");
  const body = req.body?.Body?.trim();
  if (!from) { 
    console.error("Missing 'From' in request body"); 
    return; 
  }

  setImmediate(async () => {
    try {
      await handleMessage(from, body);
    } catch (err) {
      console.error("Handler error:", err?.message || err);
      try { 
        await sendText(from, "Something went wrong — text ADMIN RESET to start fresh."); 
      } catch (_) {}
    }
  });
}

/**
 * Root route handler
 */
export function handleRoot(_, res) {
  res.send("SimisAI running ✓");
}

/**
 * Join route - redirect to WhatsApp
 */
export function handleJoin(_, res) {
  const waLink = `https://wa.me/${qrConfig.phone}?text=${encodeURIComponent(qrConfig.prefill)}`;
  res.redirect(waLink);
}

/**
 * QR admin page
 */
export function handleQrAdmin(_, res) {
  res.send(`<!DOCTYPE html>
<html><head><title>QR Admin</title>
<style>
body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc}
form{display:flex;flex-direction:column;gap:1rem;width:320px}
label{font-size:.85rem;color:#94a3b8}
input{padding:.5rem;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#f8fafc;font-size:1rem}
button{padding:.6rem;border-radius:8px;border:none;background:#38bdf8;color:#0f172a;font-weight:600;font-size:1rem;cursor:pointer}
.msg{margin-top:1rem;color:#4ade80}
</style></head>
<body>
<h2>QR Config</h2>
<form id="f">
<label>Phone (no +)<input name="phone" value="${qrConfig.phone}"/></label>
<label>Pre-filled message<input name="prefill" value="${qrConfig.prefill}"/></label>
<label>Title<input name="title" value="${qrConfig.title}"/></label>
<label>Subtitle<input name="subtitle" value="${qrConfig.subtitle}"/></label>
<button type="submit">Update</button>
<div class="msg" id="msg"></div>
</form>
<script>
document.getElementById('f').onsubmit=async e=>{
e.preventDefault();
const d=Object.fromEntries(new FormData(e.target));
const r=await fetch('/qr/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
document.getElementById('msg').textContent=r.ok?'Updated ✓':'Error';
};
</script>
</body></html>`);
}

/**
 * Update QR config
 */
export function handleQrAdminPost(req, res) {
  const { phone, prefill, title, subtitle } = req.body;
  if (phone) qrConfig.phone = phone;
  if (prefill) qrConfig.prefill = prefill;
  if (title) qrConfig.title = title;
  if (subtitle) qrConfig.subtitle = subtitle;
  console.log("[QR] Config updated:", qrConfig);
  res.json({ ok: true, config: qrConfig });
}

/**
 * QR code display page
 */
export function handleQr(_, res) {
  const joinUrl = `${process.env.RENDER_EXTERNAL_URL || 'https://your-app.onrender.com'}/join`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}`;
  res.send(`<!DOCTYPE html>
<html><head><title>${qrConfig.title}</title>
<style>
body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f172a;color:#f8fafc}
h1{font-size:1.8rem;margin-bottom:.25rem}
p{color:#94a3b8;margin-bottom:1.5rem;font-size:1.1rem}
img{border-radius:12px;border:4px solid #334155}
.link{margin-top:1rem;color:#38bdf8;text-decoration:none;font-size:.9rem}
</style></head>
<body>
<h1>${qrConfig.title}</h1>
<p>${qrConfig.subtitle}</p>
<img src="${qrUrl}" alt="QR Code" width="300" height="300"/>
<a class="link" href="/join">Or tap here on mobile</a>
</body></html>`);
}
