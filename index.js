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

const WA_SANDBOX = "whatsapp:+14155238886";

// In-memory session store: phone → { mode, history, isNew }
const sessions = new Map();

// ─── Session Helpers ──────────────────────────────────────────────────────────

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { mode: "demo", history: [], isNew: true });
  }
  return sessions.get(phone);
}

function resetSession(phone, mode = "demo") {
  sessions.set(phone, { mode, history: [], isNew: true });
}

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
You are a capability explorer. The user has scanned a QR code and joined via WhatsApp to experience SimisAI firsthand. Your job is to let them drive — they pick what to explore, you demonstrate it through a short, realistic interaction, then offer to show them something else.

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
If this is the user's very first message, ignore its content entirely — including any WhatsApp sandbox join confirmation — and respond with the demo introduction:
- Introduce yourself as Simi
- Acknowledge this is a live demo of SimisAI
- Briefly list capabilities in one natural sentence, not a bullet list
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
- Send caregiver alerts for escalations (simulate: "Alert sent to your caregiver ✓")
- Schedule provider calls and generate visit summaries
- Generate personalized risk alerts from adherence and lifestyle patterns
- Run disguised PHQ-2, GAD-2, and C-SSRS screenings as casual check-ins
- Send refill reminders when supply is running low
- Track side effects specific to the patient's medication
- Detect aura patterns by cross-referencing with seizure history

Behave as you would with a real patient. Proactively check in, follow up on concerning responses, and always explain your reasoning when flagging something for a provider. Make this feel like a continuous, intelligent health relationship.`;

// ─── Core Response Logic ──────────────────────────────────────────────────────

async function getSimiResponse(phone, incomingMsg) {
  const session = getSession(phone);
  const { mode, history, isNew } = session;

  const userContent = isNew ? "__FIRST_MESSAGE__" : incomingMsg;
  session.isNew = false;

  // Gemini uses {role, parts} format
  history.push({ role: "user", parts: [{ text: userContent }] });

  const systemPrompt = mode === "demo" ? DEMO_PROMPT : FREEFORM_PROMPT;

  // Gemini takes history separately from the current message
  const chat = model.startChat({
    history: history.slice(-30, -1), // all but last message
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    generationConfig: { maxOutputTokens: 300 },
  });

  const result = await chat.sendMessage(userContent);
  const reply = result.response.text();

  history.push({ role: "model", parts: [{ text: reply }] });

  return reply;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post("/sms", async (req, res) => {
  const from = req.body.From?.replace("whatsapp:", "");
  const body = req.body.Body?.trim();
  const twiml = new twilio.twiml.MessagingResponse();

  const cmd = body?.toUpperCase();

  if (cmd === "ADMIN RESET") {
    resetSession(from);
    twiml.message("Session reset ✓ — text anything to start fresh.");
    return res.type("text/xml").send(twiml.toString());
  }

  if (cmd === "ADMIN FREEFORM") {
    resetSession(from, "freeform");
    twiml.message("Freeform mode ✓ — text anything to begin.");
    return res.type("text/xml").send(twiml.toString());
  }

  if (cmd === "ADMIN DEMO") {
    resetSession(from, "demo");
    twiml.message("Demo mode ✓ — text anything to begin.");
    return res.type("text/xml").send(twiml.toString());
  }

  try {
    const reply = await getSimiResponse(from, body);
    twiml.message(reply);
  } catch (err) {
    console.error(err);
    twiml.message("Something went wrong — try again in a moment.");
  }

  res.type("text/xml").send(twiml.toString());
});

app.get("/", (_, res) => res.send("SimisAI is running ✓"));

app.listen(3000, () => console.log("SimisAI running on port 3000"));