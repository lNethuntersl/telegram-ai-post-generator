
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addLog(message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info', details?: any) {
  await supabase.from('bot_logs').insert({
    message,
    type,
    details
  });
  console.log(`[${type.toUpperCase()}] ${message}`, details || '');
}

async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });
  return await response.json();
}

async function sendTelegramPhoto(botToken: string, chatId: string, imageUrl: string, caption: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: imageUrl,
      caption: caption,
      parse_mode: 'HTML'
    })
  });
  return await response.json();
}

async function generateAIImage(prompt: string): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return `https://placehold.co/600x400/1a1a1a/ffffff?text=${encodeURIComponent('AI Image')}`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: `Create a professional image for cryptocurrency/crypto content: ${prompt}. Style: modern, clean, financial, technological`,
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      })
    });

    const data = await response.json();
    return data.data?.[0]?.url || `https://placehold.co/600x400/1a1a1a/ffffff?text=${encodeURIComponent('Crypto')}`;
  } catch (error) {
    console.error('AI image generation error:', error);
    return `https://placehold.co/600x400/1a1a1a/ffffff?text=${encodeURIComponent('Crypto')}`;
  }
}

async function generateContentWithGrok(prompt: string, grokApiKey?: string): Promise<string> {
  if (!grokApiKey) {
    return generateCryptoContent(prompt);
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'Ти експерт з криптовалют. Створюй короткі, інформативні пости про криптовалюти українською мовою. Використовуй емодзі, але не вказуй дату та час.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'grok-beta',
        stream: false,
        temperature: 0.7
      })
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || generateCryptoContent(prompt);
  } catch (error) {
    console.error('Grok API error:', error);
    return generateCryptoContent(prompt);
  }
}

function generateCryptoContent(prompt: string): string {
  const cryptoContents = [
    `🚀 КРИПТОНОВИНИ\n\nБіткоїн показує стабільне зростання, прориваючи ключові рівні опору. Аналітики прогнозують продовження бичачого тренду.\n\n📊 Ключові рівні:\n• Підтримка: $42,000\n• Опір: $45,000\n• Обсяг: +25% за добу\n\n#Bitcoin #Crypto #BTC`,
    
    `⚡ ETHEREUM ОНОВЛЕННЯ\n\nМережа Ethereum демонструє рекордну активність з новими DeFi протоколами:\n\n🔥 Показники:\n• Gas fees знизились на 30%\n• TVL зросла до $40 млрд\n• Нові проекти: +15 за тиждень\n\n#Ethereum #DeFi #ETH`,
    
    `📈 АЛЬТКОЇНИ У ФОКУСІ\n\nТоп альткоїни тижня показують сильне зростання:\n\n1️⃣ Solana: +22%\n2️⃣ Cardano: +18%\n3️⃣ Polygon: +15%\n\nІнвестори переключаються на проекти з реальною корисністю та сильними фундаментальними показниками.\n\n#Altcoins #SOL #ADA #MATIC`,
    
    `🔮 АНАЛІЗ РИНКУ\n\nКриптовалютний ринок входить у фазу консолідації після останнього ралі:\n\n📊 Технічний аналіз:\n• RSI: 65 (нейтральна зона)\n• Moving Average: бичача\n• Volume Profile: зростаючий\n\nОчікується прорив протягом наступних тижнів.\n\n#Analysis #Trading #Crypto`
  ];
  
  return cryptoContents[Math.floor(Math.random() * cryptoContents.length)];
}

async function generateDailyPosts() {
  await addLog('Початок генерації денних постів', 'info');
  
  const { data: channels, error } = await supabase
    .from('channels')
    .select(`
      *,
      channel_schedules (hour, minute)
    `)
    .eq('is_active', true);

  if (error || !channels) {
    await addLog('Помилка завантаження активних каналів', 'error', error);
    return;
  }

  for (const channel of channels) {
    if (!channel.channel_schedules || channel.channel_schedules.length === 0) {
      continue;
    }

    // Check how many posts we already have for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('channel_id', channel.id)
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .eq('status', 'generated');

    const postsNeeded = channel.channel_schedules.length - (existingPosts?.length || 0);
    
    if (postsNeeded <= 0) {
      await addLog(`Канал "${channel.name}" вже має достатньо постів на сьогодні`, 'info');
      continue;
    }

    // Generate missing posts
    for (let i = 0; i < postsNeeded; i++) {
      try {
        const content = await generateContentWithGrok(channel.prompt_template || 'Створи пост про криптовалюти', channel.grok_api_key);
        const imageUrl = await generateAIImage(content.substring(0, 100));
        
        const { error: insertError } = await supabase
          .from('posts')
          .insert({
            channel_id: channel.id,
            text: content,
            image_url: imageUrl,
            status: 'generated'
          });

        if (insertError) {
          await addLog(`Помилка збереження поста для каналу "${channel.name}"`, 'error', insertError);
        } else {
          await addLog(`Згенеровано пост для каналу "${channel.name}"`, 'success');
        }
      } catch (error) {
        await addLog(`Помилка генерації поста для каналу "${channel.name}"`, 'error', error);
      }
    }
  }
}

async function checkScheduledPosts() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  await addLog(`Перевірка розкладу: ${currentHour}:${String(currentMinute).padStart(2, '0')}`, 'info');

  // Find channels that should post now
  const { data: schedules, error } = await supabase
    .from('channel_schedules')
    .select(`
      *,
      channels (*)
    `)
    .eq('hour', currentHour)
    .gte('minute', currentMinute - 1)
    .lte('minute', currentMinute + 1);

  if (error || !schedules) {
    await addLog('Помилка завантаження розкладу', 'error', error);
    return;
  }

  for (const schedule of schedules) {
    const channel = schedule.channels;
    if (!channel || !channel.is_active) continue;

    // Find a generated post for today that hasn't been published yet
    const today = new Date().toISOString().split('T')[0];
    const { data: availablePosts } = await supabase
      .from('posts')
      .select('*')
      .eq('channel_id', channel.id)
      .eq('status', 'generated')
      .gte('created_at', `${today}T00:00:00Z`)
      .lt('created_at', `${today}T23:59:59Z`)
      .limit(1);

    if (!availablePosts || availablePosts.length === 0) {
      await addLog(`Немає доступних постів для каналу "${channel.name}"`, 'warning');
      continue;
    }

    const post = availablePosts[0];
    
    try {
      let result;
      if (post.image_url && !post.image_url.includes('placehold')) {
        result = await sendTelegramPhoto(channel.bot_token, channel.chat_id, post.image_url, post.text);
      } else {
        result = await sendTelegramMessage(channel.bot_token, channel.chat_id, post.text);
      }

      if (result.ok) {
        await supabase
          .from('posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            telegram_post_id: result.result.message_id.toString()
          })
          .eq('id', post.id);

        await addLog(`Пост опубліковано в каналі "${channel.name}"`, 'success');
      } else {
        await supabase
          .from('posts')
          .update({
            status: 'failed',
            error: result.description || 'Telegram API error'
          })
          .eq('id', post.id);

        await addLog(`Помилка публікації в каналі "${channel.name}": ${result.description}`, 'error');
      }
    } catch (error) {
      await supabase
        .from('posts')
        .update({
          status: 'failed',
          error: error.message
        })
        .eq('id', post.id);

      await addLog(`Помилка публікації в каналі "${channel.name}": ${error.message}`, 'error');
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();

    if (action === 'generate_daily') {
      await generateDailyPosts();
      return new Response(JSON.stringify({ success: true, message: 'Daily posts generated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else if (action === 'check_schedule') {
      await checkScheduledPosts();
      return new Response(JSON.stringify({ success: true, message: 'Schedule checked' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    await addLog(`Edge Function error: ${error.message}`, 'error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
