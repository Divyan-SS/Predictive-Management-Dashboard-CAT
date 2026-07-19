# Project Production Restructuring Plan

This document details the restructuring of the **Predective-Maintanance--CAT** repository to organize all machine learning artifacts and inference engines within the FastAPI AI service microservice.

---

## 1. Directory Structure Comparisons

### Before Restructuring (Existing State)
In the initial project structure, machine learning models and inference scripts resided outside the core repository paths (in the local workstation training directories), and the AI service computed metrics utilizing rule-based heuristics only.

```
Predective-Maintanance--CAT/
├── backend/                       # Django Web Application
├── frontend/                      # Next.js Client App
├── ai-service/                    # FastAPI Microservice (Without ML models)
│   ├── app/
│   │   ├── routes.py
│   │   ├── services.py            # Hardcoded heuristics logic
│   │   └── models.py
│   └── main.py
└── simulator/                     # Python Sensor Simulator
```

### After Restructuring (Production Structure)
In the new production layout, all trained machine learning classifier model pickles, feature configuration schemas, and the predictive inference broker are copied directly into the `ai-service` workspace.

```
Predective-Maintanance--CAT/
├── backend/                       # Django Web Application
├── frontend/                      # Next.js Client App
├── ai-service/                    # FastAPI Microservice
│   ├── app/
│   │   ├── models_ml/             # Dynamic ML model registry directory
│   │   │   ├── CAT320/            # Excavator Subsystem models (PKL + JSON)
│   │   │   ├── CAT730/            # Articulated Dump Truck models
│   │   │   ├── CAT950/            # Wheel Loader models
│   │   │   └── CATD6/             # Bulldozer models
│   │   ├── inference.py           # Self-contained Inference Engine Broker
│   │   ├── services.py            # API health prediction calculations
│   │   └── routes.py
│   └── main.py
└── docs/                          # System documentation and verification logs
    ├── PROJECT_STRUCTURE.md
    └── PHASE1_MODEL_MIGRATION_REPORT.md
```

---

## 2. Rationale: Model Placement & Design Decisions

### Why ML Models are inside `ai-service`
1. **Microservices Separation of Concerns:** The Django backend acts as the central business logic controller, authentication server, and data storage interface. Keeping heavy scientific calculations (scikit-learn, LightGBM, XGBoost, pandas) within FastAPI prevents memory overhead and dependency conflicts inside the main Django web server.
2. **Horizontal Scaling:** The FastAPI `ai-service` can be scaled horizontally and load-balanced independently to handle increased batch or stream prediction loads without degrading the performance of the dashboard UI endpoints.
3. **Warmed Model Initialization:** The models are loaded into RAM once during the FastAPI application lifecycle startup phase, ensuring near-instantaneous `1Hz` inference speeds.

### Future API Integration Flow
- When a user views an equipment detail page on the Next.js frontend, the page initiates a REST call to `GET /api/predict/health/{machine_id}` routed to FastAPI.
- FastAPI fetches the most recent telemetry rows from the PostgreSQL database, identifies the corresponding machine type, and routes the readings to the `PredictiveMaintenanceInferenceEngine`.
- The engine maps input database columns to the feature vectors expected by the model, computes prediction probabilities, and updates the `predictions` and `alerts` tables.
