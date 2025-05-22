
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Channel, ScheduleTime } from '@/types';
import { Plus, X, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatTime } from '@/lib/utils';

interface ScheduleSettingsProps {
  channel: Channel;
  onUpdate: (updatedChannel: Channel) => void;
}

const ScheduleSettings = ({ channel, onUpdate }: ScheduleSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const { toast } = useToast();

  const handleAddTime = () => {
    // Check if this time already exists in the schedule
    const timeExists = channel.schedule.some(
      time => time.hour === selectedHour && time.minute === selectedMinute
    );

    if (timeExists) {
      toast({
        title: "Час вже додано",
        description: "Цей час вже додано до розкладу",
        variant: "destructive"
      });
      return;
    }

    // Add the new time to the schedule
    const updatedSchedule = [...channel.schedule, { hour: selectedHour, minute: selectedMinute }];
    
    // Sort by hour and then by minute
    updatedSchedule.sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });
    
    onUpdate({
      ...channel,
      schedule: updatedSchedule
    });

    toast({
      title: "Розклад оновлено",
      description: `Час ${formatTime(selectedHour, selectedMinute)} додано до розкладу`,
    });
  };

  const handleRemoveTime = (index: number) => {
    const updatedSchedule = channel.schedule.filter((_, i) => i !== index);
    onUpdate({
      ...channel,
      schedule: updatedSchedule
    });

    toast({
      title: "Розклад оновлено",
      description: "Час видалено з розкладу",
    });
  };

  const handleAutoGenerateSchedule = () => {
    const postsPerDay = channel.postsPerDay;
    if (postsPerDay <= 0) {
      toast({
        title: "Помилка",
        description: "Кількість постів на день має бути більше 0",
        variant: "destructive"
      });
      return;
    }

    // Clear existing schedule
    const newSchedule: ScheduleTime[] = [];
    
    // Calculate interval between posts in hours
    const interval = 24 / postsPerDay;
    let startHour = 9; // Start at 9 AM
    
    for (let i = 0; i < postsPerDay; i++) {
      // Calculate posting time
      const hour = Math.floor(startHour + (i * interval)) % 24;
      const minute = Math.floor((startHour + (i * interval) - Math.floor(startHour + (i * interval))) * 60);
      
      newSchedule.push({ hour, minute });
    }
    
    onUpdate({
      ...channel,
      schedule: newSchedule
    });

    toast({
      title: "Розклад згенеровано",
      description: `Згенеровано ${postsPerDay} постів протягом дня`,
    });
  };

  // Generate hour options (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  
  // Generate minute options (0, 15, 30, 45)
  const minuteOptions = [0, 15, 30, 45];

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
        onClick={() => setIsOpen(true)}
      >
        <Clock size={16} />
        Розклад постів
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Налаштування розкладу</DialogTitle>
            <DialogDescription>
              Встановіть години, коли будуть публікуватись пости для каналу "{channel.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm">Поточний розклад</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {channel.schedule.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Розклад не налаштовано</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {channel.schedule.map((time, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm"
                      >
                        {formatTime(time.hour, time.minute)}
                        <button 
                          onClick={() => handleRemoveTime(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div>
              <h3 className="text-sm font-medium mb-2">Додати час:</h3>
              <div className="flex gap-2">
                <select 
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(Number(e.target.value))}
                  className="px-2 py-1 border rounded-md"
                >
                  {hourOptions.map(hour => (
                    <option key={hour} value={hour}>
                      {hour.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <span className="self-center">:</span>
                <select 
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(Number(e.target.value))}
                  className="px-2 py-1 border rounded-md"
                >
                  {minuteOptions.map(minute => (
                    <option key={minute} value={minute}>
                      {minute.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <Button size="sm" onClick={handleAddTime}>
                  <Plus size={14} className="mr-1" />
                  Додати
                </Button>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={handleAutoGenerateSchedule}>
                Згенерувати розклад автоматично
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsOpen(false)}>Закрити</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ScheduleSettings;
