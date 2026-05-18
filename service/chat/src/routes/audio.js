import express from 'express';
import { getModel, getGeminiApiKey } from '../gemini.js';

const router = express.Router();

// POST /audio/transcribe
router.post('/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;

    if (!audioBase64 || !mimeType) {
      return res.status(400).json({ error: 'audioBase64 and mimeType are required' });
    }

    const geminiKey = getGeminiApiKey();
    const model = getModel(geminiKey);

    const result = await model.generateContent([
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType,
        },
      },
      {
        text: 'এই অডিওটি বাংলায় ট্রান্সক্রাইব করুন। শুধুমাত্র ট্রান্সক্রিপ্শন দিন, অন্য কিছু নয়।',
      },
    ]);

    const text = result.response.text();
    res.json({ text: text.trim() });
  } catch (error) {
    console.error('Audio transcription error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to transcribe audio';
    res.status(500).json({ error: msg });
  }
});

export default router;
