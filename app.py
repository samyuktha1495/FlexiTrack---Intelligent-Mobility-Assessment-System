from flask import Flask, jsonify, send_file, request
import subprocess
import os
import time
import json
import signal

app = Flask(__name__)
from flask_cors import CORS
CORS(app)  # Enable CORS so frontend JS can call API

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import pickle
import os

# === ML Model Paths ===
ML_MODEL_PATH = r"C:\Users\ADMIN\anaconda_projects\Flexibility Prediction ML\flexibility_model.pkl"
ML_DATA_PATH = r"C:\Users\ADMIN\anaconda_projects\Flexibility Prediction ML\Expanded_Flexibility_Data_400.csv"

import joblib
from sklearn.preprocessing import OneHotEncoder, LabelEncoder

# === Exercise Recommendation ML Paths ===
EXERCISE_MODEL_PATH = r"C:\Users\ADMIN\anaconda_projects\Exercise Recommendations ML\random_forest_model_tuned.pkl"
EXERCISE_ENCODER_X_PATH = r"C:\Users\ADMIN\anaconda_projects\Exercise Recommendations ML\onehot_encoder_X.pkl"
EXERCISE_ENCODER_Y_PATH = r"C:\Users\ADMIN\anaconda_projects\Exercise Recommendations ML\label_encoder_y.pkl"
EXERCISE_EXAMPLES_PATH = r"C:\Users\ADMIN\anaconda_projects\Exercise Recommendations ML\category_examples_map.pkl"
EXERCISE_DATA_PATH = r"C:\Users\ADMIN\anaconda_projects\Exercise Recommendations ML\Expanded_Flexibility_Recommendations.csv"
# Global variable to store the trained model
flexibility_model = None

def load_or_train_model():
    """Load existing model or train a new one"""
    global flexibility_model
    
    try:
        # Try to load existing model
        if os.path.exists(ML_MODEL_PATH):
            with open(ML_MODEL_PATH, 'rb') as f:
                flexibility_model = pickle.load(f)
            print("Loaded existing ML model")
        else:
            # Train new model
            train_flexibility_model()
    except Exception as e:
        print(f"Error loading model, training new one: {e}")
        train_flexibility_model()

def train_flexibility_model():
    """Train the flexibility prediction model"""
    global flexibility_model
    
    try:
        # Load data
        df = pd.read_csv(ML_DATA_PATH)
        df.dropna(inplace=True)
        
        # Encode categorical variables
        df_encoded = pd.get_dummies(df, columns=["MedicalCondition", "PainLevel"], drop_first=True)
        
        # Define features and target
        X = df_encoded.drop("FinalFlexScore", axis=1)
        y = df_encoded["FinalFlexScore"]
        
        # Train model
        from sklearn.model_selection import GridSearchCV
        
        param_grid = {
            'n_estimators': [100, 150, 200],
            'max_depth': [None, 10, 20],
            'min_samples_split': [2, 4],
        }
        
        grid_search = GridSearchCV(RandomForestRegressor(random_state=42), param_grid, cv=3, scoring='r2')
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        grid_search.fit(X_train, y_train)
        
        flexibility_model = grid_search.best_estimator_
        
        # Save model
        os.makedirs(os.path.dirname(ML_MODEL_PATH), exist_ok=True)
        with open(ML_MODEL_PATH, 'wb') as f:
            pickle.dump(flexibility_model, f)
            
        print("Model trained and saved successfully")
        
    except Exception as e:
        print(f"Error training model: {e}")
        # Fallback simple model
        flexibility_model = RandomForestRegressor(n_estimators=100, random_state=42)

def predict_flexibility(age, medical_condition, pain_level, initial_score, sessions):
    """Predict flexibility score using the ML model"""
    global flexibility_model
    
    if flexibility_model is None:
        load_or_train_model()
    
    try:
        # Create input dataframe matching training format
        input_data = {
            'Age': age,
            'InitialFlexScore': initial_score,
            'SessionsCompleted': sessions,
            'MedicalCondition_Healthy': 1 if medical_condition == 'None' else 0,
            'MedicalCondition_JointCare': 1 if medical_condition == 'JointCare' else 0,
            'MedicalCondition_Rehab': 1 if medical_condition == 'Rehab' else 0,
            'PainLevel_Moderate': 1 if pain_level == 'Moderate' else 0,
            'PainLevel_Severe': 1 if pain_level == 'Severe' else 0
        }
        
        # Convert to DataFrame
        input_df = pd.DataFrame([input_data])
        
        # Predict
        prediction = flexibility_model.predict(input_df)[0]
        
        # Ensure no regression (final score >= initial score)
        final_score = max(prediction, initial_score)
        
        return round(final_score, 1)
        
    except Exception as e:
        print(f"Prediction error: {e}")
        # Fallback calculation
        improvement = sessions * 0.5 + (5 if medical_condition == 'None' else 2)
        return round(min(20, initial_score + improvement), 1)

# === New ML Prediction Endpoint ===
@app.route('/predict-flexibility')
def predict_flexibility_endpoint():
    try:
        age = int(request.args.get('age', 30))
        medical_condition = request.args.get('medical_condition', 'None')
        pain_level = request.args.get('pain_level', 'None')
        initial_score = int(request.args.get('initial_score', 5))
        sessions = int(request.args.get('sessions', 10))
        
        predicted_score = predict_flexibility(age, medical_condition, pain_level, initial_score, sessions)
        
        return jsonify({
            'predicted_score': predicted_score,
            'status': 'success'
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'predicted_score': initial_score + 2  # Fallback
        }), 500


# === Paths ===
MEDIAPIPE_SCRIPT = r"C:\Users\ADMIN\anaconda_projects\Mediapipe software.py"
STOP_SIGNAL_PATH = r"C:\Users\ADMIN\anaconda_projects\should_stop.txt"
OUTPUT_JSON_PATH = r"C:\Users\ADMIN\anaconda_projects\output\latest_knee_angles.json"
PLOT_PATH = r"C:\Users\ADMIN\anaconda_projects\output\knee_angle_plot.png"

# === Hardware Paths ===
RECEIVER_SCRIPT = r"C:\Users\ADMIN\Hardware\receiver.py"
HARDWARE_JSON_PATH = r"C:\Users\ADMIN\Hardware\angle_summary.json"
HARDWARE_PLOT_PATH = r"C:\Users\ADMIN\Hardware\angles_plot.png"
SYSTEM_PYTHON = r"C:\Users\ADMIN\AppData\Local\Programs\Python\Python313\python.exe"  # Your system Python

mediapipe_process = None  # store the MediaPipe subprocess object
receiver_process = None   # store the receiver.py subprocess object

# === Start Session (Both MediaPipe and Hardware) ===
@app.route('/start-session')
def start_session():
    global mediapipe_process, receiver_process
    
    # Check if MediaPipe is already running
    if mediapipe_process and mediapipe_process.poll() is None:
        return jsonify({"status": "MediaPipe session already running"})
    
    # Check if receiver is already running
    if receiver_process and receiver_process.poll() is None:
        return jsonify({"status": "Hardware receiver already running"})

    # Ensure stop signal file is removed
    if os.path.exists(STOP_SIGNAL_PATH):
        os.remove(STOP_SIGNAL_PATH)

    try:
        # Start MediaPipe as subprocess
        mediapipe_process = subprocess.Popen(
            ["python", MEDIAPIPE_SCRIPT],
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        
        # Start receiver.py as subprocess using your specific system Python
        receiver_process = subprocess.Popen(
            [SYSTEM_PYTHON, RECEIVER_SCRIPT],
            creationflags=subprocess.CREATE_NEW_CONSOLE,
            cwd=r"C:\Users\ADMIN\Hardware"  # Set working directory to Hardware folder
        )
        
        if receiver_process is None:
            raise Exception("Failed to start receiver.py process")
        
        return jsonify({
            "status": "Both MediaPipe and Hardware receiver started",
            "mediapipe_pid": mediapipe_process.pid,
            "receiver_pid": receiver_process.pid
        })
        
    except Exception as e:
        return jsonify({"error": f"Failed to start sessions: {str(e)}"}), 500

# === Stop Session (Both MediaPipe and Hardware) ===
@app.route('/stop-session')
def stop_session():
    global mediapipe_process, receiver_process
    
    results = {}
    
    # Stop MediaPipe
    if mediapipe_process and mediapipe_process.poll() is None:
        # Write stop signal for MediaPipe
        with open(STOP_SIGNAL_PATH, "w") as f:
            f.write("STOP")
        
        # Wait for MediaPipe to exit cleanly
        mediapipe_process.wait()
        mediapipe_process = None
        
        # Read MediaPipe JSON output
        try:
            with open(OUTPUT_JSON_PATH, "r") as f:
                mediapipe_data = json.load(f)
                results.update(mediapipe_data)
        except Exception as e:
            results["mediapipe_error"] = str(e)
    
    # Stop Hardware receiver
    if receiver_process and receiver_process.poll() is None:
        try:
            # Send CTRL+C signal to receiver process
            receiver_process.send_signal(signal.CTRL_C_EVENT)
            
            # Wait a bit for receiver to save files
            time.sleep(2)
            
            # If still running, terminate it
            if receiver_process.poll() is None:
                receiver_process.terminate()
                receiver_process.wait()
            
            receiver_process = None
            
            # Read Hardware JSON output
            if os.path.exists(HARDWARE_JSON_PATH):
                with open(HARDWARE_JSON_PATH, "r") as f:
                    hardware_data = json.load(f)
                    results.update(hardware_data)
            else:
                results["hardware_error"] = "Hardware JSON file not found"
                
        except Exception as e:
            results["hardware_error"] = str(e)
    
    if not results:
        return jsonify({"status": "No active sessions were running"}), 400
    
    return jsonify(results)

# === Serve Hardware Plot Image ===
@app.route('/hardware-plot')
def serve_hardware_plot():
    try:
        if os.path.exists(HARDWARE_PLOT_PATH):
            return send_file(HARDWARE_PLOT_PATH, mimetype='image/png')
        else:
            return jsonify({"error": "Hardware plot not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# === Get Hardware Data ===
@app.route('/hardware-data')
def get_hardware_data():
    try:
        if os.path.exists(HARDWARE_JSON_PATH):
            with open(HARDWARE_JSON_PATH, "r") as f:
                data = json.load(f)
            return jsonify(data)
        else:
            return jsonify({"error": "Hardware data not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# Global variables for exercise recommendation model
exercise_model = None
exercise_encoder_x = None
exercise_encoder_y = None
exercise_examples = None

def load_exercise_model():
    """Load the exercise recommendation model and encoders"""
    global exercise_model, exercise_encoder_x, exercise_encoder_y, exercise_examples
    
    try:
        # Try to load existing models
        if (os.path.exists(EXERCISE_MODEL_PATH) and 
            os.path.exists(EXERCISE_ENCODER_X_PATH) and 
            os.path.exists(EXERCISE_ENCODER_Y_PATH) and 
            os.path.exists(EXERCISE_EXAMPLES_PATH)):
            
            exercise_model = joblib.load(EXERCISE_MODEL_PATH)
            exercise_encoder_x = joblib.load(EXERCISE_ENCODER_X_PATH)
            exercise_encoder_y = joblib.load(EXERCISE_ENCODER_Y_PATH)
            exercise_examples = joblib.load(EXERCISE_EXAMPLES_PATH)
            print("Loaded existing exercise recommendation model")
        else:
            print("Exercise model files not found. Exercise recommendations will not be available.")
            
    except Exception as e:
        print(f"Error loading exercise model: {e}")

def predict_exercises(age, medical_condition, flexibility_score, pain_level):
    """Predict exercise recommendations based on user profile"""
    global exercise_model, exercise_encoder_x, exercise_encoder_y, exercise_examples
    
    if not all([exercise_model, exercise_encoder_x, exercise_encoder_y, exercise_examples]):
        load_exercise_model()
    
    if not all([exercise_model, exercise_encoder_x, exercise_encoder_y, exercise_examples]):
        return "Exercise recommendations not available", "Please ensure all model files are present."
    
    try:
        # Map age to age group
        if age < 30:
            age_group = "Young"
        elif age >= 60:
            age_group = "Senior"
        else:
            age_group = "Adult"
        
        # Map flexibility score to level
        if flexibility_score <= 7:
            flexibility_level = "Poor"
        elif flexibility_score <= 14:
            flexibility_level = "Moderate"
        elif flexibility_score <= 18:
            flexibility_level = "Good"
        else:
            flexibility_level = "Excellent"
        
        # Create input dataframe
        user_data = pd.DataFrame([[age_group, medical_condition, flexibility_level, pain_level]],
                                columns=['Age Group', 'Medical Condition', 'Flexibility Level', 'Pain Level'])
        
        # Encode input
        user_encoded = exercise_encoder_x.transform(user_data)
        user_encoded_df = pd.DataFrame(user_encoded, 
                                     columns=exercise_encoder_x.get_feature_names_out(user_data.columns))
        
        # Predict
        predicted_category_encoded = exercise_model.predict(user_encoded_df)
        predicted_category = exercise_encoder_y.inverse_transform(predicted_category_encoded)[0]
        
        # Get examples
        examples = exercise_examples.get(predicted_category, "No specific exercises found for this category.")
        
        return predicted_category, examples
        
    except Exception as e:
        print(f"Exercise prediction error: {e}")
        return "Basic Flexibility & Low-Impact", "Gentle stretching, Basic bodyweight exercises, Wall push-ups"

# === Exercise Recommendation Endpoint ===
@app.route('/recommend-exercises')
def recommend_exercises_endpoint():
    try:
        age = int(request.args.get('age', 30))
        medical_condition = request.args.get('medical_condition', 'Healthy')
        flexibility_score = int(request.args.get('flexibility_score', 10))
        pain_level = request.args.get('pain_level', 'None')
        
        category, exercises = predict_exercises(age, medical_condition, flexibility_score, pain_level)
        
        return jsonify({
            'category': category,
            'exercises': exercises,
            'status': 'success'
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'category': 'Basic Flexibility & Low-Impact',
            'exercises': 'Gentle stretching, Basic movements'
        }), 500

# Initialize both models when app starts
load_or_train_model()
load_exercise_model()

# === Run App ===
if __name__ == '__main__':
    try:
        app.run(debug=True, use_reloader=False)
    except KeyboardInterrupt:
        print("\nShutting down server...")
    