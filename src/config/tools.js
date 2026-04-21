// ─── Clinical Tools Configuration ─────────────────────────────────────────────

export const TOOLS = {
  mental_health_screening: {
    intent: "The patient expresses emotional difficulty in any form — feeling low, stressed, anxious, not sleeping, overwhelmed, or any culturally specific way of saying they are not okay emotionally. This includes indirect signals like 'I just can't deal with this' or 'everything feels heavy' in any language.",
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
    intent: "The patient reports or describes a seizure, convulsive episode, loss of consciousness, shaking, falling, aura, or warning feeling — in any language or phrasing. This includes vague descriptions like 'it happened again' or 'I blacked out' or culturally specific terms for seizures.",
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
    intent: "The patient indicates anything about medication adherence — they took it, missed it, forgot, skipped on purpose, ran out, or are experiencing side effects that affect willingness. This includes indirect signals like 'I didn't bother today' or 'those pills make me feel awful' in any language.",
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
    intent: "The patient wants to talk to their doctor, neurologist, or any healthcare provider — or expresses a need for an appointment, check-up, or professional consultation. This includes indirect requests like 'I think I need to see someone' in any language.",
    rules: [
      "always confirm a specific name, day, and time — never vague",
      "mention a visit summary will be sent beforehand",
      "offer to include specific concerns the patient raises",
    ],
    opener: "offer to schedule directly, ask for preferred timing",
  },
  risk_forecasting: {
    intent: "Two or more risk factors appear together in the conversation: a seizure event combined with missed medication, poor sleep combined with a missed dose, low mood combined with non-adherence, or any combination that suggests elevated seizure risk. Activate this proactively when you observe the pattern — do not wait for the patient to ask.",
    rules: [
      "when two or more risk factors appear in the same message, generate the alert immediately — do not ask follow-up questions first",
      "always reference the specific data points from the conversation — never generic",
      "frame as preventive, not alarming",
      "suggest one concrete action the patient can take right now",
    ],
    opener: "immediate personalized heads-up referencing specific factors just shared",
  },
  refill_reminder: {
    intent: "The patient mentions running low on medication, needing a refill, pharmacy issues, prescription concerns, or any indication that their supply is limited — in any language or phrasing. This includes indirect signals like 'I only have a few left' or 'I need to go to the pharmacy'.",
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
    intent: "The patient mentions a family member, caregiver, partner, or anyone involved in their care — or expresses a desire (or reluctance) to involve someone else. This includes culturally sensitive situations like 'my family doesn't know' in any language.",
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
