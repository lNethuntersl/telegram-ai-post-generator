
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Channel, Post, BotStatus, Statistics } from '../types';
import { useToast } from '@/components/ui/use-toast';

interface ChannelContextProps {
  channels: Channel[];
  addChannel: (channel: Omit<Channel, 'id' | 'lastPosts' | 'isActive'>) => void;
  updateChannel: (channel: Channel) => void;
  deleteChannel: (id: string) => void;
  botStatus: BotStatus;
  statistics: Statistics;
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
    return new Promise((resolve) => {
      const channel = channels.find(c => c.id === channelId);
      if (!channel) {
        throw new Error("Канал не знайдено");
      }
      
      // Імітуємо час генерації
      const generationTime = Math.random() * 3000 + 2000;
      
      setTimeout(() => {
        const post: Post = {
          id: uuidv4(),
          channelId: channelId,
          text: `Згенерований пост для каналу "${channel.name}" використовуючи промпт: "${channel.promptTemplate.substring(0, 50)}..."`,
          imageUrl: "https://via.placeholder.com/500",
          status: 'generated',
          createdAt: new Date().toISOString(),
        };
        
        resolve(post);
      }, generationTime);
    });
  };

  // Функція для імітації публікації поста
  const publishPost = (post: Post): Promise<Post> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const publishedPost: Post = {
          ...post,
          status: 'published',
          publishedAt: new Date().toISOString(),
        };
        
        resolve(publishedPost);
      }, 1500);
    });
  };

  // Генерація та публікація постів для всіх активних каналів
  const processChannels = async () => {
    const activeChannels = channels.filter(channel => channel.isActive);
    if (activeChannels.length === 0) {
      stopBot();
      return;
    }
    
    // Оновлюємо статус бота
    updateBotStatus({
      currentAction: 'Початок генерації постів',
    });
    
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
        const post = await generatePostForChannel(channel.id);
        
        // Оновлюємо список постів каналу
        setChannels(prev => prev.map(c => 
          c.id === channel.id 
            ? { ...c, lastPosts: [...c.lastPosts, post] }
            : c
        ));
        
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
        const publishedPost = await publishPost(post);
        
        // Оновлюємо список постів каналу
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
        
        // Оновлюємо статистику
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
        
      } catch (error) {
        console.error(`Помилка для каналу ${channel.name}:`, error);
        updateBotStatus({
          channelStatuses: botStatus.channelStatuses.map(status => 
            status.channelId === channel.id 
              ? { ...status, status: 'Помилка генерації' }
              : status
          ),
          currentAction: `Помилка для каналу "${channel.name}"`,
        });
        
        toast({ 
          title: "Помилка", 
          description: `Виникла помилка для каналу "${channel.name}"`, 
          variant: "destructive" 
        });
      }
    }
    
    // Зупиняємо бота після завершення всіх каналів
    setIsGenerating(false);
    
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
      toast({ 
        title: "Помилка", 
        description: "Активуйте хоча б один канал перед запуском бота", 
        variant: "destructive" 
      });
      return;
    }

    setIsGenerating(true);
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
