import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

// GET /conversations - list conversations
router.get('', async (req, res) => {
  try {
    const { classId, userId } = req.query;

    let query = supabase
      .from('chat_conversations')
      .select('*')
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (classId) {
      query = query.eq('class_id', parseInt(classId));
    }

    if (userId) {
      query = query.eq('user_id', parseInt(userId));
    }

    const { data: conversations, error } = await query;

    if (error) throw error;

    // Fetch message count for each conversation
    const conversationsWithCount = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { count, error: countError } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        if (countError) throw countError;

        return {
          id: conv.id,
          title: conv.title,
          updatedAt: conv.updated_at,
          messageCount: count || 0,
        };
      })
    );

    res.json(conversationsWithCount);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /conversations - create conversation
router.post('', async (req, res) => {
  try {
    const { classId } = req.body;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const conversationId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .insert([
        {
          id: conversationId,
          class_id: parseInt(classId),
          title: 'নতুন কথোপকথন',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_archived: false,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updated_at,
      messageCount: 0,
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /conversations/:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('chat_conversations')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) throw error;

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
