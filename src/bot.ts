import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { RssService } from './rssService';
import { YoutubeService } from './youtubeService';

const SUBSCRIPTION_FILE = "data/channels.json";

interface Subscriptions {
    [guildId: string]: string;
}

export class DiscordBot {
    private client: Client;
    private rssService: RssService | null;
    private youtubeService: YoutubeService | null;
    private token: string;

    constructor(token: string, rssUrl: string | undefined, youtubeChannelId: string | undefined) {
        this.token = token;
        
        this.ensureDataDir();

        this.rssService = rssUrl ? new RssService(rssUrl) : null;
        this.youtubeService = youtubeChannelId ? new YoutubeService(youtubeChannelId) : null;

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
            setInterval(() => this.runTasks(), 10 * 60 * 1000);
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
        });
    }

    private async runTasks() {
        await this.checkRss();
        await this.checkYoutube();
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