from flask import Flask, jsonify, request
from curriculam_reader import get_class_data, get_chapter, get_topic, get_all_questions

app = Flask(__name__)

@app.route("/class/<int:class_id>")
def class_data(class_id):
    data = get_class_data(class_id)
    return jsonify(data)

@app.route("/chapter")
def chapter():
    class_id = int(request.args.get("classId"))
    chapter_id = request.args.get("chapterId")
    return jsonify(get_chapter(class_id, chapter_id))

@app.route("/topic")
def topic():
    class_id = int(request.args.get("classId"))
    topic_id = request.args.get("topicId")
    return jsonify(get_topic(class_id, topic_id))

@app.route("/questions")
def questions():
    class_id = int(request.args.get("classId"))
    chapter_id = request.args.get("chapterId")
    topic_id = request.args.get("topicId")
    difficulty = request.args.get("difficulty")

    data = get_all_questions(class_id, chapter_id, topic_id, difficulty)
    return jsonify(data)

if __name__ == "__main__":
    app.run(debug=True)