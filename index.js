import express from "express";
import { initTwilio } from "./src/services/twilioService.js";
import { initGemini } from "./src/services/geminiService.js";
import {
  handleSmsWebhook,
  handleRoot,
  handleJoin,
  handleQrAdmin,
  handleQrAdminPost,
  handleQr,
} from "./src/handlers/routeHandlers.js";

// ─── Init ────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Initialize services
initGemini(process.env.GEMINI_API_KEY);
initTwilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post("/sms", handleSmsWebhook);
app.get("/", handleRoot);
app.get("/join", handleJoin);
app.get("/qr/admin", handleQrAdmin);
app.post("/qr/admin", handleQrAdminPost);
app.get("/qr", handleQr);

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`SimisAI running on port ${PORT} \u2713`));