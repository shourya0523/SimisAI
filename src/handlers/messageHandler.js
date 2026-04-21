import { getSession, resetSession } from "../services/sessionManager.js";
import { sendText } from "../services/twilioService.js";
import { runCapabilityStep, runFreeform } from "../services/geminiService.js";
import { MENU, CAPABILITY_MAP, INSIGHTS } from "../config/constants.js";

/**
 * Send the menu to a user
 * @param {string} to - Recipient phone number
 * @returns {Promise} Send result
 */
async function sendMenu(to) {
  return sendText(to, MENU);
}

/**
 * Handle incoming messages from patients
 * @param {string} from - Sender phone number
 * @param {string} body - Message body
 */
export async function handleMessage(from, body) {
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

  // Demo mode - new user
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

  // Continue current capability
  if (session.currentCap) {
    const { reply, isDone } = await runCapabilityStep(session, msg);
    await sendText(from, reply);
    if (isDone) {
      await sendText(from, `💡 *Why this matters:* ${INSIGHTS[session.currentCap]}\n\nReply 0 to explore another capability or keep chatting.`);
      session.currentCap = null;
    }
    return;
  }

  // Start new capability
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

  // Unknown input - show menu
  await sendMenu(from);
}
