
import React, { useState } from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoIcon } from 'lucide-react';

const PromptSettings = () => {
  const { channels, updateChannel } = useChannelContext();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [promptTemplate, setPromptTemplate] = useState<string>("");
  const { toast } = useToast();

  const selectedChannel = channels.find(channel => channel.id === selectedChannelId);

  // Завантаження шаблону промпту при виборі каналу
  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
    const channel = channels.find(ch => ch.id === channelId);
    if (channel) {
      setPromptTemplate(channel.promptTemplate);
    } else {
      setPromptTemplate("");
    }
  };

  // Збереження змін для каналу
  const handleSavePrompt = () => {
    if (!selectedChannel) return;
    
    updateChannel({
      ...selectedChannel,
      promptTemplate
    });
    
    toast({
      title: "Промпт збережено",
      description: `Шаблон промпту оновлено для каналу "${selectedChannel.name}"`,
    });
  };

  // Приклади підказок для промптів
  const promptExamples = [
    "Створи інформативний пост про {{тема}} з актуальними даними та цікавими фактами. Використовуй неформальний стиль та додай емодзі.",
    "Напиши короткий пост для соціальних мереж про {{тема}}. Включи 3 ключові факти та заклик до дії в кінці.",
    "Підготуй освітній пост про {{тема}}. Розбий інформацію на пункти з емодзі та додай цікавий висновок."
  ];

  // Додавання прикладу промпту
  const addExamplePrompt = (example: string) => {
    setPromptTemplate(prev => prev + (prev ? '\n\n' : '') + example);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Налаштування промптів для ШІ</CardTitle>
        <CardDescription>
          Налаштуйте шаблони промптів для кожного з ваших каналів
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="channel-select">Оберіть канал</Label>
          <Select 
            value={selectedChannelId} 
            onValueChange={handleChannelSelect}
          >
            <SelectTrigger id="channel-select">
              <SelectValue placeholder="Оберіть канал для налаштування" />
            </SelectTrigger>
            <SelectContent>
              {channels.map(channel => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedChannelId && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="prompt-template">Шаблон промпту</Label>
                <div className="text-xs text-muted-foreground">
                  Використовуйте {"{{тема}}"} для позначення місця для вставки змінних
                </div>
              </div>
              <Textarea
                id="prompt-template"
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                placeholder="Введіть шаблон промпту для генерації контенту"
                rows={8}
              />
            </div>

            <div className="bg-muted/50 p-4 rounded-md space-y-3">
              <div className="flex items-start gap-2">
                <InfoIcon className="min-w-4 text-blue-500 mt-0.5" size={16} />
                <div className="text-sm">
                  <p className="font-medium">Підказки для ефективного промпту:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                    <li>Вказуйте конкретні теми</li>
                    <li>Визначайте стиль та тон</li>
                    <li>Додавайте інструкції щодо структури та форматування</li>
                    <li>Зазначте довжину потрібного тексту</li>
                    <li>Вказуйте цільову аудиторію</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Приклади промптів</Label>
              <div className="grid gap-2">
                {promptExamples.map((example, index) => (
                  <Button 
                    key={index} 
                    variant="outline" 
                    className="h-auto py-2 justify-start font-normal text-left"
                    onClick={() => addExamplePrompt(example)}
                  >
                    <span className="line-clamp-2 text-sm">{example}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={handleSavePrompt} className="w-full">
              Зберегти промпт
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PromptSettings;
