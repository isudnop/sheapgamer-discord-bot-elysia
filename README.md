# Discord RSS Bot (Elysia/Bun)

A simple Discord bot rewritten in TypeScript using Bun and ElysiaJS.

### Features 🚀

- Stack: Bun + ElysiaJS + Discord.js.

- Polls RSS feed every 20 minutes and posts updates to Discord.

- Can monitor a specific YouTube channel for new Videos, Shorts, and Live streams.

- Includes a health check endpoint via Elysia at http://localhost:3000 (useful for cloud health checks).
- Uses local JSON files to track news state and channel subscriptions.

## Setup


### Prerequisites

- Bun installed `(curl -fsSL https://bun.sh/install | bash)`.
- A Discord Bot Token.


### Installation

- Install dependencies:

  `bun install`

- Create a .env file:
```
DISCORD_TOKEN=your_token_here
RSS_URL=https://rss.app/feeds/sadasd.xml
YOUTUBE_CHANNEL_ID=UCOsdaswsds
GEMINI_API_KEY=your_gemini_key   # optional, enables Daily Summary
```

- Running Locally

  `bun start`


## Cloud Deployment: Railway (Recommended)

-  Connect your GitHub repository to Railway.

- Add DISCORD_TOKEN and RSS_URL in the "Variables" tab.

### Persistence (Crucial):

- Go to the Volumes in your service.
- Click "Add Volume".
- Set the Mount Path to /app/data.
- This ensures channels.json and news_state.json are saved to a virtual disk. Without this, your bot will lose all data every time you redeploy.

### Health Check:

Railway may automatically detect the web server.

You can explicitly set the Healthcheck Path to `/health` in `Settings -> Deploy`.


## Docker Deployment

1. Build the Image

`docker build -t rss-bot-elysia`


2. Run with Persistence - You must mount a volume to save channels.json and news_state.json, otherwise the bot will forget its settings on restart.

Linux / Mac / PowerShell:

```
docker run -d --env-file .env -v "$(pwd):/app" -p 3000:3000 --name my-rss-bot --restart always rss-bot-elysia
```


Windows CMD:
```
docker run -d --env-file .env -v "%cd%:/app" -p 3000:3000 --name my-rss-bot --restart always rss-bot-elysia
```

## Usage

### Commands

`!subscribe_sheapgamer` - Set the current channel for news updates.

`!unsubscribe_sheapgamer` - Stop receiving news in the current server.

`!forcenews_sheapgamer` - Re-post the latest news to this server.

`!summary_sheapgamer` - Post yesterday's Daily Summary to this server now.

### Daily Summary Changelogs

When `GEMINI_API_KEY` is set, every day after 01:00 (Asia/Bangkok) the bot posts a patch-notes style summary of yesterday's News, Deals and Articles, written by Gemini. The bot archives every feed item in `data/news_archive.json` (kept 3 days) because the RSS feed only holds ~25 items.

### Invite the Bot

When the bot starts, look at the console logs. It will print a generated Invite Link that you can use to add the bot to your server.

### Health Check

You can verify the bot is running by visiting:
`http://localhost:3000/health`

### Testing

Run the unit tests using Bun's built-in test runner:

`bun test`
