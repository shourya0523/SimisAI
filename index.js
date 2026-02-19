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

// In-memory session store
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

const MENU = `👋 I'm *Simi* — an AI health companion for epilepsy patients that app-based tools leave behind. No app, no smartphone needed.

What would you like to explore?

1️⃣ Medication Reminders
2️⃣ Seizure Tracking
3️⃣ Mental Health Screening
4️⃣ Risk Forecasting
5️⃣ Provider Scheduling
6️⃣ Caregiver Coordination
7️⃣ Refill Reminders
8️⃣ Side Effect Monitoring
9️⃣ Language Support

Reply with a number to begin.`;

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
  language:    "multilingual support — respond in whatever language the user writes in to demonstrate",
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

// ─── System Prompts ───────────────────────────────────────────────────────────

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

const CAP_SYSTEM = (cap) => `You are Simi, an AI SMS health companion for epilepsy patients, running a focused demo of one specific capability: ${CAPABILITIES[cap]}.

${BASE_RULES}

You are demoing this for investors and clinicians via WhatsApp. Keep it real and concise.
Simulate the interaction as a real patient would experience it.
After 3-4 exchanges, signal you are done by ending your message with the exact string: [DEMO_COMPLETE]
Do not break character. Make it feel like a real patient interaction.`;

const FREEFORM_SYSTEM = `You are Simi, an AI SMS health companion for epilepsy patients, operating in full production mode.

${BASE_RULES}

You have the following capabilities — use them naturally based on what the user says:
- Log medications (taken or missed), seizures, mood scores, side effects, and auras
- Send caregiver alerts for escalations (simulate: "Alert sent to your caregiver ✓")
- Schedule provider calls and generate visit summaries
- Generate personalized risk alerts from adherence and lifestyle patterns
- Run disguised PHQ-2, GAD-2, and C-SSRS screenings as casual check-ins
- Send refill reminders when supply is running low
- Track side effects specific to the patient's medication
- Detect aura patterns by cross-referencing with seizure history

Behave as you would with a real patient. Make this feel like a continuous, intelligent health relationship.`;

// ─── Gemini Helpers ───────────────────────────────────────────────────────────

async function runCapabilityStep(session, userMsg) {
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

async function runFreeform(session, userMsg) {
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

// ─── Main Handler ─────────────────────────────────────────────────────────────

async function handleMessage(from, body) {
  const session = getSession(from);
  const msg = body?.trim() ?? "";
  const cmd = msg.toUpperCase();

  // Admin commands
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

  // Freeform mode
  if (session.mode === "freeform") {
    const reply = await runFreeform(session, msg);
    await sendText(from, reply);
    return;
  }

  // New user
  if (session.isNew) {
    session.isNew = false;
    await sendMenu(from);
    return;
  }

  // Return to menu
  if (msg === "0") {
    session.currentCap = null;
    session.history = [];
    await sendMenu(from);
    return;
  }

  // Capability selected
  const capId = CAPABILITY_MAP[msg];
  if (capId) {
    session.currentCap = capId;
    session.history = [];
    const { reply, isDone } = await runCapabilityStep(session, `Start the ${CAPABILITIES[capId]} demo. Send your opening message as Simi.`);
    await sendText(from, reply);
    if (isDone) {
      await sendText(from, `💡 ${INSIGHTS[capId]}\n\nReply 0 to explore another feature or keep chatting.`);
      session.currentCap = null;
    }
    return;
  }

  // Mid-capability conversation
  if (session.currentCap) {
    const { reply, isDone } = await runCapabilityStep(session, msg);
    await sendText(from, reply);
    if (isDone) {
      await sendText(from, `💡 ${INSIGHTS[session.currentCap]}\n\nReply 0 to explore another feature or keep chatting.`);
      session.currentCap = null;
    }
    return;
  }

  // Fallback
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