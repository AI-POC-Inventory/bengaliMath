from db_helper import get_conn

def get_class_data(class_id: int):
    conn = get_conn()
    cursor = conn.cursor()

    # 🔹 Get class
    cursor.execute(
        "SELECT id, name, bengali_name FROM classes WHERE id=?",
        (class_id,)
    )
    cls = cursor.fetchone()

    if not cls:
        conn.close()
        return None

    class_data = {
        "id": cls[0],
        "name": cls[1],
        "bengaliName": cls[2],
        "chapters": []
    }

    # 🔹 Get chapters
    cursor.execute(
        "SELECT id, name, description FROM chapters WHERE class_id=?",
        (class_id,)
    )
    chapters = cursor.fetchall()

    for ch in chapters:
        chapter_data = {
            "id": ch[0],
            "name": ch[1],
            "description": ch[2],
            "topics": []
        }

        # 🔹 Get topics
        cursor.execute(
            "SELECT id, name, description FROM topics WHERE chapter_id=?",
            (ch[0],)
        )
        topics = cursor.fetchall()

        for t in topics:
            topic_data = {
                "id": t[0],
                "name": t[1],
                "description": t[2],
                "questions": []
            }

            # 🔹 Get questions
            cursor.execute(
                """SELECT id, type, text, answer, solution, difficulty 
                   FROM questions WHERE topic_id=?""",
                (t[0],)
            )
            questions = cursor.fetchall()

            for q in questions:
                question_data = {
                    "id": q[0],
                    "type": q[1],
                    "text": q[2],
                    "answer": q[3],
                    "solution": q[4],
                    "difficulty": q[5]
                }

                # 🔹 Get options (for MCQ)
                cursor.execute(
                    "SELECT option_text FROM options WHERE question_id=?",
                    (q[0],)
                )
                opts = cursor.fetchall()

                if opts:
                    question_data["options"] = [o[0] for o in opts]

                topic_data["questions"].append(question_data)

            chapter_data["topics"].append(topic_data)

        class_data["chapters"].append(chapter_data)

    conn.close()
    return class_data

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

