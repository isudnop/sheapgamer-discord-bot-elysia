import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import type { NewsItem, StateData, ArchivedItem } from '@/types';
import { RSS_STATE_FILE, NEWS_ARCHIVE_FILE, ARCHIVE_KEEP_DAYS, SUMMARY_TIMEZONE } from '@/config/constants';

// Calendar day (YYYY-MM-DD) in the summary timezone
export function localDay(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: SUMMARY_TIMEZONE });
}

export class RssService {
    private feedUrl: string;
    private dbFile: string;
    private parser: Parser;
    private archiveFile: string;
    private lastSeenId: string | null;

    constructor(feedUrl: string, dbFile: string = RSS_STATE_FILE, archiveFile: string = NEWS_ARCHIVE_FILE) {
        this.feedUrl = feedUrl;
        this.dbFile = dbFile;
        this.archiveFile = archiveFile;
        
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

    private parseItem(item: any): NewsItem {
        const guid = item.guid || item.link || '';
        const rawSummary = item.summary || item.contentSnippet || '';
        let cleanSummary = this.cleanHtml(rawSummary);
        if (cleanSummary.length > 300) {
            cleanSummary = cleanSummary.substring(0, 297) + "...";
        }

        let imageUrl: string | null = null;
        if ((item as any).mediaContent) {
            const media = (item as any).mediaContent;
            if (Array.isArray(media)) {
                const img = media.find((m: any) => m.$?.medium === 'image' || m.$?.url);
                if (img) imageUrl = img.$.url;
            } else if (media?.$?.url) {
                imageUrl = media.$.url;
            }
        }
        if (!imageUrl && item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image')) {
            imageUrl = item.enclosure.url;
        }

        return {
            title: item.title || 'Untitled',
            link: item.link || '',
            summary: cleanSummary,
            guid: guid,
            image: imageUrl
        };
    }

    async checkForNews(): Promise<NewsItem[]> {
        try {
            const feed = await this.parser.parseURL(this.feedUrl);
            
            if (!feed.items || feed.items.length === 0) return [];

            // Archive the whole feed every poll (the feed only holds ~25 items, so the daily summary needs our own copy)
            this.archiveItems(feed.items);

            const latestItem = feed.items[0];
            const latestGuid = latestItem.guid || latestItem.link || '';

            if (latestGuid === this.lastSeenId) {
                return [];
            }

            const newArticles: NewsItem[] = [];

            for (const item of feed.items) {
                const guid = item.guid || item.link || '';
                if (guid === this.lastSeenId) break;

                newArticles.push(this.parseItem(item));
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

    private loadArchive(): Record<string, ArchivedItem> {
        try {
            return JSON.parse(fs.readFileSync(this.archiveFile, 'utf-8'));
        } catch { return {}; }
    }

    archiveItems(items: any[], now: Date = new Date()): void {
        const archive = this.loadArchive();
        for (const item of items) {
            const guid = item.guid || item.link;
            const date = item.isoDate || (item.pubDate && new Date(item.pubDate).toISOString());
            if (!guid || !date) continue;
            archive[guid] = {
                title: item.title || 'Untitled',
                link: item.link || '',
                // Full text, not the 300-char summary: deal posts need their prices and coupon codes
                content: (item.contentSnippet || this.cleanHtml(item.content || ''))
                    .split(/\n\s*(?:ติดตามเพจใหม่|-{10,})/)[0]! // drop page-follow + sponsor footer (BullVPN ad would show up as a "deal")
                    .substring(0, 2000),
                date,
            };
        }
        const cutoff = now.getTime() - ARCHIVE_KEEP_DAYS * 24 * 60 * 60 * 1000;
        for (const [guid, a] of Object.entries(archive)) {
            if (new Date(a.date).getTime() < cutoff) delete archive[guid];
        }
        fs.writeFileSync(this.archiveFile, JSON.stringify(archive, null, 2));
    }

    // All archived items published in [start, end), oldest first
    getItemsBetween(start: Date, end: Date): ArchivedItem[] {
        return Object.values(this.loadArchive())
            .filter(a => { const t = new Date(a.date).getTime(); return t >= start.getTime() && t < end.getTime(); })
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    async forceFetchLatest(): Promise<NewsItem | null> {
        try {
            const feed = await this.parser.parseURL(this.feedUrl);
            if (!feed.items || feed.items.length === 0) return null;

            // Just grab the first one
            return this.parseItem(feed.items[0]);
        } catch (error) {
            console.error("Error fetching RSS (Force):", error);
            return null;
        }
    }
}
