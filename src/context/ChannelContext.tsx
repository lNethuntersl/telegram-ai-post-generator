
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

  const startBot = () => {
    if (channels.length === 0) {
      toast({ 
        title: "Помилка", 
        description: "Додайте хоча б один канал перед запуском бота", 
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
        status: 'Очікує генерації',
      })),
    });

    // В реальному проекті тут було б налаштування фактичної роботи бота з Telegram API
    // Для демонстрації використовуємо setTimeout
    setTimeout(() => {
      toast({ 
        title: "Бота запущено", 
        description: "Бот розпочав генерацію контенту" 
      });
    }, 1000);
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
