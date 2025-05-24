
export interface DatabaseChannel {
  id: string;
  name: string;
  bot_token: string;
  chat_id: string;
  prompt_template?: string;
  grok_api_key?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatabaseChannelSchedule {
  id: string;
  channel_id: string;
  hour: number;
  minute: number;
  created_at: string;
}

export interface DatabasePost {
  id: string;
  channel_id: string;
  text: string;
  image_url?: string;
  status: 'pending' | 'generated' | 'published' | 'failed';
  scheduled_for?: string;
  published_at?: string;
  telegram_post_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseBotLog {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  details?: any;
  created_at: string;
}
