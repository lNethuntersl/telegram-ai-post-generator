
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Channel, Post, BotStatus, Statistics, BotLog } from '../types';
import { useToast } from '@/components/ui/use-toast';

interface ChannelContextProps {
  channels: Channel[];
  addChannel: (channel: Omit<Channel, 'id' | 'lastPosts' | 'isActive'>) => void;
  updateChannel: (channel: Channel) => void;
  deleteChannel: (id: string) => void;
  botStatus: BotStatus;
  statistics: Statistics;
  botLogs: BotLog[];
  startBot: () => void;
  stopBot: () => void;
  isGenerating: boolean;
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

  useEffect(() => {
    // Завантаження каналів з localStorage при ініціалізації
    const savedChannels = localStorage.getItem('telegramChannels');
    if (savedChannels) {
      setChannels(JSON.parse(savedChannels));
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

  const addChannel = (channelData: Omit<Channel, 'id' | 'lastPosts' | 'isActive'>) => {
    const newChannel: Channel = {
      ...channelData,
      id: uuidv4(),
      lastPosts: [],
      isActive: false,
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
          };
          
          addLog(`Пост для каналу "${channel.name}" успішно опубліковано`, 'success', { 
            postId: publishedPost.id,
            publishedAt: publishedPost.publishedAt
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
        
        // Генеруємо пост
        let post: Post;
        try {
          post = await generatePostForChannel(channel.id);
          
          // Перевіряємо чи пост був успішно доданий до каналу
          const isAdded = isPostAddedToChannel(post.id, channel.id);
          if (!isAdded) {
            addLog(`Додаємо згенерований пост до каналу "${channel.name}"`, 'info', { postId: post.id });
            // Оновлюємо список постів каналу
            setChannels(prev => prev.map(c => 
              c.id === channel.id 
                ? { ...c, lastPosts: [...c.lastPosts, post] }
                : c
            ));
          } else {
            addLog(`Пост вже існує в каналі "${channel.name}", пропускаємо додавання`, 'warning', { postId: post.id });
          }
          
        } catch (error) {
          const errorMessage = `Помилка генерації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
          addLog(errorMessage, 'error');
          
          updateBotStatus({
            channelStatuses: botStatus.channelStatuses.map(status => 
              status.channelId === channel.id 
                ? { ...status, status: 'Помилка генерації' }
                : status
            ),
            currentAction: errorMessage,
          });
          
          toast({ 
            title: "Помилка генерації", 
            description: errorMessage, 
            variant: "destructive" 
          });
          
          continue;
        }
        
        // Оновлюємо статистику
        setStatistics(prev => ({
          ...prev,
          totalPostsGenerated: prev.totalPostsGenerated + 1,
          postsByChannel: prev.postsByChannel.map(stats => 
            stats.channelId === channel.id 
              ? { ...stats, generated: stats.generated + 1 }
              : stats
          ),
        }));
        
        // Оновлюємо статус каналу
        updateBotStatus({
          channelStatuses: botStatus.channelStatuses.map(status => 
            status.channelId === channel.id 
              ? { ...status, status: 'Публікація посту' }
              : status
          ),
          currentAction: `Публікація посту для каналу "${channel.name}"`,
        });
        
        // Публікуємо пост
        let publishedPost: Post;
        try {
          publishedPost = await publishPost(post);
          
          // Оновлюємо список постів каналу з результатом публікації
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
          
        } catch (error) {
          const errorMessage = `Помилка публікації посту для каналу "${channel.name}": ${error instanceof Error ? error.message : String(error)}`;
          addLog(errorMessage, 'error');
          
          // Оновлюємо статус поста на "failed"
          setChannels(prev => prev.map(c => 
            c.id === channel.id 
              ? { 
                  ...c, 
                  lastPosts: c.lastPosts.map(p => 
                    p.id === post.id ? { ...p, status: 'failed', error: errorMessage } : p
                  ) 
                }
              : c
          ));
          
          updateBotStatus({
            channelStatuses: botStatus.channelStatuses.map(status => 
              status.channelId === channel.id 
                ? { ...status, status: 'Помилка публікації' }
                : status
            ),
            currentAction: errorMessage,
          });
          
          toast({ 
            title: "Помилка публікації", 
            description: errorMessage, 
            variant: "destructive" 
          });
          
          continue;
        }
        
        // Якщо публікація успішна, оновлюємо статистику
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
          
          // Визначаємо час наступного посту
          const now = new Date();
          const nextPostTime = new Date();
          nextPostTime.setHours(nextPostTime.getHours() + (24 / channel.postsPerDay));
          
          // Оновлюємо статус каналу
          updateBotStatus({
            channelStatuses: botStatus.channelStatuses.map(status => 
              status.channelId === channel.id 
                ? { 
                    ...status, 
                    status: 'Очікування наступного посту', 
                    nextPostTime: nextPostTime.toISOString() 
                  }
                : status
            ),
            currentAction: `Пост для каналу "${channel.name}" успішно опубліковано`,
          });
          
          toast({ 
            title: "Пост опубліковано", 
            description: `Пост для каналу "${channel.name}" успішно опубліковано` 
          });
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
    
    // Зупиняємо бота після завершення всіх каналів
    setIsGenerating(false);
    addLog("Завершення циклу генерації постів", 'info');
    
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
  };

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
};
