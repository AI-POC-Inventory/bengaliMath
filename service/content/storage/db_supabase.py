import json
import os
from supabase_client import get_connection

_dir = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(_dir, "mock_7.json"), "r", encoding="utf-8") as f:
    data = json.load(f)

conn = get_connection()
cursor = conn.cursor()

# ── Show existing tables ──────────────────────────────────────────────────

cursor.execute("""
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
""")
tables = cursor.fetchall()
print("Tables:", [t[0] for t in tables])

# ── Seed data ─────────────────────────────────────────────────────────────

for cls in data:
    print(f"Inserting class: {cls['name']} (ID: {cls['id']})")

    cursor.execute(
        """
        INSERT INTO classes (id, name, bengali_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (cls["id"], cls["name"], cls["bengaliName"])
    )

    for ch in cls["chapters"]:
        cursor.execute(
            """
            INSERT INTO chapters (id, class_id, name, description)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (ch["id"], cls["id"], ch["name"], ch["description"])
        )

        for topic in ch["topics"]:
            cursor.execute(
                """
                INSERT INTO topics (id, chapter_id, name, description)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (topic["id"], ch["id"], topic["name"], topic["description"])
            )

            for q in topic["questions"]:
                answer = str(q["answer"])

                cursor.execute(
                    """
                    INSERT INTO questions (id, topic_id, type, text, answer, solution, difficulty)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        q["id"],
                        topic["id"],
                        q["type"],
                        q["text"],
                        answer,
                        q["solution"],
                        q["difficulty"]
                    )
                )

                if q["type"] == "mcq":
                    for idx, opt in enumerate(q["options"]):
                        cursor.execute(
                            """
                            INSERT INTO options (question_id, option_text, is_correct)
                            VALUES (%s, %s, %s)
                            """,
                            (q["id"], opt, idx == q["answer"])
                        )

conn.commit()
cursor.close()
conn.close()
print("Done.")
