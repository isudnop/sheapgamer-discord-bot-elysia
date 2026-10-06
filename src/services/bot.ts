import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { RssService, localDay } from '@/services/rssService';
import { YoutubeService } from '@/services/youtubeService';
import { SummaryService } from '@/services/summaryService';
import type { Subscriptions } from '@/types';
import { SUBSCRIPTION_FILE, RSS_CHECK_INTERVAL } from '@/config/constants';

export class DiscordBot {
    private client: Client;
    private rssService: RssService | null;
    private youtubeService: YoutubeService | null;
    private summaryService: SummaryService | null;
    private token: string;

    constructor(token: string, rssUrl: string | undefined, youtubeChannelId: string | undefined, geminiApiKey?: string) {
        this.token = token;
        
        this.ensureDataDir();

        this.rssService = rssUrl ? new RssService(rssUrl) : null;
        this.youtubeService = youtubeChannelId ? new YoutubeService(youtubeChannelId) : null;
        this.summaryService = this.rssService && geminiApiKey ? new SummaryService(this.rssService, geminiApiKey) : null;

        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        this.registerEvents();
    }

    private ensureDataDir() {
        const dir = path.dirname(SUBSCRIPTION_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private loadSubscriptions(): Subscriptions {
        if (fs.existsSync(SUBSCRIPTION_FILE)) {
            try {
                return JSON.parse(fs.readFileSync(SUBSCRIPTION_FILE, 'utf-8'));
            } catch { return {}; }
        }
        return {};
    }

    private saveSubscription(guildId: string, channelId: string) {
        const subs = this.loadSubscriptions();
        subs[guildId] = channelId;
        fs.writeFileSync(SUBSCRIPTION_FILE, JSON.stringify(subs, null, 2));
    }

    private removeSubscription(guildId: string): boolean {
        const subs = this.loadSubscriptions();
        if (subs[guildId]) {
            delete subs[guildId];
            fs.writeFileSync(SUBSCRIPTION_FILE, JSON.stringify(subs, null, 2));
            return true;
        }
        return false;
    }

    private registerEvents() {
        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user?.tag}`);
            
            const clientId = this.client.user?.id;
            const link = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=274878024768&scope=bot`;
            
            console.log("----------------------------------------------------------------");
            console.log(`👉 INVITE LINK: ${link}`);
            console.log("----------------------------------------------------------------");

            // Initial Run
            this.runTasks();
            
            // Loop every 10 minutes
            setInterval(() => this.runTasks(), RSS_CHECK_INTERVAL);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

            if (message.content === '!subscribe_sheapgamer') {
                this.saveSubscription(message.guildId!, message.channelId);
                await message.channel.send(`✅ วาริรินตั้งค่าช่องข่าวสารแล้วค่ะ ช่องข่าวสารคือ  <#${message.channelId}> จะโพสต์ข่าวสารที่นี่ค่ะ`);
            }

            if (message.content === '!unsubscribe_sheapgamer') {
                if (this.removeSubscription(message.guildId!)) {
                    await message.channel.send("✅ วาริรินยกเลิกการตั้งค่าช่องข่าวสารของเซิร์ฟเวอร์แล้วค่ะ");
                } else {
                    await message.channel.send("ℹ️ ยังไม่มีการตั้งค่าช่องข่าวสารค่ะ");
                }
            }

            if (message.content === '!forcenews_sheapgamer') {
                await message.channel.send("🔄 ส่งข่าวล่าสุดอีกครั้งค่ะ");
                await this.forcePublishNews(message.guildId!);
            }

            if (message.content === '!summary_sheapgamer') {
                if (!this.summaryService) {
                    await message.channel.send("ℹ️ ยังไม่ได้เปิดใช้งาน Daily Summary ค่ะ (ต้องตั้งค่า GEMINI_API_KEY)");
                    return;
                }
                const channelId = this.loadSubscriptions()[message.guildId!];
                if (!channelId) {
                    await message.channel.send("ℹ️ ยังไม่มีการตั้งค่าช่องข่าวสารค่ะ");
                    return;
                }
                await message.channel.send("🔄 วาริรินกำลังสรุปข่าว 24 ชั่วโมงที่ผ่านมาค่ะ รอสักครู่นะคะ");
                // Only this guild, never all subscribers
                await this.postDailySummary(new Date(), { [message.guildId!]: channelId });
            }
        });
    }

    private async runTasks() {
        await this.checkRss();
        await this.checkDailySummary();
        await this.checkYoutube();
    }

    private async forcePublishNews(guildId: string) {
        if (!this.rssService) return;

        console.log("Forcing latest news publish...");
        const item = await this.rssService.forceFetchLatest();

        if (item) {
            console.log(`Force publishing item: ${item.title}`);
            // Only the guild that ran the command, never all subscribers
            const channelId = this.loadSubscriptions()[guildId];
            if (!channelId) return;
            const subs = { [guildId]: channelId };

            const embed = new EmbedBuilder()
                .setTitle(item.title)
                .setURL(item.link)
                .setColor(0x00ff00)
                .setFooter({ text: "ข่าวล่ามาไวจากเกมถูก" });

            if (item.image) {
                embed.setImage(item.image);
            }

            await this.broadcastEmbed(embed, subs);
        } else {
            console.log("No news found to force publish.");
        }
    }

    private async checkRss() {
        if (!this.rssService) return;

        console.log("Checking for RSS news...");
        const newItems = await this.rssService.checkForNews();

        if (newItems.length > 0) {
            console.log(`Found ${newItems.length} new RSS items.`);
            const subs = this.loadSubscriptions();

            for (const item of newItems) {
                const embed = new EmbedBuilder()
                    .setTitle(item.title)
                    .setURL(item.link)
                    .setColor(0x00ff00) // Green for News
                    .setFooter({ text: "ข่าวล่ามาไวจากเกมถูก" });

                if (item.image) {
                    embed.setImage(item.image);
                }

                await this.broadcastEmbed(embed, subs);
            }
        }
    }

    private async checkDailySummary() {
        if (!this.summaryService?.isDue()) return;

        const day = SummaryService.yesterday();
        if (await this.postDailySummary(SummaryService.windowEnd(), this.loadSubscriptions())) {
            this.summaryService.markDone(day);
        } else {
            this.summaryService.recordFailure(day);
        }
    }

    // Returns false on failure so the scheduled run retries on the next tick
    private async postDailySummary(end: Date, subs: Subscriptions): Promise<boolean> {
        const day = localDay(end);
        console.log(`Building daily summary for ${day}...`);
        try {
            const sections = await this.summaryService!.summarize(end);
            if (!sections) {
                console.log(`No news in the 24 hours before ${end.toISOString()}, skipping summary.`);
                return true;
            }

            // One embed per message: Discord caps a message's embeds at 6000 chars total
            for (const [i, section] of sections.entries()) {
                const embed = new EmbedBuilder()
                    .setTitle(section.title)
                    .setDescription(section.body)
                    .setColor(0xFFA500); // Orange for Daily Summary
                if (i === 0) embed.setAuthor({ name: `📜 Sheapgamer Changelog — ${day}` });
                if (i === sections.length - 1) embed.setFooter({ text: "สรุปข่าว 24 ชั่วโมงที่ผ่านมาโดยวาริรินค่ะ" });
                await this.broadcastEmbed(embed, subs);
            }
            return true;
        } catch (e) {
            console.error(`Failed to build daily summary for ${day}:`, e);
            return false;
        }
    }

    private async checkYoutube() {
        if (!this.youtubeService) return;

        console.log("Checking for YouTube videos...");
        const newVideos = await this.youtubeService.checkNewVideos();

        if (newVideos.length > 0) {
            console.log(`Found ${newVideos.length} new YouTube videos.`);
            const subs = this.loadSubscriptions();

            for (const video of newVideos) {
                const embed = new EmbedBuilder()
                    .setTitle(video.title)
                    .setURL(video.link)
                    .setColor(0xFF0000) // Red for YouTube
                    .setAuthor({ name: video.author })
                    .setFooter({ text: "YouTube Sheapgamer มีวิดีโอใหม่ค่ะ" });

                if (video.thumbnail) {
                    embed.setImage(video.thumbnail);
                }

                await this.broadcastEmbed(embed, subs);
            }
        }
    }


    private async broadcastEmbed(embed: EmbedBuilder, subs: Subscriptions) {
        for (const [guildId, channelId] of Object.entries(subs)) {
            try {
                const channel = await this.client.channels.fetch(channelId) as TextChannel;
                if (channel) {
                    // Send the message
                    const message = await channel.send({ embeds: [embed] });

                    // --- NEW: Auto-Publish (Crosspost) ---
                    // This pushes the message to all servers following this channel
                    if (message.crosspostable) {
                        await message.crosspost();
                        console.log(`Published (Crossposted) message in guild ${guildId}`);
                    }
                }
            } catch (e) {
                console.error(`Failed to send/publish to guild ${guildId}:`, e);
            }
        }
    }

    public start() {
        this.client.login(this.token);
    }
}
