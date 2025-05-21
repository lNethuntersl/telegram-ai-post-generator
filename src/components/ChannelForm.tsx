
import React, { useState, useEffect } from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Channel } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { X, Plus, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChannelFormProps {
  editChannel?: Channel;
  onClose?: () => void;
  isEdit?: boolean;
}

const ChannelForm = ({ editChannel, onClose, isEdit = false }: ChannelFormProps) => {
  const { addChannel, updateChannel } = useChannelContext();
  const [name, setName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [userId, setUserId] = useState('');
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [promptTemplate, setPromptTemplate] = useState('');
  const [grokApiKey, setGrokApiKey] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (editChannel) {
      setName(editChannel.name);
      setBotToken(editChannel.botToken);
      setChatId(editChannel.chatId);
      setUserId(editChannel.userId);
      setPostsPerDay(editChannel.postsPerDay);
      setPromptTemplate(editChannel.promptTemplate);
      setGrokApiKey(editChannel.grokApiKey || '');
    }
  }, [editChannel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const channelData = {
      name,
      botToken,
      chatId,
      userId,
      postsPerDay,
      promptTemplate,
      grokApiKey: grokApiKey || undefined,
    };

    if (isEdit && editChannel) {
      updateChannel({
        ...editChannel,
        ...channelData
      });
    } else {
      addChannel(channelData);
    }

    // Reset form
    if (!isEdit) {
      setName('');
      setBotToken('');
      setChatId('');
      setUserId('');
      setPostsPerDay(1);
      setPromptTemplate('');
      setGrokApiKey('');
    }

    setIsOpen(false);
    if (onClose) onClose();
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Назва каналу</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введіть назву каналу"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="botToken">Токен бота</Label>
        <Input
          id="botToken"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="Введіть токен бота"
          required
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="chatId">Chat ID</Label>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <Info className="h-4 w-4" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">Chat ID - ідентифікатор чату</h4>
                <p className="text-sm text-muted-foreground">
                  Унікальний ідентифікатор чату або каналу в Telegram, куди бот надсилатиме повідомлення. 
                  Можна отримати через @getidsbot в Telegram.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <Input
          id="chatId"
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Введіть Chat ID"
          required
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="userId">User ID</Label>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <Info className="h-4 w-4" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">User ID - ідентифікатор користувача</h4>
                <p className="text-sm text-muted-foreground">
                  Унікальний ідентифікатор вашого облікового запису в Telegram. 
                  Можна отримати через @getidsbot в Telegram.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <Input
          id="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Введіть User ID"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="postsPerDay">Кількість постів у день</Label>
        <Input
          id="postsPerDay"
          type="number"
          min={1}
          max={100}
          value={postsPerDay}
          onChange={(e) => setPostsPerDay(Number(e.target.value))}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="promptTemplate">Шаблон промпту для ШІ</Label>
        <Textarea
          id="promptTemplate"
          value={promptTemplate}
          onChange={(e) => setPromptTemplate(e.target.value)}
          placeholder="Напишіть шаблон промпту для генерації постів"
          rows={5}
          required
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="grokApiKey">Grok API ключ (опціонально)</Label>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <Info className="h-4 w-4" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">Grok API ключ</h4>
                <p className="text-sm text-muted-foreground">
                  Опціональний API ключ для використання моделі Grok замість стандартного ШІ сервісу.
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <Input
          id="grokApiKey"
          value={grokApiKey}
          onChange={(e) => setGrokApiKey(e.target.value)}
          placeholder="Введіть Grok API ключ (опціонально)"
        />
      </div>
      
      <Button type="submit" className="w-full">
        {isEdit ? 'Оновити канал' : 'Додати канал'}
      </Button>
    </form>
  );

  if (isEdit) {
    return formContent;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button className="flex gap-2">
          <Plus size={16} />
          <span>Додати канал</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Додати новий канал</SheetTitle>
          <SheetDescription>
            Додайте інформацію про новий телеграм канал для автоматичної генерації контенту
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-180px)] pr-4">
          <div className="py-4">
            {formContent}
          </div>
        </ScrollArea>
        <SheetFooter className="mt-2">
          <SheetClose asChild>
            <Button variant="outline" type="button">
              Скасувати
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ChannelForm;
