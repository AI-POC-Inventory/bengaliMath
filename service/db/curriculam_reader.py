from db_helper import get_conn

def get_class_data(class_id: int):
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, bengali_name FROM classes WHERE id=?", (class_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "name": row[1],
        "bengaliName": row[2]
    }

def get_chapter(class_id: int, chapter_id: str):
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM chapters 
        WHERE id=? AND class_id=?
    """, (chapter_id, class_id))

    chapter = cursor.fetchone()
    conn.close()
    return chapter

def get_topic(class_id: int, topic_id: str):
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT t.*, c.id as chapter_id
        FROM topics t
        JOIN chapters c ON t.chapter_id = c.id
        WHERE t.id=? AND c.class_id=?
    """, (topic_id, class_id))

    result = cursor.fetchone()
    conn.close()

    return result

def get_all_questions(class_id: int, chapter_id=None, topic_id=None, difficulty=None):
    conn = get_conn()
    cursor = conn.cursor()

    query = """
        SELECT q.*, t.id as topic_id, c.id as chapter_id
        FROM questions q
        JOIN topics t ON q.topic_id = t.id
        JOIN chapters c ON t.chapter_id = c.id
        WHERE c.class_id = ?
    """

    params = [class_id]

    if chapter_id:
        query += " AND c.id = ?"
        params.append(chapter_id)

    if topic_id:
        query += " AND t.id = ?"
        params.append(topic_id)

    if difficulty:
        query += " AND q.difficulty = ?"
        params.append(difficulty)

    cursor.execute(query, params)

    rows = cursor.fetchall()
    conn.close()

    # Format like your TS version
    result = []
    for row in rows:
        result.append({
            "question": {
                "id": row[0],
                "type": row[2],
                "text": row[3],
                "answer": row[4],
                "solution": row[5],
                "difficulty": row[6],
            },
            "topicId": row[-2],
            "chapterId": row[-1]
        })

    return result    


def get_options(question_id):
    conn = get_conn()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT option_text, is_correct 
        FROM options 
        WHERE question_id=?
    """, (question_id,))

    options = cursor.fetchall()
    conn.close()

    return [
        {"text": opt[0], "is_correct": bool(opt[1])}
        for opt in options
    ]

