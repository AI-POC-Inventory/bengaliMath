import express from 'express';
import { supabase } from '../db.js';
import { getModel, getGeminiApiKey } from '../gemini.js';

const router = express.Router();

// GET /conversations/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const { id: conversationId } = req.params;

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json(
      (messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /conversations/:id/messages - streaming response
router.post('/:id/messages', async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { message, classId } = req.body;

    if (!message || !classId) {
      return res.status(400).json({ error: 'message and classId are required' });
    }

    // Verify conversation exists
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Save user message
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert([
        {
          conversation_id: conversationId,
          role: 'user',
          content: message,
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) throw insertError;

    // Get conversation history (last 10 messages)
    const { data: history, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (historyError) throw historyError;

    // Build message array for Gemini (reverse to chronological order, map assistant -> model)
    const contents = (history || [])
      .reverse()
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    // Add current user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const classNames = {
      5: 'পঞ্চম',
      6: 'ষষ্ঠ',
      7: 'সপ্তম',
      8: 'অষ্টম',
      9: 'নবম',
      10: 'দশম',
    };

    const geminiKey = getGeminiApiKey();
    const model = getModel(geminiKey);
    let fullResponse = '';

    try {
      const result = await model.generateContentStream({
        contents,
        systemInstruction: `তুমি একজন সহায়ক বাংলা গণিত শিক্ষক সহকারী। তুমি ${classNames[parseInt(classId)] || ''} শ্রেণীর পশ্চিমবঙ্গ বোর্ড (WBBSE) এর ছাত্রছাত্রীদের সাহায্য করো।

তোমার কাজ:
- সবসময় বাংলায় উত্তর দাও
- গণিতের সমস্যা সমাধানে ধাপে ধাপে সাহায্য করো
- ধারণা সহজ ভাষায় ব্যাখ্যা করো
- উৎসাহজনক ও বন্ধুত্বপূর্ণ ভঙ্গিতে কথা বলো
- প্রয়োজনে উদাহরণ দাও
- শিক্ষার্থীকে নিজে চিন্তা করতে উৎসাহিত করো, সরাসরি উত্তর না দিয়ে

তুমি একজন সহায়ক বন্ধুর মতো, শুধু একজন শিক্ষক নয়।`,
      });

      for await (const chunk of result.stream) {
        if (chunk.text) {
          fullResponse += chunk.text;
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      // Save assistant response
      const { error: saveError } = await supabase
        .from('chat_messages')
        .insert([
          {
            conversation_id: conversationId,
            role: 'assistant',
            content: fullResponse,
            created_at: new Date().toISOString(),
          },
        ]);

      if (saveError) throw saveError;

      // Update conversation title and updated_at
      if (!conversation.title || conversation.title === 'নতুন কথোপকথন') {
        const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
        const { error: updateError } = await supabase
          .from('chat_conversations')
          .update({
            updated_at: new Date().toISOString(),
            title,
          })
          .eq('id', conversationId);

        if (updateError) throw updateError;
      } else {
        const { error: updateError } = await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);

        if (updateError) throw updateError;
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Chat message error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
