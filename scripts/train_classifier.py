import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier

def generate_synthetic_data(num_samples=1000):
    """
    Generates synthetic physiotherapy sensor readings.
    Features: [thumb, index, middle, ring, little, elbow, pressure, wrist_pitch, wrist_roll]
    Labels:
      0 = Idle / incorrect posture
      1 = Correct Ball Squeeze (closed hand, high pressure)
      2 = Correct Wrist Flexion (elbow straight, wrist bent pitch-wise)
      3 = Correct Elbow Curl (elbow bent at ~90-130 degrees)
    """
    np.random.seed(42)
    features = []
    labels = []

    for _ in range(num_samples):
        # 1. Idle or bad posture (Label 0)
        # Random random noise, open hands, low pressure, no flexion
        thumb = np.random.uniform(70, 90)
        index = np.random.uniform(70, 90)
        middle = np.random.uniform(70, 90)
        ring = np.random.uniform(70, 90)
        little = np.random.uniform(70, 90)
        elbow = np.random.uniform(160, 180)
        pressure = np.random.uniform(0, 20)
        pitch = np.random.uniform(-10, 10)
        roll = np.random.uniform(-10, 10)
        features.append([thumb, index, middle, ring, little, elbow, pressure, pitch, roll])
        labels.append(0)

        # 2. Correct Ball Squeeze (Label 1)
        # Closed fingers (low sensor values in mock, e.g. 5-20), high pressure (500-800)
        thumb = np.random.uniform(5, 20)
        index = np.random.uniform(5, 20)
        middle = np.random.uniform(5, 20)
        ring = np.random.uniform(5, 20)
        little = np.random.uniform(5, 20)
        elbow = np.random.uniform(140, 180)
        pressure = np.random.uniform(500, 800)
        pitch = np.random.uniform(-20, 20)
        roll = np.random.uniform(-20, 20)
        features.append([thumb, index, middle, ring, little, elbow, pressure, pitch, roll])
        labels.append(1)

        # 3. Correct Wrist Flexion (Label 2)
        # Straight elbow (150-180), open fingers, high wrist pitch bend (50-80 degrees)
        thumb = np.random.uniform(70, 90)
        index = np.random.uniform(70, 90)
        middle = np.random.uniform(70, 90)
        ring = np.random.uniform(70, 90)
        little = np.random.uniform(70, 90)
        elbow = np.random.uniform(150, 180)
        pressure = np.random.uniform(0, 30)
        pitch = np.random.uniform(50, 80) # Significant bend
        roll = np.random.uniform(-20, 20)
        features.append([thumb, index, middle, ring, little, elbow, pressure, pitch, roll])
        labels.append(2)

        # 4. Correct Elbow Curl (Label 3)
        # Bent elbow (80-130 degrees), open/loose hands, minimal pressure
        thumb = np.random.uniform(60, 90)
        index = np.random.uniform(60, 90)
        middle = np.random.uniform(60, 90)
        ring = np.random.uniform(60, 90)
        little = np.random.uniform(60, 90)
        elbow = np.random.uniform(80, 130) # Bent elbow
        pressure = np.random.uniform(0, 20)
        pitch = np.random.uniform(-20, 20)
        roll = np.random.uniform(-20, 20)
        features.append([thumb, index, middle, ring, little, elbow, pressure, pitch, roll])
        labels.append(3)

    return np.array(features), np.array(labels)

def train_and_save():
    print("Generating training data...")
    X, y = generate_synthetic_data(1500)
    
    print("Training Random Forest Classifier...")
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X, y)
    
    # Create resources folder if not exists
    resource_dir = os.path.join(os.path.dirname(__file__), "..", "backend", "app", "resources")
    os.makedirs(resource_dir, exist_ok=True)
    
    model_path = os.path.join(resource_dir, "classifier.joblib")
    print(f"Saving model to {model_path}...")
    joblib.dump(clf, model_path)
    print("Model trained and saved successfully!")

if __name__ == "__main__":
    train_and_save()
