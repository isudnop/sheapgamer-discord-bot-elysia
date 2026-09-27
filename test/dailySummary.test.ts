import { describe, it, expect, afterEach } from "bun:test";
import fs from 'fs';
import { RssService, localDay } from "@/services/rssService";
import { SummaryService, parseSections } from "@/services/summaryService";

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

    it("archives the feed and returns only that day's items", () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        const now = new Date("2026-09-23T03:00:00Z");
        rss.archiveItems([
            { guid: "a", title: "A", isoDate: "2026-09-21T17:01:00Z" }, // 00:01 BKK 22 Sep
            { guid: "b", title: "B", isoDate: "2026-09-22T16:59:00Z" }, // 23:59 BKK 22 Sep
            { guid: "c", title: "C", isoDate: "2026-09-22T17:01:00Z" }, // 23 Sep
            { guid: "old", title: "Old", isoDate: "2026-09-10T00:00:00Z" }, // pruned
        ], now);
        expect(rss.getItemsForDay("2026-09-22").map(i => i.title)).toEqual(["A", "B"]);
        expect(Object.keys(JSON.parse(fs.readFileSync(TEST_ARCHIVE, 'utf-8')))).not.toContain("old");
    });

    it("is due once per day after the summary hour", () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        fs.writeFileSync(TEST_SUMMARY_STATE, "{}"); // not a first deploy
        const summary = new SummaryService(rss, "test-key", TEST_SUMMARY_STATE);
        expect(summary.isDue(new Date("2026-09-22T17:30:00Z"))).toBe(false); // 00:30 BKK, too early
        expect(summary.isDue(new Date("2026-09-22T18:30:00Z"))).toBe(true);  // 01:30 BKK
        summary.markDone("2026-09-22");
        expect(summary.isDue(new Date("2026-09-22T18:40:00Z"))).toBe(false);
    });

    it("gives up on a day after 3 failed attempts", () => {
        const rss = new RssService("http://fake", TEST_STATE, TEST_ARCHIVE);
        fs.writeFileSync(TEST_SUMMARY_STATE, "{}");
        const summary = new SummaryService(rss, "test-key", TEST_SUMMARY_STATE);
        const now = new Date("2026-09-22T18:30:00Z");
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
        expect(rss.getItemsForDay("2026-09-22")[0]!.content).toBe("ข่าวจริง\n .");
    });

    it("splits model output into sections", () => {
        const sections = parseSections("Here you go:\n## 📰 News\n**[NEW]** A\n\n## 💸 Deals\n**[BUFF]** B\n## Empty\n");
        expect(sections).toEqual([
            { title: "📰 News", body: "**[NEW]** A" },
            { title: "💸 Deals", body: "**[BUFF]** B" },
        ]);
    });
});
