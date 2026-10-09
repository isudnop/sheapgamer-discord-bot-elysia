import { describe, it, expect, afterEach } from "bun:test";
import fs from 'fs';
import { RssService, localDay } from "@/services/rssService";
import { SummaryService, parseSections, isMeme } from "@/services/summaryService";
import { GEMINI_MODEL, GEMINI_FALLBACK_MODELS } from "@/config/constants";

const TEST_STATE = "test_summary_rss_state.json";
const TEST_ARCHIVE = "test_summary_archive.json";
const TEST_SUMMARY_STATE = "test_summary_state.json";

describe("Daily Summary", () => {
    afterEach(() => {
        for (const f of [TEST_STATE, TEST_ARCHIVE, TEST_SUMMARY_STATE]) if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    it("uses the Bangkok calendar day", () => {
        expect(localDay(new Date("2026-09-22T16:30:00Z"))).toBe("2026-09-22"); // 23:30 BKK
        expect(localDay(new Date("2026-09-22T17:30:00Z"))).toBe("2026-09-23"); // 00:30 BKK
        expect(SummaryService.yesterday(new Date("2026-09-23T03:00:00Z"))).toBe("2026-09-22");
    });

    it("archives the feed and returns only the 24 hours before the summary time", () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        const now = new Date("2026-09-23T03:00:00Z");
        rss.archiveItems([
            { guid: "early", title: "Early", isoDate: "2026-09-22T00:29:00Z" }, // 07:29 BKK 22 Sep, previous window
            { guid: "a", title: "A", isoDate: "2026-09-22T00:30:00Z" }, // 07:30 BKK 22 Sep
            { guid: "b", title: "B", isoDate: "2026-09-23T00:29:00Z" }, // 07:29 BKK 23 Sep
            { guid: "c", title: "C", isoDate: "2026-09-23T00:30:00Z" }, // 07:30 BKK 23 Sep, next window
            { guid: "old", title: "Old", isoDate: "2026-09-10T00:00:00Z" }, // pruned
        ], now);
        const end = SummaryService.windowEnd(now);
        expect(end.toISOString()).toBe("2026-09-23T00:30:00.000Z"); // 07:30 BKK
        expect(rss.getItemsBetween(new Date(end.getTime() - 24 * 60 * 60 * 1000), end).map(i => i.title)).toEqual(["A", "B"]);
        expect(Object.keys(JSON.parse(fs.readFileSync(TEST_ARCHIVE, 'utf-8')))).not.toContain("old");
    });

    it("is due once per day after the summary hour", () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        fs.writeFileSync(TEST_SUMMARY_STATE, "{}"); // not a first deploy
        const summary = new SummaryService(rss, "test-key", TEST_SUMMARY_STATE);
        expect(summary.isDue(new Date("2026-09-23T00:29:00Z"))).toBe(false); // 07:29 BKK, too early
        expect(summary.isDue(new Date("2026-09-23T00:30:00Z"))).toBe(true);  // 07:30 BKK
        summary.markDone("2026-09-22");
        expect(summary.isDue(new Date("2026-09-23T00:40:00Z"))).toBe(false);
    });

    it("gives up on a day after 3 failed attempts", () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        fs.writeFileSync(TEST_SUMMARY_STATE, "{}");
        const summary = new SummaryService(rss, "test-key", TEST_SUMMARY_STATE);
        const now = new Date("2026-09-23T00:30:00Z"); // 07:30 BKK
        summary.recordFailure("2026-09-22");
        summary.recordFailure("2026-09-22");
        expect(summary.isDue(now)).toBe(true);
        summary.recordFailure("2026-09-22");
        expect(summary.isDue(now)).toBe(false);
    });

    it("strips the sponsor footer when archiving", () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        rss.archiveItems([{ guid: "a", isoDate: "2026-09-22T05:00:00Z",
            contentSnippet: "ข่าวจริง\n .\n ติดตามเพจใหม่ได้ที่นี่\n -------------------------------\n แนะนำ BullVPN" }],
            new Date("2026-09-22T06:00:00Z"));
        expect(rss.getItemsBetween(new Date("2026-09-22T00:00:00Z"), new Date("2026-09-23T00:00:00Z"))[0]!.content).toBe("ข่าวจริง\n .");
    });

    it("detects memes", () => {
        const item = (title: string, content: string) => ({ title, content, link: "", date: "" });
        expect(isMeme(item("Untitled", ""))).toBe(true); // image only
        expect(isMeme(item("[Meme] lol", "[Meme] lol"))).toBe(true);
        expect(isMeme(item("[News] A", "[News] A game"))).toBe(false);
    });

    it("splits model output into sections", () => {
        const sections = parseSections("Here you go:\n## 📰 News\n**[UPDATE]** A\n\n**[EVENT]** C\n## 💸 Deals\n**[DEAL]** B\n## Empty\n");
        expect(sections).toEqual([
            { title: "📰 News", body: "**[UPDATE]** A\n.\n**[EVENT]** C\n." },
            { title: "💸 Deals", body: "**[DEAL]** B\n." },
        ]);
    });

    it("falls back to the next model on 503", async () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        const end = new Date("2026-09-23T00:30:00Z");
        rss.archiveItems([{ guid: "a", title: "A", contentSnippet: "ข่าว A", isoDate: "2026-09-22T12:00:00Z" }], end);
        fs.writeFileSync(TEST_SUMMARY_STATE, "{}");
        const summary = new SummaryService(rss, "test-key", TEST_SUMMARY_STATE);

        const ok = { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "## 📰 News\n**[UPDATE]** A" }] } }] };
        const realFetch = globalThis.fetch;
        const called: string[] = [];
        const mock = (statuses: number[]) => {
            called.length = 0;
            globalThis.fetch = (async (url: string) => {
                called.push(url.match(/models\/(.+):/)![1]!);
                const status = statuses[called.length - 1]!;
                return new Response(status === 200 ? JSON.stringify(ok) : "overloaded", { status });
            }) as any;
        };
        try {
            mock([503, 200]);
            expect(await summary.summarize(end)).toEqual([{ title: "📰 News", body: "**[UPDATE]** A\n." }]);
            expect(called).toEqual([GEMINI_MODEL, GEMINI_FALLBACK_MODELS[0]!]);

            mock([500]); // only 503 falls back
            await expect(summary.summarize(end)).rejects.toThrow("Gemini API 500");
            expect(called).toEqual([GEMINI_MODEL]);

            mock([503, 503, 503]); // every model overloaded
            await expect(summary.summarize(end)).rejects.toThrow("Gemini API 503");
            expect(called).toEqual([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]);
        } finally {
            globalThis.fetch = realFetch;
        }
    });
});
