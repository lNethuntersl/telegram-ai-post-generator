
import React from 'react';
import BotControls from './BotControls';
import StatusMonitor from './StatusMonitor';
import Statistics from './Statistics';
import PromptSettings from './PromptSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import ChannelsList from './ChannelsList';

const Dashboard = () => {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <StatusMonitor />
        </div>
        <div className="lg:col-span-1">
          <BotControls />
        </div>
      </div>

      <Tabs defaultValue="channels" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="channels">Канали</TabsTrigger>
          <TabsTrigger value="prompts">Промпти</TabsTrigger>
          <TabsTrigger value="statistics">Статистика</TabsTrigger>
        </TabsList>
        <TabsContent value="channels">
          <ChannelsList />
        </TabsContent>
        <TabsContent value="prompts">
          <PromptSettings />
        </TabsContent>
        <TabsContent value="statistics">
          <Statistics />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
