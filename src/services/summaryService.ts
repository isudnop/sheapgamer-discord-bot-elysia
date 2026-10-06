import fs from 'fs';
import { RssService, localDay } from '@/services/rssService';
import type { ArchivedItem } from '@/types';
import { SUMMARY_STATE_FILE, SUMMARY_TIME, SUMMARY_UTC_OFFSET, SUMMARY_TIMEZONE, GEMINI_MODEL } from '@/config/constants';

const MAX_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface SummarySection {
    title: string;
    body: string;
}

const SYSTEM_PROMPT = `คุณคือ "วาริริน" ผู้ช่วยของเพจ Sheapgamer (ข่าวเกม ดีลเกมราคาถูก และบทความเกม)
งานของคุณ: สรุปโพสต์ทั้งหมดในช่วง 24 ชั่วโมงที่ผ่านมาให้อยู่ในรูปแบบ "Patch Notes / Changelog" แบบอัปเดตเกม ให้ผู้อ่านรู้ว่า 24 ชั่วโมงที่ผ่านมาเกิดอะไรขึ้นบ้างในเวลาไม่กี่วินาที

รูปแบบผลลัพธ์ (Discord markdown):
- แบ่งเป็นหมวด โดยแต่ละหมวดขึ้นต้นด้วยบรรทัด "## " ตามด้วยชื่อหมวด ใช้เฉพาะหมวดที่มีโพสต์:
  ## 📰 News
  ## 💸 Deals
  ## 📝 Articles
- แต่ละรายการเป็นหนึ่งบรรทัด ขึ้นต้นด้วยแท็กแบบ changelog แล้วตามด้วยสรุปสั้นๆ ภาษาไทย 1 ประโยค และลิงก์ในรูป [อ่านต่อ](url)
  แท็กที่ใช้ (ใช้เฉพาะแท็กเหล่านี้เท่านั้น):
  - หมวด News: **[EVENT]** สำหรับอีเวนต์/งานแสดง ส่วนข่าวอื่นทั้งหมดใช้ **[UPDATE]** ไม่ว่าจะเป็นข่าวดีหรือข่าวร้าย
  - หมวด Deals: ใช้ **[DEAL]** ทุกรายการ
  - หมวด Articles: ใช้ **[ARTICLE]** ทุกรายการ
- จัดหมวดตามป้ายที่ขึ้นต้นโพสต์:
  - [News], [Mods] และข่าวทั่วไป → News
  - [Free] (แจกฟรี) และโพสต์ที่ไม่มีป้ายแต่ขึ้นต้นด้วยลิงก์ร้านค้าและบอกราคา/ส่วนลด → Deals
  - [Article], [Review], [บทความ] หรือโพสต์เชิงบทความ/รีวิว → Articles
  - ป้ายอื่นที่ไม่รู้จัก ให้เลือกหมวดที่ใกล้เคียงที่สุด
- ไม่ต้องใส่ป้ายเดิมของโพสต์ (เช่น [News]) ในสรุป ใช้เฉพาะแท็กด้านบน
- ข้ามโพสต์มีม ([Meme]) และโพสต์ที่เป็นแค่มุก/แคปชันสั้นๆ ที่ไม่มีเนื้อหาข่าว ดีล หรือบทความ
- หมวด Deals ให้ใส่ชื่อเกม ราคา ร้านค้า และโค้ดคูปองถ้ามี
- รวมโพสต์ที่พูดถึงเรื่องเดียวกันไว้เป็นรายการเดียว
- ห้ามแต่งข้อมูลที่ไม่มีในโพสต์
- แต่ละหมวดยาวไม่เกิน 3500 ตัวอักษร
- ตอบเฉพาะเนื้อหา changelog ไม่ต้องมีคำนำหรือคำลงท้าย`;

export class SummaryService {
    private apiKey: string;
    private rssService: RssService;
    private stateFile: string;

    constructor(rssService: RssService, apiKey: string, stateFile: string = SUMMARY_STATE_FILE) {
        this.apiKey = apiKey;
        this.rssService = rssService;
        this.stateFile = stateFile;
        // First deploy: don't broadcast a half-archived yesterday, start from the next full day
        if (!fs.existsSync(stateFile)) this.markDone(SummaryService.yesterday());
    }

    // Yesterday's date (YYYY-MM-DD) in the summary timezone
    static yesterday(now: Date = new Date()): string {
        return localDay(new Date(now.getTime() - DAY_MS));
    }

    // Today's SUMMARY_TIME in the summary timezone: the end of the scheduled 24-hour window
    static windowEnd(now: Date = new Date()): Date {
        return new Date(`${localDay(now)}T${SUMMARY_TIME}:00${SUMMARY_UTC_OFFSET}`);
    }

    private loadState(): { last_summary_day?: string; failed_day?: string; failures?: number } {
        try {
            return JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        } catch { return {}; }
    }

    private saveState(state: object): void {
        fs.writeFileSync(this.stateFile, JSON.stringify({ ...this.loadState(), ...state, updated_at: new Date().toISOString() }, null, 2));
    }

    markDone(day: string): void {
        this.saveState({ last_summary_day: day });
    }

    // Refusals / max_tokens / bad requests fail the same way every tick, so give up on a day after MAX_ATTEMPTS
    recordFailure(day: string): void {
        const state = this.loadState();
        const failures = state.failed_day === day ? (state.failures ?? 0) + 1 : 1;
        this.saveState({ failed_day: day, failures });
        if (failures >= MAX_ATTEMPTS) {
            console.error(`Giving up on daily summary for ${day} after ${failures} attempts.`);
            this.markDone(day);
        }
    }

    // True once per day, after SUMMARY_TIME, until markDone(yesterday)
    isDue(now: Date = new Date()): boolean {
        return now >= SummaryService.windowEnd(now) && this.loadState().last_summary_day !== SummaryService.yesterday(now);
    }

    // Summarizes the 24 hours before `end`. Returns null when nothing was posted in that window
    async summarize(end: Date): Promise<SummarySection[] | null> {
        const items = this.rssService.getItemsBetween(new Date(end.getTime() - DAY_MS), end).filter(item => !isMeme(item));
        if (items.length === 0) return null;

        const posts = items.map((item, i) =>
            `#${i + 1} (${new Date(item.date).toLocaleString('th-TH', { timeZone: SUMMARY_TIMEZONE })})\nลิงก์: ${item.link}\n${item.content || item.title}`
        ).join('\n\n---\n\n');

        // ponytail: plain fetch to the Gemini REST API, one call doesn't need the SDK
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: `โพสต์ทั้งหมดในช่วง 24 ชั่วโมงก่อน ${end.toLocaleString('th-TH', { timeZone: SUMMARY_TIMEZONE })} (${items.length} โพสต์):\n\n${posts}` }] }],
                generationConfig: { maxOutputTokens: 16000 },
            }),
        });
        if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
        const data: any = await res.json();

        console.log(`Daily summary usage for ${localDay(end)}:`, data.usageMetadata);

        if (data.promptFeedback?.blockReason) {
            throw new Error(`Summary blocked: ${data.promptFeedback.blockReason}`);
        }
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason !== 'STOP') {
            throw new Error(`Summary did not finish: ${candidate?.finishReason ?? 'no candidate'}`);
        }

        const text = (candidate.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
        return parseSections(text);
    }
}

// Memes: labelled [Meme], or image-only posts with no caption. Short joke captions are left for the model to skip
export function isMeme(item: ArchivedItem): boolean {
    return !item.content.trim() || /^\s*\[meme\]/i.test(item.content || item.title);
}

// Splits "## Title\nbody" markdown into sections, capped to Discord's 4096-char embed description
export function parseSections(text: string): SummarySection[] {
    return text.split(/^## /m)
        .slice(text.trimStart().startsWith('## ') ? 0 : 1) // drop any preamble before the first section
        .map(chunk => chunk.trim())
        .filter(Boolean)
        .map(chunk => {
            const [title, ...rest] = chunk.split('\n');
            // One item per line, each followed by a "." line so the embed isn't a wall of text
            let body = rest.map(l => l.trim()).filter(l => l && l !== '.').map(l => `${l}\n.`).join('\n');
            // Cut at a line break so a [อ่านต่อ](url) link is never split
            if (body.length > 4000) body = body.substring(0, body.lastIndexOf('\n', 3990)) + '\n...';
            return { title: title!.trim(), body };
        })
        .filter(s => s.body);
}
