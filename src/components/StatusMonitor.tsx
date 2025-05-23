import React, { useEffect, useState } from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDateTime } from '@/lib/utils';

const StatusMonitor = () => {
  const { botStatus, channels, isGenerating, stopBot } = useChannelContext();
  const [progress, setProgress] = useState(10); // Start with 10% to show immediate feedback
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  
  // Reset timeout warning when generation status changes
  useEffect(() => {
    if (isGenerating) {
      setShowTimeoutWarning(false);
      setProgress(10); // Reset progress to initial value when generation starts
    } else {
      setProgress(0); // Reset to 0 when not generating
    }
  }, [isGenerating]);
  
  // Simulation of progress and time tracking for demonstration
  useEffect(() => {
    let timerProgress;
    let processingTimer;
    
    if (isGenerating) {
      // Start timer for tracking generation time
      processingTimer = setInterval(() => {
        setProcessingTime(prev => {
          const newTime = prev + 1;
          // Show warning if generation takes more than 30 seconds
          if (newTime > 30 && !showTimeoutWarning) {
            setShowTimeoutWarning(true);
          }
          return newTime;
        });
      }, 1000);

      // Modified progress calculation to ensure visible movement
      timerProgress = setInterval(() => {
        setProgress(prev => {
          // Ensure progress moves more consistently and visibly
          // Progress moves faster at the start and slows down as it approaches 100%
          const increment = Math.max(0.5, (100 - prev) / 15);
          const newProgress = Math.min(prev + increment, 99); // Cap at 99% until complete
          return newProgress;
        });
      }, 800);
      
      return () => {
        if (timerProgress) clearInterval(timerProgress);
        if (processingTimer) clearInterval(processingTimer);
        setProcessingTime(0);
      };
    } else {
      setProgress(0);
      setProcessingTime(0);
      setShowTimeoutWarning(false);
    }
  }, [isGenerating, showTimeoutWarning]);

  // Function to format time in minutes:seconds
  const formatProcessingTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get active channel status for displaying details
  const activeChannelStatus = botStatus.channelStatuses.find(
    status => channels.find(channel => channel.id === status.channelId)?.isActive
  );
  
  const activeChannel = activeChannelStatus 
    ? channels.find(channel => channel.id === activeChannelStatus.channelId) 
    : null;

  const handleCancelGeneration = () => {
    stopBot();
    setShowTimeoutWarning(false);
  };

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
              <span className="font-medium">{formatDateTime(botStatus.lastUpdate)}</span>
            </div>
          </div>
          
          {botStatus.isRunning && (
            <>
              {isGenerating && (
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Прогрес генерації</span>
                    <span>{generationProgress}% ({timeElapsed})</span>
                  </div>
                  <Progress value={Math.max(5, generationProgress)} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {botStatus.isRunning 
                      ? "Генерація контенту... Будь ласка, зачекайте." 
                      : "Тестова генерація контенту..."}
                  </p>
                </div>
              )}
              
              {showTimeoutWarning && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Генерація триває довше, ніж очікувалося</AlertTitle>
                  <AlertDescription>
                    Процес генерації триває вже {formatProcessingTime(processingTime)}. Можливо, виникли проблеми з підключенням до API.
                    <div className="mt-2 flex space-x-2">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleCancelGeneration}
                      >
                        Скасувати
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowTimeoutWarning(false)}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" /> Продовжити очікування
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
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
                        <span>{formatDateTime(activeChannelStatus.nextPostTime)}</span>
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
