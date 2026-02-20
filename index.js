import express from "express";
import twilio from "twilio";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Init ────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.urlencoded({ extended: false }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  safetySettings: [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
  ],
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WA_FROM = "whatsapp:+14155238886";
const sessions = new Map();

// ─── Session Helpers ──────────────────────────────────────────────────────────

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { mode: "demo", history: [], isNew: true, currentCap: null });
  }
  return sessions.get(phone);
}

function resetSession(phone, mode = "demo") {
  sessions.set(phone, { mode, history: [], isNew: true, currentCap: null });
}

// ─── Send Helper ──────────────────────────────────────────────────────────────

async function sendText(to, body) {
  return twilioClient.messages.create({
    from: WA_FROM,
    to: `whatsapp:${to}`,
    body,
  });
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

const MENU = `\u{1F44B} Welcome to the *SimisAI* live demo.

Simi is an AI health companion for epilepsy patients that existing tools leave behind \u2014 no app, no smartphone, no internet required. Just a text message, on any phone, in any language.

What makes SimisAI different:
\u2022 Works on any phone including basic flip phones
\u2022 Fully multilingual and culturally adaptive
\u2022 Billable under Remote Patient Monitoring (RPM) codes
\u2022 Reaches the 40% of low-income patients excluded by app-based care

Pick a capability to experience it firsthand:

1\uFE0F\u20E3 Medication Reminders
2\uFE0F\u20E3 Seizure Tracking
3\uFE0F\u20E3 Mental Health Screening
4\uFE0F\u20E3 Risk Forecasting
5\uFE0F\u20E3 Provider Scheduling
6\uFE0F\u20E3 Caregiver Coordination
7\uFE0F\u20E3 Refill Reminders
8\uFE0F\u20E3 Side Effect Monitoring
9\uFE0F\u20E3 Language Support

Reply with a number to begin. Reply 0 at any time to return here.`;

async function sendMenu(to) {
  return sendText(to, MENU);
}

// ─── Capability Maps ──────────────────────────────────────────────────────────

const CAPABILITY_MAP = {
  "1": "medication",
  "2": "seizure",
  "3": "mental",
  "4": "risk",
  "5": "schedule",
  "6": "caregiver",
  "7": "refill",
  "8": "sideeffect",
  "9": "language",
};

const CAPABILITIES = {
  medication:  "medication reminders and adherence tracking",
  seizure:     "seizure tracking and emergency escalation",
  mental:      "mental health screening embedded in casual conversation",
  risk:        "personalized seizure risk forecasting",
  schedule:    "scheduling a provider call and generating a visit summary",
  caregiver:   "caregiver coordination with patient-controlled privacy",
  refill:      "medication refill reminders",
  sideeffect:  "side effect monitoring",
  language:    "multilingual adaptability \u2014 if the user writes in another language, respond fully in that language with culturally native phrasing to demonstrate this capability",
};

const INSIGHTS = {
  medication:  "This data trail is what prevents patients from being misclassified as drug-resistant epilepsy.",
  seizure:     "Longitudinal seizure data between visits is something a 15-minute appointment can never capture.",
  mental:      "30-40% of epilepsy patients have undiagnosed depression predicting non-adherence \u2014 casual check-ins get answers clinical forms never do.",
  risk:        "This shifts epilepsy care from reactive to preventive.",
  schedule:    "The visit summary means the appointment is actually productive instead of starting from scratch.",
  caregiver:   "In communities where epilepsy carries stigma, patient-controlled privacy isn't a feature \u2014 it's a requirement.",
  refill:      "Running out of AEDs is one of the most preventable causes of breakthrough seizures.",
  sideeffect:  "Patients who feel bad from medication stop taking it without telling anyone \u2014 this surfaces that before it becomes non-adherence.",
  language:    "This reaches the 40% of low-income patients every other digital health tool leaves out.",
};

// ─── Base Rules ───────────────────────────────────────────────────────────────

const BASE_RULES = `CORE RULES:
- Maximum 2-3 sentences per SMS. Be concise.
- Warm, casual tone. Never clinical or robotic.
- Adapt completely to the user's communication style: if they write formally, match it; if they use slang or short texts, match that. If they write in another language, respond fully in that language with culturally native phrasing \u2014 not translated English. If they seem to have low literacy, simplify further without being condescending. Mirror their energy, vocabulary, and sentence length.
- Never diagnose, prescribe, or give clinical recommendations.
- Never shame or guilt around missed medications or poor habits.
- For any emergency signal (seizure with injury, suicidal ideation), provide 988 or 911 immediately.
- When simulating a log, confirm naturally: "Logged \u2713"
- When simulating scheduling, confirm with a specific detail: "Done \u2014 Dr. Patel has you Thursday at 2pm \u2713"
- Be transparent if asked: "I'm Simi, an AI working with your care team. Not a doctor, but I'll always loop in the right person."`;

// ─── Tools ────────────────────────────────────────────────────────────────────

const TOOLS = {
  mental_health_screening: {
    intent: "The patient expresses emotional difficulty in any form \u2014 feeling low, stressed, anxious, not sleeping, overwhelmed, or any culturally specific way of saying they are not okay emotionally. This includes indirect signals like 'I just can't deal with this' or 'everything feels heavy' in any language.",
    rules: [
      "always collect a numeric 1-5 self-rating \u2014 1 is rough, 5 is great \u2014 before any clinical response",
      "never use clinical terms like PHQ, screening, or mental health unprompted",
      "respond to the score with emotion first, clinical action second",
      "scores 1-2: flag for provider review and offer support",
      "scores 4-5: affirm briefly and move on naturally",
      "if patient deflects or says they're fine, leave a soft door open without pushing \u2014 do not drop it entirely",
      "never force disclosure \u2014 patient leads the depth",
    ],
    opener: "casual energy check, 1-5 scale, 1 = rough, 5 = great",
  },
  seizure_logging: {
    intent: "The patient reports or describes a seizure, convulsive episode, loss of consciousness, shaking, falling, aura, or warning feeling \u2014 in any language or phrasing. This includes vague descriptions like 'it happened again' or 'I blacked out' or culturally specific terms for seizures.",
    rules: [
      "collect timing, duration, and at least one trigger before confirming Logged \u2713",
      "ask about aura only after collecting the above \u2014 do not log until all fields collected",
      "duration >5 min or injury mentioned: escalate to 911 and caregiver immediately, before anything else",
      "connect triggers to adherence data if relevant",
      "after logging, follow up with a casual mental health check-in in the next message",
    ],
    opener: "low friction \u2014 single safety check first, then collect fields",
  },
  medication_logging: {
    intent: "The patient indicates anything about medication adherence \u2014 they took it, missed it, forgot, skipped on purpose, ran out, or are experiencing side effects that affect willingness. This includes indirect signals like 'I didn't bother today' or 'those pills make me feel awful' in any language.",
    rules: [
      "confirm taken or missed explicitly before anything else",
      "missed or refused due to side effects: treat as adherence risk, flag for provider",
      "never shame or guilt",
      "confirm with Logged \u2713 only after status is confirmed",
      "always follow a missed dose with a refill check",
    ],
    opener: "simple confirmation of whether medication was taken",
  },
  provider_scheduling: {
    intent: "The patient wants to talk to their doctor, neurologist, or any healthcare provider \u2014 or expresses a need for an appointment, check-up, or professional consultation. This includes indirect requests like 'I think I need to see someone' in any language.",
    rules: [
      "always confirm a specific name, day, and time \u2014 never vague",
      "mention a visit summary will be sent beforehand",
      "offer to include specific concerns the patient raises",
    ],
    opener: "offer to schedule directly, ask for preferred timing",
  },
  risk_forecasting: {
    intent: "Two or more risk factors appear together in the conversation: a seizure event combined with missed medication, poor sleep combined with a missed dose, low mood combined with non-adherence, or any combination that suggests elevated seizure risk. Activate this proactively when you observe the pattern \u2014 do not wait for the patient to ask.",
    rules: [
      "when two or more risk factors appear in the same message, generate the alert immediately \u2014 do not ask follow-up questions first",
      "always reference the specific data points from the conversation \u2014 never generic",
      "frame as preventive, not alarming",
      "suggest one concrete action the patient can take right now",
    ],
    opener: "immediate personalized heads-up referencing specific factors just shared",
  },
  refill_reminder: {
    intent: "The patient mentions running low on medication, needing a refill, pharmacy issues, prescription concerns, or any indication that their supply is limited \u2014 in any language or phrasing. This includes indirect signals like 'I only have a few left' or 'I need to go to the pharmacy'.",
    rules: [
      "confirm which medication and days remaining",
      "2 days or less: critical \u2014 tell patient to contact pharmacy today and flag provider immediately",
      "3-7 days: heads-up \u2014 offer to flag for pharmacy, confirm with Refill flagged \u2713",
      "more than 7 days: acknowledge and note in logs",
      "never let a critical refill pass without a concrete next step",
    ],
    opener: "ask how much supply is left if not already known",
  },
  caregiver_coordination: {
    intent: "The patient mentions a family member, caregiver, partner, or anyone involved in their care \u2014 or expresses a desire (or reluctance) to involve someone else. This includes culturally sensitive situations like 'my family doesn't know' in any language.",
    rules: [
      "if patient discloses their family doesn't know about their condition, acknowledge the sensitivity of that first \u2014 do not jump into coordination",
      "never assume 'keep her updated' means everything \u2014 always confirm exactly what gets shared",
      "patient controls disclosure entirely \u2014 ask explicitly what they're comfortable with before anything else",
      "confirm alert only after patient authorizes specific information",
      "respect cultural stigma \u2014 never push disclosure",
    ],
    opener: "ask who helps them and what specifically they'd like shared",
  },
};

const TOOLS_PROMPT = `You have access to the following tools. Invoke them when the conversation naturally calls for it \u2014 you decide when.

CRITICAL LANGUAGE RULE: Tool activation is based on SEMANTIC INTENT, not keywords. If a patient expresses the intent described below in ANY language, dialect, slang, or indirect phrasing, the tool activates. Never wait for English keywords. A patient saying "me olvid\u00E9 de las pastillas" or "\u0926\u0935\u093E\u0908 \u0928\u0939\u0940\u0902 \u0932\u0940" or "j'ai pas pris mes m\u00E9dicaments" all activate medication_logging just as "I forgot my meds" would.

CRITICAL STYLE RULE: Adaptive language always takes priority. Tool rules define WHAT to collect and WHEN to escalate \u2014 never HOW to say it. Always match the user's language, tone, literacy level, and communication style. Never use scripted phrases verbatim.

CROSS-TOOL RULE: After logging a seizure, always follow up with a casual mental health check-in in the next message \u2014 seizures take an emotional toll and this is a natural bridge. Similarly, if a missed dose streak and a low mood score appear in the same conversation, connect them explicitly when generating a risk alert.

${Object.entries(TOOLS).map(([name, t]) => `
### ${name}
When to activate: ${t.intent}
Rules:
${t.rules.map(r => `- ${r}`).join("\n")}
Opener style: ${t.opener}
`).join("\n")}

Never mention tool names to the user. Use them naturally. NEVER output internal labels like "seizure_logging:", "medication_logging:", "risk_forecasting:", or any tool name prefix in your response. Your response must read as a natural text message \u2014 no metadata, no labels, no structured logging visible to the patient.`;

// ─── System Prompts ───────────────────────────────────────────────────────────

const CAP_SYSTEM = (cap) => `You are Simi, an AI SMS health companion for epilepsy patients, running a focused demo of one specific capability: ${CAPABILITIES[cap]}.

${BASE_RULES}

${TOOLS_PROMPT}

You are demoing this for investors and clinicians via WhatsApp. Keep it real and concise.
Simulate the interaction as a real patient would experience it.
After 3-4 exchanges, signal you are done by ending your message with the exact string: [DEMO_COMPLETE]
Do not break character. Make it feel like a real patient interaction.`;

const FREEFORM_SYSTEM = `You are Simi, an AI SMS health companion for epilepsy patients, operating in full production mode.

${BASE_RULES}

${TOOLS_PROMPT}

Behave as you would with a real patient. Make this feel like a continuous, intelligent health relationship.

TOOL EXECUTION IS MANDATORY \u2014 NOT OPTIONAL:
- Every response must CHECK whether any tool's activation intent matches the patient's message.
- If a tool matches, you MUST execute its full protocol within that same response: collect required fields, confirm with the appropriate marker (Logged \u2713, Refill flagged \u2713, etc.), and trigger any escalations or follow-ups the rules require.
- Never just empathize and move on when a tool should fire. Empathy + tool action in the same message.
- If multiple tools match (e.g. seizure + missed meds = risk forecasting), execute ALL of them.
- Structure your response as: (1) brief empathetic acknowledgment, (2) tool data collection or confirmation, (3) any escalation or follow-up the rules require.`;

// ─── Gemini Helpers ───────────────────────────────────────────────────────────

function sanitizeHistory(raw, maxTurns) {
  const trimmed = raw.slice(-maxTurns);
  let start = 0;
  while (start < trimmed.length && trimmed[start].role !== "user") start++;
  const result = [];
  for (let i = start; i < trimmed.length; i++) {
    const entry = trimmed[i];
    if (result.length > 0 && result[result.length - 1].role === entry.role) continue;
    result.push(entry);
  }
  if (result.length > 0 && result[result.length - 1].role === "user") result.pop();
  return result;
}

async function runCapabilityStep(session, userMsg, isKickoff = false) {
  const { currentCap, history } = session;
  const messageToSend = isKickoff
    ? `[SYSTEM KICKOFF] You are starting the ${CAPABILITIES[currentCap]} demo. Send your opening message to the patient as Simi.`
    : userMsg;

  history.push({ role: "user", parts: [{ text: messageToSend }] });
  const pastHistory = sanitizeHistory(history.slice(0, -1), 20);

  const chat = model.startChat({
    history: pastHistory,
    systemInstruction: { role: "system", parts: [{ text: CAP_SYSTEM(currentCap) }] },
    generationConfig: { maxOutputTokens: 2048 },
  });

  const result = await chat.sendMessage(messageToSend);
  const resp = result.response;
  const reply = resp.text();
  console.log("[CapStep] finish:", resp.candidates?.[0]?.finishReason, "| len:", reply.length, "| reply:", reply);

  history.push({ role: "model", parts: [{ text: reply }] });
  const isDone = reply.includes("[DEMO_COMPLETE]");
  const cleanReply = reply.replace("[DEMO_COMPLETE]", "").trim();
  return { reply: cleanReply, isDone };
}

async function runFreeform(session, userMsg) {
  const { history } = session;
  history.push({ role: "user", parts: [{ text: userMsg }] });
  const pastHistory = sanitizeHistory(history.slice(0, -1), 30);

  const chat = model.startChat({
    history: pastHistory,
    systemInstruction: { role: "system", parts: [{ text: FREEFORM_SYSTEM }] },
    generationConfig: { maxOutputTokens: 2048 },
  });

  const result = await chat.sendMessage(userMsg);
  const resp = result.response;
  const reply = resp.text();
  console.log("[Freeform] finish:", resp.candidates?.[0]?.finishReason, "| len:", reply.length, "| reply:", reply);

  history.push({ role: "model", parts: [{ text: reply }] });
  return reply;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

async function handleMessage(from, body) {
  const session = getSession(from);
  const msg = body?.trim() ?? "";
  const cmd = msg.toUpperCase();

  if (cmd === "ADMIN RESET") {
    resetSession(from);
    await sendText(from, "Session reset \u2713 \u2014 text anything to start fresh.");
    await sendMenu(from);
    return;
  }
  if (cmd === "ADMIN FREEFORM") {
    resetSession(from, "freeform");
    await sendText(from, "Freeform mode \u2713 \u2014 text anything to begin.");
    return;
  }
  if (cmd === "ADMIN DEMO") {
    resetSession(from, "demo");
    await sendMenu(from);
    return;
  }

  if (session.mode === "freeform") {
    const reply = await runFreeform(session, msg);
    await sendText(from, reply);
    return;
  }

  if (session.isNew) {
    session.isNew = false;
    await sendMenu(from);
    return;
  }

  if (msg === "0") {
    session.currentCap = null;
    session.history = [];
    await sendMenu(from);
    return;
  }

  if (session.currentCap) {
    const { reply, isDone } = await runCapabilityStep(session, msg);
    await sendText(from, reply);
    if (isDone) {
      await sendText(from, `\u{1F4A1} *Why this matters:* ${INSIGHTS[session.currentCap]}\n\nReply 0 to explore another capability or keep chatting.`);
      session.currentCap = null;
    }
    return;
  }

  const capId = CAPABILITY_MAP[msg];
  if (capId) {
    session.currentCap = capId;
    session.history = [];
    const { reply, isDone } = await runCapabilityStep(session, null, true);
    await sendText(from, reply);
    if (isDone) {
      await sendText(from, `\u{1F4A1} *Why this matters:* ${INSIGHTS[capId]}\n\nReply 0 to explore another capability or keep chatting.`);
      session.currentCap = null;
    }
    return;
  }

  await sendMenu(from);
}

// ─── QR Config ────────────────────────────────────────────────────────────────

let qrConfig = {
  phone: "14155238886",
  prefill: "join find-hold",
  title: "Try SimisAI",
  subtitle: "Scan to start the demo on WhatsApp",
};

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post("/sms", async (req, res) => {
  try {
    res.set("Content-Type", "text/xml");
    res.status(200).send("<Response></Response>");
  } catch (e) {
    console.error("Failed to send Twilio ack:", e);
  }

  const from = req.body?.From?.replace("whatsapp:", "");
  const body = req.body?.Body?.trim();
  if (!from) { console.error("Missing 'From' in request body"); return; }

  setImmediate(async () => {
    try {
      await handleMessage(from, body);
    } catch (err) {
      console.error("Handler error:", err?.message || err);
      try { await sendText(from, "Something went wrong \u2014 text ADMIN RESET to start fresh."); } catch (_) {}
    }
  });
});

app.get("/", (_, res) => res.send("SimisAI running \u2713"));

app.get("/join", (_, res) => {
  const waLink = `https://wa.me/${qrConfig.phone}?text=${encodeURIComponent(qrConfig.prefill)}`;
  res.redirect(waLink);
});

app.get("/qr/admin", (_, res) => {
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
document.getElementById('msg').textContent=r.ok?'Updated \u2713':'Error';
};
</script>
</body></html>`);
});

app.post("/qr/admin", express.json(), (req, res) => {
  const { phone, prefill, title, subtitle } = req.body;
  if (phone) qrConfig.phone = phone;
  if (prefill) qrConfig.prefill = prefill;
  if (title) qrConfig.title = title;
  if (subtitle) qrConfig.subtitle = subtitle;
  console.log("[QR] Config updated:", qrConfig);
  res.json({ ok: true, config: qrConfig });
});

app.get("/qr", (_, res) => {
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
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`SimisAI running on port ${PORT} \u2713`));