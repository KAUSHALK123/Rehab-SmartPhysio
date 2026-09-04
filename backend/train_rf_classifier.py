import pandas as pd
import os
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import numpy as np

# Mapping text labels to integers for the model
# Matches `ml_service.py` expected output probabilities
# 0 = Idle / Incorrect
# 1 = Correct Ball Squeeze
# 2 = Correct Wrist Flexion
# 3 = Correct Elbow Curl
LABEL_MAP = {
    'Idle': 0,
    'Over_Compensating': 0,
    'Incomplete': 0,
    'Correct_Ball_Squeeze': 1,
    'Correct_Wrist_Flexion': 2,
    'Correct_Elbow_Curl': 3
}

def train_model(dataset_path):
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        print("Please collect data using the frontend /data-collection page and save it here.")
        return

    print("Loading dataset...")
    df = pd.read_csv(dataset_path)
    
    # Feature engineering: We expect raw packets, but for simplicity, we map row-by-row.
    # In a real scenario, you'd extract sliding window features (mean, std, etc).
    # Expected columns: ['timestamp', 'exercise', 'label', 'thumb', 'index', 'middle', 'ring', 'little', 'elbow', 'pressure', 'wrist_pitch', 'wrist_roll']
    
    # Create the target mapping
    def map_target(row):
        ex = row['exercise'].replace(" ", "_")
        lbl = row['label'].replace(" ", "_")
        if lbl == 'Correct':
            key = f"Correct_{ex}"
            return LABEL_MAP.get(key, 0)
        return 0 # Incorrect/Idle

    df['target'] = df.apply(map_target, axis=1)

    features = ['thumb', 'index', 'middle', 'ring', 'little', 'elbow', 'pressure', 'wrist_pitch', 'wrist_roll']
    X = df[features]
    y = df['target']

    print(f"Training on {len(df)} samples...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y if len(y.unique()) > 1 else None)

    # Initialize Random Forest
    rf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    rf.fit(X_train, y_train)

    # Evaluate
    y_pred = rf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nModel Accuracy: {acc * 100:.2f}%")
    
    if len(np.unique(y_test)) > 1:
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))

    # Feature Importance
    importances = rf.feature_importances_
    print("\nFeature Importances:")
    for f, imp in zip(features, importances):
        print(f"  {f}: {imp:.4f}")

    # Export model
    export_path = os.path.join(os.path.dirname(__file__), 'app', 'resources', 'classifier.joblib')
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    joblib.dump(rf, export_path)
    print(f"\nModel saved successfully to {export_path}")
    print("The backend MLService will automatically load this model on next startup.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        dataset_path = sys.argv[1]
    else:
        dataset_path = "dataset.csv"
    train_model(dataset_path)
