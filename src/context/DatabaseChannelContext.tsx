import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Channel, Post, BotStatus, Statistics, BotLog, ScheduleTime } from '../types';
import { DatabaseChannel, DatabaseChannelSchedule, DatabasePost, DatabaseBotLog } from '../types/database';
import { useToast } from '@/hooks/use-toast';

interface DatabaseChannelContextProps {
  channels: Channel[];
  addChannel: (channel: Omit<Channel, 'id' | 'lastPosts' | 'isActive' | 'schedule'>) => Promise<void>;
  updateChannel: (channel: Channel) => Promise<void>;
  deleteChannel: (id: string) => Promise<void>;
  botStatus: BotStatus;
  statistics: Statistics;
  botLogs: BotLog[];
  startBot: () => Promise<void>;
  stopBot: () => void;
  isGenerating: boolean;
  generateTestPost: (channelId: string) => Promise<Post>;
  publishPost: (post: Post) => Promise<Post>;
  updatePost: (post: Post) => Promise<void>;
  deletePost: (postId: string, channelId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DatabaseChannelContext = createContext<DatabaseChannelContextProps | undefined>(undefined);

export const useDatabaseChannelContext = () => {
  const context = useContext(DatabaseChannelContext);
  if (!context) {
    throw new Error('useDatabaseChannelContext must be used within a DatabaseChannelProvider');
  }
  return context;
};

interface DatabaseChannelProviderProps {
  children: ReactNode;
}

export const DatabaseChannelProvider = ({ children }: DatabaseChannelProviderProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const { toast } = useToast();
  
  const [botStatus, setBotStatus] = useState<BotStatus>({
    isRunning: false,
    currentAction: 'Зупинено',
    lastUpdate: new Date().toISOString(),
    channelStatuses: [],
  });

  const [statistics, setStatistics] = useState<Statistics>({
    totalPostsGenerated: 0,
    totalPostsPublished: 0,
    postsByChannel: [],
    dailyStats: [],
  });

  // Convert database objects to frontend format
  const convertDbChannelToChannel = (dbChannel: DatabaseChannel, schedules: DatabaseChannelSchedule[], posts: DatabasePost[]): Channel => {
    return {
      id: dbChannel.id,
      name: dbChannel.name,
      botToken: dbChannel.bot_token,
      chatId: dbChannel.chat_id,
      userId: '', // Not needed for database version
      postsPerDay: schedules.length,
      promptTemplate: dbChannel.prompt_template || '',
      grokApiKey: dbChannel.grok_api_key,
      isActive: dbChannel.is_active,
      schedule: schedules.map(s => ({ hour: s.hour, minute: s.minute })),
      lastPosts: posts.map(p => ({
        id: p.id,
        channelId: p.channel_id,
        text: p.text,
        imageUrl: p.image_url || '',
        status: p.status,
        createdAt: p.created_at,
        publishedAt: p.published_at,
        error: p.error,
        telegramPostId: p.telegram_post_id
      }))
    };
  };

  const loadData = useCallback(async () => {
    try {
      // Load channels with schedules and posts
      const { data: dbChannels, error: channelsError } = await supabase
        .from('channels')
        .select(`
          *,
          channel_schedules (*),
          posts (*)
        `)
        .order('created_at', { ascending: false });

      if (channelsError) {
        console.error('Error loading channels:', channelsError);
        throw new Error(`Failed to load channels: ${channelsError.message}`);
      }

      const convertedChannels = (dbChannels || []).map(dbChannel => 
        convertDbChannelToChannel(
          dbChannel,
          dbChannel.channel_schedules || [],
          (dbChannel.posts || []).map(post => ({
            ...post,
            status: post.status as 'pending' | 'generated' | 'published' | 'failed'
          }))
        )
      );

      setChannels(convertedChannels);

      // Load bot logs
      const { data: dbLogs, error: logsError } = await supabase
        .from('bot_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.error('Error loading bot logs:', logsError);
        throw new Error(`Failed to load bot logs: ${logsError.message}`);
      }

      const convertedLogs = (dbLogs || []).map(log => ({
        timestamp: log.created_at,
        message: log.message,
        type: log.type as 'info' | 'error' | 'success' | 'warning',
        details: log.details
      }));

      setBotLogs(convertedLogs);

      // Calculate statistics
      const totalGenerated = convertedChannels.reduce((sum, channel) => 
        sum + channel.lastPosts.filter(p => p.status === 'generated' || p.status === 'published').length, 0);
      
      const totalPublished = convertedChannels.reduce((sum, channel) => 
        sum + channel.lastPosts.filter(p => p.status === 'published').length, 0);

      setStatistics({
        totalPostsGenerated: totalGenerated,
        totalPostsPublished: totalPublished,
        postsByChannel: convertedChannels.map(channel => ({
          channelId: channel.id,
          generated: channel.lastPosts.filter(p => p.status === 'generated' || p.status === 'published').length,
          published: channel.lastPosts.filter(p => p.status === 'published').length
        })),
        dailyStats: [] // TODO: Calculate from database
      });

    } catch (error) {
      console.error('Detailed error loading data:', error);
      toast({
        title: "Помилка завантаження",
        description: error instanceof Error ? error.message : "Не вдалося завантажити дані з бази",
        variant: "destructive"
      });
      throw error; // Re-throw to be caught by ErrorBoundary
    }
  }, [toast]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const addChannel = useCallback(async (channelData: Omit<Channel, 'id' | 'lastPosts' | 'isActive' | 'schedule'>) => {
    try {
      const { data: newChannel, error } = await supabase
        .from('channels')
        .insert({
          name: channelData.name,
          bot_token: channelData.botToken,
          chat_id: channelData.chatId,
          prompt_template: channelData.promptTemplate,
          grok_api_key: channelData.grokApiKey,
          is_active: false
        })
        .select()
        .single();

      if (error) throw error;

      await loadData();
      
      toast({
        title: "Канал додано",
        description: `Канал "${channelData.name}" успішно додано`
      });
    } catch (error) {
      console.error('Error adding channel:', error);
      toast({
        title: "Помилка",
        description: "Не вдалося додати канал",
        variant: "destructive"
      });
    }
  }, [loadData, toast]);

  const updateChannel = useCallback(async (channel: Channel) => {
    try {
      // Update channel
      const { error: channelError } = await supabase
        .from('channels')
        .update({
          name: channel.name,
          bot_token: channel.botToken,
          chat_id: channel.chatId,
          prompt_template: channel.promptTemplate,
          grok_api_key: channel.grokApiKey,
          is_active: channel.isActive
        })
        .eq('id', channel.id);

      if (channelError) throw channelError;

      // Update schedules
      await supabase
        .from('channel_schedules')
        .delete()
        .eq('channel_id', channel.id);

      if (channel.schedule.length > 0) {
        const { error: scheduleError } = await supabase
          .from('channel_schedules')
          .insert(
            channel.schedule.map(time => ({
              channel_id: channel.id,
              hour: time.hour,
              minute: time.minute
            }))
          );

        if (scheduleError) throw scheduleError;
      }

      await loadData();
      
      toast({
        title: "Канал оновлено",
        description: `Канал "${channel.name}" успішно оновлено`
      });
    } catch (error) {
      console.error('Error updating channel:', error);
      toast({
        title: "Помилка",
        description: "Не вдалося оновити канал",
        variant: "destructive"
      });
    }
  }, [loadData, toast]);

  const deleteChannel = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadData();
      
      toast({
        title: "Канал видалено",
        description: "Канал успішно видалено"
      });
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast({
        title: "Помилка",
        description: "Не вдалося видалити канал",
        variant: "destructive"
      });
    }
  }, [loadData, toast]);

  const startBot = useCallback(async () => {
    try {
      setBotStatus(prev => ({
        ...prev,
        isRunning: true,
        currentAction: 'Запуск бота...'
      }));

      // Generate daily posts
      const response = await supabase.functions.invoke('telegram-bot', {
        body: { action: 'generate_daily' }
      });

      if (response.error) throw response.error;

      setBotStatus(prev => ({
        ...prev,
        currentAction: 'Бот працює 24/7'
      }));

      await loadData();
      
      toast({
        title: "Бота запущено",
        description: "Бот тепер працює автономно 24/7"
      });
    } catch (error) {
      console.error('Error starting bot:', error);
      setBotStatus(prev => ({
        ...prev,
        isRunning: false,
        currentAction: 'Помилка запуску'
      }));
      
      toast({
        title: "Помилка",
        description: "Не вдалося запустити бота",
        variant: "destructive"
      });
    }
  }, [loadData, toast]);

  const stopBot = useCallback(() => {
    setBotStatus(prev => ({
      ...prev,
      isRunning: false,
      currentAction: 'Зупинено вручну'
    }));
    
    toast({
      title: "Бота зупинено",
      description: "Автономна робота бота призупинена"
    });
  }, [toast]);

  const generateTestPost = useCallback(async (channelId: string): Promise<Post> => {
    setIsGenerating(true);
    
    try {
      const channel = channels.find(c => c.id === channelId);
      if (!channel) throw new Error('Канал не знайдено');

      // For now, create a test post directly
      const testPost: Post = {
        id: `test-${Date.now()}`,
        channelId,
        text: `Тестовий пост для каналу "${channel.name}"\n\nЦей пост згенеровано для перевірки налаштувань каналу.`,
        imageUrl: 'https://placehold.co/600x400/1a1a1a/ffffff?text=Test+Post',
        status: 'generated',
        createdAt: new Date().toISOString()
      };

      return testPost;
    } finally {
      setIsGenerating(false);
    }
  }, [channels]);

  const publishPost = useCallback(async (post: Post): Promise<Post> => {
    // This is handled by the Edge Function
    return { ...post, status: 'published', publishedAt: new Date().toISOString() };
  }, []);

  const updatePost = useCallback(async (post: Post): Promise<void> => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          text: post.text,
          image_url: post.imageUrl,
          status: post.status,
          error: post.error
        })
        .eq('id', post.id);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }, [loadData]);

  const deletePost = useCallback(async (postId: string, channelId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }, [loadData]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time subscriptions
  useEffect(() => {
    const channels_subscription = supabase
      .channel('channels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => {
        loadData();
      })
      .subscribe();

    const posts_subscription = supabase
      .channel('posts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        loadData();
      })
      .subscribe();

    const logs_subscription = supabase
      .channel('logs-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bot_logs' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channels_subscription);
      supabase.removeChannel(posts_subscription);
      supabase.removeChannel(logs_subscription);
    };
  }, [loadData]);

  const value = {
    channels,
    addChannel,
    updateChannel,
    deleteChannel,
    botStatus,
    statistics,
    botLogs,
    startBot,
    stopBot,
    isGenerating,
    generateTestPost,
    publishPost,
    updatePost,
    deletePost,
    refreshData
  };

  return (
    <DatabaseChannelContext.Provider value={value}>
      {children}
    </DatabaseChannelContext.Provider>
  );
};
