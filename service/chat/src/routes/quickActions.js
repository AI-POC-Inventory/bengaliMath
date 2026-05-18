import express from 'express';
import { supabase } from '../db.js';

const router = express.Router();

// GET /quick-actions
router.get('', async (req, res) => {
  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const { data: actions, error } = await supabase
      .from('chat_quick_actions')
      .select('*')
      .eq('class_id', parseInt(classId))
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;

    res.json(
      (actions || []).map((a) => ({
        id: a.id,
        category: a.category,
        question: a.question_bengali,
        icon: a.icon,
      }))
    );
  } catch (error) {
    console.error('Error fetching quick actions:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
