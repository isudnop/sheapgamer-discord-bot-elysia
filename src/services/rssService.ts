import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import type { NewsItem, StateData } from '@/types';
import { RSS_STATE_FILE } from '@/config/constants';

export class RssService {
    private feedUrl: string;
    private dbFile: string;
    private parser: Parser;
    private lastSeenId: string | null;

    constructor(feedUrl: string, dbFile: string = RSS_STATE_FILE) {
        this.feedUrl = feedUrl;
        this.dbFile = dbFile;
        
        // Ensure the data directory exists
        this.ensureDirectory();

        this.parser = new Parser({
            customFields: {
                item: [['media:content', 'mediaContent', { keepArray: true }]]
            }
        });
        this.lastSeenId = this.loadState();
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
                const data = fs.readFileSync(this.dbFile, 'utf-8');
                const json: StateData = JSON.parse(data);
                return json.last_seen_id || null;
            } catch (e) {
                console.error("Error reading state file:", e);
            }
        }
        return null;
    }

    private saveState(lastId: string): void {
        const data: StateData = {
            last_seen_id: lastId,
            updated_at: new Date().toISOString()
        };
        fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2));
        this.lastSeenId = lastId;
    }

    private cleanHtml(rawHtml: string): string {
        if (!rawHtml) return "No description available.";
        return rawHtml.replace(/<[^>]*>?/gm, '').trim();
    }

    async checkForNews(): Promise<NewsItem[]> {
        try {
            const feed = await this.parser.parseURL(this.feedUrl);
            
            if (!feed.items || feed.items.length === 0) return [];

            const latestItem = feed.items[0];
            const latestGuid = latestItem.guid || latestItem.link || '';

            if (latestGuid === this.lastSeenId) {
                return [];
            }

            const newArticles: NewsItem[] = [];

            for (const item of feed.items) {
                const guid = item.guid || item.link || '';
                if (guid === this.lastSeenId) break;

                const rawSummary = item.summary || item.contentSnippet || '';
                let cleanSummary = this.cleanHtml(rawSummary);
                if (cleanSummary.length > 300) {
                    cleanSummary = cleanSummary.substring(0, 297) + "...";
                }

                let imageUrl: string | null = null;
                if ((item as any).mediaContent) {
                    const media = (item as any).mediaContent;
                    if (Array.isArray(media)) {
                        const img = media.find((m: any) => m.$?.medium === 'image' || m.$.url);
                        if (img) imageUrl = img.$.url;
                    } else if (media?.$?.url) {
                        imageUrl = media.$.url;
                    }
                }
                if (!imageUrl && item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image')) {
                    imageUrl = item.enclosure.url;
                }

                newArticles.push({
                    title: item.title || 'Untitled',
                    link: item.link || '',
                    summary: cleanSummary,
                    guid: guid,
                    image: imageUrl
                });
            }

            if (newArticles.length > 0) {
                this.saveState(latestGuid);
            }

            return newArticles;

        } catch (error) {
            console.error("Error fetching RSS:", error);
            return [];
        }
    }
}
