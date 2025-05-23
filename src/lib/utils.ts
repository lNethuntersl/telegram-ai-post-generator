
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

// Timeout handling for fetch requests
export function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000): Promise<Response> {
  return new Promise(async (resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeout}ms`));
    }, timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      resolve(response);
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

// Improved function to validate Telegram credentials with better checks
export function validateTelegramCredentials(botToken: string, chatId: string): boolean {
  if (!botToken || !chatId) {
    console.log("validateTelegramCredentials: Missing bot token or chat ID");
    return false;
  }
  
  // Basic validation for bot token (should be in format 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
  const botTokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
  if (!botTokenPattern.test(botToken)) {
    console.log("validateTelegramCredentials: Invalid bot token format");
    return false;
  }
  
  // Chat ID can be a number (group/channel ID) or username (@username)
  const chatIdPattern = /^-?\d+$|^@[A-Za-z0-9_]+$/;
  if (!chatIdPattern.test(chatId)) {
    console.log("validateTelegramCredentials: Invalid chat ID format");
    return false;
  }
  
  return true;
}

// Enhanced function to send message to Telegram with improved error handling and timeouts
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
    
    // Use fetchWithTimeout for better error handling
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 30000); // 30-second timeout
    
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
    if (error.name === 'AbortError') {
      console.error('Request timed out after 30 seconds');
      throw new Error('Telegram API request timed out after 30 seconds');
    }
    
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

// Enhanced function to send photo with caption to Telegram with timeout
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
    
    // Use fetchWithTimeout for better error handling
    const response = await fetchWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 30000); // 30-second timeout
    
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
    if (error.name === 'AbortError') {
      console.error('Request timed out after 30 seconds');
      throw new Error('Telegram API request timed out after 30 seconds');
    }
    
    console.error('Error sending Telegram photo:', error);
    throw error;
  }
}
