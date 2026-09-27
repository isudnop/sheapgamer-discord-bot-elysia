import { Elysia } from 'elysia';
import { DiscordBot } from './services/bot';

const RSS_URL = Bun.env.RSS_URL;
const YOUTUBE_CHANNEL_ID = Bun.env.YOUTUBE_CHANNEL_ID;
const DISCORD_TOKEN = Bun.env.DISCORD_TOKEN;
const GEMINI_API_KEY = Bun.env.GEMINI_API_KEY;

if (!DISCORD_TOKEN) {
    console.error("❌ Error: DISCORD_TOKEN is missing in .env");
    process.exit(1);
}

// Start Discord Bot
console.log("Starting Discord Bot...");
if (YOUTUBE_CHANNEL_ID) {
    console.log(`📺 YouTube monitoring enabled for channel: ${YOUTUBE_CHANNEL_ID}`);
}
if (RSS_URL && GEMINI_API_KEY) {
    console.log("📜 Daily Summary enabled");
}

const bot = new DiscordBot(DISCORD_TOKEN, RSS_URL, YOUTUBE_CHANNEL_ID, GEMINI_API_KEY);
bot.start();

// Start Elysia Server (Health Check)
const app = new Elysia()
    .get("/", () => "🤖 Discord RSS Bot is Running!")
    .get("/health", () => {
        return { status: "ok", timestamp: new Date() };
    })
    .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);