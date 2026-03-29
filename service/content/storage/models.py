from db  import get_connection
import json

class ChapterModel:

    @staticmethod
    def insert(chapter):
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO chapters (chapter_number, title, book, standard)
            VALUES (?, ?, ?, ?)
        """, (
            chapter["chapter"]["number"],
            chapter["chapter"]["title"],
            chapter["chapter"]["book"],
            chapter["chapter"]["class"]
        ))

        chapter_id = cur.lastrowid
        conn.commit()
        print(f"Inserted chapter with ID: {chapter_id}")
        return chapter_id

class ExerciseModel:

    @staticmethod
    def insert_many(chapter_id, exercises):
        conn = get_connection()
        cur = conn.cursor()

        for q in exercises["questions"]:
            cur.execute("""
                INSERT INTO exercises (
                    chapter_id, question_number, question, answer, solution_json
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                chapter_id,
                q["number"],
                q["question"],
                q.get("answer", ""),
                json.dumps(q.get("solution", {}), ensure_ascii=False)
            ))

        conn.commit()

