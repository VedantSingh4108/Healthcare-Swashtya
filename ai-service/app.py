import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Gemini Client
# It will automatically pick up GEMINI_API_KEY from environment
try:
    client = genai.Client()
except Exception as e:
    print(f"Warning: Failed to initialize Gemini client: {e}")
    client = None

@app.route('/api/ai/pre-visit', methods=['POST'])
def pre_visit():
    data = request.get_json() or {}
    symptoms = data.get('symptoms', '')
    
    prompt = f"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms}"
    
    try:
        if not client:
            raise Exception("Gemini client not initialized")
        
        # Use gemini-3.1-flash as the standard model for quick text tasks
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
        )
        
        # We try to parse the text response into a structured format
        return jsonify({
            "status": "success",
            "data": response.text
        })
    except Exception as e:
        print(f"AI Service Error (pre-visit): {e}")
        # Graceful degradation fallback
        fallback = {
            "status": "fallback",
            "urgency_level": "Medium",
            "chief_complaint": "Unknown",
            "questions_for_doctor": [
                "What could be causing these symptoms?",
                "Are there any tests I should take?",
                "What are the next steps?"
            ]
        }
        return jsonify(fallback), 200


@app.route('/api/ai/post-visit', methods=['POST'])
def post_visit():
    data = request.get_json() or {}
    notes = data.get('notes', '')
    prescription = data.get('prescription', [])
    
    prompt = f"""You are a warm, empathetic medical assistant translating a doctor's notes for a patient. 
    Doctor's Clinical Notes: {notes}
    Prescriptions: {prescription}
    
    Instructions: Write a short, patient-friendly summary explaining their diagnosis, how to take their medications, and any lifestyle/rest advice. Use simple, everyday language. Do NOT use complex medical jargon. 
    CRITICAL: Return ONLY the plain text summary. Do not include markdown formatting, asterisks, or introductory phrases."""
    
    try:
        if not client:
            raise Exception("Gemini client not initialized")
            
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
        )
        
        return jsonify({
            "summary": response.text.strip()
        })
    except Exception as e:
        print(f"AI Service Error (post-visit): {e}")
        # Graceful degradation fallback
        fallback = {
            "status": "fallback",
            "summary": "Please refer to the doctor's direct notes for details.",
            "medication_schedule": "Follow prescribed instructions.",
            "follow_up_steps": "Schedule follow-up as advised by your doctor."
        }
        return jsonify(fallback), 200

@app.route('/api/ai/patient-history', methods=['POST'])
def patient_history():
    data = request.get_json() or {}
    chronic = data.get('chronic_diseases')
    if not chronic or str(chronic).strip() == '':
        chronic = 'None recorded'
    allergies = data.get('allergies')
    if not allergies or str(allergies).strip() == '':
        allergies = 'None recorded'
    surgeries = data.get('surgeries')
    if not surgeries or str(surgeries).strip() == '':
        surgeries = 'None recorded'
    notes = data.get('past_visit_notes')
    if not notes or str(notes).strip() == '':
        notes = 'No past visits'
    
    prompt = f"""You are an expert medical AI assistant. Review the following patient history. 
    Chronic Diseases: {chronic}
    Allergies: {allergies}
    Surgeries: {surgeries}
    Past Visit Notes: {notes}
    Instructions: Generate a concise, professional longitudinal summary for the attending doctor. Highlight recurring issues, active conditions, and critical risks. Do NOT use markdown. Return plain text only."""
    
    try:
        if not client:
            raise Exception("Gemini client not initialized")
            
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
        )
        
        return jsonify({
            "summary": response.text.strip()
        })
    except Exception as e:
        print(f"AI Service Error (patient-history): {e}")
        return jsonify({
            "status": "fallback",
            "summary": "Error generating AI summary. Please refer to past notes manually."
        }), 200

if __name__ == "__main__":
    app.run(port=5000, host="0.0.0.0")