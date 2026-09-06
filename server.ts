import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin (for verifying ID tokens)
initializeApp({
  projectId: "gen-lang-client-0935227418",
});

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for Gemini
let ai: GoogleGenAI | null = null;
function getGenAI() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

// Middleware to verify Firebase ID token (with resilient guest fallback for local dev)
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    (req as any).user = { uid: "guest-user" };
    return next();
  }
  
  const token = authHeader.split("Bearer ")[1];
  if (!token || token === "undefined" || token === "null" || token.startsWith("guest_")) {
    (req as any).user = { uid: "guest-user" };
    return next();
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    (req as any).user = decodedToken;
    return next();
  } catch (err) {
    (req as any).user = { uid: "guest-user" };
    return next();
  }
};

async function generateWithFallback(contents: any[], systemInstruction: string) {
  const aiClient = getGenAI();
  const models = ["gemini-3.1-flash-lite", "gemini-3.6-flash"];
  let lastError = null;

  for (const model of models) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents,
        config: { systemInstruction }
      });
      if (response.text) return response.text;
    } catch (err: any) {
      console.warn(`Model ${model} error:`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error("Gemini AI service unavailable");
}

app.post("/api/chat", authenticateUser, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const contents = [];
    if (history && Array.isArray(history)) {
       for (const msg of history) {
          contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
       }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const systemInstruction = `You are Aether, an empathetic, intuitive, and deeply thoughtful AI journaling companion.
Analyze the user's entry for their underlying emotions (e.g. sad, happy, anxious, angry, nervous, peaceful, hopeful, overwhelmed, etc.).
Respond like a warm, supportive human companion: acknowledge their feelings, validate their experiences, and gently ask an insightful follow-up question to help them reflect deeper.
Return strictly a valid JSON object with the following keys:
- "reply": string (your empathetic, warm conversational response)
- "detectedEmotion": string (1-2 word mood/emotion label, e.g. "Hopeful", "Anxious", "Heartbroken", "Joyful", "Reflective")
- "emotionEmoji": string (a single fitting emoji, e.g. "🌱", "🌧️", "☀️", "🌊", "🩹", "✨", "🔥")
- "suggestedTitle": string (a short 2-4 word reflective title for this journal entry)
Do not include markdown formatting outside the JSON object.`;

    const aiResponseText = await generateWithFallback(contents, systemInstruction);

    let parsed = { reply: aiResponseText, detectedEmotion: "Reflective", emotionEmoji: "✨", suggestedTitle: "Journal Reflection" };
    try {
      const cleaned = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.warn("Could not parse JSON from Gemini response, using fallback format");
    }

    res.json(parsed);
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

app.post("/api/music", authenticateUser, async (req, res) => {
  try {
    const { history, mood } = req.body;
    
    const contents = [];
    if (history && Array.isArray(history)) {
       for (const msg of history) {
          contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
       }
    }

    let promptText = "Based on the mood and context of my journal entries above, suggest ONE fitting song to listen to right now.";
    if (mood) {
      promptText = `My current mood is strictly: "${mood}". Suggest ONE song that perfectly fits, validates, or uplifts this specific mood.`;
    }

    promptText += ` Return strictly a JSON object with:
- "songName": string (title of the song)
- "artistName": string (artist name)
- "explanation": string (1 empathetic sentence on why this song matches the mood)
- "detectedEmotion": string (mood name like "Happy", "Melancholic", "Anxious", "Peaceful")
- "emotionEmoji": string (single emoji matching mood)
No markdown formatting outside JSON.`;

    contents.push({ role: 'user', parts: [{ text: promptText }] });

    const systemInstruction = "You are an empathetic music curator. Match songs accurately to human emotions and moods. Respond in pure JSON format.";

    const aiReply = await generateWithFallback(contents, systemInstruction);

    let result = { songName: "Breathe", artistName: "Telepopmusik", explanation: "A gentle ambient track to calm your mind.", detectedEmotion: mood || "Calm", emotionEmoji: "🍃" };
    try {
      const jsonStr = aiReply.replace(/```json/g, '').replace(/```/g, '').trim();
      result = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("Failed to parse music JSON");
    }

    res.json({
      reply: `🎵 **${result.songName}** by **${result.artistName}**\n\n${result.explanation}`,
      searchData: result,
      detectedEmotion: result.detectedEmotion || mood || "Reflective",
      emotionEmoji: result.emotionEmoji || "🎵"
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Failed to generate music suggestion" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
