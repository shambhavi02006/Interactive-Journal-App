# 🌿 Mindful Journal

> An empathetic, AI-powered journaling companion with real-time emotion analysis and mood-matched music curation.

Mindful Journal helps users reflect on their thoughts, feelings, and daily experiences. Powered by **Google Gemini API**, the app acts as a thoughtful companion—analyzing emotions, offering warm reflections, and curating matching music preview tracks based on your mood.

---

## ✨ Features

- 💬 **Empathetic AI Companion (Aether)**: Conversational reflection companion powered by Google Gemini.
- 🎭 **Real-Time Emotion Analysis**: Detects underlying emotions (*Happy, Anxious, Hopeful, Melancholic, Angry, etc.*) and displays emotion badges on responses.
- 🎵 **Mood-Matched Music Curation**: Recommends fitting music tracks with live 30-second audio previews via iTunes API integration.
- ⚡ **Interactive Mood Selector**: Interactive *"How are you feeling right now?"* prompt with preset mood pills, custom emotion input, and a *"Surprise Me (Random)"* mood option.
- 🔑 **Google Sign-In & Guest Mode**: Seamless Google OAuth authentication plus a zero-setup Guest Demo mode for instant local testing.
- ☁️ **Cloud Synchronization**: Encrypted reflection persistence using Cloud Firestore.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, TailwindCSS, Lucide Icons
- **Backend**: Express.js, Node.js, Vite
- **AI Logic**: `@google/genai` (Google Gemini API)
- **Database & Auth**: Firebase Auth, Cloud Firestore
- **Audio Integration**: iTunes Search API

---

## 🚀 Getting Started Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/Journal-App.git
   cd Journal-App
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```

5. **Open in Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🔑 Authentication Notes

- **Guest Mode (Default for Local Testing)**: Click **Continue as Guest (Demo Mode)** on the login screen to test all features instantly without configuration.
- **Google Sign-In**: To use Google Sign-In locally, add `localhost` to **Authorized Domains** under **Firebase Console -> Authentication -> Settings**.