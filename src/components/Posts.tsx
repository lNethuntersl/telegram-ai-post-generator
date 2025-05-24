import React, { useState, useEffect } from 'react';
import { useDatabaseChannelContext } from '@/context/DatabaseChannelContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Post } from '@/types';
import { RefreshCw, AlertTriangle, Edit, Trash2, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const Posts = () => {
  const { channels, botLogs, publishPost, deletePost, updatePost, refreshData } = useDatabaseChannelContext();
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [showLogs, setShowLogs] = useState(false);
  const { toast } = useToast();
  
  // States for post editing
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editedText, setEditedText] = useState('');
  const [editedImageUrl, setEditedImageUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State for delete confirmation
  const [isDeletingPost, setIsDeletingPost] = useState<Post | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
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

  // Force refresh state to trigger re-rendering when new posts are generated
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 30000); // Check for updates every 30 seconds
    
    return () => clearInterval(interval);
  }, [refreshData]);

  useEffect(() => {
    // Log post counts every time they change
    console.log(`Posts available: ${allPosts.length}, Filtered: ${filteredPosts.length}`);
  }, [allPosts.length, filteredPosts.length]);

  const refreshPosts = () => {
    setIsRefreshing(true);
    refreshData().finally(() => {
      setIsRefreshing(false);
      toast({
        title: "Пости оновлено",
        description: `Всього постів: ${allPosts.length}`
      });
    });
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

  const handleEditClick = (post: Post) => {
    setEditingPost(post);
    setEditedText(post.text);
    setEditedImageUrl(post.imageUrl);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    
    setIsProcessing(true);
    
    try {
      const updatedPost = {
        ...editingPost,
        text: editedText,
        imageUrl: editedImageUrl,
        // Reset status if it was failed
        status: editingPost.status === 'failed' ? 'generated' : editingPost.status
      };
      
      await updatePost(updatedPost);
      
      toast({
        title: "Пост оновлено",
        description: "Зміни успішно збережено"
      });
      
      setIsEditDialogOpen(false);
      setEditingPost(null);
    } catch (error) {
      toast({
        title: "Помилка",
        description: `Не вдалося оновити пост: ${error instanceof Error ? error.message : 'Невідома помилка'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClick = (post: Post) => {
    setIsDeletingPost(post);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!isDeletingPost) return;
    
    setIsProcessing(true);
    
    try {
      await deletePost(isDeletingPost.id, isDeletingPost.channelId);
      
      toast({
        title: "Пост видалено",
        description: "Пост успішно видалено"
      });
      
      setIsDeleteDialogOpen(false);
      setIsDeletingPost(null);
    } catch (error) {
      toast({
        title: "Помилка",
        description: `Не вдалося видалити пост: ${error instanceof Error ? error.message : 'Невідома помилка'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePublishNowClick = async (post: Post) => {
    // Create a type guard to help TypeScript understand the status check
    if (post.status === "published" as Post['status']) {
      toast({
        title: "Інформація",
        description: "Цей пост вже опубліковано"
      });
      return;
    }
    
    try {
      setIsProcessing(true);
      
      await publishPost(post);
      
      toast({
        title: "Успіх",
        description: "Пост успішно опубліковано в Telegram"
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: `Не вдалося опублікувати пост: ${error instanceof Error ? error.message : 'Невідома помилка'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
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
                Оновлено: {formatDateTime(lastRefreshed.toISOString())}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLogs(!showLogs)}
                className={showLogs ? "bg-primary text-primary-foreground" : ""}
              >
                {showLogs ? "Сховати логи" : "Показати логи"}
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
                  <ScrollArea className="h-[300px] border rounded-md p-4 bg-gray-50">
                    {botLogs.length > 0 ? (
                      botLogs.map((log, index) => (
                        <div key={index} className={`mb-1 text-sm ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-green-500' : log.type === 'warning' ? 'text-amber-600' : 'text-gray-700'}`}>
                          <span className="font-mono text-xs">[{formatDateTime(log.timestamp)}]</span> {log.message}
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
          
          {/* Display a help alert if there are failed posts */}
          {filteredPosts.some(p => p.status === 'failed') && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Виявлено помилки публікації</AlertTitle>
              <AlertDescription>
                Перевірте правильність та формат Bot Token і Chat ID в налаштуваннях каналів.
                <ul className="list-disc pl-5 mt-2 text-sm">
                  <li>Bot Token має формат: 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11</li>
                  <li>Chat ID має бути числом (наприклад -1001234567890) або назвою каналу з @ (наприклад @mychannel)</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {filteredPosts.length > 0 ? (
            <div className="space-y-4">
              {filteredPosts.map((post: Post & { channelName?: string }) => (
                <Card key={post.id} className={`overflow-hidden ${post.status === 'failed' ? 'border-red-300' : ''}`}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{post.channelName || 'Канал'}</h3>
                        <p className="text-xs text-muted-foreground">
                          Створено: {formatDateTime(post.createdAt)}
                        </p>
                        {post.publishedAt && (
                          <p className="text-xs text-green-600">
                            Опубліковано: {formatDateTime(post.publishedAt)}
                          </p>
                        )}
                        {post.telegramPostId && (
                          <p className="text-xs text-blue-600">
                            Telegram ID: {post.telegramPostId}
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
                    {post.imageUrl && post.imageUrl !== "https://via.placeholder.com/500" && (
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
                        <p className="font-medium mb-1">Помилка:</p>
                        <p className="font-mono text-xs">{post.error}</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex gap-1 items-center"
                      onClick={() => handleEditClick(post)}
                      disabled={isProcessing}
                    >
                      <Edit className="h-4 w-4" /> Редагувати
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex gap-1 items-center text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteClick(post)}
                      disabled={isProcessing}
                    >
                      <Trash2 className="h-4 w-4" /> Видалити
                    </Button>
                    {post.status !== "published" as Post['status'] && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex gap-1 items-center"
                        onClick={() => handlePublishNowClick(post)}
                        disabled={isProcessing || post.status === "published" as Post['status']}
                      >
                        <Send className="h-4 w-4" /> Опублікувати зараз
                      </Button>
                    )}
                  </CardFooter>
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

      {/* Edit Post Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Редагувати пост</DialogTitle>
            <DialogDescription>
              Внесіть зміни у текст або посилання на зображення для поста
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="text">Текст поста</label>
                <Textarea 
                  id="text" 
                  value={editedText} 
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={6} 
                  className="resize-none"
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <label htmlFor="imageUrl">Посилання на зображення</label>
                <Input 
                  id="imageUrl" 
                  value={editedImageUrl} 
                  onChange={(e) => setEditedImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg" 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isProcessing}
            >
              Скасувати
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={isProcessing || !editedText.trim()}
            >
              {isProcessing ? "Зберігаємо..." : "Зберегти зміни"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Post Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Підтвердіть видалення</DialogTitle>
            <DialogDescription>
              Ви впевнені, що хочете видалити цей пост? Це дія не може бути скасована.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isProcessing}
            >
              Скасувати
            </Button>
            <Button 
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isProcessing}
            >
              {isProcessing ? "Видаляємо..." : "Так, видалити"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Posts;
