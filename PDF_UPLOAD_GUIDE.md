# PDF Upload & Question Extraction Feature

## Overview
The admin panel now includes a powerful PDF upload feature that automatically extracts questions and answers from Bengali mathematics PDFs, translates them, and saves them to the database.

## Features

### ✅ What's Included
- **Multi-AI Provider Support**: Choose from Anthropic Claude, Google Gemini, or OpenAI GPT-4
- **Automatic Extraction**: Extracts questions, answers, solutions, and explanations
- **Bengali to English Translation**: Automatically translates content
- **Database Integration**: Saves extracted questions directly to your SQLite database
- **Chapter/Topic Organization**: Associate questions with specific classes, chapters, and topics

### 📋 What Gets Extracted
- Chapter information (if present in PDF)
- Example problems with solutions
- Exercise questions
- Question text (Bengali)
- English translation
- Solution steps
- Final answers
- Question type classification

## Setup Requirements

### 1. Python Dependencies
```bash
cd service/content/extractor
pip install -r requirements.txt
```

Required packages:
- PyMuPDF (PDF processing)
- Pillow (image handling)
- anthropic (for Claude)
- google-generativeai (for Gemini)
- openai (for GPT-4)

### 2. API Keys
Set up at least one AI provider API key in your environment:

```bash
# For Anthropic Claude (recommended)
export ANTHROPIC_API_KEY="sk-ant-..."

# For Google Gemini
export GOOGLE_API_KEY="..."

# For OpenAI
export OPENAI_API_KEY="sk-..."
```

Or create a `.env` file in `service/content/extractor/`:
```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
OPENAI_API_KEY=sk-...
```

## How to Use

### Step 1: Access Admin Panel
1. Navigate to http://localhost:5173
2. Go to the "প্রশাসন" (Admin) section
3. Click on the "PDF আপলোড" (PDF Upload) tab

### Step 2: Select Target Location
1. **শ্রেণী (Class)**: Select the class (5-10)
2. **অধ্যায় (Chapter)**: Choose the chapter
3. **বিষয় (Topic)**: Pick the specific topic

### Step 3: Choose AI Provider
Select your preferred AI provider:
- **Anthropic Claude**: Best for Bengali text, most accurate
- **Google Gemini**: Fast and cost-effective
- **OpenAI GPT-4**: Good alternative

### Step 4: Upload PDF
1. Click "Choose File" and select your PDF
2. The system supports PDFs up to 50MB
3. Click "Upload & Extract Questions"

### Step 5: Wait for Processing
The system will:
1. Upload the PDF to the server
2. Convert PDF pages to images
3. Send to AI for extraction
4. Parse and translate the content
5. Save questions to the database

### Step 6: Review Results
After processing, you'll see:
- Number of questions extracted
- Number successfully saved to database
- Any error messages if something failed

## Backend API

### Endpoint
```
POST /api/admin/upload-pdf
Content-Type: multipart/form-data
```

### Request Body
```
pdf: File (PDF file)
classId: number
chapterId: string
topicId: string
provider: string (anthropic|google|openai)
```

### Response
```json
{
  "success": true,
  "message": "Successfully processed PDF and saved 5 questions",
  "extracted": 5,
  "saved": 5,
  "extractedData": {
    "chapter": { ... },
    "exercises": { ... }
  }
}
```

## Technical Details

### PDF Processing Flow
```
1. PDF Upload (frontend)
   ↓
2. Save to /uploads directory (Node.js)
   ↓
3. Call Python extractor script
   ↓
4. Convert PDF to images (PyMuPDF)
   ↓
5. Send to AI provider (Claude/Gemini/GPT-4)
   ↓
6. Parse JSON response
   ↓
7. Map to database format
   ↓
8. Insert into SQLite database
   ↓
9. Return results to frontend
   ↓
10. Clean up uploaded file
```

### Extraction Prompt
The AI is instructed to extract:
- Chapter metadata (number, title, book, class)
- Example problems with full solutions
- Exercise questions with:
  - Question text (Bengali)
  - English translation
  - Question type
  - Solution steps
  - Final answer

### Database Mapping
Extracted data is mapped to your schema:

**Questions Table:**
```sql
{
  id: "7-1-1-q1",
  topic_id: "7-1-1",
  type: "short|mcq",
  text: "প্রশ্নের পাঠ্য (Bengali text)",
  answer: "উত্তর",
  solution: "JSON string with steps",
  difficulty: "medium"
}
```

**Options Table (for MCQ):**
```sql
{
  question_id: "7-1-1-q1",
  option_text: "Option text",
  is_correct: 0|1
}
```

## Troubleshooting

### "No API keys found"
- Make sure at least one AI provider API key is set in environment variables
- Restart the backend server after setting environment variables

### "PDF processing failed"
- Check the PDF is valid and not corrupted
- Ensure the PDF contains text (not scanned images only)
- Try a different AI provider

### "Upload failed"
- Check backend server logs in the terminal
- Verify Python and required packages are installed
- Ensure write permissions on /uploads directory

### Questions not saving
- Check if questions with the same ID already exist
- Verify the topic ID exists in the database
- Look for database constraint errors in logs

## File Locations

### Backend Endpoint
```
server/index.js
  - POST /api/admin/upload-pdf
```

### PDF Processor
```
service/content/extractor/process_pdf.py
  - Handles PDF extraction and database mapping
```

### PDF Extractor Classes
```
service/content/extractor/pdf_extractor.py
  - UnifiedPDFExtractor (auto-detects provider)
  - ClaudeExtractor
  - GeminiExtractor
  - OpenAIExtractor
```

### Frontend Component
```
ui/src/components/PDFUpload.tsx
  - PDF upload UI
```

## Example Usage

### 1. Upload a Chapter PDF
```
Class: 7 (সপ্তম শ্রেণী)
Chapter: অনুপাত ও সমানুপাত
Topic: অনুপাত
Provider: Anthropic Claude
PDF: chapter7-ratio.pdf
```

### 2. Process Results
```
✓ Upload Successful!
Extracted: 15 questions
Saved: 15 questions
Successfully processed PDF and saved 15 questions
```

## Best Practices

### 1. PDF Preparation
- Use high-quality PDFs with clear text
- Avoid heavily formatted or image-based PDFs
- One chapter per upload for better organization

### 2. Provider Selection
- **Claude**: Best for Bengali mathematics content
- **Gemini**: Good balance of speed and accuracy
- **GPT-4**: When Claude/Gemini are unavailable

### 3. Data Organization
- Create class, chapter, and topic structure before uploading
- Use consistent naming conventions
- Review extracted questions after upload

### 4. Error Handling
- Always check the success message
- Review "Extracted vs Saved" counts
- If counts don't match, check for duplicate IDs

## Cost Considerations

### AI Provider Costs (approximate)
- **Claude Sonnet**: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- **Gemini Flash**: ~$0.35 per 1M tokens
- **GPT-4o**: ~$5 per 1M input tokens, ~$15 per 1M output tokens

A typical 10-page PDF with 20 questions costs:
- Claude: $0.05 - $0.15
- Gemini: $0.01 - $0.03
- GPT-4: $0.05 - $0.10

## Future Enhancements

Potential improvements:
- [ ] Batch PDF upload
- [ ] Progress indicator during processing
- [ ] Preview extracted questions before saving
- [ ] Edit extracted questions before save
- [ ] Support for image-only PDFs (OCR)
- [ ] Question difficulty auto-classification
- [ ] Duplicate detection
- [ ] Bulk import from folder

## Support

For issues or questions:
1. Check server logs: `npm start` output
2. Check Python processor logs
3. Verify API keys are configured
4. Test with a simple PDF first

---

**Current Status**: ✅ Fully Functional

All services are running:
- Backend: http://localhost:3001
- Frontend: http://localhost:5173
- PDF Upload: Ready
