import os
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime

REVERSE_CLASS_MAPPING = {
    0: 'SAFE',
    1: 'WARNING',
    2: 'CRITICAL',
    3: 'FAILURE'
}

class PredictiveMaintenanceInferenceEngine:
    def __init__(self, models_dir=None):
        if models_dir is None:
            models_dir = os.getenv("MODELS_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models_ml"))
        self.models_dir = models_dir
        self.loaded_models = {}
        self.loaded_features = {}
        
    def _get_model_key(self, machine_key, subsystem_name):
        return f"{machine_key.upper()}_{subsystem_name.lower()}"
        
    def load_subsystem_model(self, machine_key, subsystem_name):
        key = self._get_model_key(machine_key, subsystem_name)
        if key in self.loaded_models:
            return self.loaded_models[key], self.loaded_features[key]
            
        machine_dir = os.path.join(self.models_dir, machine_key.upper())
        sub_lower = subsystem_name.lower()
        
        model_path = os.path.join(machine_dir, f"{sub_lower}_model.pkl")
        feat_path = os.path.join(machine_dir, f"{sub_lower}_feature_names.json")
        
        # Fallback path check if primary models_dir is missing file
        if not os.path.exists(model_path):
            fallback_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "ml-training", "outputs", "models", machine_key.upper()))
            alt_model_path = os.path.join(fallback_dir, f"{sub_lower}_model.pkl")
            alt_feat_path = os.path.join(fallback_dir, f"{sub_lower}_feature_names.json")
            if os.path.exists(alt_model_path) and os.path.exists(alt_feat_path):
                model_path = alt_model_path
                feat_path = alt_feat_path

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found for machine '{machine_key}' subsystem '{subsystem_name}' at: {model_path}")
        if not os.path.exists(feat_path):
            raise FileNotFoundError(f"Feature names file not found for machine '{machine_key}' subsystem '{subsystem_name}' at: {feat_path}")
            
        model = joblib.load(model_path)
        with open(feat_path, 'r') as f:
            feature_names = json.load(f)
            
        self.loaded_models[key] = model
        self.loaded_features[key] = feature_names
        return model, feature_names
        
    def predict_subsystem_health(self, machine_key, subsystem_name, sensor_readings):
        """
        Unified prediction interface.
        
        Input:
            machine_key: str (e.g. 'CAT320')
            subsystem_name: str (e.g. 'engine')
            sensor_readings: dict (e.g. {'Engine_RPM': 1850, 'Engine_Load': 75.0, ...})
            
        Output:
            dict containing predicted_status, prediction_confidence, class_probability_distribution, timestamp
        """
        model, feature_names = self.load_subsystem_model(machine_key, subsystem_name)
        
        # Build feature vector in exact feature order
        input_data = {}
        for feat in feature_names:
            if feat in sensor_readings:
                input_data[feat] = [float(sensor_readings[feat])]
            else:
                input_data[feat] = [0.0]  # Fallback default for missing feature
                
        df_input = pd.DataFrame(input_data, columns=feature_names)
        
        probas = model.predict_proba(df_input)[0]
        pred_idx = int(np.argmax(probas))
        
        predicted_status = REVERSE_CLASS_MAPPING.get(pred_idx, f"CLASS_{pred_idx}")
        confidence = float(np.max(probas))
        
        class_prob_dist = {
            REVERSE_CLASS_MAPPING.get(i, f"CLASS_{i}"): float(probas[i])
            for i in range(len(probas))
        }
        
        return {
            'machine_key': machine_key.upper(),
            'subsystem_name': subsystem_name.lower(),
            'predicted_status': predicted_status,
            'prediction_confidence': confidence,
            'class_probability_distribution': class_prob_dist,
            'timestamp': datetime.now().isoformat()
        }

if __name__ == '__main__':
    print("Predictive Maintenance Inference Engine Module Loaded Successfully.")
