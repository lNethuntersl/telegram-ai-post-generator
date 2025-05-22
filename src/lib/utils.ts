
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function formatDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

// Function to send message to Telegram
export async function sendTelegramMessage(botToken: string, chatId: string, text: string, imageUrl?: string): Promise<any> {
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API Error: ${errorData.description || 'Unknown error'}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

// Function to send photo with caption to Telegram
export async function sendTelegramPhoto(botToken: string, chatId: string, imageUrl: string, caption: string): Promise<any> {
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  
  const payload = {
    chat_id: chatId,
    photo: imageUrl,
    caption: caption,
    parse_mode: 'HTML',
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API Error: ${errorData.description || 'Unknown error'}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending Telegram photo:', error);
    throw error;
  }
}
