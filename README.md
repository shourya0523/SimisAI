<img width="657" height="251" alt="image" src="https://github.com/user-attachments/assets/bfcde710-344c-4260-a21c-b2e1d07b3e8a" />


# SimsAI

**AI health companion for chronic health patients. No app. No smartphone. No internet. Just a text.**

SimisAI (Simi) is an SMS-based health companion that provides continuous epilepsy care on any phone — including basic flip phones. It reaches the 40% of low-income patients that app-based digital health tools leave behind.

## Why This Exists

Epilepsy management today has a gap: the patients who need the most support are the ones every digital tool excludes. Existing solutions require smartphones, app downloads, and reliable internet. Simi works over SMS and WhatsApp, adapts to any language and literacy level, and is designed to be billable under Remote Patient Monitoring (RPM) codes.

## Capabilities

Simi has 9 clinical tools that activate based on semantic intent — not keywords. A patient saying *"me olvidé de las pastillas"* or *"I forgot my meds"* triggers the same medication protocol.

| Capability | What it does |
|---|---|
| **Medication Reminders** | Tracks adherence, flags missed doses for providers, never shames |
| **Seizure Tracking** | Collects timing, duration, triggers; escalates to 911 if duration >5 min or injury |
| **Mental Health Screening** | Embeds PHQ-equivalent assessment into casual conversation (1-5 scale) |
| **Risk Forecasting** | Proactively alerts when multiple risk factors appear together (missed meds + poor sleep + seizure) |
| **Provider Scheduling** | Books appointments with a specific doctor, day, and time; sends visit summary beforehand |
| **Caregiver Coordination** | Patient-controlled privacy — patient decides exactly what gets shared with family |
| **Refill Reminders** | Flags low supply, escalates critical (≤2 days) to pharmacy and provider immediately |
| **Side Effect Monitoring** | Surfaces medication side effects before they become non-adherence |
| **Language Support** | Responds fully in the patient's language with culturally native phrasing — not translated English |

### Cross-Tool Intelligence

Tools don't operate in isolation. After logging a seizure, Simi automatically follows up with a mental health check-in. When missed medication patterns coincide with low mood scores, risk forecasting activates proactively. The system connects the dots the way a good clinician would — but continuously, between appointments.

## Architecture

```
Patient (any phone)
    │
    ▼
 Twilio (WhatsApp / SMS)
    │
    ▼
 Express.js server (index.js)
    │
    ├── Route Handlers (src/handlers/)
    │   ├── messageHandler.js - Main conversation logic
    │   └── routeHandlers.js - HTTP endpoints & QR management
    │
    ├── Services (src/services/)
    │   ├── sessionManager.js - Per-patient state tracking
    │   ├── twilioService.js - WhatsApp/SMS messaging
    │   └── geminiService.js - AI conversation engine
    │
    └── Configuration (src/config/)
        ├── constants.js - Menu, capabilities, insights
        ├── tools.js - Clinical tool definitions
        └── prompts.js - System prompts & AI instructions
```

### Key Features

- **Intent detection is semantic, not keyword-based.** Tools activate on meaning, across any language, dialect, slang, or indirect phrasing.
- **Two modes:** Demo mode (structured capability walkthrough for investors/clinicians) and freeform mode (full production patient interaction).
- **Adaptive style:** Simi mirrors the patient's tone, vocabulary, sentence length, and literacy level. Tool rules define *what* to collect and *when* to escalate — never *how* to say it.
- **Modular design:** Clean separation between configuration, services, and handlers for easy maintenance and testing.

## Setup

### Prerequisites

- Node.js 18+
- A [Twilio](https://twilio.com) account with a WhatsApp-enabled number
- A [Google AI](https://ai.google.dev) API key (Gemini 2.5 Flash)

### Environment Variables

```bash
GEMINI_API_KEY=your-gemini-api-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
RENDER_EXTERNAL_URL=https://your-app.onrender.com  # optional, for QR code generation
```

### Run

```bash
npm install
node index.js
```

Configure your Twilio WhatsApp webhook to point to `https://your-domain/sms` (POST).

## Project Structure

```
SimisAI/
├── index.js                    # Main entry point
├── src/
│   ├── config/                 # Configuration files
│   │   ├── constants.js        # Menu, capabilities, insights
│   │   ├── tools.js            # Clinical tool definitions
│   │   └── prompts.js          # AI system prompts
│   ├── services/               # Business logic services
│   │   ├── sessionManager.js   # User session state management
│   │   ├── twilioService.js    # WhatsApp/SMS messaging
│   │   └── geminiService.js    # Gemini AI integration
│   └── handlers/               # Request handlers
│       ├── messageHandler.js   # Core message routing logic
│       └── routeHandlers.js    # HTTP route handlers
├── package.json
└── README.md
```

### Try the Demo

Visit `/qr` to get a scannable QR code that opens the WhatsApp demo directly.

Or text **join find-hold** to the Twilio sandbox number to start.

### Admin Commands

| Command | Action |
|---|---|
| `ADMIN RESET` | Clear session, restart from menu |
| `ADMIN FREEFORM` | Switch to full production mode (no menu, continuous interaction) |
| `ADMIN DEMO` | Switch back to structured demo mode |

## Design Principles

**Concise.** Every response is 2-3 sentences. This is SMS, not a chatbot.

**Never clinical.** Simi doesn't diagnose, prescribe, or use medical jargon unless the patient does first.

**Never shaming.** A missed dose is a data point, not a failure. The language around adherence is always neutral and supportive.

**Patient-controlled.** Especially for caregiver coordination — in communities where epilepsy carries stigma, the patient decides exactly what information gets shared and with whom.

**Culturally adaptive.** Not just translated. If a patient writes in Hindi, Simi responds with culturally native phrasing, not English sentences run through Google Translate.

## Why This Matters

- 30-40% of epilepsy patients have **undiagnosed depression** that predicts non-adherence — casual check-ins surface what clinical forms never do
- Running out of medication is one of the **most preventable causes** of breakthrough seizures — Simi catches it before it happens
- A 15-minute appointment can never capture **longitudinal seizure data** between visits — Simi can
- When epilepsy carries **cultural stigma**, patient-controlled privacy isn't a feature — it's a requirement
