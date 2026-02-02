# Discord RSS Bot (Elysia/Bun)

A simple Discord bot rewritten in TypeScript using Bun and ElysiaJS.

### Features

Stack: Bun + ElysiaJS + Discord.js.

Functionality: Polls RSS feed every 20 minutes and posts updates to Discord.

Web Server: Includes a health check endpoint via Elysia at http://localhost:3000 (useful for cloud health checks).

Persistence: Uses local JSON files to track news state and channel subscriptions.

## Setup

1. Prerequisites

Bun installed `(curl -fsSL https://bun.sh/install | bash)`.

A Discord Bot Token.

2. Installation

Install dependencies:

`bun install`

Create a .env file:
```
DISCORD_TOKEN=your_token_here
RSS_URL=https://rss.app/feeds/sadasd.xml
```

3. Running Locally

Start the bot and the web server:

`bun start`


## Cloud Deployment: Railway (Recommended)

Create Project: Connect your GitHub repository to Railway.

Variables: Add DISCORD_TOKEN and RSS_URL in the "Variables" tab.

Persistence (Crucial):

Go to the Volumes tab in your service.

Click "Add Volume".

Set the Mount Path to /app/data.

Why? This ensures channels.json and news_state.json are saved to a virtual disk. Without this, your bot will lose all data every time you redeploy.

Health Check:

Railway may automatically detect the web server.

You can explicitly set the Healthcheck Path to /health in Settings -> Deploy.




## Docker Deployment

1. Build the Image

`docker build -t rss-bot-elysia`


2. Run with Persistence

You must mount a volume to save channels.json and news_state.json, otherwise the bot will forget its settings on restart.

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

### Invite the Bot

When the bot starts, look at the console logs. It will print a generated Invite Link that you can use to add the bot to your server.

### Health Check

You can verify the bot is running by visiting:
`http://localhost:3000/health`

### Testing

Run the unit tests using Bun's built-in test runner:

`bun test`
