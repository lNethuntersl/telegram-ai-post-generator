
import React from 'react';
import { useChannelContext } from '@/context/ChannelContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const Statistics = () => {
  const { statistics, channels } = useChannelContext();

  // Підготуємо дані для графіка по днях
  const chartData = statistics.dailyStats.slice(-7).map(day => ({
    name: new Date(day.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
    Згенеровано: day.generated,
    Опубліковано: day.published,
  }));

  // Підготуємо дані для статистики по каналах
  const channelStatsData = statistics.postsByChannel.map(stat => {
    const channel = channels.find(c => c.id === stat.channelId);
    return {
      name: channel ? channel.name : 'Невідомий канал',
      channelId: stat.channelId,
      generated: stat.generated,
      published: stat.published,
    };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Загальна статистика</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-muted p-4 rounded-md text-center">
              <div className="text-3xl font-bold">{statistics.totalPostsGenerated}</div>
              <div className="text-sm text-muted-foreground">Згенеровано постів</div>
            </div>
            <div className="bg-muted p-4 rounded-md text-center">
              <div className="text-3xl font-bold">{statistics.totalPostsPublished}</div>
              <div className="text-sm text-muted-foreground">Опубліковано постів</div>
            </div>
          </div>

          <div className="h-[300px] mt-6">
            <h3 className="text-lg font-medium mb-2">Активність за останній тиждень</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Згенеровано" fill="#4f46e5" />
                  <Bar dataKey="Опубліковано" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full bg-muted/50 rounded-md">
                <p className="text-muted-foreground">Недостатньо даних для відображення графіка</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Статистика по каналах</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {channelStatsData.length > 0 ? (
              channelStatsData.map(stat => (
                <div key={stat.channelId} className="py-3">
                  <h4 className="font-medium">{stat.name}</h4>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="bg-muted/50 p-2 rounded text-center">
                      <div className="text-lg font-medium">{stat.generated}</div>
                      <div className="text-xs text-muted-foreground">Згенеровано</div>
                    </div>
                    <div className="bg-muted/50 p-2 rounded text-center">
                      <div className="text-lg font-medium">{stat.published}</div>
                      <div className="text-xs text-muted-foreground">Опубліковано</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-muted-foreground">
                Ще немає статистики по каналах
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Statistics;
