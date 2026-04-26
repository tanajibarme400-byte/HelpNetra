from flask import Flask, jsonify, request
from flask_cors import CORS
import random

app = Flask(__name__)
CORS(app)

# Enhanced Mock Needs Data with coordinates and details
needs_data = [
    {"id": 1, "category": "Medical", "title": "Medical Support Needed", "location": "Sector 4, Downtown", "lat": 40.75, "lng": -73.98, "urgency": "critical", "reported": "2h ago"},
    {"id": 2, "category": "Education", "title": "Math Tutor Needed", "location": "East Side", "lat": 40.73, "lng": -73.96, "urgency": "medium", "reported": "5h ago"},
    {"id": 3, "category": "Food", "title": "Food Distribution Help", "location": "West Village", "lat": 40.74, "lng": -74.00, "urgency": "high", "reported": "1h ago"},
    {"id": 4, "category": "Disaster Relief", "title": "Flood Cleanup", "location": "North District", "lat": 40.78, "lng": -73.95, "urgency": "critical", "reported": "30m ago"},
    {"id": 5, "category": "Medical", "title": "Senior Care Assistance", "location": "Chelsea", "lat": 40.745, "lng": -73.99, "urgency": "medium", "reported": "3h ago"},
    {"id": 6, "category": "Education", "title": "Computer Literacy Class", "location": "Brooklyn", "lat": 40.69, "lng": -73.94, "urgency": "low", "reported": "1d ago"},
    {"id": 7, "category": "Food", "title": "Grocery Delivery", "location": "Upper East Side", "lat": 40.77, "lng": -73.96, "urgency": "high", "reported": "45m ago"},
]

# Enhanced Mock Volunteers Data
volunteers_data = [
    {"id": 1, "name": "Sarah Jones", "skills": ["Teaching", "Childcare"], "avatar": "SJ", "location": "Sector 4, Downtown", "lat": 40.75, "lng": -73.99},
    {"id": 2, "name": "Mike Chen", "skills": ["Medical", "First Aid"], "avatar": "MC", "location": "East Side", "lat": 40.73, "lng": -73.95},
    {"id": 5, "name": "Priya Sharma", "skills": ["Medical", "Nursing"], "avatar": "PS", "location": "East Side", "lat": 40.725, "lng": -73.945}
]

@app.route("/api/needs", methods=["GET", "POST"])
def manage_needs():
    if request.method == "POST":
        data = request.json.get("need", {})
        new_id = len(needs_data) + 1
        new_need = {
            "id": new_id,
            "category": data.get("category", "General"),
            "title": data.get("title", "New Task"),
            "location": data.get("location", "Unknown"),
            "lat": data.get("lat") or 40.70 + random.uniform(0, 0.1),
            "lng": data.get("lng") or -74.00 + random.uniform(0, 0.1),
            "urgency": data.get("urgency", "medium"),
            "reported": "Just now"
        }
        needs_data.append(new_need)
        return jsonify(new_need)
    return jsonify(needs_data)

@app.route("/api/volunteers")
def get_volunteers():
    return jsonify(volunteers_data)

@app.route("/api/match", methods=["GET", "POST"])
def get_match():
    matches = []
    # Simplified matching logic for simulation
    for vol in volunteers_data:
        for need in needs_data:
            score = 0
            reasoning = "General match based on availability."
            
            if vol["location"] == need["location"]:
                score += 40
                reasoning = "Located in same sector, ensuring rapid response."
            
            if need["category"] in vol["skills"]:
                score += 50
                reasoning = "Direct skill-to-need match detected by AI."
            elif any(s in need["title"] for s in vol["skills"]):
                score += 45
                reasoning = "Contextual skill match identified."
            
            dist_km = 0
            if "lat" in vol and "lat" in need:
                import math
                dist_km = math.sqrt((vol["lat"] - need["lat"])**2 + (vol["lng"] - need["lng"])**2) * 111
                score -= dist_km * 1.5

            if score > 0:
                matches.append({
                    "volunteer": vol,
                    "task": need,
                    "score": max(10, min(99, int(score + random.randint(1, 9)))),
                    "reasoning": reasoning,
                    "distance": f"{dist_km:.1f} km"
                })
    
    # Sort by score and return top matches
    matches.sort(key=lambda x: x["score"], reverse=True)
    return jsonify(matches[:10])

@app.route("/api/analyze", methods=["POST"])
def analyze_text():
    data = request.json
    text = data.get("text", "").lower()
    
    # Simulated AI analysis logic
    category = "General"
    if "medical" in text or "doctor" in text: category = "Medical"
    elif "food" in text or "hunger" in text: category = "Food"
    elif "teach" in text or "school" in text: category = "Education"
    elif "flood" in text or "rescue" in text: category = "Disaster Relief"
    
    urgency = "medium"
    if "urgent" in text or "emergency" in text or "critical" in text: urgency = "critical"
    elif "asap" in text or "help" in text: urgency = "high"
    
    return jsonify({
        "category": category,
        "urgency": urgency,
        "location": "Detected: Sector " + str(random.randint(1, 10)),
        "impact": str(random.randint(50, 500)) + " people"
    })

@app.route("/api/achievements")
def get_achievements():
    # Return mock data with examples to make it look attractive
    return jsonify({
        "totalPoints": 2750,
        "workingScore": 85,
        "badges": ["starter", "first-mission", "helper", "expert", "hero"],
        "certificates": ["cert-community", "cert-expert"]
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5500, debug=True)