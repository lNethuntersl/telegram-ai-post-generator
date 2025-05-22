
import React from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Square, RefreshCw, Calendar } from 'lucide-react';
import { formatTime } from '@/lib/utils';

const BotControls = () => {
  const { startBot, stopBot, botStatus, channels, isGenerating } = useChannelContext();

  const activeChannelsCount = channels.filter(channel => channel.isActive).length;
  const totalPostsPerDay = channels.reduce((sum, channel) => sum + (channel.isActive ? channel.postsPerDay : 0), 0);
  const totalScheduledTimes = channels
    .filter(channel => channel.isActive)
    .reduce((sum, channel) => sum + (channel.schedule?.length || 0), 0);

  // Find the next scheduled post time
  const getNextScheduledPost = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    let nextPost = null;
    let nextPostTime = null;
    
    // Check all active channels for their schedules
    channels.filter(channel => channel.isActive).forEach(channel => {
      if (!channel.schedule || channel.schedule.length === 0) return;
      
      channel.schedule.forEach(time => {
        // Calculate time difference
        const timeDate = new Date();
        timeDate.setHours(time.hour, time.minute, 0, 0);
        
        // If time is in the past for today, set it for tomorrow
        if (time.hour < currentHour || (time.hour === currentHour && time.minute <= currentMinute)) {
          timeDate.setDate(timeDate.getDate() + 1);
        }
        
        // Compare with current nextPost
        if (!nextPostTime || timeDate < nextPostTime) {
          nextPost = {
            channelName: channel.name,
            time: formatTime(time.hour, time.minute),
            date: timeDate
          };
          nextPostTime = timeDate;
        }
      });
    });
    
    return nextPost;
  };
  
  const nextScheduledPost = getNextScheduledPost();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Керування ботом</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted p-3 rounded-md text-center">
            <div className="text-2xl font-bold">{activeChannelsCount}</div>
            <div className="text-sm text-muted-foreground">Активних каналів</div>
          </div>
          <div className="bg-muted p-3 rounded-md text-center">
            <div className="text-2xl font-bold">{totalPostsPerDay}</div>
            <div className="text-sm text-muted-foreground">Постів у день</div>
          </div>
          <div className="bg-muted p-3 rounded-md text-center">
            <div className="text-2xl font-bold">{totalScheduledTimes}</div>
            <div className="text-sm text-muted-foreground">Запланованих постів</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Статус бота:</span>
            <span className={`font-medium ${botStatus.isRunning ? 'text-green-600' : 'text-red-600'}`}>
              {botStatus.isRunning ? 'Активний' : 'Зупинений'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Поточна дія:</span>
            <span className="font-medium">{botStatus.currentAction}</span>
          </div>
          
          {nextScheduledPost && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar size={14} />
                Наступний пост:
              </span>
              <span className="font-medium">
                {nextScheduledPost.channelName} о {nextScheduledPost.time}
              </span>
            </div>
          )}
          
          {isGenerating && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
              Бот обробляє запити... Це може зайняти деякий час.
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-4">
        <Button
          variant={botStatus.isRunning ? "outline" : "default"}
          className={`w-full ${botStatus.isRunning ? "" : "bg-green-500 hover:bg-green-600"}`}
          onClick={startBot}
          disabled={botStatus.isRunning || activeChannelsCount === 0 || isGenerating}
        >
          <Play className="mr-2 h-4 w-4" />
          Запустити бот
        </Button>

        <Button
          variant="outline"
          className={`w-full ${botStatus.isRunning ? "text-red-500 border-red-500 hover:bg-red-50" : ""}`}
          onClick={stopBot}
          disabled={!botStatus.isRunning}
        >
          <Square className="mr-2 h-4 w-4" />
          Зупинити бот
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BotControls;
