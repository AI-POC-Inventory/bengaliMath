import sqlite3
import json

# Load your TS file (convert to JSON first)
# Remove "export const curriculum =" and convert to valid JSON

with open("all_classes.json", "r", encoding="utf-8") as f:
    data = json.load(f)

conn = sqlite3.connect("D:\\Sujit\\AiML\\AITech\\academy\\beangali-board\\bengaliMath\\database\\bengali_curriculam.db")
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()

print("Tables:", tables)



for cls in data:
    print(f"Inserting class: {cls['name']} (ID: {cls['id']})")
    cursor.execute(
        "INSERT INTO classes VALUES (?, ?, ?)",
        (cls["id"], cls["name"], cls["bengaliName"])
    )

    for ch in cls["chapters"]:
        cursor.execute(
            "INSERT INTO chapters VALUES (?, ?, ?, ?)",
            (ch["id"], cls["id"], ch["name"], ch["description"])
        )

        for topic in ch["topics"]:
            cursor.execute(
                "INSERT INTO topics VALUES (?, ?, ?, ?)",
                (topic["id"], ch["id"], topic["name"], topic["description"])
            )

            for q in topic["questions"]:
                answer = str(q["answer"])  # unify type

                cursor.execute(
                    "INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?, ?)",
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

                # Insert options if MCQ
                if q["type"] == "mcq":
                    for idx, opt in enumerate(q["options"]):
                        cursor.execute(
                            "INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)",
                            (q["id"], opt, 1 if idx == q["answer"] else 0)
                        )

conn.commit()
conn.close()