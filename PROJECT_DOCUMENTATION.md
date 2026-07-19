# Caterpillar CAT® Predictive Maintenance Platform
## Enterprise Software Design Document & System Documentation

---

## 1. PROJECT OVERVIEW

### 1.1 What This Project Is
The **Caterpillar CAT® Predictive Maintenance Platform** is an enterprise-grade Industrial Internet of Things (IIoT) analytics and fleet monitoring system. It provides site supervisors, maintenance engineers, service teams, and executives with real-time insight into the health, status, and telemetry profile of heavy machinery across globally distributed sites. 

### 1.2 The Business Problem It Solves
Heavy machinery downtime represents one of the single largest losses in the mining, construction, and agricultural sectors. Unscheduled breakdowns result in:
*   **Direct Revenue Loss**: idle machinery halts processing plants, excavation sites, and supply chains.
*   **Safety Hazards**: catastrophic structural or mechanical failures (e.g., cooling system explosions, bearing seizures) can endanger operators.
*   **High Emergency Repair Costs**: last-minute shipping of replacement parts and unscheduled technician overtime are significantly more expensive than planned maintenance.
*   **Suboptimal Asset Lifespans**: running assets with minor faults accelerates overall mechanical wear, shortening the operational lifecycle.

### 1.3 Why Predictive Maintenance is Important
Traditional maintenance operates on either a reactive model (fix when broken) or a preventive model (fix on static schedules regardless of wear). Predictive maintenance uses real-time telemetry combined with machine learning (ML) and statistical anomaly detection to identify mechanical wear *before* a failure occurs. By scheduling repairs precisely when indicated by telemetry, operators maximize asset uptime and minimize repair overhead.

### 1.4 Project Objectives
1.  **Real-Time Data Ingestion**: Seamlessly ingest high-frequency sensor readings (temperature, vibration, pressure, voltage, RPM) from thousands of heavy machines.
2.  **Autonomous Anomaly Detection**: Identify spikes, outliers, and degradation patterns in telemetry stream indicators using ML.
3.  **Actionable Failure Forecasting**: Predict the Remaining Useful Life (RUL) and specific failure modes (e.g., bearing, hydraulic, engine) of active machines.
4.  **Integrated Maintenance Workflows**: Auto-generate maintenance tasks, assign them to regional service teams, and track completion states.
5.  **Role-Based Fleet Visibility**: Deliver custom, optimized dashboards for varying user personas (Super Admins, Maintenance Teams, Maintenance Engineers).

### 1.5 Main Users of the System
*   **Super Admin (Executive/Fleet Director)**: Monitors overall fleet health, global asset distribution, macro cost savings, and manages cross-site configurations.
*   **Maintenance Department (Facility Supervisor)**: Oversees operations at a specific location, coordinates active machinery distribution, and manages supervisors.
*   **Maintenance Engineer**: Receives automated telemetry warning tasks, performs mechanical repairs, calibrates sensors, and updates work order statuses.
*   **Service Team (Support Crew)**: Manages regional service requests, replaces parts, and tracks fluid replenishment.

---

## 2. TECHNOLOGY STACK

The system uses a modern, decoupled microservice architecture built to support high-throughput write streams and low-latency client reads.

| Technology | Purpose | Advantages | Where It Is Used | Communication Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Next.js (v16)** | Frontend Web Framework | Server-side rendering (SSR), static site generation (SSG), file-based routing, and hot module reloading. | Complete user client interface (`/frontend`). | HTTPS / REST to Django; WebSockets to telemetry streams. |
| **React** | Component Library | Declarative UI state updates, component reusability, virtual DOM diffing. | Frontend dashboard elements, telemetry charts, tables, navigation. | Internal React state, Props, Context. |
| **TypeScript** | Static Type Safety | Eliminates runtime type errors, improves developer autocomplete, self-documenting code. | Across both Next.js frontend and configuration scripts. | Compile-time validation. |
| **Tailwind CSS** | Styling Engine | Utility-first styling, highly performant bundle sizes, built-in responsive grid controls. | Global theme tokens, custom light/dark Caterpillar branding system. | CSS compilation. |
| **Django (v5)** | Enterprise Backend Core | Robust ORM, built-in security features, simple migration system, simple simple request routing. | Core web service and API endpoints (`/backend`). | REST API client routing. |
| **Django REST Framework (DRF)** | API Serialization | Powerful serializers, viewsets, authentication middleware, and standardized JSON returns. | Telemetry endpoints, user profiling, role registration, sites overview APIs. | JSON over HTTP/S. |
| **FastAPI** | AI Telemetry Microservice | Asynchronous routing, automated Swagger doc generation, low memory footprint, optimized for scientific Python. | Anomaly detection and prediction calculations (`/ai-service`). | Called by Django / Frontend via REST; database read/write. |
| **PostgreSQL (Neon)** | Persistent SQL Database | Serverless Postgres database with auto-scaling, fast branching, and partitioning support. | Global persistent data store (Sites, Machines, Users, History, Telemetry). | Direct SQL connection pools (psycopg2 / SQLAlchemy). |
| **SimpleJWT** | Authentication protocol | Stateless JWT tokens, signed payload validation, cryptographically secure. | User login, registration, and protected route access. | Authorization Header: `Bearer <token>`. |
| **Railway** | Cloud Infrastructure Hosting | Automated Git-triggered builds, built-in environment injection, robust logging. | Hosting for Django Backend, FastAPI, and simulator. | Internal private networking. |
| **Vercel** | Frontend Deployments | Edge network routing, automated global CDN caching, optimized Next.js support. | Frontend hosting. | Public internet over SSL. |

---

## 3. SYSTEM ARCHITECTURE

The platform implements a modular architecture separating data simulation, database persistence, AI telemetry evaluation, Django administrative APIs, and Next.js presentation.

### 3.1 Architecture Diagram

```mermaid
graph TD
    subgraph Browser Client [Web Browser Client]
        FE[Next.js Frontend]
        state[React State / Context]
    end

    subgraph Cloud Infrastructure [Railway / Vercel Host]
        subgraph Django Admin App [Django Backend Core]
            DJ[Django API Server]
            ORM[Django ORM]
        end

        subgraph AI Microservice [FastAPI AI Engine]
            FA[FastAPI Server]
            ML[Predictive Maintenance Logic]
        end

        subgraph Simulator Engine [Telemetry Simulator]
            SIM[Python Sim Loop]
        end

        subgraph Database Layer [Neon Serverless Cloud]
            DB[(PostgreSQL Database)]
        end
    end

    %% Data flow connections
    SIM -->|Writes Batch Telemetry every 10s| DB
    SIM -->|Updates Machine Status instantly| DB
    
    FE <--->|Reads/Writes JWT, Users, Machinery, Tasks| DJ
    FE <--->|Fetches Live Predictions & Anomalies| FA
    
    DJ <--->|Queries Sites, History, Users| DB
    FA <--->|Queries Telemetry History & Saves Predictions| DB
```

### 3.2 Step-by-Step Data Lifecycle
1.  **Sensor Generation**: The **Telemetry Simulator** calculates high-frequency sensor readings (temperature, vibration, pressure, voltage, RPM) for 105 machines every second.
2.  **Database Batch Write**: The simulator pools these readings in memory and flushes them to the Neon PostgreSQL `sensor_data` table in batches every 10 seconds using `psycopg2.extras.execute_values` to reduce network overhead.
3.  **AI microservice Evaluation**: When a client requests machine details, the browser queries the **FastAPI AI Microservice** endpoint `/api/predict/health/{machine_id}`.
4.  **Postgres Telemetry Read**: FastAPI fetches the last 50 telemetry points for that machine from Neon Postgres, runs its rule-based and Z-score anomaly algorithms, saves the result to the `predictions` table, and returns the health metrics.
5.  **Django Coordination**: For administrative, authentication, and task workflows (e.g., registering new machinery, assigning maintenance), the browser communicates with **Django**. Django reads/writes to the corresponding database tables and handles JWT checks.
6.  **Next.js Render**: The frontend receives the JSON payloads and updates its virtual DOM instantly, rendering animated dashboards, fleet lists, and maintenance tabs.

### 3.3 Scalability Factors
*   **Time-Series Partitioning**: The `sensor_data` table is range-partitioned by `timestamp` in PostgreSQL, preventing index degradation as millions of telemetry points accumulate.
*   **Database Batching**: Batching telemetry writes every 10 seconds reduces round-trip times and locking conflicts on Neon DB.
*   **Decoupled AI Layer**: Telemetry evaluations are offloaded to FastAPI, protecting the main Django web app from CPU-heavy scientific numpy calculations.

---

## 4. PROJECT FOLDER STRUCTURE

```
CAT HACKATHON/
├── ai-service/             # FastAPI Machine Learning & Anomaly Detection microservice
│   ├── app/                # Main application package
│   │   ├── config.py       # Configuration and Environment variable injection
│   │   ├── database.py     # SQLAlchemy connection engines and session pools
│   │   ├── models.py       # Declarative SQLAlchemy models matching SQL tables
│   │   ├── routes.py       # FastAPI routing endpoints (/api/predict)
│   │   ├── schemas.py      # Pydantic validation schemas
│   │   └── services.py     # ML algorithms, Z-score, failure risk algorithms
│   ├── main.py             # FastAPI entrypoint script
│   ├── fallback.db         # Local SQLite fallback database file
│   └── requirements.txt    # Python packages required (numpy, sqlalchemy, fastapi)
│
├── backend/                # Django REST Framework Web API Core
│   ├── apps/               # Decoupled Django applications
│   │   ├── machinery/      # Sites, Machinery, and global summary reports
│   │   ├── maintenance/    # Maintenance/Service Teams and repair histories
│   │   ├── notifications/  # Unread and resolved notifications
│   │   ├── telemetry/      # Telemetry logs, predictions, and alerts
│   │   └── users/          # Users model, roles, and simple JWT authentication
│   ├── config/             # Django settings, WSGI, ASGI, and primary router configurations
│   ├── manage.py           # Django administrative command script
│   └── requirements.txt    # Python packages (django, djangorestframework, simplejwt)
│
├── frontend/               # Next.js Frontend Application
│   ├── src/
│   │   ├── app/            # Next.js App Router folders
│   │   │   ├── layout.tsx  # Root Layout (Injects global fonts, styles, and dark class)
│   │   │   ├── globals.css # Styling theme variables (warm stone, caterpillar yellow)
│   │   │   ├── page.tsx    # Primary SPA dashboard router and layout wrapper
│   │   │   └── login/      # User credentials login page
│   │   └── components/     # Reusable layout and dashboard components
│   │       ├── layout/     # Navigation modules (sidebar, navbar)
│   │       ├── ui/         # Generic UI primitives (card, badge, button, input, select, table)
│   │       └── dashboard/  # Dashboard views (super-admin, maintenance-engineer, maintenance-engineer)
│   └── package.json        # Node modules configuration (React, Tailwind, ChartJS)
│
└── simulator/              # High-frequency Telemetry Data Simulator
    ├── main.py             # Multi-machine telemetry generator and automatic DB provisioner
    └── requirements.txt    # Python dependency packages (psycopg2-binary, python-dotenv)
```

---

## 5. MODULES

### 5.1 Authentication Module
*   **Purpose**: Manages secure access control.
*   **Responsibilities**: Registers new operator accounts, validates login credentials, generates stateless JSON Web Tokens (Access and Refresh), and verifies token signatures on protected API routes.
*   **Main Components**: Custom views, simplejwt middleware, `UserProfileView`.
*   **Database Tables**: `users`, `roles`.
*   **APIs**: `POST /api/auth/login/`, `POST /api/auth/logout/`, `POST /api/auth/register/`, `GET /api/auth/me/`.
*   **Future Scope**: Support OAuth2 logins, hardware key credentials, and multi-factor authentication (MFA).

### 5.2 Fleet Overview Module
*   **Purpose**: Delivers site-level statistics and map distributions.
*   **Responsibilities**: Aggregates health values across sites and returns equipment breakdowns.
*   **Main Components**: `SuperAdminDashboard`, `MaintenanceDepartmentDashboard`.
*   **Database Tables**: `sites`, `machines`, `alerts`.
*   **APIs**: `GET /api/machinery/sites/`, `GET /api/machinery/reports/summary/`.
*   **Future Scope**: Integration with real GIS location updates for active machinery mapping.

### 5.3 Machinery Profile Module
*   **Purpose**: Tracks individual machinery configuration.
*   **Responsibilities**: Stores serial numbers, purchase histories, and tracks status variables.
*   **Main Components**: `MachineDetails`.
*   **Database Tables**: `machines`.
*   **APIs**: `GET /api/machinery/machines/`, `POST /api/machinery/machines/`.
*   **Future Scope**: Attaching original CAD schematics and manufacturing manuals to machines.

### 5.4 AI Service Module
*   **Purpose**: Calculates machinery wear factors.
*   **Responsibilities**: Runs running average calculations and standard deviation checks.
*   **Main Components**: `PredictiveMaintenanceService`, `FASTAPI routes`.
*   **Database Tables**: `sensor_data`, `predictions`.
*   **APIs**: `GET /api/predict/health/{machine_id}`, `GET /api/predict/anomalies/{machine_id}`.
*   **Future Scope**: Incorporate deep neural networks (LSTM, Transformers) to train on longer wear history.

### 5.5 Maintenance Module
*   **Purpose**: Tracks spanner-work activities.
*   **Responsibilities**: Handles task assignment, logging cost metrics, and updating repair statuses.
*   **Main Components**: Tabbed `MAINTENANCE` component, `MaintenanceHistoryViewSet`.
*   **Database Tables**: `maintenance_history`, `maintenance_teams`.
*   **APIs**: `GET /api/maintenance/maintenance-history/`, `POST /api/maintenance/maintenance-history/`.
*   **Future Scope**: Automated spare parts inventory request matching.

---

## 6. FRONTEND COMPONENTS

### 6.1 Component Hierarchy

```
RootLayout (layout.tsx)
 └── Home SPA (page.tsx)
      ├── Sidebar Navigation (sidebar.tsx)
      ├── Top Navigation Bar (navbar.tsx)
      ├── Dashboard Workspace View Router
      │    ├── SuperAdminDashboard (super-admin.tsx)
      │    │    ├── Card Primitive (card.tsx)
      │    │    ├── Badge Primitive (badge.tsx)
      │    │    └── MAINTENANCE Component (tabbed filters)
      │    │
      │    ├── MaintenanceDepartmentDashboard (maintenance-engineer.tsx)
      │    │    └── Table Primitives (table.tsx)
      │    │
      │    ├── MaintenanceEngineerDashboard (maintenance-engineer.tsx)
      │    │    └── Button Primitive (button.tsx)
      │    │
      │    └── MachineDetails (machine-details.tsx)
      │         └── Custom SVG Telemetry Chart
      │
      └── Design System / Palette Primitive
```

### 6.2 Key React Components

#### `SuperAdminDashboard`
*   **Purpose**: Renders the executive-level fleet view.
*   **Parent Component**: `Home` ([page.tsx](file:///c:/Users/admin/Desktop/CAT%20HACKATHON/frontend/src/app/page.tsx))
*   **Child Components**: `Card`, `Badge`, tabbed `MAINTENANCE` filter component.
*   **Props**: None (static route container).
*   **State**: `severityFilter`, `siteFilter` (alarms toolbar), `activeMaintenanceTab`, `maintenanceSearch`, `maintenanceSort`, `maintenanceCostSort` (maintenance toolbar).
*   **Hooks**: `useState`, `useMemo` (filters calculations).
*   **API Calls**: Resolves mock variables; queries Django core backend stats.

#### `MachineDetails`
*   **Purpose**: Renders detailed real-time sensor statistics for a single chosen machine.
*   **Parent Component**: `Home` ([page.tsx](file:///c:/Users/admin/Desktop/CAT%20HACKATHON/frontend/src/app/page.tsx))
*   **Child Components**: `Card`, `Badge`, custom SVG time-series charts.
*   **Props**: `machineId` (UUID string), `onBack` (navigation callback).
*   **State**: `activeTab` ("realtime", "anomalies", "predictions"), `telemetryHistory`, `isPolling`.
*   **Hooks**: `useEffect` (telemetry tick loop), `useState`.
*   **API Calls**: `GET /api/predict/health/{id}` for live evaluations, `GET /api/predict/anomalies/{id}` for history.

---

## 7. USER ROLES

The system enforces strict permission scoping based on user roles defined in the `roles` table:

| Role Name | Primary Responsibility | Accessible Views | Key Permissions | Restrictions |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Global Fleet Operations | All Dashboards, Settings, Reports, Design System, Admin backend. | Full CRUD on Users, Sites, Teams, Machines; override alerts. | None. |
| **Maintenance Department** | Facility Operations Supervisor | Site Dashboard, Site Machines list, Reports. | Edit Machine statuses, assign local tasks, inspect local telemetry. | Cannot access other Sites' private telemetry or delete Sites. |
| **Maintenance Engineer** | On-site machinery repair | Maintenance Portal, Assigned Machine logs. | Update task status (`scheduled` $\rightarrow$ `in-progress` $\rightarrow$ `completed`), log parts replaced and costs. | Cannot create new machinery profiles or modify global site configurations. |
| **Service Team** | Support coordination | Service Portal, Parts catalog. | Read work orders, log fluid levels, and request inventory resources. | Cannot resolve high-severity predictions or clear global alarms. |
| **Operator** | Machine Driving | Realtime telemetry feedback portal. | Read status warnings, trigger emergency shutdown alarms. | Cannot view other operator details or clear faults. |

---

## 8. FEATURES

### 8.1 User Login
*   **Purpose**: Authenticate operators.
*   **Workflow**: User inputs credentials $\rightarrow$ Django hashes and checks password $\rightarrow$ Returns JWT $\rightarrow$ Next.js saves token to `localStorage` and routes to home.
*   **Inputs**: Username/Email, password.
*   **Outputs**: Cryptographically signed access and refresh tokens.
*   **Tables**: `users`.

### 8.2 Maintenance Tabbed Workflow
*   **Purpose**: Group and filter operations on machinery tasks.
*   **Workflow**: Selecting "Complete" filters out active tasks. Choosing sorting variables (Cost or Date) triggers reactive array sorting.
*   **Inputs**: Tab click, select value, input search string.
*   **Outputs**: Dynamically ordered, filtered array mapping of maintenance cards.
*   **Tables**: `maintenance_history`.

---

## 9. DATABASE DESIGN

### 9.1 Entity-Relationship (ER) Diagram

```
+---------------+         +---------------+         +---------------+
|     ROLES     |         |     USERS     |         |     SITES     |
+---------------+         +---------------+         +---------------+
| id (PK, UUID) |1      * | id (PK, UUID) |1      1 | id (PK, UUID) |
| name (Unique) +-------->| username      +-------->| name          |
| description   |         | email         |         | location      |
+---------------+         | password_hash |         | manager_id(FK)|
                          | role_id (FK)  |         +-------+-------+
                          +---------------+                 | 1
                                                            |
                                                            | *
+---------------+         +---------------+         +-------v-------+
|  ALERTS FEED  |         |  PREDICTIONS  |         |   MACHINES    |
+---------------+         +---------------+         +---------------+
| id (PK, UUID) |*      1 | id (PK, UUID) |1      * | id (PK, UUID) |
| machine_id(FK)|<--------| machine_id(FK)|<--------| site_id (FK)  |
| prediction(FK)|         | probability   |         | name          |
| severity      |         | anomaly_score |         | model         |
| message       |         | failure_mode  |         | serial_number |
+---------------+         +---------------+         | status        |
                                                    +-------+-------+
                                                            | 1
                                                            |
                                                            | *
                                                    +-------v-------+
                                                    |  SENSOR DATA  |
                                                    +---------------+
                                                    | id (Bigint)   |
                                                    | machine_id(FK)|
                                                    | timestamp(PK) |
                                                    | temperature   |
                                                    | vibration     |
                                                    | pressure      |
                                                    +---------------+
```

### 9.2 Key Tables Definition

#### `machines`
*   **Purpose**: Holds asset metadata.
*   **Columns**: `id` (UUID PK), `site_id` (UUID FK), `name`, `model`, `serial_number` (Unique), `status` (Default: `'operational'`), `purchase_date`, `created_at`, `updated_at`.
*   **Relationships**: References `sites(id)` (CASCADE on delete).
*   **Example Record**:
    ```json
    {
      "id": "8c6b75c8-1002-4fb0-a24a-e4905d625d99",
      "site_id": "3a11bcf2-3e28-4e89-9a2c-f601ef4cd811",
      "name": "CAT 797F Mining Truck #01",
      "model": "797F",
      "serial_number": "CAT-797F-SIM001",
      "status": "warning",
      "purchase_date": "2024-03-12"
    }
    ```

#### `sensor_data`
*   **Purpose**: Time-series partition table holding high-frequency telemetry.
*   **Columns**: `id` (Bigint), `machine_id` (UUID FK), `timestamp` (TIMESTAMPTZ PK), `temperature`, `vibration`, `pressure`, `voltage`, `speed`, `extra_data` (JSONB).
*   **Relationships**: References `machines(id)` (CASCADE). Partitioned on `timestamp`.
*   **Example Record**:
    ```json
    {
      "machine_id": "8c6b75c8-1002-4fb0-a24a-e4905d625d99",
      "timestamp": "2026-07-19T04:10:00Z",
      "temperature": 74.20,
      "vibration": 3.12,
      "pressure": 32.50,
      "voltage": 13.20,
      "speed": 1550.0,
      "extra_data": {
        "engine_load": 82.5,
        "coolant_temperature": 78.4,
        "vibration_x": 1.45,
        "vibration_y": 1.95,
        "vibration_z": 2.05
      }
    }
    ```

---

## 10. API DOCUMENTATION

### 10.1 Authentication Endpoints

#### `POST /api/auth/login/`
*   **Purpose**: Authenticate user and issue tokens.
*   **Authentication**: None.
*   **Request Payload**:
    ```json
    { "username": "cat_manager", "password": "password_val" }
    ```
*   **Response (200 OK)**:
    ```json
    {
      "refresh": "eyJhbGciOi...",
      "access": "eyJhbGciOi...",
      "user": { "username": "cat_manager", "role": "Maintenance Department" }
    }
    ```
*   **Status Codes**: `200 OK` (success), `401 Unauthorized` (bad password).

### 10.2 Telemetry & AI Endpoints

#### `GET /api/predict/health/{machine_id}`
*   **Purpose**: Calculate latest health score, RUL, and append recommendations. Saves to predictions table.
*   **Authentication**: Bearer JWT.
*   **Response (200 OK)**:
    ```json
    {
      "machine_id": "8c6b75c8-1002-4fb0-a24a-e4905d625d99",
      "machine_name": "CAT 797F Mining Truck #01",
      "health_score": 74.5,
      "failure_probability": 0.255,
      "remaining_useful_life_hours": 1488.2,
      "is_anomaly": true,
      "anomaly_score": 2.82,
      "predicted_failure_mode": "Bearing Failure",
      "recommendations": [
        {
          "action": "Perform Bearing Lubrication & Alignment Check",
          "priority": "medium",
          "description": "Severe mechanical vibrations detected (3.12 mm/s). High risk of bearing wear."
        }
      ],
      "evaluated_at": "2026-07-19T04:15:30Z"
    }
    ```
*   **Status Codes**: `200 OK`, `404 Not Found` (invalid machine ID).

---

## 11. COMPLETE WORKFLOW

```
+------------------+
| Sensor Generator |  (Simulator generates telemetry values)
+--------+---------+
         |
         | (1. Batch flushes every 10s)
         v
+------------------+
|  Neon Postgres   |  (Ingested into sensor_data partitioned table)
+--------+---------+
         |
         | (2. Client triggers evaluation fetch request)
         v
+------------------+
|  FastAPI AI App  |  (Reads last 50 telemetry rows, calculates Z-score/limits)
+--------+---------+
         |
         | (3. Saves calculation log & returns payload)
         v
+------------------+
| Predictions Table|  (Status logged as pending; triggers active critical alert)
+--------+---------+
         |
         | (4. Django signals task generation)
         v
+------------------+
|  Maint. History  |  (Task auto-scheduled for Maintenance Team)
+--------+---------+
         |
         | (5. Engineer opens terminal, completes repair)
         v
+------------------+
|  Dashboard UI    |  (Task changes to COMPLETED; main widgets update instantly)
+------------------+
```

---

## 12. DASHBOARD EXPLANATION

### 12.1 Fleet Overview Widgets (Super Admin View)
*   **Summary Stats Grid**: Shows Total Sites, Total Fleet Machines, Healthy Assets, Warnings Active, Critical Shutdowns, predicted failures, and saved downtime hours. Data is sourced from Django ORM aggregations.
*   **Fleet Health Chart**: Custom SVG line chart plotting the fleet-wide health index over the last 10 days. Users hover to inspect trends.
*   **Site Fleet Overview Table**: Shows active machinery count, supervisor name, and average health for global sites (PSG CAS, Decatur, Aurora, Tucson).
*   **Critical Fleet Alarms Grid**: Displays active machine alarms. Includes machine code, site label, specific failure mode (e.g. Engine Overheat), severity badge, and time. Features severity and site dropdown filters.
*   **Consolidated Tabbed MAINTENANCE Card**:
    *   *Complete Tab*: Shows all completed repair tasks, engineers, dates, costs, and green success badges.
    *   *In Progress Tab*: Shows scheduled and active repairs with estimates.
    *   Features search inputs, sort configurations (newest/oldest), and cost sorts.

---

## 13. DATA FLOW

```
[Sensor Device] --(TCP/DB Pool)--> [sensor_data Table]
                                            |
                                            | (REST GET Request)
                                            v
[Browser Client] <--(JSON Payload)-- [FastAPI microservice]
                                            |
                                            | (SQL SELECT last 50 rows)
                                            v
                                     [Neon PostgreSQL]
```

---

## 14. AUTHENTICATION FLOW

1.  **Credentials Submission**: Browser submits username and password to `/api/auth/login/` via HTTPS.
2.  **Signature Verification**: SimpleJWT validates password matches pbkdf2_sha256 hash. Returns encrypted JWT access token (valid 15 minutes) and refresh token (valid 24 hours).
3.  **Token Storage**: Client registers access token to `localStorage.setItem('accessToken', token)`.
4.  **API Requests**: For subsequent API requests (e.g. `/api/machinery/machines/`), the header is set:
    `Authorization: Bearer <accessToken>`.
5.  **Token Expiry**: On access token expiration, Next.js calls `/api/auth/refresh/` using refresh token to obtain a fresh access token without interrupting the user.

---

## 15. DEPLOYMENT

### 15.1 Infrastructure Overview
*   **Next.js Frontend**: Hosted on **Vercel** for immediate edge network asset compilation and SSR deployment.
*   **Django Backend & REST APIs**: Hosted on **Railway** container runtimes.
*   **FastAPI AI service**: Hosted on **Railway** as a standalone asynchronous service.
*   **Database**: Hosted on **Neon Serverless PostgreSQL**.

### 15.2 Key Environment Variables

#### Django Backend Environment Variables
```env
DEBUG=False
SECRET_KEY=caterpillar_production_secret_key_2026
DATABASE_URL=postgres://user:password@ep-neon-db-pool.us-east-2.aws.neon.tech/neondb
ALLOWED_HOSTS=cat-backend.railway.app,localhost
CORS_ALLOWED_ORIGINS=https://cat-platform.vercel.app
AI_SERVICE_URL=https://cat-ai-service.railway.app
```

#### FastAPI AI service Environment Variables
```env
DATABASE_URL=postgres://user:password@ep-neon-db-pool.us-east-2.aws.neon.tech/neondb
HOST=0.0.0.0
PORT=8000
DEBUG=False
```

---

## 16. PROJECT WORKFLOW (CI/CD)

1.  **Local Development**: Developers commit code changes to GitHub repository branches.
2.  **Automated Webhook triggers**: Vercel and Railway pull the latest commit from their respective directories.
3.  **Build Testing**: Webpack runs Next.js static asset compilation (`npm run build`). Python executes environment checks.
4.  **Database Migration**: Django applies migrations via Railway build scripts: `python manage.py migrate`.
5.  **Traffic Routing**: On build success, production load balancers roll traffic to the new instances with zero downtime.

---

## 17. FUTURE ENHANCEMENTS

*   **Real-time WebSockets Integration**: Replace polling loops with full Django Channels / WebSocket connections targeting `ws://` to push telemetry updates directly from the simulator to the dashboard.
*   **Apache Kafka Message Broker**: Introduce Kafka in front of PostgreSQL to ingest hundreds of thousands of sensor readings per second without putting load on the relational database.
*   **Redis Cache Layer**: Cache calculations for machine RUL and health index values in Redis with a 1-second TTL to handle heavy concurrent user loads.
*   **SMS & Email Alerts**: Integrate Twilio and SendGrid APIs to immediately notify Maintenance Teams and Engineers on their mobile devices when a machine enters a `critical` failure mode.
*   **Automated AI Model Retraining**: Trigger cron jobs to retrain regression coefficients on historical data every week, updating predictions dynamically.

---

## 18. CONCLUSION

The **Caterpillar CAT® Predictive Maintenance Platform** couples Next.js, Django, and FastAPI to deliver a responsive, industrial-grade monitoring solution. By separating telemetry simulation, persistent data scaling (partitioned Postgres), and fast AI estimations, the system handles heavy write streams while remaining fully interactive. The Caterpillar design aesthetic (yellow accents, warm stones, and responsive grids) ensures readability in challenging field environments, bringing preventative efficiency and cost-savings to modern heavy fleet operations.
