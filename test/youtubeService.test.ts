import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import fs from 'fs';
import path from 'path';
import { YoutubeService } from "@/services/youtubeService";

const TEST_DB = "data/test_yt_state.json";

describe("YoutubeService", () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
        const dir = path.dirname(TEST_DB);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    it("should initialize and load state as null", () => {
        const service = new YoutubeService("channel_id", TEST_DB);
        expect((service as any).lastVideoId).toBeNull();
    });

    it("should extract thumbnail from media:group", async () => {
        const service = new YoutubeService("channel_id", TEST_DB);

        // Mock YouTube Feed Structure
        const mockFeed = {
            items: [
                {
                    title: "Video 1",
                    link: "http://yt.com/v1",
                    id: "yt-video:123",
                    author: "My Channel",
                    mediaGroup: {
                        'media:thumbnail': { $: { url: "http://thumb.jpg" } }
                    }
                }
            ]
        };

        (service as any).parser.parseURL = mock(() => Promise.resolve(mockFeed));

        const videos = await service.checkNewVideos();
        
        expect(videos.length).toBe(1);
        expect(videos[0].title).toBe("Video 1");
        expect(videos[0].thumbnail).toBe("http://thumb.jpg");
        expect(videos[0].id).toBe("yt-video:123");
    });

    it("should handle array style thumbnails (sometimes happens)", async () => {
        const service = new YoutubeService("channel_id", TEST_DB);

        const mockFeed = {
            items: [
                {
                    id: "v2",
                    mediaGroup: {
                        'media:thumbnail': [
                            { $: { url: "http://thumb-hq.jpg" } },
                            { $: { url: "http://thumb-lq.jpg" } }
                        ]
                    }
                }
            ]
        };
        (service as any).parser.parseURL = mock(() => Promise.resolve(mockFeed));

        const videos = await service.checkNewVideos();
        expect(videos[0].thumbnail).toBe("http://thumb-hq.jpg");
    });

    it("should deduplicate videos correctly", async () => {
        const service = new YoutubeService("channel_id", TEST_DB);

        // 1. Initial State
        (service as any).lastVideoId = "video-A";

        // 2. Feed has Video B (new) and Video A (old)
        const mockFeed = {
            items: [
                { id: "video-B", title: "New V" },
                { id: "video-A", title: "Old V" }
            ]
        };
        (service as any).parser.parseURL = mock(() => Promise.resolve(mockFeed));

        const videos = await service.checkNewVideos();

        expect(videos.length).toBe(1);
        expect(videos[0].id).toBe("video-B");
        
        // Verify state update
        const state = JSON.parse(fs.readFileSync(TEST_DB, 'utf-8'));
        expect(state.last_video_id).toBe("video-B");
    });
});