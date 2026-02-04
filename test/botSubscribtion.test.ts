import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import fs from 'fs';
import path from 'path';
import { DiscordBot } from "@/services/bot";

// We mock the discord.js Client to avoid connecting to real Discord
const mockLogin = mock(() => Promise.resolve("token"));
const mockOn = mock(() => {});
mock.module("discord.js", () => {
    return {
        Client: class {
            login = mockLogin;
            on = mockOn;
        },
        GatewayIntentBits: {},
        PermissionsBitField: { Flags: {} }
    };
});

// We need to point the bot to a test file
const TEST_SUBS_FILE = "data/channels.json"; 

describe("Bot Subscription Logic", () => {
    let bot: DiscordBot;

    beforeEach(() => {
        // Clear subscriptions file
        if (fs.existsSync(TEST_SUBS_FILE)) fs.unlinkSync(TEST_SUBS_FILE);
        const dir = path.dirname(TEST_SUBS_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Initialize bot (mocks will handle connection)
        bot = new DiscordBot("fake-token", undefined, undefined);
    });

    afterEach(() => {
        if (fs.existsSync(TEST_SUBS_FILE)) fs.unlinkSync(TEST_SUBS_FILE);
    });

    it("should initialize with empty subscriptions", () => {
        const subs = (bot as any).loadSubscriptions();
        expect(subs).toEqual({});
    });

    it("should save a subscription", () => {
        // Access private method via any
        (bot as any).saveSubscription("guild-1", "channel-A");
        
        // Check memory load
        const subs = (bot as any).loadSubscriptions();
        expect(subs["guild-1"]).toBe("channel-A");

        // Check file on disk
        const raw = fs.readFileSync(TEST_SUBS_FILE, 'utf-8');
        expect(JSON.parse(raw)["guild-1"]).toBe("channel-A");
    });

    it("should overwrite subscription for the same guild", () => {
        (bot as any).saveSubscription("guild-1", "channel-A");
        (bot as any).saveSubscription("guild-1", "channel-B");

        const subs = (bot as any).loadSubscriptions();
        expect(subs["guild-1"]).toBe("channel-B");
    });

    it("should remove a subscription", () => {
        (bot as any).saveSubscription("guild-1", "channel-A");
        
        const result = (bot as any).removeSubscription("guild-1");
        expect(result).toBe(true);

        const subs = (bot as any).loadSubscriptions();
        expect(subs["guild-1"]).toBeUndefined();
    });

    it("should return false when removing non-existent subscription", () => {
        const result = (bot as any).removeSubscription("guild-999");
        expect(result).toBe(false);
    });
});
