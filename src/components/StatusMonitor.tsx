
import React, { useEffect, useState } from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

const StatusMonitor = () => {
  const { botStatus, channels, isGenerating } = useChannelContext();
  const [progress, setProgress] = useState(0);
  
  // Імітуємо прогрес для демонстрації
  useEffect(() => {
    if (isGenerating) {
      const timer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + Math.random() * 2;
          if (newProgress >= 100) {
            clearInterval(timer);
            return 100;
          }
          return newProgress;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    } else {
      setProgress(0);
    }
  }, [isGenerating]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMMM yyyy, HH:mm:ss', { locale: uk });
    } catch (e) {
      return 'Невідома дата';
    }
  };

  // Отримуємо активний канал зі статусом для відображення деталей
  const activeChannelStatus = botStatus.channelStatuses.find(
    status => channels.find(channel => channel.id === status.channelId)?.isActive
  );
  
  const activeChannel = activeChannelStatus 
    ? channels.find(channel => channel.id === activeChannelStatus.channelId) 
    : null;

  return (
    <div className="space-y-4">
      <Card className={`${botStatus.isRunning ? 'border-green-500' : 'border-gray-300'}`}>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Статус бота</CardTitle>
            <Badge 
              variant={botStatus.isRunning ? "default" : "outline"}
              className={botStatus.isRunning ? "bg-green-500" : ""}
            >
              {botStatus.isRunning ? 'Активний' : 'Зупинений'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Поточна дія:</span>
              <span className="font-medium">{botStatus.currentAction}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Останнє оновлення:</span>
              <span className="font-medium">{formatDate(botStatus.lastUpdate)}</span>
            </div>
          </div>
          
          {botStatus.isRunning && (
            <>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>Прогрес генерації</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
              
              {activeChannel && (
                <div className="mt-4 bg-muted p-3 rounded-md">
                  <h4 className="font-medium mb-1">Поточний канал: {activeChannel.name}</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Статус:</span>
                      <span>{activeChannelStatus?.status}</span>
                    </div>
                    {activeChannelStatus?.nextPostTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Наступний пост:</span>
                        <span>{formatDate(activeChannelStatus.nextPostTime)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="grid grid-cols-2 gap-2 mt-4">
            {botStatus.channelStatuses.slice(0, 4).map((status) => {
              const channel = channels.find(c => c.id === status.channelId);
              if (!channel) return null;
              
              return (
                <div key={status.channelId} className="bg-muted/50 p-2 rounded text-xs">
                  <div className="font-medium truncate">{channel.name}</div>
                  <div className="text-muted-foreground truncate">{status.status}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatusMonitor;
