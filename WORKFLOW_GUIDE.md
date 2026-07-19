# Caterpillar CAT® Predictive Maintenance Platform
## Comprehensive Components, Modules, Features, & Workflows Reference Guide

This document provides a highly detailed, clear, and structured guide to the **components**, **modules**, **features**, and **workflows** of the Caterpillar Predictive Maintenance Platform. It is designed to help developers and stakeholders quickly understand the codebase flow and functional architecture.

---

## 1. COMPONENT ARCHITECTURE & PRESENTATION LAYER

The frontend is built using Next.js (App Router) and React. It operates as a Single Page Application (SPA) shell defined in [page.tsx](file:///c:/Users/admin/Desktop/CAT%20HACKATHON/frontend/src/app/page.tsx), routing between different dashboard modules based on the active sidebar navigation selection.

### 1.1 Component Tree Hierarchy

```
RootLayout (layout.tsx)
 └── Home SPA (page.tsx)
      ├── Sidebar Navigation (sidebar.tsx)
      ├── Top Navigation Bar (navbar.tsx)
      │
      └── Dynamic Dashboard Portal (based on activeTab & userRole states)
           ├── SuperAdminDashboard (super-admin.tsx)
           │    ├── Card (card.tsx)
           │    └── MAINTENANCE (tabbed list + sort/filter toolbar)
           │
           ├── MaintenanceDepartmentDashboard (maintenance-engineer.tsx)
           │    ├── Card (card.tsx)
           │    └── Table (table.tsx)
           │
           ├── MaintenanceEngineerDashboard (maintenance-engineer.tsx)
           │    ├── Card (card.tsx)
           │    └── Button (button.tsx)
           │
           ├── ServiceTeamDashboard (service-team.tsx)
           │    └── Badge (badge.tsx)
           │
           ├── MachineDetails (machine-details.tsx)
           │    └── Custom SVG Live Telemetry Line Chart
           │
           └── ReportsModule (reports-module.tsx)
                └── Table (table.tsx)
```

---

### 1.2 Core Component Definitions

#### 1.2.1 `Home` (SPA Controller)
*   **Purpose**: Coordinates the global app shell state, user authentication session mock, active views, theme updates, and holds the global layout.
*   **State Variables**:
    *   `darkMode` (boolean): Controls default dark class injection on the HTML root element.
    *   `activeTab` (string): Controls which dashboard view is mounted (e.g., `"dashboard"`, `"machines"`, `"predictions"`, `"reports"`).
    *   `userRole` (string): Controls current role privileges (`"Super Admin"`, `"Maintenance Department"`, `"Maintenance Engineer"`, `"Service Engineer"`).
    *   `streamPoints` (array): Buffers mock time-series data for the dashboard's real-time demonstration widgets.
*   **Hooks Used**: `useState`, `useEffect` (for live telemetry ticks and class list manipulation).
*   **API Interactions**: Validates token requests and manages routing redirects on credentials change.

#### 1.2.2 `SuperAdminDashboard`
*   **Purpose**: Displays aggregated global statistics across all sites and machinery.
*   **State Variables**:
    *   `severityFilter` (string): Filters active alerts by `"all"`, `"critical"`, or `"warning"`.
    *   `siteFilter` (string): Filters alerts by site (`"all"`, `"PSG CAS"`, `"Decatur"`, etc.).
    *   `activeMaintenanceTab` (string): Toggles the single MAINTENANCE card between `"complete"` and `"inProgress"`.
    *   `maintenanceSearch` (string): Filters maintenance lists by machine code strings.
    *   `maintenanceSort` (string): Orders list records by `"newest"` or `"oldest"`.
    *   `maintenanceCostSort` (string): Orders list records by cost (`"lowToHigh"`, `"highToLow"`).
*   **Hooks Used**: `useState`, `useMemo` (independent state-driven sorting and search matching calculations).
*   **Child Components**: `Card`, `Badge` (used for severity alert counts and status flags).

#### 1.2.3 `MachineDetails`
*   **Purpose**: Renders detailed real-time telemetry streams, historical anomalies, and ML prediction evaluations for a single chosen machine profile.
*   **Props**:
    *   `machineId` (string): Selected machine UUID.
    *   `onBack` (function): Callback routing back to the site/fleet view.
*   **State Variables**:
    *   `activeTab` (string): Selected view tab (`"realtime"`, `"anomalies"`, `"predictions"`).
    *   `telemetryHistory` (array): Holds incoming live telemetry sensor values.
    *   `isPolling` (boolean): Controls fallback polling loop toggles.
*   **Hooks Used**: `useState`, `useEffect` (establishes WebSocket telemetry feed with a 1Hz polling loop callback fallback).
*   **API Interactions**: Queries the FastAPI AI engine endpoint `/api/predict/health/{machine_id}`.

---

## 2. FUNCTIONAL MODULES

The project is structured into independent apps (modules) in the Django backend and separate packages in the FastAPI microservice.

```
+-----------------------------------------------------------------------+
|                           FUNCTIONAL MODULES                           |
+-----------------------------------------------------------------------+
| 1. Authentication   | Logs operators, registers profiles, signs JWTs. |
| 2. Fleet Overview   | Aggregates global site stats and metrics.       |
| 3. Machinery        | Manages machine parameters and active statuses. |
| 4. AI Analytics     | Calculates RUL, anomaly z-scores, risk indices. |
| 5. Maintenance      | Schedules repair tasks and logs parts/costs.    |
| 6. Notifications    | Manages active alerts and logs read statuses.   |
+-----------------------------------------------------------------------+
```

### 2.1 Authentication Module
*   **Responsibility**: Generates secure access protocols and prevents unauthenticated API consumption.
*   **Database Tables**: `users`, `roles` (references simple role permissions lookup).
*   **API Methods**: `POST /api/auth/login/`, `POST /api/auth/refresh/`, `POST /api/auth/logout/`.

### 2.2 Machinery Fleet Module
*   **Responsibility**: Manages global site properties and machinery asset inventory profiles.
*   **Database Tables**: `sites`, `machines`.
*   **API Methods**: `GET /api/machinery/sites/`, `GET /api/machinery/machines/`, `POST /api/machinery/machines/`.

### 2.3 AI Analytics Module (FastAPI)
*   **Responsibility**: Run standard deviation calculations and compute predictive failure risk factors.
*   **Database Tables**: Reads `sensor_data` streams; writes to `predictions`.
*   **API Methods**: `GET /api/predict/health/{machine_id}`, `GET /api/predict/anomalies/{machine_id}`.

### 2.4 Maintenance Module
*   **Responsibility**: Tracks maintenance orders, completion dates, and repair expenditure metrics.
*   **Database Tables**: `maintenance_history`, `maintenance_teams`, `service_history`.
*   **API Methods**: `GET /api/maintenance/maintenance-history/`, `POST /api/maintenance/maintenance-history/`.

---

## 3. CORE PLATFORM FEATURES

### 3.1 Operator Login
*   **Description**: Authenticates users and routes them to their corresponding dashboard interface.
*   **Input**: JSON credentials (`username`, `password`).
*   **Output**: Signed JWT Access Token (stored in client `localStorage` for API header injection) and Refresh Token.
*   **Security**: Scopes API access based on the user's role ID.

### 3.2 Real-Time Telemetry Stream Rendering
*   **Description**: Ingests and renders high-frequency sensor readings as a smooth line graph.
*   **Input**: Active telemetry feeds (vibration, temperature, pressure).
*   **Output**: Renders an interactive SVG chart on the frontend that updates every second.

### 3.3 Dynamic Maintenance Workspace Filters
*   **Description**: Filters and sorts maintenance cards dynamically.
*   **Input**: Search queries (e.g. "CAT320"), sort orders (newest/oldest), or cost sorts (low to high).
*   **Output**: Refiltered list displays rendered instantly.

### 3.4 Automated Anomaly Alert Generation
*   **Description**: Generates an alert in the alarms feed when telemetry metrics exceed calculated z-score limits.
*   **Input**: Telemetry standard deviation z-score $> 2.5$.
*   **Output**: Automatically writes an active alert row to the `alerts` table.

---

## 4. SYSTEM WORKFLOWS

### 4.1 Real-Time Telemetry Ingestion Workflow

```
[1. Sensor Simulator]
       │
       ├─► Generates readings (temp, vibration, pressure, speed, voltage) every 1s
       ├─► Steps through machine state loops (normal, spike, fail, broken)
       │
[2. In-Memory Buffer]
       │
       ├─► Stores raw telemetry values temporarily
       ├─► Performs batch write every 10s using psycopg2.extras
       │
[3. Neon PostgreSQL Database]
       │
       └─► Ingests records into "sensor_data" partitions based on timestamp
```

### 4.2 AI Anomaly & Failure Calculation Workflow

```
[1. Browser Client]
       │
       ├─► Navigates to a Machine Details page
       ├─► Issues HTTP GET request to FastAPI AI service
       │
[2. FastAPI AI Microservice]
       │
       ├─► Queries "sensor_data" database for the last 50 telemetry logs
       ├─► Computes 6 failure risk factors (bearing, hydraulic, engine, oil, cooling, battery)
       ├─► Derives health score (100 - max risk) and Remaining Useful Life (RUL)
       ├─► Saves evaluation log to "predictions" table
       │
[3. Browser Client]
       │
       └─► Receives calculation payload and renders metrics and recommendations
```

### 4.3 Alert & Maintenance Ticket Generation Workflow

```
[1. Anomaly Evaluated]
       │
       ├─► FastAPI identifies a telemetry outlier (Z-Score > 2.5)
       ├─► Writes prediction record to database with "warning" or "critical" status
       │
[2. Database Triggers Alert]
       │
       ├─► Django listener captures new warning predictions
       ├─► Writes active alert record to the "alerts" table
       ├─► Issues notification to maintenance team's unread list
       │
[3. Maintenance Task Scheduled]
       │
       ├─► Auto-schedules repair work order in the "maintenance_history" table
       ├─► Task status set to "scheduled" (In Progress tab)
       │
[4. Technician Action]
       │
       ├─► Maintenance engineer views active repairs list on the dashboard
       ├─► Performs repair and marks task status as "completed"
       ├─► Card shifts to the "Complete" tab; machine status returns to "operational"
```

---

## 5. AUTHENTICATION & SECURITY DATA FLOW

```
[Browser Client]               [Django Backend]              [Neon Database]
       │                               │                             │
       ├─► Submit login credentials ──►│                             │
       │   (username, password)        ├─► Verify pbkdf2 hash ──────►│
       │                               │   against user record       │
       │◄─ Returns JWT access token ───┤                             │
       │   & refresh token             │                             │
       │                               │                             │
       │   (Headers: Authorization: Bearer <token>)                  │
       ├─► Request protected endpoint ─►                             │
       │   (e.g. GET /api/machinery)   ├─► Verify token signature    │
       │                               ├─► Check role permissions    │
       │◄─ Renders API JSON payload ───┼─► Fetch machinery records ─►│
```

Thank You