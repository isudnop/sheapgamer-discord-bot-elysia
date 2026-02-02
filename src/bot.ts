import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, PermissionsBitField } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { RssService } from './rssService';

// Save inside the 'data' folder
const SUBSCRIPTION_FILE = "data/channels.json";

interface Subscriptions {
    [guildId: string]: string;
}

export class DiscordBot {
    private client: Client;
    private rssService: RssService | null;
    private token: string;

    constructor(token: string, rssUrl: string | undefined) {
        this.token = token;
        
        // Ensure data directory exists
        this.ensureDataDir();

        this.rssService = rssUrl ? new RssService(rssUrl) : null;

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

            this.runFeedCheck();
            setInterval(() => this.runFeedCheck(), 20 * 60 * 1000);
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;

            if (message.content === '!setnews') {
                this.saveSubscription(message.guildId!, message.channelId);
                await message.channel.send(`✅ วาริรินตั้งค่าช่องข่าวสารแล้วค่ะ ช่องข่าวสารคือ <#${message.channelId}> จะโพสต์ข่าวสารที่นี่ค่ะ`);
            }

            if (message.content === '!unsentnews') {
                if (this.removeSubscription(message.guildId!)) {
                    await message.channel.send("✅ วาริรินยกเลิกการตั้งค่าช่องข่าวสารแล้วค่ะ");
                } else {
                    await message.channel.send("ℹ️ ยังไม่มีการตั้งค่าช่องข่าวสารค่ะ");
                }
            }
        });
    }

    private async runFeedCheck() {
        if (!this.rssService) {
            console.log("RSS Service not initialized.");
            return;
        }

        console.log("Checking for news...");
        const newItems = await this.rssService.checkForNews();

        if (newItems.length === 0) {
            console.log("No new items found.");
            return;
        }

        console.log(`Found ${newItems.length} new items. Broadcasting...`);
        const subs = this.loadSubscriptions();

        for (const item of newItems) {
            const embed = new EmbedBuilder()
                .setTitle(item.title)
                .setURL(item.link)
                //.setDescription(item.summary) 
                .setColor(0x00ff00)
                .setFooter({ text: "ข่าวล่ามาไวจากเกมถูก" });

            if (item.image) {
                embed.setImage(item.image);
            }

            for (const [guildId, channelId] of Object.entries(subs)) {
                try {
                    const channel = await this.client.channels.fetch(channelId) as TextChannel;
                    if (channel) {
                        await channel.send({ embeds: [embed] });
                    }
                } catch (e) {
                    console.error(`Failed to send to guild ${guildId}:`, e);
                }
            }
        }
    }

    public start() {
        this.client.login(this.token);
    }
}