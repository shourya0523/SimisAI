import twilio from "twilio";
import { WA_FROM } from "../config/constants.js";

let twilioClient = null;

/**
 * Initialize the Twilio client
 * @param {string} accountSid - Twilio Account SID
 * @param {string} authToken - Twilio Auth Token
 */
export function initTwilio(accountSid, authToken) {
  twilioClient = twilio(accountSid, authToken);
}

/**
 * Get the Twilio client instance
 * @returns {Object} Twilio client
 */
export function getTwilioClient() {
  if (!twilioClient) {
    throw new Error("Twilio client not initialized. Call initTwilio first.");
  }
  return twilioClient;
}

/**
 * Send a text message via WhatsApp
 * @param {string} to - Recipient phone number (without whatsapp: prefix)
 * @param {string} body - Message body
 * @returns {Promise} Twilio message result
 */
export async function sendText(to, body) {
  const client = getTwilioClient();
  return client.messages.create({
    from: WA_FROM,
    to: `whatsapp:${to}`,
    body,
  });
}
