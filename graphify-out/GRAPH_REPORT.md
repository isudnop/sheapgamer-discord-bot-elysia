# Graph Report - sheapgamer-discord-bot-elysia  (2026-10-09)

## Corpus Check
- Corpus is ~5,046 words - fits in a single context window. You may not need a graph.

## Summary
- 152 nodes · 301 edges · 9 communities (6 shown, 3 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 1% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.83)
- Token cost: 47,933 input · 0 output

## Community Hubs (Navigation)
- Constants & Entry Point
- README Concepts & Deployment
- Package Manifest
- TypeScript Config
- Discord Bot Core
- RSS Service & Archive
- Daily Summary Service
- YouTube Service
- Renovate Config

## God Nodes (most connected - your core abstractions)
1. `DiscordBot` - 20 edges
2. `RssService` - 20 edges
3. `compilerOptions` - 19 edges
4. `SummaryService` - 15 edges
5. `Discord RSS Bot (Elysia/Bun) README` - 11 edges
6. `YoutubeService` - 10 edges
7. `localDay()` - 8 edges
8. `Railway cloud deployment (recommended)` - 7 edges
9. `Subscriptions` - 5 edges
10. `NewsItem` - 5 edges

## Surprising Connections (you probably didn't know these)
- `DiscordBot` --references--> `RssService`  [EXTRACTED]
  src/services/bot.ts → src/services/rssService.ts
- `DiscordBot` --references--> `SummaryService`  [EXTRACTED]
  src/services/bot.ts → src/services/summaryService.ts
- `DiscordBot` --references--> `YoutubeService`  [EXTRACTED]
  src/services/bot.ts → src/services/youtubeService.ts
- `SummaryService` --references--> `RssService`  [EXTRACTED]
  src/services/summaryService.ts → src/services/rssService.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Daily Summary pipeline: archive feed items, summarize with Gemini, post on schedule or on demand** — readme_rss_polling, readme_news_archive_json, readme_gemini_api_key, readme_gemini, readme_daily_summary, readme_summary_sheapgamer [EXTRACTED 1.00]
- **Local JSON state that must survive redeploys via a mounted volume** — readme_channels_json, readme_news_state_json, readme_news_archive_json, readme_volume_persistence [INFERRED 0.85]
- **Bot chat commands (!*_sheapgamer)** — readme_subscribe_sheapgamer, readme_unsubscribe_sheapgamer, readme_forcenews_sheapgamer, readme_summary_sheapgamer [EXTRACTED 1.00]

## Communities (9 total, 3 thin omitted)

### Community 0 - "Constants & Entry Point"
Cohesion: 0.14
Nodes (19): ARCHIVE_KEEP_DAYS, GEMINI_FALLBACK_MODELS, GEMINI_MODEL, NEWS_ARCHIVE_FILE, RSS_CHECK_INTERVAL, RSS_STATE_FILE, SUBSCRIPTION_FILE, SUMMARY_STATE_FILE (+11 more)

### Community 1 - "README Concepts & Deployment"
Cohesion: 0.12
Nodes (20): Discord RSS Bot (Elysia/Bun) README, Bun runtime, Unit tests via bun test, channels.json (channel subscriptions), Discord.js, DISCORD_TOKEN env var, Docker deployment (rss-bot-elysia image), ElysiaJS (+12 more)

### Community 2 - "Package Manifest"
Cohesion: 0.09
Nodes (21): dependencies, discord.js, dotenv, elysia, rss-parser, devDependencies, bun-types, module (+13 more)

### Community 3 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, allowSyntheticDefaultImports, baseUrl, composite, downlevelIteration, forceConsistentCasingInFileNames (+11 more)

### Community 5 - "RSS Service & Archive"
Cohesion: 0.29
Nodes (3): RssService, ArchivedItem, NewsItem

### Community 8 - "Renovate Config"
Cohesion: 0.50
Nodes (3): config:recommended, extends, $schema

## Ambiguous Edges - Review These
- `YOUTUBE_CHANNEL_ID env var` → `Railway cloud deployment (recommended)`  [AMBIGUOUS]
  README.md · relation: references
- `GEMINI_API_KEY env var (optional)` → `Railway cloud deployment (recommended)`  [AMBIGUOUS]
  README.md · relation: references

## Knowledge Gaps
- **8 isolated node(s):** `dotenv`, `bun-types`, `config:recommended`, `!subscribe_sheapgamer command`, `!unsubscribe_sheapgamer command` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 46 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RssService` connect `RSS Service & Archive` to `Constants & Entry Point`, `Discord Bot Core`, `Daily Summary Service`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **What connects `dotenv`, `bun-types`, `config:recommended` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Constants & Entry Point` be split into smaller, more focused modules?**
  _Cohesion score 0.14204545454545456 - nodes in this community are weakly interconnected._
- **Why does `DiscordBot` connect `Discord Bot Core` to `Constants & Entry Point`, `Package Manifest`, `RSS Service & Archive`, `Daily Summary Service`, `YouTube Service`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Should `README Concepts & Deployment` be split into smaller, more focused modules?**
  _Cohesion score 0.12333333333333334 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `YOUTUBE_CHANNEL_ID env var` and `Railway cloud deployment (recommended)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `GEMINI_API_KEY env var (optional)` and `Railway cloud deployment (recommended)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._