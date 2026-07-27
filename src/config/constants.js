// ─── Twilio Configuration ────────────────────────────────────────────────────

export const WA_FROM = "whatsapp:+14155238886";

// ─── Capability Maps ──────────────────────────────────────────────────────────

export const CAPABILITY_MAP = {
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

export const CAPABILITIES = {
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

export const INSIGHTS = {
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

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const MENU = `👋 Welcome to the *Simi's AI* live demo.

Simi is an AI health companion for epilepsy patients that existing tools leave behind — no app, no smartphone, no internet required. Just a text message, on any phone, in any language.

What makes Simi's AI different:
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
