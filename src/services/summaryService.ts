import fs from 'fs';
import { RssService, localDay } from '@/services/rssService';
import { SUMMARY_STATE_FILE, SUMMARY_HOUR, SUMMARY_TIMEZONE, GEMINI_MODEL } from '@/config/constants';

const MAX_ATTEMPTS = 3;

export interface SummarySection {
    title: string;
    body: string;
}

const SYSTEM_PROMPT = `คุณคือ "วาริริน" ผู้ช่วยของเพจ Sheapgamer (ข่าวเกม ดีลเกมราคาถูก และบทความเกม)
งานของคุณ: สรุปโพสต์ทั้งหมดของเมื่อวานให้อยู่ในรูปแบบ "Patch Notes / Changelog" แบบอัปเดตเกม ให้ผู้อ่านรู้ว่าเมื่อวานเกิดอะไรขึ้นบ้างในเวลาไม่กี่วินาที

รูปแบบผลลัพธ์ (Discord markdown):
- แบ่งเป็นหมวด โดยแต่ละหมวดขึ้นต้นด้วยบรรทัด "## " ตามด้วยชื่อหมวด ใช้เฉพาะหมวดที่มีโพสต์:
  ## 📰 News
  ## 💸 Deals
  ## 📝 Articles
- แต่ละรายการเป็นหนึ่งบรรทัด ขึ้นต้นด้วยแท็กแบบ changelog แล้วตามด้วยสรุปสั้นๆ ภาษาไทย 1 ประโยค และลิงก์ในรูป [อ่านต่อ](url)
  แท็กที่ใช้: **[NEW]** เปิดตัว/ประกาศเกมใหม่, **[UPDATE]** แพตช์/อัปเดต/ข่าวความคืบหน้า, **[BUFF]** ข่าวดี/ลดราคา/แจกฟรี, **[NERF]** ข่าวร้าย/ขึ้นราคา/เลื่อน/ปิดเซิร์ฟ, **[FIX]** แก้ปัญหา/แก้บั๊ก, **[EVENT]** อีเวนต์/งานแสดง
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
        return localDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
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

    // True once per day, after SUMMARY_HOUR, until markDone(yesterday)
    isDue(now: Date = new Date()): boolean {
        const hour = Number(now.toLocaleString('en-US', { timeZone: SUMMARY_TIMEZONE, hour: 'numeric', hourCycle: 'h23' }));
        return hour >= SUMMARY_HOUR && this.loadState().last_summary_day !== SummaryService.yesterday(now);
    }

    // Returns null when there was nothing posted that day
    async summarize(day: string): Promise<SummarySection[] | null> {
        const items = this.rssService.getItemsForDay(day);
        if (items.length === 0) return null;

        const posts = items.map((item, i) =>
            `#${i + 1} (${new Date(item.date).toLocaleTimeString('th-TH', { timeZone: SUMMARY_TIMEZONE })})\nลิงก์: ${item.link}\n${item.content || item.title}`
        ).join('\n\n---\n\n');

        // ponytail: plain fetch to the Gemini REST API, one call doesn't need the SDK
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: `โพสต์ทั้งหมดของวันที่ ${day} (${items.length} โพสต์):\n\n${posts}` }] }],
                generationConfig: { maxOutputTokens: 16000 },
            }),
        });
        if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
        const data: any = await res.json();

        console.log(`Daily summary usage for ${day}:`, data.usageMetadata);

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

// Splits "## Title\nbody" markdown into sections, capped to Discord's 4096-char embed description
export function parseSections(text: string): SummarySection[] {
    return text.split(/^## /m)
        .slice(text.trimStart().startsWith('## ') ? 0 : 1) // drop any preamble before the first section
        .map(chunk => chunk.trim())
        .filter(Boolean)
        .map(chunk => {
            const [title, ...rest] = chunk.split('\n');
            let body = rest.join('\n').trim();
            // Cut at a line break so a [อ่านต่อ](url) link is never split
            if (body.length > 4000) body = body.substring(0, body.lastIndexOf('\n', 3990)) + '\n...';
            return { title: title!.trim(), body };
        })
        .filter(s => s.body);
}
