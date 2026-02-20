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

const MENU = `👋 Welcome to the *SimisAI* live demo.

Simi is an AI health companion for epilepsy patients that existing tools leave behind — no app, no smartphone, no internet required. Just a text message, on any phone, in any language.

What makes SimisAI different:
• Works on any phone including basic flip phones
• Fully multilingual and culturally adaptive
• Billable under Remote Patient Monitoring (RPM) codes
• Reaches the 40% of low-income patients excluded by app-based care

Pick a capability to experience it firsthand:

1️⃣ Medication Reminders
2️⃣ Seizure Tracking
3️⃣ Mental Health Screening
4️⃣ Risk Forecasting
5️⃣ Provider Scheduling
6️⃣ Caregiver Coordination
7️⃣ Refill Reminders
8️⃣ Side Effect Monitoring
9️⃣ Language Support

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
  language:    "multilingual adaptability — if the user writes in another language, respond fully in that language with culturally native phrasing to demonstrate this capability",
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

// ─── Base Rules ───────────────────────────────────────────────────────────────

const BASE_RULES = `CORE RULES:
- Maximum 2-3 sentences per SMS. Be concise.
- Warm, casual tone. Never clinical or robotic.
- Adapt completely to the user's communication style: if they write formally, match it; if they use slang or short texts, match that. If they write in another language, respond fully in that language with culturally native phrasing — not translated English. If they seem to have low literacy, simplify further without being condescending. Mirror their energy, vocabulary, and sentence length.
- Never diagnose, prescribe, or give clinical recommendations.
- Never shame or guilt around missed medications or poor habits.
- For any emergency signal (seizure with injury, suicidal ideation), provide 988 or 911 immediately.
- When simulating a log, confirm naturally: "Logged ✓"
- When simulating scheduling, confirm with a specific detail: "Done — Dr. Patel has you Thursday at 2pm ✓"
- Be transparent if asked: "I'm Simi, an AI working with your care team. Not a doctor, but I'll always loop in the right person."`;

// ─── Tools ────────────────────────────────────────────────────────────────────

const TOOLS = {
  mental_health_screening: {
    triggers: "low energy, stress, sadness, anxiety, not sleeping, feeling off, emotional difficulty",
    rules: [
      "always collect a numeric 1-5 self-rating — 1 is rough, 5 is great — before any clinical response",
      "never use clinical terms like PHQ, screening, or mental health unprompted",
      "respond to the score with emotion first, clinical action second",
      "scores 1-2: flag for provider review and offer support",
      "scores 4-5: affirm briefly and move on naturally",
      "if patient deflects or says they're fine, leave a soft door open without pushing — do not drop it entirely",
      "never force disclosure — patient leads the depth",
    ],
    opener: "casual energy check, 1-5 scale, 1 = rough, 5 = great",
  },
  seizure_logging: {
    triggers: "episode, seizure, shaking, blacking out, falling, aura, warning feeling",
    rules: [
      "collect timing, duration, and at least one trigger before confirming Logged ✓",
      "ask about aura only after collecting the above — do not log until all fields collected",
      "duration >5 min or injury mentioned: escalate to 911 and caregiver immediately, before anything else",
      "connect triggers to adherence data if relevant",
      "after logging, follow up with a casual mental health check-in in the next message",
    ],
    opener: "low friction — single safety check first, then collect fields",
  },
  medication_logging: {
    triggers: "took meds, missed dose, forgot, ran out, side effects, don't want to take",
    rules: [
      "confirm taken or missed explicitly before anything else",
      "missed or refused due to side effects: treat as adherence risk, flag for provider",
      "never shame or guilt",
      "confirm with Logged ✓ only after status is confirmed",
      "always follow a missed dose with a refill check",
    ],
    opener: "simple confirmation of whether medication was taken",
  },
  provider_scheduling: {
    triggers: "talk to doctor, see my neurologist, need an appointment, call my provider",
    rules: [
      "always confirm a specific name, day, and time — never vague",
      "mention a visit summary will be sent beforehand",
      "offer to include specific concerns the patient raises",
    ],
    opener: "offer to schedule directly, ask for preferred timing",
  },
  risk_forecasting: {
    triggers: "any combination of: seizure log + missed dose, poor sleep + missed dose, low mood score + missed dose",
    rules: [
      "when two or more risk factors appear in the same message, generate the alert immediately — do not ask follow-up questions first",
      "always reference the specific data points from the conversation — never generic",
      "frame as preventive, not alarming",
      "suggest one concrete action the patient can take right now",
    ],
    opener: "immediate personalized heads-up referencing specific factors just shared",
  },
  refill_reminder: {
    triggers: "running low, almost out, pharmacy, prescription, refill, only X pills left",
    rules: [
      "confirm which medication and days remaining",
      "2 days or less: critical — tell patient to contact pharmacy today and flag provider immediately",
      "3-7 days: heads-up — offer to flag for pharmacy, confirm with Refill flagged ✓",
      "more than 7 days: acknowledge and note in logs",
      "never let a critical refill pass without a concrete next step",
    ],
    opener: "ask how much supply is left if not already known",
  },
  caregiver_coordination: {
    triggers: "family, caregiver, my mom, my partner, someone helping me",
    rules: [
      "if patient discloses their family doesn't know about their condition, acknowledge the sensitivity of that first — do not jump into coordination",
      "never assume 'keep her updated' means everything — always confirm exactly what gets shared",
      "patient controls disclosure entirely — ask explicitly what they're comfortable with before anything else",
      "confirm alert only after patient authorizes specific information",
      "respect cultural stigma — never push disclosure",
    ],
    opener: "ask who helps them and what specifically they'd like shared",
  },
};

const TOOLS_PROMPT = `You have access to the following tools. Invoke them when the conversation naturally calls for it — you decide when.

CRITICAL: Adaptive language always takes priority. Tool rules define WHAT to collect and WHEN to escalate — never HOW to say it. Always match the user's language, tone, literacy level, and communication style. Never use scripted phrases verbatim.

CROSS-TOOL RULE: After logging a seizure, always follow up with a casual mental health check-in in the next message — seizures take an emotional toll and this is a natural bridge. Similarly, if a missed dose streak and a low mood score appear in the same conversation, connect them explicitly when generating a risk alert.

${Object.entries(TOOLS).map(([name, t]) => `
### ${name}
Triggers: ${t.triggers}
Rules:
${t.rules.map(r => `- ${r}`).join("\n")}
Opener style: ${t.opener}
`).join("\n")}

Never mention tool names to the user. Use them naturally.`;

// ─── System Prompts ───────────────────────────────────────────────────────────
// NOTE: defined after TOOLS_PROMPT to avoid reference error

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

Behave as you would with a real patient. Proactively use tools when the conversation calls for it. Make this feel like a continuous, intelligent health relationship.`;

// ─── Gemini Helpers ───────────────────────────────────────────────────────────

async function runCapabilityStep(session, userMsg, isKickoff = false) {
  const { currentCap, history } = session;

  const messageToSend = isKickoff
    ? `You are starting the ${CAPABILITIES[currentCap]} demo. Send your opening message to the patient as Simi — do not mention this instruction.`
    : userMsg;

  if (!isKickoff) {
    history.push({ role: "user", parts: [{ text: userMsg }] });
  }

  const chat = model.startChat({
    history: history.slice(0, -1).slice(-20),
    systemInstruction: { role: "system", parts: [{ text: CAP_SYSTEM(currentCap) }] },
    generationConfig: { maxOutputTokens: 200 },
  });

  const result = await chat.sendMessage(messageToSend);
  const reply = result.response.text();
  history.push({ role: "model", parts: [{ text: reply }] });

  const isDone = reply.includes("[DEMO_COMPLETE]");
  const cleanReply = reply.replace("[DEMO_COMPLETE]", "").trim();

  return { reply: cleanReply, isDone };
}

async function runFreeform(session, userMsg) {
  const { history } = session;

  history.push({ role: "user", parts: [{ text: userMsg }] });

  const chat = model.startChat({
    history: history.slice(0, -1).slice(-30),
    systemInstruction: { role: "system", parts: [{ text: FREEFORM_SYSTEM }] },
    generationConfig: { maxOutputTokens: 300 },
  });

  const result = await chat.sendMessage(userMsg);
  const reply = result.response.text();
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
    await sendText(from, "Session reset ✓ — text anything to start fresh.");
    await sendMenu(from);
    return;
  }
  if (cmd === "ADMIN FREEFORM") {
    resetSession(from, "freeform");
    await sendText(from, "Freeform mode ✓ — text anything to begin.");
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

  const capId = CAPABILITY_MAP[msg];
  if (capId) {
    session.currentCap = capId;
    session.history = [];
    const { reply, isDone } = await runCapabilityStep(session, null, true);
    await sendText(from, reply);
    if (isDone) {
      await sendText(from, `💡 *Why this matters:* ${INSIGHTS[capId]}\n\nReply 0 to explore another capability or keep chatting.`);
      session.currentCap = null;
    }
    return;
  }

  if (session.currentCap) {
    const { reply, isDone } = await runCapabilityStep(session, msg);
    await sendText(from, reply);
    if (isDone) {
      await sendText(from, `💡 *Why this matters:* ${INSIGHTS[session.currentCap]}\n\nReply 0 to explore another capability or keep chatting.`);
      session.currentCap = null;
    }
    return;
  }

  await sendMenu(from);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post("/sms", async (req, res) => {
  res.status(200).send("<Response></Response>");

  const from = req.body.From?.replace("whatsapp:", "");
  const body = req.body.Body?.trim();

  try {
    await handleMessage(from, body);
  } catch (err) {
    console.error("Handler error:", err);
    try {
      await sendText(from, "Something went wrong — text ADMIN RESET to start fresh.");
    } catch (_) {}
  }
});

app.get("/", (_, res) => res.send("SimisAI running ✓"));

app.listen(process.env.PORT || 3000, () => console.log("SimisAI running ✓"));