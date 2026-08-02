# SmartPhysio - Developer Contribution & Setup Guide

Welcome to the SmartPhysio developer guide! This document explains the architecture, how to set up the project locally (both with and without Docker), and the workflow for making Git commits and opening Pull Requests (PRs).

---

## 🏗️ Architecture & Technology Stack
* **Frontend**: React (Vite) + Tailwind CSS (v4) + Lucide Icons.
* **Backend**: FastAPI + SQLAlchemy (supports SQLite for local quickstart, PostgreSQL for production/Docker).
* **Communication**: Real-time bi-directional WebSockets for ESP32 telemetry data streaming.

---

## 🐳 Why is Docker Here?
The root repository includes a `docker-compose.yml` configuration. Docker is provided to:
1. **Eliminate "Works on My Machine" Issues**: Packages Python, Node.js, and PostgreSQL dependencies inside isolated containers so the dev environment is identical for all team members.
2. **PostgreSQL Database Support**: Instead of manually installing and setting up Postgres on your local OS, Docker spins up a Postgres container automatically, configures ports, and sets up tables.
3. **Zero Configuration**: A single command builds and runs the entire stack (Database, Backend API, and Frontend App) in sync.

---

## 🚀 Setup & Run Options

### Option A: Running with Docker (Recommended)
Make sure you have **Docker Desktop** installed and running.

1. **Spin up the stack**:
   ```bash
   docker-compose up --build
   ```
   *Note: Both backend and frontend directories are mounted as volumes inside the containers. This means that editing code on your host machine will immediately trigger live hot-reloading (Vite HMR on frontend and Uvicorn auto-reload on backend) inside Docker!*

2. **Access the application**:
   * Frontend Client: [http://localhost:5173](http://localhost:5173)
   * Backend REST Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

3. **Stop the containers**:
   ```bash
   docker-compose down -v
   ```

---

### Option B: Local Running (Without Docker)
If you prefer to run services natively on your host machine:

#### 1. Backend Setup (FastAPI + SQLite)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows:
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the Uvicorn development server:
   ```bash
   # By default, this runs on SQLite (smartphysio.db is automatically created and seeded)
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

#### 2. Frontend Setup (React)
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install Node modules:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🤝 Git Contribution Workflow
Follow these guidelines to contribute code and make Pull Requests:

### 1. Create a Branch
Always write your code on a feature-specific branch. Never commit directly to `main`.
```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```
*Use naming conventions: `feature/` for new screens/features, `bugfix/` for resolving bugs, `refactor/` for cleanup.*

### 2. Make Clean Commits
Keep your commits focused and write descriptive commit messages:
```bash
git add .
git commit -m "feat(frontend): implement dual light/dark theme toggles on dashboard"
```

### 3. Push and Open a PR
1. Push your branch to the remote repository:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Navigate to your GitHub repository and click **Compare & pull request**.
3. In the PR description:
   * Describe what changes you made.
   * Attach screenshots of any UI updates.
   * Reference any issues closed by the PR (e.g. `Closes #12`).
4. Wait for code review and automated checks to pass before merging.

---

## 🔌 Hardware / Simulator Testing
During frontend development, you can test the **Device Calibration** dashboard telemetry flows without having a physical ESP32 connected:
* Open the **Device Calibration** view.
* Click **Establish Link**.
* Since the WebSocket expects sensor values, you can use a WebSocket client (like Postman or a custom Python script) to send mock payloads to `ws://localhost:8000/api/v1/device/ws?client_type=device` containing:
  ```json
  {
    "flex_fingers": [0.32, 0.45, 0.28, 0.12, 0.0],
    "flex_elbow": 45.0,
    "wrist_angles": [12.0, 55.0, 5.0],
    "pressure_palm": 320.0
  }
  ```
* Bending these simulated values above the calibration thresholds will trigger the green `CALIBRATED` indicator badges automatically.
