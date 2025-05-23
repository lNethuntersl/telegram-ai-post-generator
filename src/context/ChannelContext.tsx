
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
  
  // Функція зупинки бота (moved up before any references)
  const stopBot = useCallback(() => {
    setIsGenerating(false);
    addLog("Бота зупинено", 'warning');
    
    // Очищаємо всі таймаути при зупинці бота
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

  // Встановлення та очищення таймаутів генерації
  const setupGenerationTimeout = useCallback((channelId: string, timeoutMs = 60000) => {
    // Очистимо попередній таймаут, якщо такий існує
    if (generationTimeouts[channelId]) {
      clearTimeout(generationTimeouts[channelId]);
    }
    
    // Встановлюємо новий таймаут
    const timeoutId = setTimeout(() => {
      // Якщо таймаут спрацював, додаємо лог про можливу помилку
      addLog(`Можливе зависання під час генерації посту для каналу з ID ${channelId}`, 'warning');
      
      // Оновлюємо статуси
      updateBotStatus({
        channelStatuses: botStatus.channelStatuses.map(status => 
          status.channelId === channelId 
            ? { ...status, status: 'Можливе зависання генерації' }
            : status
        ),
      });
      
      // Видаляємо цей таймаут зі списку
      setGenerationTimeouts(prev => {
        const newTimeouts = { ...prev };
        delete newTimeouts[channelId];
        return newTimeouts;
      });
      
    }, timeoutMs);
    
    // Зберігаємо таймаут
    setGenerationTimeouts(prev => ({
      ...prev,
      [channelId]: timeoutId
    }));
    
    return timeoutId;
  }, [generationTimeouts, addLog, updateBotStatus, botStatus.channelStatuses]);
  
  // Очищення таймаута для каналу
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

  // Updated function to publish posts using real Telegram API (moved up)
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
      
      // Перевіряємо наявність та формат токену бота та ID чату
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
        // Log token and chat ID info (safely)
        addLog(`Підготовка до публікації в Telegram. Бот токен: ${channel.botToken.substring(0, 5)}..., Chat ID: ${channel.chatId}`, 'info');

        // Make actual API call to Telegram
        let result;
        
        try {
          if (post.imageUrl && post.imageUrl !== "https://via.placeholder.com/500") {
            // Send photo with caption
            result = await sendTelegramPhoto(channel.botToken, channel.chatId, post.imageUrl, post.text);
            addLog(`Відправлено зображення з текстом до Telegram`, 'info');
          } else {
            // Send text only
            result = await sendTelegramMessage(channel.botToken, channel.chatId, post.text);
            addLog(`Відправлено текстове повідомлення до Telegram`, 'info');
          }
        } catch (apiError) {
          throw new Error(`Помилка Telegram API: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        }
        
        if (!result || !result.ok) {
          throw new Error(`Telegram API повернув помилку: ${result?.description || 'Невідома помилка'}`);
        }
        
        // Publication successful
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
      
      // Імітуємо час генерації
      const generationTime = Math.random() * 1000 + 500; // Faster generation for testing
      
      setTimeout(() => {
        try {
          // Generating real content for testing the API
          const post: Post = {
            id: uuidv4(),
            channelId: channelId,
            text: `Тестовий пост для каналу "${channel.name}" з часом ${new Date().toLocaleTimeString()}. Це повідомлення відправлено за допомогою Telegram Bot API.`,
            imageUrl: "https://placehold.co/600x400/png",
            status: 'generated',
            createdAt: new Date().toISOString(),
          };
          
          addLog(`Пост для каналу "${channel.name}" успішно згенеровано`, 'success', { postId: post.id });
          resolve(post);
        } catch (error) {
          const errorMessage = `Помилка під час генерації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
          addLog(errorMessage, 'error', { error });
          reject(new Error(errorMessage));
        }
      }, generationTime);
    });
  }, [channels, addLog]);

  // Function to generate and publish a post for a specific channel
  const generateAndPublishPost = useCallback(async (channelId: string): Promise<Post> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      throw new Error(`Канал з ID ${channelId} не знайдено`);
    }

    addLog(`Початок генерації та публікації для каналу "${channel.name}"`, 'info');
    
    // Встановлюємо таймаут для відслідковування можливого зависання
    setupGenerationTimeout(channelId);

    // First generate the post
    let post: Post;
    try {
      post = await generatePostForChannel(channelId);
      
      // Очищаємо таймаут, оскільки генерація успішно завершена
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
    } catch (error) {
      // Очищаємо таймаут при помилці
      clearGenerationTimeout(channelId);
      
      const errorMessage = `Помилка генерації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    // Then publish it
    try {
      // Встановлюємо новий таймаут для публікації
      setupGenerationTimeout(channelId);
      
      const publishedPost = await publishPost(post);
      
      // Очищаємо таймаут, оскільки публікація успішно завершена
      clearGenerationTimeout(channelId);
      
      // Update the post in the channel
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
      
      // Update statistics if published successfully
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
      // Очищаємо таймаут при помилці
      clearGenerationTimeout(channelId);
      
      const errorMessage = `Помилка публікації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
      addLog(errorMessage, 'error');
      
      // Update post status to failed
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

  // Function to check if any posts need to be published based on schedule
  const checkScheduledPosts = useCallback(() => {
    if (!botStatus.isRunning) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Log that we're checking scheduled posts
    addLog(`Перевірка розкладу постів - ${currentHour}:${String(currentMinute).padStart(2, '0')}`, 'info');

    // Check each active channel
    channels.filter(channel => channel.isActive).forEach(channel => {
      if (!channel.schedule || channel.schedule.length === 0) return;

      // Check if any scheduled time matches current time
      const matchingTime = channel.schedule.find(time => 
        time.hour === currentHour && 
        Math.abs(time.minute - currentMinute) < 2 // Within 2 minutes
      );

      if (matchingTime) {
        addLog(`Знайдено заплановану публікацію для каналу "${channel.name}" на ${currentHour}:${String(matchingTime.minute).padStart(2, '0')}`, 'info');
        
        // Generate and publish post for this channel
        generateAndPublishPost(channel.id).catch(error => {
          addLog(`Помилка при запланованій публікації для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`, 'error');
        });
      }
    });
  }, [botStatus.isRunning, channels, addLog, generateAndPublishPost]);

  // Генерація та публікація постів для всіх активних каналів
  const processChannels = useCallback(async () => {
    const activeChannels = channels.filter(channel => channel.isActive);
    if (activeChannels.length === 0) {
      addLog("Немає активних каналів для обробки", 'warning');
      stopBot();
      return;
    }
    
    // Оновлюємо статус бота
    updateBotStatus({
      currentAction: 'Початок генерації постів',
    });
    
    addLog(`Запуск обробки ${activeChannels.length} активних каналів`, 'info');
    
    for (const channel of activeChannels) {
      try {
        // Оновлюємо статус каналу
        updateBotStatus({
          channelStatuses: botStatus.channelStatuses.map(status => 
            status.channelId === channel.id 
              ? { ...status, status: 'Генерація посту' }
              : status
          ),
          currentAction: `Генерація посту для каналу "${channel.name}"`,
        });
        
        // Generate test post for each active channel on startup if no schedule
        if (!channel.schedule || channel.schedule.length === 0) {
          await generateAndPublishPost(channel.id);
        } else {
          addLog(`Канал "${channel.name}" має налаштований розклад (${channel.schedule.length} записів). Пости будуть публікуватись за розкладом.`, 'info');
        }
        
      } catch (error) {
        const errorMessage = `Неочікувана помилка для каналу ${channel.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage);
        addLog(errorMessage, 'error', { error });
        
        updateBotStatus({
          channelStatuses: botStatus.channelStatuses.map(status => 
            status.channelId === channel.id 
              ? { ...status, status: 'Помилка' }
              : status
          ),
          currentAction: errorMessage,
        });
        
        toast({ 
          title: "Помилка", 
          description: errorMessage, 
          variant: "destructive" 
        });
      }
    }
    
    // Зупиняємо генерацію після завершення всіх каналів
    setIsGenerating(false);
    addLog("Завершення початкової генерації постів, переходимо в режим роботи за розкладом", 'info');
    
    // Зберігаємо загальну статистику за день
    const today = new Date().toISOString().split('T')[0];
    setStatistics(prev => {
      const todayStats = prev.dailyStats.find(stat => stat.date === today);
      
      if (todayStats) {
        return {
          ...prev,
          dailyStats: prev.dailyStats.map(stat => 
            stat.date === today 
              ? { 
                  ...stat, 
                  generated: stat.generated + activeChannels.length, 
                  published: stat.published + activeChannels.length 
                }
              : stat
          ),
        };
      } else {
        return {
          ...prev,
          dailyStats: [
            ...prev.dailyStats, 
            {
              date: today,
              generated: activeChannels.length,
              published: activeChannels.length,
            }
          ],
        };
      }
    });
  }, [channels, botStatus, addLog, stopBot, updateBotStatus, generateAndPublishPost, toast]);

  // Function to generate a test post
  const generateTestPost = useCallback(async (channelId: string): Promise<Post> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      const errorMessage = `Канал з ID ${channelId} не знайдено`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }
    
    // Check if channel has valid credentials before proceeding
    if (!validateTelegramCredentials(channel.botToken, channel.chatId)) {
      const errorMessage = `Канал "${channel.name}" має невірні дані для Telegram: перевірте Bot Token та Chat ID`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }
    
    setIsGenerating(true);
    addLog(`Початок генерації тестового посту для каналу "${channel.name}"`, 'info');
    
    try {
      // Встановлюємо таймаут для відслідковування можливого зависання
      setupGenerationTimeout(channelId);
      
      // Генеруємо і публікуємо пост
      const post = await generateAndPublishPost(channelId);
      
      // Очищаємо таймаут, оскільки операція успішно завершена
      clearGenerationTimeout(channelId);
      
      addLog(`Тестовий пост для каналу "${channel.name}" успішно згенеровано та опубліковано`, 'success', { 
        postId: post.id,
        status: post.status
      });
      
      setIsGenerating(false);
      return post;
    } catch (error) {
      // Очищаємо таймаут при помилці
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

    setIsGenerating(true);
    addLog("Запуск бота", 'success');
    
    updateBotStatus({
      isRunning: true,
      currentAction: 'Запуск процесу генерації постів',
      channelStatuses: channels.map(channel => ({
        channelId: channel.id,
        status: channel.isActive ? 'Очікує генерації' : 'Неактивний',
      })),
    });

    toast({ 
      title: "Бота запущено", 
      description: "Бот розпочав генерацію контенту" 
    });
    
    // Запускаємо процес генерації та публікації постів
    processChannels();
  }, [channels, addLog, toast, updateBotStatus, processChannels]);

  // Set up scheduler
  useEffect(() => {
    if (!botStatus.isRunning) return;

    // Check for scheduled posts every minute
    const intervalId = setInterval(() => {
      checkScheduledPosts();
    }, 60000); // Every minute

    // Initial check
    checkScheduledPosts();

    return () => {
      clearInterval(intervalId);
    };
  }, [botStatus.isRunning, channels, checkScheduledPosts]);

  // New function to update an existing post
  const updatePost = useCallback(async (updatedPost: Post): Promise<void> => {
    const channel = channels.find(c => c.id === updatedPost.channelId);
    if (!channel) {
      const errorMessage = `Канал з ID ${updatedPost.channelId} не знайдено`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    addLog(`Оновлення посту для каналу "${channel.name}"`, 'info', { postId: updatedPost.id });

    // Update the post in the channel
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

  // New function to delete a post
  const deletePost = useCallback(async (postId: string, channelId: string): Promise<void> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      const errorMessage = `Канал з ID ${channelId} не знайдено`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    addLog(`Видалення посту для каналу "${channel.name}"`, 'info', { postId });

    // Remove the post from the channel
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
    
    // Оновлюємо статистику
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
    
    // Видаляємо статистику для цього каналу
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

  // Очищаємо всі таймаути при знищенні компоненту
  useEffect(() => {
    return () => {
      Object.values(generationTimeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [generationTimeouts]);

  // Завантаження каналів з localStorage при ініціалізації
  useEffect(() => {
    const savedChannels = localStorage.getItem('telegramChannels');
    if (savedChannels) {
      try {
        const parsedChannels = JSON.parse(savedChannels);
        
        // Add schedule array if it doesn't exist in saved channels
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

    // Завантаження статистики з localStorage
    const savedStats = localStorage.getItem('telegramStatistics');
    if (savedStats) {
      setStatistics(JSON.parse(savedStats));
    }

    // Завантаження логів з localStorage
    const savedLogs = localStorage.getItem('telegramBotLogs');
    if (savedLogs) {
      setBotLogs(JSON.parse(savedLogs));
    }
  }, []);

  // Збереження каналів в localStorage при зміні
  useEffect(() => {
    if (channels.length > 0) {
      localStorage.setItem('telegramChannels', JSON.stringify(channels));
    }
  }, [channels]);

  // Збереження статистики в localStorage при зміні
  useEffect(() => {
    localStorage.setItem('telegramStatistics', JSON.stringify(statistics));
  }, [statistics]);

  // Збереження логів в localStorage при зміні
  useEffect(() => {
    localStorage.setItem('telegramBotLogs', JSON.stringify(botLogs.slice(-100))); // Зберігаємо останні 100 логів
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
