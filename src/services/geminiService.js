import { GoogleGenerativeAI } from "@google/generative-ai";
import { CAP_SYSTEM, FREEFORM_SYSTEM } from "../config/prompts.js";

let model = null;

/**
 * Initialize the Gemini AI model
 * @param {string} apiKey - Google Gemini API key
 */
export function initGemini(apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  });
}

/**
 * Get the Gemini model instance
 * @returns {Object} Gemini model
 */
export function getModel() {
  if (!model) {
    throw new Error("Gemini model not initialized. Call initGemini first.");
  }
  return model;
}

/**
 * Sanitize conversation history for Gemini
 * @param {Array} raw - Raw history array
 * @param {number} maxTurns - Maximum number of turns to keep
 * @returns {Array} Sanitized history
 */
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

/**
 * Run a capability demo step
 * @param {Object} session - User session
 * @param {string} userMsg - User message (null for kickoff)
 * @param {boolean} isKickoff - Whether this is the initial kickoff
 * @returns {Promise<Object>} Response object with reply and isDone flag
 */
export async function runCapabilityStep(session, userMsg, isKickoff = false) {
  const { currentCap, history } = session;
  const messageToSend = isKickoff
    ? `[SYSTEM KICKOFF] You are starting the demo. Send your opening message to the patient as Simi.`
    : userMsg;

  history.push({ role: "user", parts: [{ text: messageToSend }] });
  const pastHistory = sanitizeHistory(history.slice(0, -1), 20);

  const currentModel = getModel();
  const chat = currentModel.startChat({
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

/**
 * Run freeform conversation mode
 * @param {Object} session - User session
 * @param {string} userMsg - User message
 * @returns {Promise<string>} AI response
 */
export async function runFreeform(session, userMsg) {
  const { history } = session;
  history.push({ role: "user", parts: [{ text: userMsg }] });
  const pastHistory = sanitizeHistory(history.slice(0, -1), 30);

  const currentModel = getModel();
  const chat = currentModel.startChat({
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
