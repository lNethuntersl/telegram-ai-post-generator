
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

// Function to validate Telegram credentials
export function validateTelegramCredentials(botToken: string, chatId: string): boolean {
  if (!botToken || !chatId) return false;
  
  // Basic validation for bot token (should be in format 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
  const botTokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
  if (!botTokenPattern.test(botToken)) return false;
  
  // Chat ID can be a number (group/channel ID) or username (@username)
  const chatIdPattern = /^-?\d+$|^@[A-Za-z0-9_]+$/;
  if (!chatIdPattern.test(chatId)) return false;
  
  return true;
}

// Improved function to send message to Telegram with better error handling
export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<any> {
  if (!validateTelegramCredentials(botToken, chatId)) {
    throw new Error('Invalid bot token or chat ID format');
  }
  
  console.log(`Sending message to Telegram with bot token ${botToken.substring(0, 5)}... and chat ID ${chatId}`);
  
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
  };

  try {
    console.log('Making API request to Telegram:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log('Telegram API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Telegram API error response:', errorData);
      
      try {
        const parsedError = JSON.parse(errorData);
        throw new Error(`Telegram API Error [${response.status}]: ${parsedError.description || 'Unknown error'}`);
      } catch (e) {
        throw new Error(`Telegram API Error [${response.status}]: ${errorData || 'Unknown error'}`);
      }
    }

    const data = await response.json();
    console.log('Telegram API success response:', data);
    return data;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

// Improved function to send photo with caption to Telegram
export async function sendTelegramPhoto(botToken: string, chatId: string, imageUrl: string, caption: string): Promise<any> {
  if (!validateTelegramCredentials(botToken, chatId)) {
    throw new Error('Invalid bot token or chat ID format');
  }
  
  console.log(`Sending photo to Telegram with bot token ${botToken.substring(0, 5)}... and chat ID ${chatId}`);
  
  const apiUrl = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  
  const payload = {
    chat_id: chatId,
    photo: imageUrl,
    caption: caption,
    parse_mode: 'HTML',
  };

  try {
    console.log('Making photo API request to Telegram:', apiUrl);
    console.log('Using photo URL:', imageUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log('Telegram photo API response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Telegram API error response for photo:', errorData);
      
      try {
        const parsedError = JSON.parse(errorData);
        throw new Error(`Telegram API Error [${response.status}]: ${parsedError.description || 'Unknown error'}`);
      } catch (e) {
        throw new Error(`Telegram API Error [${response.status}]: ${errorData || 'Unknown error'}`);
      }
    }

    const data = await response.json();
    console.log('Telegram photo API success response:', data);
    return data;
  } catch (error) {
    console.error('Error sending Telegram photo:', error);
    throw error;
  }
}
