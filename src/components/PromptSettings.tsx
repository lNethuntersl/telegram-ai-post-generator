
import React, { useState } from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const PromptSettings = () => {
  const { channels, updateChannel } = useChannelContext();
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [promptTemplate, setPromptTemplate] = useState<string>("");
  const [grokApiKey, setGrokApiKey] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);
  const { toast } = useToast();

  const selectedChannel = channels.find(channel => channel.id === selectedChannelId);

  // Load prompt template and API key when selecting a channel
  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
    const channel = channels.find(ch => ch.id === channelId);
    if (channel) {
      setPromptTemplate(channel.promptTemplate || "");
      setGrokApiKey(channel.grokApiKey || "");
    } else {
      setPromptTemplate("");
      setGrokApiKey("");
    }
  };

  // Save changes to the channel
  const handleSavePrompt = () => {
    if (!selectedChannel) return;
    
    setIsSaving(true);
    setSaveProgress(25);
    
    // Simulate saving process
    setTimeout(() => {
      setSaveProgress(50);
      
      setTimeout(() => {
        setSaveProgress(75);
        
        setTimeout(() => {
          setSaveProgress(100);
          
          updateChannel({
            ...selectedChannel,
            promptTemplate,
            grokApiKey: grokApiKey.trim() || undefined
          });
          
          toast({
            title: "Налаштування збережено",
            description: `Налаштування промпту та Grok API ключ оновлено для каналу "${selectedChannel.name}"`,
            variant: "success"
          });
          
          setIsSaving(false);
          setSaveProgress(0);
        }, 300);
      }, 300);
    }, 300);
  };

  // Prompt examples
  const promptExamples = [
    "Створи інформативний пост про {{тема}} з актуальними даними та цікавими фактами. Використовуй неформальний стиль та додай емодзі.",
    "Напиши короткий пост для соціальних мереж про {{тема}}. Включи 3 ключові факти та заклик до дії в кінці.",
    "Підготуй освітній пост про {{тема}}. Розбий інформацію на пункти з емодзі та додай цікавий висновок."
  ];

  // Add example prompt
  const addExamplePrompt = (example: string) => {
    setPromptTemplate(prev => prev + (prev ? '\n\n' : '') + example);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Налаштування промптів для ШІ</CardTitle>
        <CardDescription>
          Налаштуйте шаблони промптів та API ключі для кожного з ваших каналів
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
              <Label htmlFor="grok-api-key">Grok API ключ</Label>
              <Input
                id="grok-api-key"
                type="password"
                value={grokApiKey}
                onChange={(e) => setGrokApiKey(e.target.value)}
                placeholder="Введіть ваш Grok API ключ"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                API ключ потрібен для генерації контенту. Без дійсного ключа генерація не працюватиме.
              </p>
            </div>

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

            {isSaving && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Зберігаємо налаштування...</span>
                  <span>{saveProgress}%</span>
                </div>
                <Progress value={saveProgress} className="h-2" />
              </div>
            )}

            <Button onClick={handleSavePrompt} className="w-full" disabled={isSaving}>
              {isSaving ? "Зберігаємо..." : "Зберегти налаштування"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PromptSettings;
