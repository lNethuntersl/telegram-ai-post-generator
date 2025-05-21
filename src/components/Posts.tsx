
import React, { useState, useEffect } from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Post } from '@/types';
import { RefreshCw, HistoryIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Posts = () => {
  const { channels, botLogs } = useChannelContext();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [showLogs, setShowLogs] = useState(false);
  
  // Get all posts from all channels or filter by selected channel
  const allPosts = channels.flatMap(channel => 
    channel.lastPosts.map(post => ({
      ...post,
      channelName: channel.name
    }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const filteredPosts = selectedChannelId 
    ? allPosts.filter(post => post.channelId === selectedChannelId)
    : allPosts;

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMMM yyyy, HH:mm:ss', { locale: uk });
    } catch (e) {
      return 'Невідома дата';
    }
  };

  // Force refresh state to trigger re-rendering when new posts are generated
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefreshed(new Date());
    }, 5000); // Check for updates every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const refreshPosts = () => {
    setIsRefreshing(true);
    // Simply updating the refresh timestamp will trigger a re-render
    setTimeout(() => {
      setLastRefreshed(new Date());
      setIsRefreshing(false);
    }, 500);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'generated': return 'bg-blue-500';
      case 'published': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return '';
    }
  };

  const postStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Очікує';
      case 'generated': return 'Згенеровано';
      case 'published': return 'Опубліковано';
      case 'failed': return 'Помилка';
      default: return status;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle>Згенеровані пости</CardTitle>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={refreshPosts} 
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <span className="text-xs text-muted-foreground">
              Оновлено: {formatDate(lastRefreshed.toISOString())}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogs(!showLogs)}
              className={showLogs ? "bg-primary text-primary-foreground" : ""}
            >
              Показати логи
            </Button>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedChannelId(null)}
              className={!selectedChannelId ? "bg-primary text-primary-foreground" : ""}
            >
              Всі канали
            </Button>
            {channels.map(channel => (
              <Button 
                key={channel.id} 
                variant="outline" 
                size="sm" 
                onClick={() => setSelectedChannelId(channel.id)}
                className={selectedChannelId === channel.id ? "bg-primary text-primary-foreground" : ""}
              >
                {channel.name}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {showLogs && (
          <Accordion type="single" collapsible className="mb-6">
            <AccordionItem value="logs">
              <AccordionTrigger>Системні логи операцій</AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="h-[200px] border rounded-md p-4 bg-gray-50">
                  {botLogs.length > 0 ? (
                    botLogs.map((log, index) => (
                      <div key={index} className={`mb-1 text-sm ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : 'text-gray-700'}`}>
                        <span className="font-mono text-xs">[{formatDate(log.timestamp)}]</span> {log.message}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">Немає доступних логів</p>
                  )}
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        
        {filteredPosts.length > 0 ? (
          <div className="space-y-4">
            {filteredPosts.map((post: Post & { channelName?: string }) => (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{post.channelName || 'Канал'}</h3>
                      <p className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</p>
                      {post.publishedAt && (
                        <p className="text-xs text-green-600">
                          Опубліковано: {formatDate(post.publishedAt)}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusBadgeColor(post.status)}>
                      {postStatusText(post.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="whitespace-pre-wrap text-sm">{post.text}</div>
                  {post.imageUrl && (
                    <div className="mt-2">
                      <img 
                        src={post.imageUrl} 
                        alt="Зображення для поста" 
                        className="rounded-md max-h-48 object-cover"
                      />
                    </div>
                  )}
                  {post.error && (
                    <div className="mt-2 text-sm text-red-500 p-2 border border-red-200 bg-red-50 rounded">
                      Помилка: {post.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">Ще немає згенерованих постів</p>
            <p className="text-sm text-muted-foreground mt-1">
              Постів з'являться тут після їх генерації ботом
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Posts;
