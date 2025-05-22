
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Channel, Post, BotStatus, Statistics, BotLog, ScheduleTime } from '../types';
import { useToast } from '@/components/ui/use-toast';

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
  }, [botStatus.isRunning, channels]);

  // Function to check if any posts need to be published based on schedule
  const checkScheduledPosts = () => {
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
  };

  // Function to generate and publish a post for a specific channel
  const generateAndPublishPost = async (channelId: string): Promise<Post> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      throw new Error(`Канал з ID ${channelId} не знайдено`);
    }

    addLog(`Початок генерації та публікації для каналу "${channel.name}"`, 'info');

    // First generate the post
    let post: Post;
    try {
      post = await generatePostForChannel(channelId);
      
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
      const errorMessage = `Помилка генерації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    // Then publish it
    try {
      const publishedPost = await publishPost(post);
      
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
  };

  useEffect(() => {
    // Завантаження каналів з localStorage при ініціалізації
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

  const addLog = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info', details?: any) => {
    const log: BotLog = {
      timestamp: new Date().toISOString(),
      message,
      type,
      details
    };
    
    console.log(`[${type.toUpperCase()}] ${message}`, details || '');
    
    setBotLogs(prev => [...prev, log]);
  };

  const addChannel = (channelData: Omit<Channel, 'id' | 'lastPosts' | 'isActive' | 'schedule'>) => {
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
  };

  const updateChannel = (updatedChannel: Channel) => {
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
  };

  const deleteChannel = (id: string) => {
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
  };

  const updateBotStatus = (status: Partial<BotStatus>) => {
    setBotStatus((prev) => ({
      ...prev,
      ...status,
      lastUpdate: new Date().toISOString(),
    }));
  };

  // Функція для генерації тестового посту
  const generateTestPost = async (channelId: string): Promise<Post> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      const errorMessage = `Канал з ID ${channelId} не знайдено`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }
    
    setIsGenerating(true);
    addLog(`Початок генерації тестового посту для каналу "${channel.name}"`, 'info');
    
    try {
      // Генеруємо і публікуємо пост
      const post = await generateAndPublishPost(channelId);
      
      addLog(`Тестовий пост для каналу "${channel.name}" успішно згенеровано та опубліковано`, 'success', { 
        postId: post.id,
        status: post.status
      });
      
      setIsGenerating(false);
      return post;
    } catch (error) {
      setIsGenerating(false);
      const errorMessage = `Помилка під час тестового посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
      addLog(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  // Функція для імітації генерації поста
  const generatePostForChannel = (channelId: string): Promise<Post> => {
    return new Promise((resolve, reject) => {
      const channel = channels.find(c => c.id === channelId);
      if (!channel) {
        const errorMessage = "Канал не знайдено";
        addLog(errorMessage, 'error', { channelId });
        reject(new Error(errorMessage));
        return;
      }
      
      addLog(`Початок генерації посту для каналу "${channel.name}"`, 'info');
      
      // Імітуємо час генерації
      const generationTime = Math.random() * 3000 + 2000;
      
      setTimeout(() => {
        try {
          // Симуляція помилки генерації в 15% випадків
          const isGenerationError = Math.random() < 0.15;
          
          if (isGenerationError) {
            const errorMessage = "Помилка генерації контенту через Grok API (симуляція помилки)";
            addLog(errorMessage, 'error');
            reject(new Error(errorMessage));
            return;
          }
          
          const post: Post = {
            id: uuidv4(),
            channelId: channelId,
            text: `Згенерований пост для каналу "${channel.name}" використовуючи промпт: "${channel.promptTemplate.substring(0, 50)}..."`,
            imageUrl: "https://via.placeholder.com/500",
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
  };

  // Функція для імітації публікації поста
  const publishPost = (post: Post): Promise<Post> => {
    return new Promise((resolve, reject) => {
      const channel = channels.find(c => c.id === post.channelId);
      if (!channel) {
        const errorMessage = "Канал для публікації не знайдено";
        addLog(errorMessage, 'error', { postId: post.id });
        reject(new Error(errorMessage));
        return;
      }
      
      addLog(`Початок публікації посту для каналу "${channel.name}"`, 'info', { postId: post.id });
      
      setTimeout(() => {
        try {
          // Імітуємо помилку публікації в 20% випадків для тестування
          const isPublishingError = Math.random() < 0.2;
          
          if (isPublishingError) {
            const errorMessage = `Помилка публікації: неможливо надіслати повідомлення до Telegram (симуляція помилки)`;
            addLog(errorMessage, 'error', { postId: post.id });
            
            const failedPost: Post = {
              ...post,
              status: 'failed',
              error: errorMessage
            };
            
            resolve(failedPost);
            return;
          }
          
          // Публікуємо успішно (симуляція)
          const publishedPost: Post = {
            ...post,
            status: 'published',
            publishedAt: new Date().toISOString(),
            telegramPostId: Math.floor(Math.random() * 10000).toString()
          };
          
          addLog(`Пост для каналу "${channel.name}" успішно опубліковано`, 'success', { 
            postId: publishedPost.id,
            publishedAt: publishedPost.publishedAt,
            telegramPostId: publishedPost.telegramPostId
          });
          
          resolve(publishedPost);
          
        } catch (error) {
          const errorMessage = `Помилка під час публікації посту: ${error instanceof Error ? error.message : String(error)}`;
          addLog(errorMessage, 'error', { error, postId: post.id });
          
          const failedPost: Post = {
            ...post,
            status: 'failed',
            error: errorMessage
          };
          
          resolve(failedPost);
        }
      }, 1500);
    });
  };

  // Перевірка чи пост був доданий до каналу
  const isPostAddedToChannel = (postId: string, channelId: string): boolean => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return false;
    return channel.lastPosts.some(p => p.id === postId);
  };

  // Генерація та публікація постів для всіх активних каналів
  const processChannels = async () => {
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
  };

  const startBot = () => {
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
  };

  const stopBot = () => {
    setIsGenerating(false);
    addLog("Бота зупинено", 'warning');
    
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
  };

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
  };

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
};
