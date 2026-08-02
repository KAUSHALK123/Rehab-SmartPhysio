import os
import joblib
import numpy as np

class MLService:
    def __init__(self):
        self.model = None
        self.model_path = os.path.join(
            os.path.dirname(__file__), "..", "resources", "classifier.joblib"
        )
        self.load_model()

    def load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                print("[ML] Random Forest model loaded successfully.")
            except Exception as e:
                print(f"[ML] Error loading model: {e}")
        else:
            print("[ML] Model file not found. Falling back to rule-based evaluation.")

    def evaluate_exercise(self, exercise_name: str, sensor_data: dict) -> float:
        """
        Evaluates the form correctness for the given exercise.
        Returns accuracy as a float percentage (0.0 to 100.0).
        """
        # If the model is loaded, use it to predict form correctness probability
        if self.model:
            try:
                # Features list ordered exactly as in training:
                # [thumb, index, middle, ring, little, elbow, pressure, wrist_pitch, wrist_roll]
                features = [
                    sensor_data.get("thumb", 80),
                    sensor_data.get("index", 80),
                    sensor_data.get("middle", 80),
                    sensor_data.get("ring", 80),
                    sensor_data.get("little", 80),
                    sensor_data.get("elbow", 180),
                    sensor_data.get("pressure", 0),
                    sensor_data.get("wrist_pitch", 0.0),
                    sensor_data.get("wrist_roll", 0.0)
                ]
                
                # Predict class probabilities
                probs = self.model.predict_proba([features])[0]
                
                # Check mapping based on label classes from train_classifier.py:
                # 0 = Idle / incorrect
                # 1 = Correct Ball Squeeze
                # 2 = Correct Wrist Flexion
                # 3 = Correct Elbow Curl
                
                if exercise_name == "Ball Squeeze":
                    # Accuracy is the probability of class 1
                    acc = probs[1] * 100.0 if len(probs) > 1 else 0.0
                elif exercise_name in ["Wrist Flexion", "Wrist Extension"]:
                    # Accuracy is the probability of class 2
                    acc = probs[2] * 100.0 if len(probs) > 2 else 0.0
                elif exercise_name == "Elbow Curl":
                    # Accuracy is the probability of class 3
                    acc = probs[3] * 100.0 if len(probs) > 3 else 0.0
                else:
                    # General probability of correct movement vs idle
                    acc = (1 - probs[0]) * 100.0
                
                return float(round(acc, 1))
            except Exception as e:
                print(f"[ML] Error during prediction: {e}")
                # Fall back to rule-based logic below
        
        # Fallback rule-based evaluation (so it never crashes)
        return self._rule_based_fallback(exercise_name, sensor_data)

    def _rule_based_fallback(self, exercise_name: str, sensor_data: dict) -> float:
        # Simple rule matching for demo purposes
        if exercise_name == "Ball Squeeze":
            thumb = sensor_data.get("thumb", 80)
            pressure = sensor_data.get("pressure", 0)
            if thumb < 30 and pressure > 400:
                return 95.0
            elif thumb < 50 and pressure > 200:
                return 70.0
            return 10.0
        elif exercise_name == "Wrist Flexion":
            pitch = sensor_data.get("wrist_pitch", 0.0)
            if pitch > 50:
                return 98.0
            elif pitch > 30:
                return 75.0
            return 15.0
        elif exercise_name == "Elbow Curl":
            elbow = sensor_data.get("elbow", 180)
            if 80 <= elbow <= 130:
                return 96.0
            return 20.0
        return 50.0

ml_service = MLService()
