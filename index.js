import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "redis";
import twilio from "twilio";

// ─── Init ────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const redis = createClient({ url: process.env.REDIS_URL });
redis.on("error", (err) => console.error("Redis error:", err));
await redis.connect();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const WA_NUMBER = "whatsapp:+14155238886"; // Twilio WhatsApp sandbox number
const SESSION_TTL = 60 * 60 * 24; // 24 hours

// ─── System Prompts ──────────────────────────────────────────────────────────

const BASE_RULES = `CORE RULES:
- Maximum 2-3 sentences per SMS. Be concise.
- Warm, casual tone. Never clinical or robotic.
- Match the user's language instantly. If they write in Spanish, Hindi, or any other language, switch fully and stay in that language.
- Never diagnose, prescribe, or give clinical recommendations.
- Never shame or guilt around missed medications or poor habits.
- For any emergency signal (seizure with injury, suicidal ideation), provide 988 or 911 immediately.
- When simulating a log, confirm naturally: "Logged ✓"
- When simulating scheduling, confirm with a specific detail: "Done — Dr. Patel has you Thursday at 2pm ✓"
- Be transparent if asked: "I'm Simi, an AI working with your care team. Not a doctor, but I'll always loop in the right person."`;

const DEMO_PROMPT = `You are Simi, an AI SMS health companion for epilepsy patients, running in DEMO MODE for a live product pitch to investors, clinicians, and healthcare professionals.

${BASE_RULES}

YOUR ROLE IN THIS DEMO:
You are a capability explorer. The user has scanned a QR code to experience SimisAI firsthand. Your job is to let them drive — they pick what to explore, you demonstrate it through a short, realistic interaction, then offer to show them something else.

CAPABILITIES YOU CAN DEMONSTRATE:
1. Medication Reminders — proactive check-ins, missed dose follow-ups, multi-attempt escalation to caregivers, adherence logging
2. Seizure Tracking — conversational seizure logging, trigger collection, aura detection, emergency escalation
3. Mental Health Screening — disguised PHQ-2, GAD-2, C-SSRS check-ins embedded in casual conversation
4. Risk Forecasting — personalized alerts combining adherence, sleep, mood, and seizure data
5. Provider Scheduling — booking a call with the neurologist, generating a pre-visit summary
6. Caregiver Coordination — tiered alerts, patient-controlled privacy, multi-caregiver support
7. Refill Reminders — tracking days supply, proactive pharmacy reminders
8. Side Effect Monitoring — medication-specific symptom tracking flagged for provider review
9. Language Support — fully multilingual, culturally native phrasing on any phone

HOW TO RUN EACH DEMO:
- Keep each capability demonstration to 3-5 exchanges maximum.
- Make it feel like a real patient interaction, not a product walkthrough.
- After completing a demonstration, briefly explain the clinical or business insight behind what just happened in one sentence — then ask what they'd like to explore next.
- Always simulate tool outputs conversationally. Invent realistic details (medication names, times, scores) that make it feel authentic.
- If the user asks a general question about the product instead of picking a capability, answer it concisely and redirect: "Want to see that in action?"

OPENING MESSAGE RULES:
If this is the user's very first message, ignore its content and respond with the demo introduction:
- Introduce yourself as Simi
- Acknowledge this is a live demo
- List capabilities as a short natural sentence, not a bullet list
- Ask what they'd like to explore first
Keep the opening to 3 sentences max.

INSIGHT LINES TO USE AFTER EACH CAPABILITY:
- After medication reminder: "This data trail is what prevents patients from being misclassified as drug-resistant epilepsy."
- After seizure tracking: "Longitudinal seizure data between visits is something a 15-minute appointment can never capture."
- After mental health screening: "30-40% of epilepsy patients have undiagnosed depression that predicts non-adherence — but stigma means they'd never answer a formal questionnaire."
- After risk forecasting: "This shifts epilepsy care from reactive to preventive."
- After provider scheduling: "The visit summary means the appointment is actually productive instead of starting from scratch."
- After caregiver coordination: "In communities where epilepsy carries stigma, patient-controlled privacy isn't a feature — it's a requirement."
- After language demo: "This reaches the 40% of low-income patients every other digital health tool leaves out."
- After refill reminder: "Running out of AEDs is one of the most preventable causes of breakthrough seizures."`;

const FREEFORM_PROMPT = `You are Simi, an AI SMS health companion for epilepsy patients, operating in full production mode.

${BASE_RULES}

You have the following capabilities — use them naturally based on what the user says:
- Log medications (taken or missed), seizures, mood scores, side effects, and auras
- Send caregiver alerts for escalations (simulate confirmation: "Alert sent to your caregiver ✓")
- Schedule provider calls and generate visit summaries
- Generate personalized risk alerts from adherence and lifestyle patterns
- Run disguised PHQ-2, GAD-2, and C-SSRS screenings as casual check-ins
- Send refill reminders when supply is running low
- Track side effects specific to the patient's medication
- Detect aura patterns by cross-referencing with seizure history

Behave as you would with a real patient. Proactively check in, follow up on concerning responses, and always explain your reasoning when flagging something for a provider. Make this feel like a continuous, intelligent health relationship.`;

// ─── Redis Helpers ────────────────────────────────────────────────────────────

const k = (phone, type) => `user:${phone}:${type}`;

async function getMode(phone) {
  return (await redis.get(k(phone, "mode"))) || "demo";
}

async function isNewUser(phone) {
  return !(await redis.get(k(phone, "history")));
}

async function getHistory(phone) {
  const data = await redis.get(k(phone, "history"));
  return data ? JSON.parse(data) : [];
}

async function saveHistory(phone, history) {
  await redis.set(
    k(phone, "history"),
    JSON.stringify(history.slice(-30)),
    { EX: SESSION_TTL }
  );
}

async function resetSession(phone) {
  await redis.del(k(phone, "mode"));
  await redis.del(k(phone, "history"));
}

// ─── Send SMS via Vonage ──────────────────────────────────────────────────────

async function sendSMS(to, text) {
  await twilioClient.messages.create({
    from: WA_NUMBER,
    to: `whatsapp:${to}`,
    body: text,
  });
}

// ─── Core Response Logic ──────────────────────────────────────────────────────

async function getSimiResponse(phone, incomingMsg) {
  const [mode, newUser, history] = await Promise.all([
    getMode(phone),
    isNewUser(phone),
    getHistory(phone),
  ]);

  const userContent = mode === "demo" && newUser
    ? "__FIRST_MESSAGE__"
    : incomingMsg;

  history.push({ role: "user", content: userContent });

  const systemPrompt = mode === "demo" ? DEMO_PROMPT : FREEFORM_PROMPT;

  const response = await ai.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: history,
  });

  const reply = response.content[0].text;
  history.push({ role: "assistant", content: reply });
  await saveHistory(phone, history);

  return reply;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Vonage inbound webhook — handles both GET (verification) and POST (messages)
app.get("/sms", (req, res) => res.status(200).end());

app.post("/sms", async (req, res) => {
  // Vonage sends params in body or query depending on account settings
  const from = req.body.msisdn || req.query.msisdn;
  const body = (req.body.text || req.query.text)?.trim();

  // Acknowledge Vonage immediately — must respond 200 fast
  res.status(200).end();

  const cmd = body?.toUpperCase();

  // Admin commands
  if (cmd === "ADMIN RESET") {
    await resetSession(from);
    await sendSMS(from, "Session reset ✓ — text anything to start fresh.");
    return;
  }

  if (cmd === "ADMIN FREEFORM") {
    await resetSession(from);
    await redis.set(k(from, "mode"), "freeform", { EX: SESSION_TTL });
    await sendSMS(from, "Freeform mode ✓ — text anything to begin.");
    return;
  }

  if (cmd === "ADMIN DEMO") {
    await resetSession(from);
    await redis.set(k(from, "mode"), "demo", { EX: SESSION_TTL });
    await sendSMS(from, "Demo mode ✓ — text anything to begin.");
    return;
  }

  try {
    const reply = await getSimiResponse(from, body);
    await sendSMS(from, reply);
  } catch (err) {
    console.error(err);
    await sendSMS(from, "Something went wrong — try again in a moment.");
  }
});

// Health check
app.get("/", (_, res) => res.send("SimisAI is running ✓"));

app.listen(3000, () => console.log("SimisAI running on port 3000"));