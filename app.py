# app.py

from flask import Flask, render_template, request, jsonify
from chat_bot.content_wr import generate_caption
app = Flask(__name__, static_folder='static', template_folder='chat_bot/templates')


@app.route("/")
def dashboard():
    return render_template("home.html")

@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = request.get_json()
        topic = data.get("topic")
        tone = data.get("tone", "Professional")

        if not topic:
            return jsonify({"error": "Topic required"}), 400

        # 🔥 CALL LANGGRAPH WITH TOPIC + TONE
        result = generate_caption(topic, tone)
        return jsonify({"result": result})
    except Exception as e:
        print(f"Error generating caption: {str(e)}")
        return jsonify({"error": f"Generation failed: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)
    
    