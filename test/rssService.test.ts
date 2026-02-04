import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import fs from 'fs';
import { RssService } from "@/services/rssService";

// We will mock the parser by extending the class or mocking the method
// However, mocking external libraries in Bun is simpler by creating a temporary file
// or just mocking the method response if we structure it right.
// For simplicity in this example, we will test the logic assuming the parser returns data.

// NOTE: Since mocking external modules like 'rss-parser' is specific in Bun,
// we will focus on testing state logic and html cleaning here.

describe("RssService", () => {
    const TEST_DB = "test_state.json";

    beforeEach(() => {
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    afterEach(() => {
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    it("should initialize and load no state initially", () => {
        const service = new RssService("http://fake", TEST_DB);
        // Access private property using 'any' for testing
        expect((service as any).lastSeenId).toBeNull();
    });

    it("should clean HTML correctly", () => {
        const service = new RssService("http://fake", TEST_DB);
        const dirty = "<div><img src='x'>Hello World</div>";
        const clean = (service as any).cleanHtml(dirty);
        expect(clean).toBe("Hello World");
    });

    it("should save state correctly", () => {
        const service = new RssService("http://fake", TEST_DB);
        (service as any).saveState("GUID-123");
        
        // Check file
        const data = JSON.parse(fs.readFileSync(TEST_DB, 'utf-8'));
        expect(data.last_seen_id).toBe("GUID-123");
    });
});