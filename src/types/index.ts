// Discord Bot Types
export interface Subscriptions {
    [guildId: string]: string;
}

// RSS Service Types
export interface NewsItem {
    title: string;
    link: string;
    summary: string;
    guid: string;
    image: string | null;
}

// YouTube Service Types
export interface YoutubeItem {
    title: string;
    link: string;
    id: string;
    thumbnail: string | null;
    author: string;
}

// State Management Types
export interface StateData {
    last_seen_id?: string | null;
    last_video_id?: string | null;
    updated_at: string;
}
