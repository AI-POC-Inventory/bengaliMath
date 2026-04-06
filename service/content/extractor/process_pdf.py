#!/usr/bin/env python3
"""
Process uploaded PDF and save extracted questions to database
"""
import sys
import json
import os
from pathlib import Path

# Add parent directory to path to import pdf_extractor
sys.path.append(str(Path(__file__).parent))

from pdf_extractor import UnifiedPDFExtractor

def map_to_database_format(extracted_data, class_id, chapter_id, topic_id):
    """
    Map extracted data to database format
    """
    questions = []
    exercises = extracted_data.get('exercises', {})

    if not exercises or 'questions' not in exercises:
        return []

    for q in exercises['questions']:
        question = {
            'id': f"{topic_id}-q{q.get('number', len(questions) + 1)}",
            'topic_id': topic_id,
            'type': 'short' if q.get('type') in ['word_problem', 'calculation'] else 'mcq',
            'text': q.get('question', ''),
            'answer': q.get('answer', ''),
            'solution': json.dumps(q.get('solution', {}), ensure_ascii=False),
            'difficulty': 'medium',  # Default, can be customized
            'options': []
        }

        # For MCQ, we'd need to generate options from the solution
        # For now, keeping it simple

        questions.append(question)

    return questions

def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            'success': False,
            'error': 'Usage: process_pdf.py <pdf_path> <class_id> <chapter_id> <topic_id> [provider]'
        }))
        sys.exit(1)

    pdf_path = sys.argv[1]
    class_id = sys.argv[2]
    chapter_id = sys.argv[3]
    topic_id = sys.argv[4]
    provider = sys.argv[5] if len(sys.argv) > 5 else None

    try:
        # Check if PDF exists
        if not Path(pdf_path).exists():
            print(json.dumps({
                'success': False,
                'error': f'PDF file not found: {pdf_path}'
            }))
            sys.exit(1)

        # Extract content from PDF
        extractor = UnifiedPDFExtractor(provider=provider)
        extracted_data = extractor.extract(pdf_path)

        # Map to database format
        questions = map_to_database_format(extracted_data, class_id, chapter_id, topic_id)

        # Return result
        result = {
            'success': True,
            'extracted_data': extracted_data,
            'questions': questions,
            'count': len(questions)
        }

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()
