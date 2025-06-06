
export interface Channel {
  id: string;
  name: string;
  botToken: string;
  chatId: string;
  userId: string;
  postsPerDay: number;
  promptTemplate: string;
  grokApiKey?: string;
  lastPosts: Post[];
  isActive: boolean;
  schedule: ScheduleTime[]; // Array of scheduled posting times
}

export interface ScheduleTime {
  hour: number;
  minute: number;
}

export interface Post {
  id: string;
  channelId: string;
  text: string;
  imageUrl: string;
  status: 'pending' | 'generated' | 'published' | 'failed';
  createdAt: string;
  publishedAt?: string;
  error?: string;
  telegramPostId?: string; // ID returned by Telegram API
}

export interface BotStatus {
  isRunning: boolean;
  currentAction: string;
  lastUpdate: string;
  channelStatuses: {
    channelId: string;
    status: string;
    nextPostTime?: string;
  }[];
}

export interface Statistics {
  totalPostsGenerated: number;
  totalPostsPublished: number;
  postsByChannel: {
    channelId: string;
    generated: number;
    published: number;
  }[];
  dailyStats: {
    date: string;
    generated: number;
    published: number;
  }[];
}

export interface BotLog {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  details?: any;
}
