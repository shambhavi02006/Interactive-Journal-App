import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin safely for Vercel serverless cold starts
if (!getApps().length) {
  initializeApp({
    projectId: "gen-lang-client-0935227418",
  });
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS for Vercel deployment
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    return res.status(200).json({});
  }
  next();
});

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

// Middleware to verify Firebase ID token (with resilient guest fallback for local dev & Vercel)
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

app.post(["/api/chat", "/chat"], authenticateUser, async (req, res) => {
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
- "emotionEmoji": string (a single fitting emoji, e.g. "🌱", "🌧️", "☀️", "OCEAN", "🩹", "✨", "🔥")
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

const MOOD_FALLBACK_MUSIC: Record<string, { songName: string; artistName: string; explanation: string; emotionEmoji: string; previewUrl: string; artworkUrl: string }> = {
  Happy: {
    songName: "Lovely Day",
    artistName: "Bill Withers",
    explanation: "This uplifting classic brightens your spirits and celebrates good vibes.",
    emotionEmoji: "☀️",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/05/7d/5a/057d5a5e-2f95-4ebf-a0dd-7945781a7924/mzaf_10332812030048667554.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/71/3b/68/713b680c-c6f3-4f9e-a89e-00100780287a/886443315993.jpg/100x100bb.jpg"
  },
  Sad: {
    songName: "Fix You",
    artistName: "Coldplay",
    explanation: "A comforting track that wraps you in warmth when you are feeling heavy.",
    emotionEmoji: "🌧️",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/bf/2d/71/bf2d7159-f260-1e5b-e48f-8d9e248b61c5/mzaf_17203666286780709088.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/77/8a/53/778a53df-b4b1-e2bb-85bb-685b306b9a89/00094633783457.jpg/100x100bb.jpg"
  },
  Anxious: {
    songName: "Weightless",
    artistName: "Marconi Union",
    explanation: "Scientifically designed ambient music to calm your nervous system and slow your heart rate.",
    emotionEmoji: "🌿",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/8e/31/36/8e313678-0c67-628a-784f-4a3028ee8028/mzaf_14480208154865103445.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/58/b5/54/58b5541e-3607-bb19-48ed-4b210a48b945/5055531980076.jpg/100x100bb.jpg"
  },
  Nervous: {
    songName: "Breathe (2AM)",
    artistName: "Anna Nalick",
    explanation: "A gentle reminder to take a deep breath and ground yourself in the present moment.",
    emotionEmoji: "😬",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/e5/2d/02/e52d0295-8854-e69d-2b0e-6fdf396655c6/mzaf_13506161476686121406.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/56/67/bf/5667bf91-4cf1-6987-a065-201648a3c8fb/886444078651.jpg/100x100bb.jpg"
  },
  Angry: {
    songName: "Unstoppable",
    artistName: "Sia",
    explanation: "Channel your intense energy into strength and inner resilience.",
    emotionEmoji: "🔥",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/b8/91/97/b89197c3-efc7-6e6b-d18d-ef5713df3cb8/mzaf_10795493019805908585.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/1b/27/bf/1b27bf2a-60fb-d446-0b1e-06588d929b9f/886445584823.jpg/100x100bb.jpg"
  },
  Default: {
    songName: "Sunrise",
    artistName: "Norah Jones",
    explanation: "A warm acoustic melody to bring peace and reflection to your mind.",
    emotionEmoji: "✨",
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/a4/09/2c/a4092c42-5e60-48ee-df42-51a4cf0ec586/mzaf_11303867629555621415.plus.aac.p.m4a",
    artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/04/b8/b104b868-b769-cf4d-3d4a-5f502d99d10e/00724359850451.jpg/100x100bb.jpg"
  }
};

app.post(["/api/music", "/music"], authenticateUser, async (req, res) => {
  try {
    const { history, mood } = req.body || {};
    const moodKey = mood && MOOD_FALLBACK_MUSIC[mood] ? mood : "Default";
    const fallbackTrack = MOOD_FALLBACK_MUSIC[moodKey] || MOOD_FALLBACK_MUSIC.Default;

    let result = {
      songName: fallbackTrack.songName,
      artistName: fallbackTrack.artistName,
      explanation: fallbackTrack.explanation,
      detectedEmotion: mood || "Reflective",
      emotionEmoji: fallbackTrack.emotionEmoji
    };

    try {
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
      const jsonStr = aiReply.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.songName && parsed.artistName) {
        result = parsed;
      }
    } catch (e) {
      console.warn("Gemini music generation notice (using mood curated track):", e);
    }

    let musicData = {
      previewUrl: fallbackTrack.previewUrl,
      trackName: result.songName,
      artistName: result.artistName,
      artworkUrl: fallbackTrack.artworkUrl
    };

    try {
      const searchTerm = encodeURIComponent(`${result.songName} ${result.artistName}`);
      const itunesRes = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`);
      if (itunesRes.ok) {
        const itunesJson = await itunesRes.json();
        if (itunesJson.results && itunesJson.results.length > 0) {
          const track = itunesJson.results[0];
          musicData = {
            previewUrl: track.previewUrl || fallbackTrack.previewUrl,
            trackName: track.trackName || result.songName,
            artistName: track.artistName || result.artistName,
            artworkUrl: track.artworkUrl100 || fallbackTrack.artworkUrl
          };
        }
      }
    } catch (e) {
      console.warn("iTunes API search warning (using cached track artwork):", e);
    }

    res.json({
      reply: `🎵 **${result.songName}** by **${result.artistName}**\n\n${result.explanation}`,
      searchData: result,
      musicData,
      detectedEmotion: result.detectedEmotion || mood || "Reflective",
      emotionEmoji: result.emotionEmoji || "🎵"
    });
  } catch (error) {
    console.error("Music API handler notice:", error);
    const fallback = MOOD_FALLBACK_MUSIC.Default;
    res.json({
      reply: `🎵 **${fallback.songName}** by **${fallback.artistName}**\n\n${fallback.explanation}`,
      searchData: fallback,
      musicData: fallback,
      detectedEmotion: "Reflective",
      emotionEmoji: fallback.emotionEmoji
    });
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

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
