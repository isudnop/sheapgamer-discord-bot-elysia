import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import type { YoutubeItem, StateData } from '@/types';
import { YOUTUBE_STATE_FILE } from '@/config/constants';

export class YoutubeService {
    private channelId: string;
    private dbFile: string;
    private parser: Parser;
    private lastVideoId: string | null;

    constructor(channelId: string, dbFile: string = YOUTUBE_STATE_FILE) {
        this.channelId = channelId;
        this.dbFile = dbFile;
        this.ensureDirectory();
        
        // Configure parser to handle YouTube's media tags
        this.parser = new Parser({
            customFields: {
                item: [['media:group', 'mediaGroup']]
            }
        });
        
        this.lastVideoId = this.loadState();
    }

    private ensureDirectory() {
        const dir = path.dirname(this.dbFile);
        if (dir && dir !== '.' && !fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private loadState(): string | null {
        if (fs.existsSync(this.dbFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.dbFile, 'utf-8'));
                return data.last_video_id || null;
            } catch (e) {
                console.error("Error reading youtube state:", e);
            }
        }
        return null;
    }

    private saveState(lastId: string): void {
        const data: StateData = {
            last_video_id: lastId,
            updated_at: new Date().toISOString()
        };
        fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2));
        this.lastVideoId = lastId;
    }

    async checkNewVideos(): Promise<YoutubeItem[]> {
        try {
            // YouTube RSS URL format
            const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${this.channelId}`;
            const feed = await this.parser.parseURL(url);

            if (!feed.items || feed.items.length === 0) return [];

            // YouTube RSS is ordered by time (newest first)
            const latestItem = feed.items[0];
            const ytId = latestItem.id || latestItem.guid || "";
            
            // If latest ID matches what we have, no new videos
            if (ytId === this.lastVideoId) return [];

            const newVideos: YoutubeItem[] = [];

            for (const item of feed.items) {
                const id = item.id || item.guid || "";
                
                // Stop if we reach the last seen video
                if (id === this.lastVideoId) break;

                // Extract thumbnail from media:group -> media:thumbnail
                let thumbnail = null;
                const mediaGroup = (item as any).mediaGroup;
                if (mediaGroup && mediaGroup['media:thumbnail']) {
                    const thumbObj = mediaGroup['media:thumbnail'];
                    // Sometimes it's an array, sometimes a single object
                    if (Array.isArray(thumbObj)) {
                        thumbnail = thumbObj[0].$.url;
                    } else if (thumbObj.$ && thumbObj.$.url) {
                        thumbnail = thumbObj.$.url;
                    }
                }

                newVideos.push({
                    title: item.title || "New Video",
                    link: item.link || "",
                    id: id,
                    thumbnail: thumbnail,
                    author: item.author || "YouTube Channel"
                });
            }

            if (newVideos.length > 0) {
                this.saveState(ytId);
            }

            return newVideos;
        } catch (error) {
            console.error("Error fetching YouTube RSS:", error);
            return [];
        }
    }
}
