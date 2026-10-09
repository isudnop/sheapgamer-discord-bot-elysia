// File paths for persistent storage
export const SUBSCRIPTION_FILE = "data/channels.json";
export const RSS_STATE_FILE = "data/news_state.json";
export const YOUTUBE_STATE_FILE = "data/youtube_state.json";

// Poll intervals (in milliseconds)
export const RSS_CHECK_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Daily summary
export const NEWS_ARCHIVE_FILE = "data/news_archive.json";
export const SUMMARY_STATE_FILE = "data/summary_state.json";
export const SUMMARY_TIMEZONE = "Asia/Bangkok";
export const SUMMARY_TIME = "07:30"; // post the last 24 hours' summary at this local time, when people are awake
// ponytail: fixed offset, Bangkok has no DST. Derive it from SUMMARY_TIMEZONE if the timezone ever changes
export const SUMMARY_UTC_OFFSET = "+07:00";
export const ARCHIVE_KEEP_DAYS = 3;
export const GEMINI_MODEL = Bun.env.GEMINI_MODEL || "gemini-3.8-flash";
// Tried in order when the model before it answers 503 (overloaded)
export const GEMINI_FALLBACK_MODELS = (Bun.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.6-flash,gemini-3.5-flash").split(",").map(m => m.trim()).filter(m => m && m !== GEMINI_MODEL);
