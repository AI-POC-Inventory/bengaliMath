from supabase_client import supabase


def get_class_data(class_id: int):
    cls_row = supabase.table("classes").select("*").eq("id", class_id).limit(1).execute().data
    if not cls_row:
        return None

    cls = cls_row[0]
    class_data = {
        "id": cls["id"],
        "name": cls["name"],
        "bengaliName": cls["bengali_name"],
        "chapters": []
    }

    chapters = supabase.table("chapters").select("*").eq("class_id", class_id).execute().data

    for ch in chapters:
        chapter_data = {
            "id": ch["id"],
            "name": ch["name"],
            "description": ch["description"],
            "topics": []
        }

        topics = supabase.table("topics").select("*").eq("chapter_id", ch["id"]).execute().data

        for t in topics:
            topic_data = {
                "id": t["id"],
                "name": t["name"],
                "description": t["description"],
                "questions": []
            }

            questions = supabase.table("questions").select("*").eq("topic_id", t["id"]).execute().data

            for q in questions:
                question_data = {
                    "id": q["id"],
                    "type": q["type"],
                    "text": q["text"],
                    "answer": q["answer"],
                    "solution": q["solution"],
                    "difficulty": q["difficulty"],
                }

                if q["type"] == "mcq":
                    opts = supabase.table("options").select("option_text").eq("question_id", q["id"]).execute().data
                    question_data["options"] = [o["option_text"] for o in opts]

                topic_data["questions"].append(question_data)

            chapter_data["topics"].append(topic_data)

        class_data["chapters"].append(chapter_data)

    return class_data


def get_chapter(class_id: int, chapter_id: str):
    rows = (
        supabase.table("chapters")
        .select("*")
        .eq("id", chapter_id)
        .eq("class_id", class_id)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def get_topic(class_id: int, topic_id: str):
    rows = (
        supabase.table("topics")
        .select("*, chapters!inner(id, class_id)")
        .eq("id", topic_id)
        .eq("chapters.class_id", class_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return None
    row = rows[0]
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "chapter_id": row["chapters"]["id"],
    }


def get_all_questions(class_id: int, chapter_id=None, topic_id=None, difficulty=None):
    query = (
        supabase.table("questions")
        .select("*, topics!inner(id, chapter_id, chapters!inner(id, class_id))")
        .eq("topics.chapters.class_id", class_id)
    )

    if chapter_id:
        query = query.eq("topics.chapters.id", chapter_id)
    if topic_id:
        query = query.eq("topic_id", topic_id)
    if difficulty:
        query = query.eq("difficulty", difficulty)

    rows = query.execute().data

    result = []
    for row in rows:
        result.append({
            "question": {
                "id": row["id"],
                "type": row["type"],
                "text": row["text"],
                "answer": row["answer"],
                "solution": row["solution"],
                "difficulty": row["difficulty"],
            },
            "topicId": row["topics"]["id"],
            "chapterId": row["topics"]["chapters"]["id"],
        })

    return result


def get_options(question_id: str):
    rows = supabase.table("options").select("option_text, is_correct").eq("question_id", question_id).execute().data
    return [{"text": o["option_text"], "is_correct": bool(o["is_correct"])} for o in rows]
