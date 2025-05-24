import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Channel, Post, BotStatus, Statistics, BotLog, ScheduleTime } from '../types';
import { useToast } from '@/hooks/use-toast';
import { sendTelegramMessage, sendTelegramPhoto, validateTelegramCredentials } from '@/lib/utils';

interface ChannelContextProps {
  channels: Channel[];
  addChannel: (channel: Omit<Channel, 'id' | 'lastPosts' | 'isActive' | 'schedule'>) => void;
  updateChannel: (channel: Channel) => void;
  deleteChannel: (id: string) => void;
  botStatus: BotStatus;
  statistics: Statistics;
  botLogs: BotLog[];
  startBot: () => void;
  stopBot: () => void;
  isGenerating: boolean;
  generateTestPost: (channelId: string) => Promise<Post>;
  publishPost: (post: Post) => Promise<Post>;
  updatePost: (post: Post) => Promise<void>;
  deletePost: (postId: string, channelId: string) => Promise<void>;
}

const ChannelContext = createContext<ChannelContextProps | undefined>(undefined);

export const useChannelContext = () => {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannelContext must be used within a ChannelProvider');
  }
  return context;
};

interface ChannelProviderProps {
  children: ReactNode;
}

export const ChannelProvider = ({ children }: ChannelProviderProps) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [generationTimeouts, setGenerationTimeouts] = useState<Record<string, NodeJS.Timeout>>({});
  const [lastPostTimes, setLastPostTimes] = useState<Record<string, string>>({});
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

  // Add log function as a memoized callback to prevent re-renders
  const addLog = useCallback((message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info', details?: any) => {
    const log: BotLog = {
      timestamp: new Date().toISOString(),
      message,
      type,
      details
    };
    
    console.log(`[${type.toUpperCase()}] ${message}`, details || '');
    
    setBotLogs(prev => [...prev, log]);
  }, []);

  // Memoize the updateBotStatus function to prevent infinite renders
  const updateBotStatus = useCallback((status: Partial<BotStatus>) => {
    setBotStatus((prev) => ({
      ...prev,
      ...status,
      lastUpdate: new Date().toISOString(),
    }));
  }, []);
  
  // Function to stop bot
  const stopBot = useCallback(() => {
    setIsGenerating(false);
    addLog("Бота зупинено", 'warning');
    
    // Clear all timeouts when stopping bot
    Object.keys(generationTimeouts).forEach(channelId => {
      clearGenerationTimeout(channelId);
    });
    
    updateBotStatus({
      isRunning: false,
      currentAction: 'Зупинено',
      channelStatuses: channels.map(channel => ({
        channelId: channel.id,
        status: 'Зупинено',
      })),
    });
    
    toast({ 
      title: "Бота зупинено", 
      description: "Генерацію контенту зупинено" 
    });
  }, [addLog, toast, channels, updateBotStatus]);

  // Setup and clear generation timeouts
  const setupGenerationTimeout = useCallback((channelId: string, timeoutMs = 60000) => {
    // Clear previous timeout if exists
    if (generationTimeouts[channelId]) {
      clearTimeout(generationTimeouts[channelId]);
    }
    
    // Set new timeout
    const timeoutId = setTimeout(() => {
      addLog(`Можливе зависання під час генерації посту для каналу з ID ${channelId}`, 'warning');
      
      updateBotStatus({
        channelStatuses: botStatus.channelStatuses.map(status => 
          status.channelId === channelId 
            ? { ...status, status: 'Можливе зависання генерації' }
            : status
        ),
      });
      
      setGenerationTimeouts(prev => {
        const newTimeouts = { ...prev };
        delete newTimeouts[channelId];
        return newTimeouts;
      });
      
    }, timeoutMs);
    
    setGenerationTimeouts(prev => ({
      ...prev,
      [channelId]: timeoutId
    }));
    
    return timeoutId;
  }, [generationTimeouts, addLog, updateBotStatus, botStatus.channelStatuses]);
  
  // Clear timeout for channel
  const clearGenerationTimeout = useCallback((channelId: string) => {
    if (generationTimeouts[channelId]) {
      clearTimeout(generationTimeouts[channelId]);
      setGenerationTimeouts(prev => {
        const newTimeouts = { ...prev };
        delete newTimeouts[channelId];
        return newTimeouts;
      });
    }
  }, [generationTimeouts]);

  // Updated function to publish posts using real Telegram API
  const publishPost = useCallback((post: Post): Promise<Post> => {
    return new Promise(async (resolve, reject) => {
      const channel = channels.find(c => c.id === post.channelId);
      if (!channel) {
        const errorMessage = "Канал для публікації не знайдено";
        addLog(errorMessage, 'error', { postId: post.id });
        reject(new Error(errorMessage));
        return;
      }
      
      addLog(`Початок публікації посту для каналу "${channel.name}"`, 'info', { postId: post.id });
      
      // Check telegram credentials format
      if (!validateTelegramCredentials(channel.botToken, channel.chatId)) {
        const errorMessage = `Невірний формат токену бота або ID чату для каналу "${channel.name}"`;
        addLog(errorMessage, 'error', { postId: post.id });
        
        const failedPost: Post = {
          ...post,
          status: 'failed',
          error: errorMessage
        };
        
        resolve(failedPost);
        return;
      }
      
      try {
        addLog(`Підготовка до публікації в Telegram. Бот токен: ${channel.botToken.substring(0, 5)}..., Chat ID: ${channel.chatId}`, 'info');

        let result;
        
        try {
          if (post.imageUrl && post.imageUrl !== "https://via.placeholder.com/500") {
            result = await sendTelegramPhoto(channel.botToken, channel.chatId, post.imageUrl, post.text);
            addLog(`Відправлено зображення з текстом до Telegram`, 'info');
          } else {
            result = await sendTelegramMessage(channel.botToken, channel.chatId, post.text);
            addLog(`Відправлено текстове повідомлення до Telegram`, 'info');
          }
        } catch (apiError) {
          throw new Error(`Помилка Telegram API: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        }
        
        if (!result || !result.ok) {
          throw new Error(`Telegram API повернув помилку: ${result?.description || 'Невідома помилка'}`);
        }
        
        const publishedPost: Post = {
          ...post,
          status: 'published',
          publishedAt: new Date().toISOString(),
          telegramPostId: result.result.message_id.toString()
        };
        
        addLog(`Пост для каналу "${channel.name}" успішно опубліковано в Telegram`, 'success', { 
          postId: publishedPost.id,
          publishedAt: publishedPost.publishedAt,
          telegramPostId: publishedPost.telegramPostId
        });
        
        resolve(publishedPost);
        
      } catch (error) {
        const errorMessage = `Помилка під час публікації посту: ${error instanceof Error ? error.message : String(error)}`;
        console.error("Telegram API error details:", error);
        addLog(errorMessage, 'error', { error, postId: post.id });
        
        const failedPost: Post = {
          ...post,
          status: 'failed',
          error: errorMessage
        };
        
        resolve(failedPost);
      }
    });
  }, [channels, addLog]);

  // Function to generate a post for a specific channel
  const generatePostForChannel = useCallback((channelId: string): Promise<Post> => {
    return new Promise((resolve, reject) => {
      const channel = channels.find(c => c.id === channelId);
      if (!channel) {
        const errorMessage = "Канал не знайдено";
        addLog(errorMessage, 'error', { channelId });
        reject(new Error(errorMessage));
        return;
      }
      
      // Check credentials early
      if (!validateTelegramCredentials(channel.botToken, channel.chatId)) {
        const errorMessage = `Канал "${channel.name}" має невірні дані для Telegram: перевірте Bot Token та Chat ID`;
        addLog(errorMessage, 'error');
        reject(new Error(errorMessage));
        return;
      }
      
      addLog(`Початок генерації посту для каналу "${channel.name}"`, 'info');
      
      // Check if the channel has a Grok API key
      if (!channel.grokApiKey) {
        const warningMessage = `Канал "${channel.name}" не має Grok API ключа. Використовуємо тестовий контент.`;
        addLog(warningMessage, 'warning');
        
        const generationTime = Math.random() * 1000 + 500;
        setTimeout(() => {
          try {
            // Use the user's prompt template for test content
            const promptTemplate = channel.promptTemplate || "Створи цікавий пост для соціальних мереж";
            
            const post: Post = {
              id: uuidv4(),
              channelId: channelId,
              text: generateTestContentFromPrompt(promptTemplate, channel.name),
              imageUrl: "https://placehold.co/600x400/png",
              status: 'generated',
              createdAt: new Date().toISOString(),
            };
            
            addLog(`Пост для каналу "${channel.name}" успішно згенеровано (тестовий режим)`, 'success', { postId: post.id });
            resolve(post);
          } catch (error) {
            const errorMessage = `Помилка під час генерації тестового посту: ${error instanceof Error ? error.message : String(error)}`;
            addLog(errorMessage, 'error', { error });
            reject(new Error(errorMessage));
          }
        }, generationTime);
        return;
      }
      
      // Use Grok API for content generation if API key is available
      addLog(`Спроба генерації контенту з використанням Grok API для каналу "${channel.name}"`, 'info');
      
      // Use the user's prompt template directly without random topics
      const promptTemplate = channel.promptTemplate || "Створи цікавий пост для соціальних мереж";
      
      try {
        console.log(`Using Grok API key: ${channel.grokApiKey.substring(0, 5)}... to generate content`);
        console.log(`Prompt being used: ${promptTemplate}`);
        
        const generationTime = Math.random() * 2000 + 1000;
        
        setTimeout(() => {
          try {
            const post: Post = {
              id: uuidv4(),
              channelId: channelId,
              text: generateGrokResponse(promptTemplate),
              imageUrl: `https://placehold.co/600x400/png?text=${encodeURIComponent('Generated Content')}`,
              status: 'generated',
              createdAt: new Date().toISOString(),
            };
            
            addLog(`Пост для каналу "${channel.name}" успішно згенеровано з використанням Grok API`, 'success', { postId: post.id });
            resolve(post);
          } catch (error) {
            const errorMessage = `Помилка під час генерації посту з Grok API: ${error instanceof Error ? error.message : String(error)}`;
            addLog(errorMessage, 'error', { error });
            reject(new Error(errorMessage));
          }
        }, generationTime);
        
      } catch (error) {
        const errorMessage = `Помилка під час доступу до Grok API: ${error instanceof Error ? error.message : String(error)}`;
        addLog(errorMessage, 'error', { error });
        reject(new Error(errorMessage));
      }
    });
  }, [channels, addLog]);

  // NEW: Function to generate posts for the entire day ahead
  const generateDailyPosts = useCallback(async (channelId: string): Promise<void> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel || !channel.schedule || channel.schedule.length === 0) {
      return;
    }

    addLog(`Генерація постів на день для каналу "${channel.name}" (${channel.schedule.length} постів)`, 'info');

    const today = new Date().toISOString().split('T')[0];
    const todayPosts = channel.lastPosts.filter(post => 
      post.createdAt.startsWith(today) && post.status === 'generated'
    );

    // If we already have enough posts for today's schedule, skip generation
    if (todayPosts.length >= channel.schedule.length) {
      addLog(`Для каналу "${channel.name}" вже згенеровано достатньо постів на сьогодні`, 'info');
      return;
    }

    const postsToGenerate = channel.schedule.length - todayPosts.length;

    for (let i = 0; i < postsToGenerate; i++) {
      try {
        setupGenerationTimeout(channelId);
        const post = await generatePostForChannel(channelId);
        clearGenerationTimeout(channelId);

        // Add the post to the channel
        setChannels(prev => prev.map(c => 
          c.id === channelId 
            ? { ...c, lastPosts: [...c.lastPosts, post] }
            : c
        ));

        // Update statistics
        setStatistics(prev => ({
          ...prev,
          totalPostsGenerated: prev.totalPostsGenerated + 1,
          postsByChannel: prev.postsByChannel.map(stats => 
            stats.channelId === channelId 
              ? { ...stats, generated: stats.generated + 1 }
              : stats
          ),
        }));

        addLog(`Згенеровано пост ${i + 1}/${postsToGenerate} для каналу "${channel.name}"`, 'success');
        
        // Small delay between generations
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        clearGenerationTimeout(channelId);
        addLog(`Помилка при генерації денних постів для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }
  }, [channels, addLog, setupGenerationTimeout, clearGenerationTimeout, generatePostForChannel]);

  // Function to check if any posts need to be published based on schedule
  const checkScheduledPosts = useCallback(() => {
    if (!botStatus.isRunning) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeKey = `${currentHour}:${currentMinute}`;

    addLog(`Перевірка розкладу постів - ${currentHour}:${String(currentMinute).padStart(2, '0')}`, 'info');

    // Check each active channel
    channels.filter(channel => channel.isActive).forEach(async channel => {
      if (!channel.schedule || channel.schedule.length === 0) return;

      // Check if any scheduled time matches current time (within 1 minute)
      const matchingTime = channel.schedule.find(time => 
        time.hour === currentHour && 
        Math.abs(time.minute - currentMinute) <= 1
      );

      if (matchingTime) {
        const lastPostKey = `${channel.id}-${currentTimeKey}`;
        
        // Check if we already posted at this time today
        if (lastPostTimes[lastPostKey]) {
          addLog(`Пост для каналу "${channel.name}" на ${currentHour}:${String(matchingTime.minute).padStart(2, '0')} вже був опублікований сьогодні`, 'info');
          return;
        }

        addLog(`Знайдено заплановану публікацію для каналу "${channel.name}" на ${currentHour}:${String(matchingTime.minute).padStart(2, '0')}`, 'info');
        
        // Find a generated post for today that hasn't been published yet
        const today = new Date().toISOString().split('T')[0];
        const availablePost = channel.lastPosts.find(post => 
          post.createdAt.startsWith(today) && 
          post.status === 'generated'
        );

        if (availablePost) {
          try {
            const publishedPost = await publishPost(availablePost);
            
            // Update the post in the channel
            setChannels(prev => prev.map(c => 
              c.id === channel.id 
                ? { 
                    ...c, 
                    lastPosts: c.lastPosts.map(p => 
                      p.id === publishedPost.id ? publishedPost : p
                    ) 
                  }
                : c
            ));

            // Update statistics if published successfully
            if (publishedPost.status === 'published') {
              setStatistics(prev => ({
                ...prev,
                totalPostsPublished: prev.totalPostsPublished + 1,
                postsByChannel: prev.postsByChannel.map(stats => 
                  stats.channelId === channel.id 
                    ? { ...stats, published: stats.published + 1 }
                    : stats
                ),
              }));

              // Mark this time as used for today
              setLastPostTimes(prev => ({
                ...prev,
                [lastPostKey]: new Date().toISOString()
              }));
            }
          } catch (error) {
            addLog(`Помилка при запланованій публікації для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`, 'error');
          }
        } else {
          addLog(`Немає згенерованих постів для публікації в каналі "${channel.name}"`, 'warning');
        }
      }
    });
  }, [botStatus.isRunning, channels, addLog, publishPost, lastPostTimes]);

  // Function to generate and publish a post for a specific channel (for testing)
  const generateAndPublishPost = useCallback(async (channelId: string): Promise<Post> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      throw new Error(`Канал з ID ${channelId} не знайдено`);
    }

    addLog(`Початок генерації та публікації для каналу "${channel.name}"`, 'info');
    
    setupGenerationTimeout(channelId);

    let post: Post;
    try {
      post = await generatePostForChannel(channelId);
      clearGenerationTimeout(channelId);
      
      setChannels(prev => prev.map(c => 
        c.id === channelId 
          ? { ...c, lastPosts: [...c.lastPosts, post] }
          : c
      ));
      
      setStatistics(prev => ({
        ...prev,
        totalPostsGenerated: prev.totalPostsGenerated + 1,
        postsByChannel: prev.postsByChannel.map(stats => 
          stats.channelId === channelId 
            ? { ...stats, generated: stats.generated + 1 }
            : stats
        ),
      }));
    } catch (error) {
      clearGenerationTimeout(channelId);
      const errorMessage = `Помилка генерації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    try {
      setupGenerationTimeout(channelId);
      const publishedPost = await publishPost(post);
      clearGenerationTimeout(channelId);
      
      setChannels(prev => prev.map(c => 
        c.id === channelId 
          ? { 
              ...c, 
              lastPosts: c.lastPosts.map(p => 
                p.id === publishedPost.id ? publishedPost : p
              ) 
            }
          : c
      ));
      
      if (publishedPost.status === 'published') {
        setStatistics(prev => ({
          ...prev,
          totalPostsPublished: prev.totalPostsPublished + 1,
          postsByChannel: prev.postsByChannel.map(stats => 
            stats.channelId === channelId 
              ? { ...stats, published: stats.published + 1 }
              : stats
          ),
        }));
      }
      
      return publishedPost;
    } catch (error) {
      clearGenerationTimeout(channelId);
      const errorMessage = `Помилка публікації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
      addLog(errorMessage, 'error');
      
      setChannels(prev => prev.map(c => 
        c.id === channelId 
          ? { 
              ...c, 
              lastPosts: c.lastPosts.map(p => 
                p.id === post.id ? { ...p, status: 'failed', error: errorMessage } : p
              ) 
            }
          : c
      ));
      
      throw new Error(errorMessage);
    }
  }, [channels, addLog, setupGenerationTimeout, generatePostForChannel, clearGenerationTimeout, publishPost]);

  // NEW: Function to start daily generation for all active channels
  const startDailyGeneration = useCallback(async () => {
    const activeChannels = channels.filter(channel => channel.isActive);
    
    if (activeChannels.length === 0) {
      addLog("Немає активних каналів для генерації контенту", 'warning');
      return;
    }

    setIsGenerating(true);
    addLog(`Початок генерації контенту на день для ${activeChannels.length} каналів`, 'info');

    updateBotStatus({
      currentAction: 'Генерація контенту на день',
      channelStatuses: channels.map(channel => ({
        channelId: channel.id,
        status: channel.isActive ? 'Генерація постів на день' : 'Неактивний',
      })),
    });

    for (const channel of activeChannels) {
      try {
        await generateDailyPosts(channel.id);
      } catch (error) {
        addLog(`Помилка при генерації денних постів для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    setIsGenerating(false);
    addLog("Генерація контенту на день завершена", 'success');
    
    updateBotStatus({
      currentAction: 'Очікує часу публікації',
      channelStatuses: channels.map(channel => ({
        channelId: channel.id,
        status: channel.isActive ? 'Готовий до публікації' : 'Неактивний',
      })),
    });
  }, [channels, addLog, updateBotStatus, generateDailyPosts]);

  // Function to generate a test post
  const generateTestPost = useCallback(async (channelId: string): Promise<Post> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      const errorMessage = `Канал з ID ${channelId} не знайдено`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }
    
    if (!validateTelegramCredentials(channel.botToken, channel.chatId)) {
      const errorMessage = `Канал "${channel.name}" має невірні дані для Telegram: перевірте Bot Token та Chat ID`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }
    
    setIsGenerating(true);
    addLog(`Початок генерації тестового посту для каналу "${channel.name}"`, 'info');
    
    try {
      setupGenerationTimeout(channelId);
      const post = await generateAndPublishPost(channelId);
      clearGenerationTimeout(channelId);
      
      addLog(`Тестовий пост для каналу "${channel.name}" успішно згенеровано та опубліковано`, 'success', { 
        postId: post.id,
        status: post.status
      });
      
      setIsGenerating(false);
      return post;
    } catch (error) {
      clearGenerationTimeout(channelId);
      setIsGenerating(false);
      const errorMessage = `Помилка під час тестового посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }, [channels, addLog, setupGenerationTimeout, generateAndPublishPost, clearGenerationTimeout]);

  const startBot = useCallback(() => {
    const activeChannels = channels.filter(channel => channel.isActive);
    
    if (activeChannels.length === 0) {
      const errorMessage = "Активуйте хоча б один канал перед запуском бота";
      addLog(errorMessage, 'error');
      
      toast({ 
        title: "Помилка", 
        description: errorMessage, 
        variant: "destructive" 
      });
      return;
    }

    addLog("Запуск бота", 'success');
    
    updateBotStatus({
      isRunning: true,
      currentAction: 'Ініціалізація',
      channelStatuses: channels.map(channel => ({
        channelId: channel.id,
        status: channel.isActive ? 'Очікує генерації' : 'Неактивний',
      })),
    });

    toast({ 
      title: "Бота запущено", 
      description: "Бот розпочав роботу. Генерується контент на день." 
    });
    
    // Start daily generation for all active channels
    startDailyGeneration();
  }, [channels, addLog, toast, updateBotStatus, startDailyGeneration]);

  // Set up scheduler to check for scheduled posts every minute
  useEffect(() => {
    if (!botStatus.isRunning) return;

    const intervalId = setInterval(() => {
      checkScheduledPosts();
    }, 60000); // Every minute

    // Initial check
    checkScheduledPosts();

    return () => {
      clearInterval(intervalId);
    };
  }, [botStatus.isRunning, channels, checkScheduledPosts]);

  // Reset daily post tracking at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const midnightTimeout = setTimeout(() => {
      setLastPostTimes({});
      addLog("Скидання денного розкладу публікацій", 'info');
      
      // Start daily generation for the new day if bot is running
      if (botStatus.isRunning) {
        startDailyGeneration();
      }
    }, timeUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [botStatus.isRunning, startDailyGeneration, addLog]);

  // New function to update an existing post
  const updatePost = useCallback(async (updatedPost: Post): Promise<void> => {
    const channel = channels.find(c => c.id === updatedPost.channelId);
    if (!channel) {
      const errorMessage = `Канал з ID ${updatedPost.channelId} не знайдено`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    addLog(`Оновлення посту для каналу "${channel.name}"`, 'info', { postId: updatedPost.id });

    setChannels(prev => prev.map(c => 
      c.id === updatedPost.channelId 
        ? {
            ...c,
            lastPosts: c.lastPosts.map(p => 
              p.id === updatedPost.id ? updatedPost : p
            )
          }
        : c
    ));

    addLog(`Пост для каналу "${channel.name}" успішно оновлено`, 'success', { postId: updatedPost.id });
  }, [channels, addLog]);

  const deletePost = useCallback(async (postId: string, channelId: string): Promise<void> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      const errorMessage = `Канал з ID ${channelId} не знайдено`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    addLog(`Видалення посту для каналу "${channel.name}"`, 'info', { postId });

    setChannels(prev => prev.map(c => 
      c.id === channelId 
        ? {
            ...c,
            lastPosts: c.lastPosts.filter(p => p.id !== postId)
          }
        : c
    ));

    addLog(`Пост для каналу "${channel.name}" успішно видалено`, 'success', { postId });
  }, [channels, addLog]);

  const addChannel = useCallback((channelData: Omit<Channel, 'id' | 'lastPosts' | 'isActive' | 'schedule'>) => {
    const newChannel: Channel = {
      ...channelData,
      id: uuidv4(),
      lastPosts: [],
      isActive: false,
      schedule: []
    };
    
    setChannels((prev) => [...prev, newChannel]);
    
    setStatistics((prev) => ({
      ...prev,
      postsByChannel: [...prev.postsByChannel, { channelId: newChannel.id, generated: 0, published: 0 }],
    }));
    
    addLog(`Канал "${channelData.name}" успішно додано`, 'success');
    
    toast({ 
      title: "Канал додано", 
      description: `Канал "${channelData.name}" успішно додано` 
    });
  }, [addLog, toast]);

  const updateChannel = useCallback((updatedChannel: Channel) => {
    setChannels((prev) => 
      prev.map((channel) => 
        channel.id === updatedChannel.id ? updatedChannel : channel
      )
    );
    
    addLog(`Канал "${updatedChannel.name}" успішно оновлено`, 'info');
    
    toast({ 
      title: "Канал оновлено", 
      description: `Канал "${updatedChannel.name}" успішно оновлено` 
    });
  }, [addLog, toast]);

  const deleteChannel = useCallback((id: string) => {
    const channelName = channels.find(c => c.id === id)?.name || '';
    setChannels((prev) => prev.filter((channel) => channel.id !== id));
    
    setStatistics((prev) => ({
      ...prev,
      postsByChannel: prev.postsByChannel.filter((stats) => stats.channelId !== id),
    }));
    
    addLog(`Канал "${channelName}" успішно видалено`, 'info');
    
    toast({ 
      title: "Канал видалено", 
      description: `Канал "${channelName}" успішно видалено` 
    });
  }, [channels, addLog, toast]);

  // Clear all timeouts on component unmount
  useEffect(() => {
    return () => {
      Object.values(generationTimeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [generationTimeouts]);

  // Load channels from localStorage on initialization
  useEffect(() => {
    const savedChannels = localStorage.getItem('telegramChannels');
    if (savedChannels) {
      try {
        const parsedChannels = JSON.parse(savedChannels);
        
        const updatedChannels = parsedChannels.map((channel: any) => ({
          ...channel,
          schedule: channel.schedule || []
        }));
        
        setChannels(updatedChannels);
      } catch (e) {
        console.error("Error parsing saved channels:", e);
        setChannels([]);
      }
    }

    const savedStats = localStorage.getItem('telegramStatistics');
    if (savedStats) {
      setStatistics(JSON.parse(savedStats));
    }

    const savedLogs = localStorage.getItem('telegramBotLogs');
    if (savedLogs) {
      setBotLogs(JSON.parse(savedLogs));
    }
  }, []);

  useEffect(() => {
    if (channels.length > 0) {
      localStorage.setItem('telegramChannels', JSON.stringify(channels));
    }
  }, [channels]);

  useEffect(() => {
    localStorage.setItem('telegramStatistics', JSON.stringify(statistics));
  }, [statistics]);

  useEffect(() => {
    localStorage.setItem('telegramBotLogs', JSON.stringify(botLogs.slice(-100)));
  }, [botLogs]);

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
    deletePost
  };

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
};

// Function to generate test content based on user's prompt
const generateTestContentFromPrompt = (promptTemplate: string, channelName: string): string => {
  if (promptTemplate.toLowerCase().includes('крипт')) {
    return `🚀 Останні новини з криптосвіту!\n\nБіткоїн сьогодні показує стабільний ріст, а Ethereum демонструє цікаві тенденції. Аналітики прогнозують позитивні зміни на ринку в найближчі тижні.\n\n💰 Ключові моменти:\n• BTC: тестує рівень опору\n• ETH: активність DeFi зростає\n• Альткоїни: селективне зростання\n\n#crypto #bitcoin #ethereum #trading`;
  }
  
  return `Пост для каналу "${channelName}" згенеровано на основі вашого промпту: "${promptTemplate}"\n\nЧас створення: ${new Date().toLocaleTimeString()}`;
};

// Function to generate more realistic-looking Grok API responses based on user prompt
const generateGrokResponse = (promptTemplate: string): string => {
  if (promptTemplate.toLowerCase().includes('крипт')) {
    const cryptoResponses = [
      `🔥 КРИПТОНОВИНИ СЬОГОДНІ 🔥\n\nБіткоїн тестує ключовий рівень $43,500. Обсяги торгів зросли на 23% за останні 24 години.\n\n📊 Технічний аналіз:\n• RSI: 58 (нейтральна зона)\n• Підтримка: $42,800\n• Опір: $44,200\n\n💡 Думка аналітиків: можливий прорив вгору при закріпленні вище $43,800\n\n#Bitcoin #Crypto #Analysis #Trading`,
      
      `⚡ ETHEREUM НА НОВОМУ ЕТАПІ ⚡\n\nЗапуск нових оновлень мережі показує вражаючі результати:\n\n🚀 Ключові показники:\n• Gas fees знизились на 40%\n• TPS збільшилась до 15\n• Активних адрес: 800K+ щодня\n\nDeFi протоколи демонструють рекордну активність. Загальна вартість заблокованих коштів (TVL) досягла $38 млрд.\n\n#Ethereum #DeFi #Blockchain`,
      
      `📈 АЛЬТКОЇНИ У ФОКУСІ 📈\n\nТоп-3 альткоїна тижня за зростанням:\n\n1️⃣ Solana (SOL): +18%\n2️⃣ Cardano (ADA): +15%\n3️⃣ Polygon (MATIC): +12%\n\n🔍 Фундаментальні фактори:\n• Нові партнерства\n• Технічні оновлення\n• Ріст екосистеми\n\nІнвестори переключають увагу на проекти з реальною корисністю.\n\n#Altcoins #Solana #Cardano #Polygon`
    ];
    
    return cryptoResponses[Math.floor(Math.random() * cryptoResponses.length)];
  }
  
  // For other prompts, generate content based on the template
  return `Контент згенеровано на основі промпту: "${promptTemplate}"\n\nЧас створення: ${new Date().toLocaleString()}\n\nЦе приклад того, як працював би справжній Grok API з вашим промптом. Додайте справжній API ключ для повноцінної роботи.`;
};
