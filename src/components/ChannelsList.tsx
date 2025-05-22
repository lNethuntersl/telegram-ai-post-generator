
import React, { useState } from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Channel } from '@/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import ChannelForm from './ChannelForm';
import ScheduleSettings from './ScheduleSettings';
import { Edit, Trash2, Settings, Play, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ChannelsList = () => {
  const { channels, deleteChannel, updateChannel, generateTestPost } = useChannelContext();
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isGeneratingTestPost, setIsGeneratingTestPost] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDeleteClick = (channel: Channel) => {
    setChannelToDelete(channel);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (channelToDelete) {
      deleteChannel(channelToDelete.id);
    }
    setDeleteDialogOpen(false);
  };

  const handleEditClick = (channel: Channel) => {
    setEditingChannel(channel);
    setEditDialogOpen(true);
  };

  const handleStatusToggle = (channel: Channel, isActive: boolean) => {
    updateChannel({
      ...channel,
      isActive
    });
  };

  const handleScheduleUpdate = (updatedChannel: Channel) => {
    updateChannel(updatedChannel);
  };

  const handleTestPost = async (channel: Channel) => {
    setIsGeneratingTestPost(channel.id);
    try {
      await generateTestPost(channel.id);
      toast({
        title: "Тестовий пост",
        description: `Тестовий пост для каналу "${channel.name}" згенеровано та надіслано`,
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: `Не вдалося згенерувати тестовий пост: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTestPost(null);
    }
  };

  if (channels.length === 0) {
    return (
      <Card className="text-center p-8">
        <CardHeader>
          <CardTitle>Немає доданих каналів</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Додайте ваш перший телеграм канал, щоб почати генерацію контенту</p>
        </CardContent>
        <CardFooter className="justify-center pt-4">
          <ChannelForm />
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Ваші канали</h2>
        <ChannelForm />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {channels.map((channel) => (
          <Card key={channel.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{channel.name}</CardTitle>
                <Badge variant={channel.isActive ? "default" : "outline"}>
                  {channel.isActive ? 'Активний' : 'Неактивний'}
                </Badge>
              </div>
              <CardDescription className="truncate">
                Chat ID: {channel.chatId}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Постів у день:</span>
                  <span className="font-medium">{channel.postsPerDay}</span>
                </div>
                <div className="text-sm">
                  <p className="text-muted-foreground mb-1">Промпт:</p>
                  <p className="line-clamp-2">{channel.promptTemplate}</p>
                </div>
                
                {/* Display schedule */}
                <div className="text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground mb-1">
                    <Calendar size={14} />
                    <span>Розклад:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {channel.schedule && channel.schedule.length > 0 ? (
                      channel.schedule.map((time, idx) => (
                        <span key={idx} className="bg-muted px-2 py-0.5 rounded-md text-xs">
                          {time.hour.toString().padStart(2, '0')}:{time.minute.toString().padStart(2, '0')}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">Не налаштовано</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 pt-2">
              <div className="flex justify-between w-full">
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={channel.isActive} 
                    onCheckedChange={(checked) => handleStatusToggle(channel, checked)}
                    id={`status-${channel.id}`}
                  />
                  <Label htmlFor={`status-${channel.id}`}>
                    {channel.isActive ? 'Активний' : 'Вимкнено'}
                  </Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEditClick(channel)}>
                    <Edit size={16} />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteClick(channel)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
              
              <div className="flex w-full justify-between gap-2 mt-2">
                <ScheduleSettings channel={channel} onUpdate={handleScheduleUpdate} />
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-1"
                  onClick={() => handleTestPost(channel)}
                  disabled={isGeneratingTestPost === channel.id}
                >
                  <Play size={16} />
                  {isGeneratingTestPost === channel.id ? 'Генерація...' : 'Тестовий пост'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Діалог редагування каналу */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редагувати канал</DialogTitle>
            <DialogDescription>
              Внесіть зміни до даних каналу
            </DialogDescription>
          </DialogHeader>
          {editingChannel && (
            <ChannelForm
              editChannel={editingChannel}
              onClose={() => setEditDialogOpen(false)}
              isEdit
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Діалог підтвердження видалення */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити канал?</DialogTitle>
            <DialogDescription>
              Ця дія не може бути скасована. Канал "{channelToDelete?.name}" буде назавжди видалено.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Скасувати</Button>
            <Button variant="destructive" onClick={confirmDelete}>Видалити</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChannelsList;
