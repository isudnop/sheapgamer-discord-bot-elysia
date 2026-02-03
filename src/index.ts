import { Elysia } from 'elysia';
import { DiscordBot } from './bot';

const RSS_URL = process.env.RSS_URL;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
    console.error("❌ Error: DISCORD_TOKEN is missing in .env");
    process.exit(1);
}

// Start Discord Bot
console.log("Starting Discord Bot...");
if (YOUTUBE_CHANNEL_ID) {
    console.log(`📺 YouTube monitoring enabled for channel: ${YOUTUBE_CHANNEL_ID}`);
}

const bot = new DiscordBot(DISCORD_TOKEN, RSS_URL, YOUTUBE_CHANNEL_ID);
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