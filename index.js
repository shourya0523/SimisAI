import express from "express";
import twilio from "twilio";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Init ────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.urlencoded({ extended: false }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WA_FROM = "whatsapp:+14155238886"; // Twilio sandbox number
const CONTENT_API = `https://content.twilio.com/v1/Content`;
const AUTH = Buffer.from(
  `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
).toString("base64");

// In-memory stores
const sessions = new Map();   // phone → { history, menuPage, currentCap, mode }
const templates = {};         // named ContentSids created at startup

// ─── Content API – Create Templates ──────────────────────────────────────────

async function createTemplate(friendly_name, body, actions) {
  const res = await fetch(CONTENT_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${AUTH}`,
    },
    body: JSON.stringify({
      friendly_name,
      language: "en",
      types: {
        "twilio/quick-reply": { body, actions },
        "twilio/text": { body }, // SMS fallback
      },
    }),
  });
  const data = await res.json();
  if (!data.sid) throw new Error(`Template creation failed: ${JSON.stringify(data)}`);
  console.log(`Template created: ${friendly_name} → ${data.sid}`);
  return data.sid;
}

async function initTemplates() {
  console.log("Creating WhatsApp templates...");
  const [m1, m2, m3, yn, next] = await Promise.all([
    createTemplate(
      "simisai_menu_1",
      "👋 I'm *Simi* — an AI health companion built for epilepsy patients that app-based tools leave behind.\n\nNo app. No smartphone needed. Just a text message — on any phone, in any language.\n\nExplore a capability to see how SimisAI works:",
      [
        { id: "medication", title: "💊 Medication Reminders" },
        { id: "seizure",    title: "🧠 Seizure Tracking" },
        { id: "mental",     title: "💬 Mental Health" },
        { id: "more_1",     title: "More options →" },
      ]
    ),
    createTemplate(
      "simisai_menu_2",
      "More capabilities to explore:",
      [
        { id: "risk",       title: "⚠️ Risk Forecasting" },
        { id: "schedule",   title: "📅 Provider Scheduling" },
        { id: "caregiver",  title: "👨‍👩‍👧 Caregiver Coordination" },
        { id: "more_2",     title: "More options →" },
      ]
    ),
    createTemplate(
      "simisai_menu_3",
      "More capabilities to explore:",
      [
        { id: "refill",     title: "🔄 Refill Reminders" },
        { id: "sideeffect", title: "📋 Side Effect Monitoring" },
        { id: "language",   title: "🌍 Language Support" },
        { id: "back",       title: "← Back to start" },
      ]
    ),
    createTemplate(
      "simisai_yes_no",
      "{{1}}",
      [
        { id: "yes", title: "Yes" },
        { id: "no",  title: "No" },
      ]
    ),
    createTemplate(
      "simisai_next",
      "{{1}}",
      [
        { id: "menu",    title: "🔁 Try another feature" },
        { id: "freeform", title: "💬 Ask Simi anything" },
      ]
    ),
  ]);

  templates.menu1 = m1;
  templates.menu2 = m2;
  templates.menu3 = m3;
  templates.yesNo = yn;
  templates.next  = next;

  console.log("All templates ready ✓");
}

// ─── Send Helpers ─────────────────────────────────────────────────────────────

async function sendTemplate(to, contentSid, contentVariables = {}) {
  return twilioClient.messages.create({
    from: WA_FROM,
    to: `whatsapp:${to}`,
    contentSid,
    ...(Object.keys(contentVariables).length
      ? { contentVariables: JSON.stringify(contentVariables) }
      : {}),
  });
}

async function sendText(to, body) {
  return twilioClient.messages.create({
    from: WA_FROM,
    to: `whatsapp:${to}`,
    body,
  });
}

async function sendMenu(to, page = 1) {
  const sid = page === 1 ? templates.menu1
            : page === 2 ? templates.menu2
            : templates.menu3;
  return sendTemplate(to, sid);
}

async function sendYesNo(to, question) {
  return sendTemplate(to, templates.yesNo, { "1": question });
}

async function sendNext(to, insight) {
  return sendTemplate(to, templates.next, { "1": insight });
}

// ─── Session Helpers ──────────────────────────────────────────────────────────

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      mode: "demo",
      history: [],
      isNew: true,
      menuPage: 1,
      currentCap: null,
      capStep: 0,
    });
  }
  return sessions.get(phone);
}

function resetSession(phone, mode = "demo") {
  sessions.set(phone, {
    mode,
    history: [],
    isNew: true,
    menuPage: 1,
    currentCap: null,
    capStep: 0,
  });
}

// ─── Capability Map ───────────────────────────────────────────────────────────

const CAPABILITIES = {
  medication:  "medication reminders and adherence tracking",
  seizure:     "seizure tracking and emergency escalation",
  mental:      "mental health screening embedded in casual conversation",
  risk:        "personalized seizure risk forecasting",
  schedule:    "scheduling a provider call and generating a visit summary",
  caregiver:   "caregiver coordination with patient-controlled privacy",
  refill:      "medication refill reminders",
  sideeffect:  "side effect monitoring",
  language:    "multilingual support — respond in any language to demonstrate",
};

const INSIGHTS = {
  medication:  "This data trail is what prevents patients from being misclassified as drug-resistant epilepsy.",
  seizure:     "Longitudinal seizure data between visits is something a 15-minute appointment can never capture.",
  mental:      "30-40% of epilepsy patients have undiagnosed depression predicting non-adherence — casual check-ins get answers clinical forms never do.",
  risk:        "This shifts epilepsy care from reactive to preventive.",
  schedule:    "The visit summary means the appointment is actually productive instead of starting from scratch.",
  caregiver:   "In communities where epilepsy carries stigma, patient-controlled privacy isn't a feature — it's a requirement.",
  refill:      "Running out of AEDs is one of the most preventable causes of breakthrough seizures.",
  sideeffect:  "Patients who feel bad from medication stop taking it without telling anyone — this surfaces that before it becomes non-adherence.",
  language:    "This reaches the 40% of low-income patients every other digital health tool leaves out.",
};

// ─── Gemini – Capability Demo ─────────────────────────────────────────────────

const CAP_SYSTEM = (cap) => `You are Simi, an AI SMS health companion for epilepsy patients, running a focused demo of one specific capability: ${CAPABILITIES[cap]}.

RULES:
- You are demoing this for investors and clinicians via WhatsApp. Keep it real and concise.
- Maximum 2-3 sentences per message.
- Simulate the interaction as a real patient would experience it.
- Confirm logs naturally: "Logged ✓"
- Confirm scheduling with specifics: "Done — Dr. Patel has you Thursday at 2pm ✓"
- For language demo: respond in whatever language the user writes in.
- After 3-4 exchanges signal you're done by ending your message with the exact string: [DEMO_COMPLETE]

Do not break character. Make it feel like a real patient interaction.`;

async function runCapabilityStep(phone, session, userMsg) {
  const { currentCap, history } = session;
  history.push({ role: "user", parts: [{ text: userMsg }] });

  const chat = model.startChat({
    history: history.slice(-20, -1),
    systemInstruction: { role: "system", parts: [{ text: CAP_SYSTEM(currentCap) }] },
    generationConfig: { maxOutputTokens: 200 },
  });

  const result = await chat.sendMessage(userMsg);
  const reply = result.response.text();
  history.push({ role: "model", parts: [{ text: reply }] });

  const isDone = reply.includes("[DEMO_COMPLETE]");
  const cleanReply = reply.replace("[DEMO_COMPLETE]", "").trim();

  return { reply: cleanReply, isDone };
}

// ─── Freeform Gemini ──────────────────────────────────────────────────────────

const FREEFORM_SYSTEM = `You are Simi, an AI SMS health companion for epilepsy patients in full production mode.

RULES:
- Maximum 2-3 sentences per SMS.
- Warm, casual tone. Never clinical.
- Adapt completely to the user's communication style: if they write formally, match it; if they use slang or short texts, match that. If they write in another language, respond fully in that language with culturally native phrasing — not translated English. If they seem to have low literacy, simplify further without being condescending. Mirror their energy, vocabulary, and sentence length.
- Never diagnose or prescribe.
- Confirm logs: "Logged ✓", scheduling: "Done — Dr. Patel has you Thursday at 2pm ✓"
- For emergencies provide 988 or 911 immediately.

Capabilities: medication logging, seizure tracking, PHQ/GAD/C-SSRS screening as casual check-ins, risk forecasting, provider scheduling, caregiver alerts, refill reminders, side effect monitoring.`;

async function runFreeform(phone, session, userMsg) {
  const { history } = session;
  history.push({ role: "user", parts: [{ text: userMsg }] });

  const chat = model.startChat({
    history: history.slice(-30, -1),
    systemInstruction: { role: "system", parts: [{ text: FREEFORM_SYSTEM }] },
    generationConfig: { maxOutputTokens: 300 },
  });

  const result = await chat.sendMessage(userMsg);
  const reply = result.response.text();
  history.push({ role: "model", parts: [{ text: reply }] });
  return reply;
}

// ─── Main Message Handler ─────────────────────────────────────────────────────

async function handleMessage(phone, body) {
  const session = getSession(phone);
  const msg = body?.trim() ?? "";
  const id = msg.toLowerCase();

  // ── Admin commands ──
  if (msg.toUpperCase() === "ADMIN RESET") {
    resetSession(phone);
    await sendText(phone, "Session reset ✓");
    await sendMenu(phone, 1);
    return;
  }
  if (msg.toUpperCase() === "ADMIN FREEFORM") {
    resetSession(phone, "freeform");
    await sendText(phone, "Freeform mode ✓ — text anything.");
    return;
  }
  if (msg.toUpperCase() === "ADMIN DEMO") {
    resetSession(phone, "demo");
    await sendMenu(phone, 1);
    return;
  }

  // ── Freeform mode ──
  if (session.mode === "freeform") {
    const reply = await runFreeform(phone, session, msg);
    await sendText(phone, reply);
    return;
  }

  // ── Demo mode ──

  // New user — show menu
  if (session.isNew) {
    session.isNew = false;
    await sendMenu(phone, 1);
    return;
  }

  // Menu navigation
  if (id === "more_1" || id === "more options →") {
    session.menuPage = 2;
    await sendMenu(phone, 2);
    return;
  }
  if (id === "more_2" || id === "more options →") {
    session.menuPage = 3;
    await sendMenu(phone, 3);
    return;
  }
  if (id === "back" || id === "← back to start") {
    session.menuPage = 1;
    await sendMenu(phone, 1);
    return;
  }
  if (id === "menu" || id === "🔁 try another feature") {
    session.currentCap = null;
    session.history = [];
    await sendMenu(phone, 1);
    return;
  }
  if (id === "freeform" || id === "💬 ask simi anything") {
    session.mode = "freeform";
    await sendText(phone, "You're now in free conversation mode. Ask me anything or describe a situation — I'll respond as I would with a real patient.");
    return;
  }

  // Capability selected from menu
  if (CAPABILITIES[id]) {
    session.currentCap = id;
    session.history = [];
    session.capStep = 0;

    // Kick off the demo with first AI message
    const { reply, isDone } = await runCapabilityStep(phone, session, `Start the ${CAPABILITIES[id]} demo. Send your opening message as Simi.`);
    await sendText(phone, reply);

    // Use yes/no buttons if appropriate for this capability
    const usesYesNo = ["medication", "seizure", "mental", "refill", "sideeffect"].includes(id);
    if (usesYesNo && !isDone) {
      await sendYesNo(phone, "How would you like to respond?");
    }
    return;
  }

  // Mid-capability conversation
  if (session.currentCap) {
    const { reply, isDone } = await runCapabilityStep(phone, session, msg);
    await sendText(phone, reply);

    if (isDone) {
      const insight = INSIGHTS[session.currentCap];
      await sendNext(phone, `💡 ${insight}\n\nWhat would you like to do next?`);
      session.currentCap = null;
    } else {
      const usesYesNo = ["medication", "seizure", "mental", "refill", "sideeffect"].includes(session.currentCap);
      if (usesYesNo) {
        await sendYesNo(phone, "How would you like to respond?");
      }
    }
    return;
  }

  // Fallback — show menu
  await sendMenu(phone, session.menuPage || 1);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post("/sms", async (req, res) => {
  // Acknowledge Twilio immediately
  res.status(200).send("<Response></Response>");

  const from = req.body.From?.replace("whatsapp:", "");
  const body = req.body.Body ?? req.body.ButtonPayload ?? "";

  try {
    await handleMessage(from, body);
  } catch (err) {
    console.error("Handler error:", err);
    try {
      await sendText(from, "Something went wrong — try texting ADMIN RESET to start fresh.");
    } catch (_) {}
  }
});

app.get("/", (_, res) => res.send("SimisAI running ✓"));

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  await initTemplates();
  app.listen(3000, () => console.log("SimisAI running on port 3000 ✓"));
}

start().catch(console.error);