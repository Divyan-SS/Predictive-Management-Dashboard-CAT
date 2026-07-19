# PHASE 1: Model Migration Verification Report

This report verifies the structural integrity of the migrated subsystem machine learning models.

| Machine | Subsystem | Pickle File | Loaded Successfully | Model Type | Feature Schema Exists |
| :--- | :--- | :--- | :---: | :--- | :---: |
| CAT320 | BOOM | `boom_model.pkl` | YES | `LGBMClassifier` | YES |
| CAT320 | ENGINE | `engine_model.pkl` | YES | `RandomForestClassifier` | YES |
| CAT320 | HYDRAULIC | `hydraulic_model.pkl` | YES | `XGBClassifier` | YES |
| CAT730 | BRAKE_TIRE | `brake_tire_model.pkl` | YES | `XGBClassifier` | YES |
| CAT730 | ENGINE | `engine_model.pkl` | YES | `RandomForestClassifier` | YES |
| CAT730 | TRANSMISSION | `transmission_model.pkl` | YES | `LGBMClassifier` | YES |
| CAT950 | BUCKET_AXLE | `bucket_axle_model.pkl` | YES | `LGBMClassifier` | YES |
| CAT950 | ENGINE | `engine_model.pkl` | YES | `RandomForestClassifier` | YES |
| CAT950 | HYDRAULIC | `hydraulic_model.pkl` | YES | `RandomForestClassifier` | YES |
| CATD6 | ENGINE | `engine_model.pkl` | YES | `RandomForestClassifier` | YES |
| CATD6 | HYDRAULIC | `hydraulic_model.pkl` | YES | `RandomForestClassifier` | YES |
| CATD6 | TRACK | `track_model.pkl` | YES | `RandomForestClassifier` | YES |
