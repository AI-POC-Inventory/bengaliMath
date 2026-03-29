import json
from models.chapter import ChapterModel
from models.exercise import ExerciseModel   

def seed_mock():
    with open("mock_6.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    chapter_id = ChapterModel.insert(data)
    ExerciseModel.insert_many(chapter_id, data["exercises"])

    print("Mock data inserted")
