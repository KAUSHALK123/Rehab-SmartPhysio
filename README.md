# SmartPhysio 🩺

An Intelligent IoT-Based Physiotherapy Rehabilitation Platform that connects a wearable ESP32 sensor sleeve with a real-time web application to guide, monitor, and analyze home-based rehabilitation exercises.

---

## 🛠️ Tech Stack & Architecture

SmartPhysio is built using a modern, lightweight, and scalable tech stack:

*   **Frontend Client**: React (Vite) + Tailwind CSS (v4) + Lucide Icons + Recharts (for analytics).
*   **Backend Server**: FastAPI (Python) + SQLAlchemy ORM + WebSockets (for real-time sensor streams).
*   **Database**: 
    *   **Development**: SQLite (file-based database: `backend/smartphysio.db` for instant setups).
    *   **Production / Docker**: PostgreSQL (highly concurrent relational database).
*   **Hardware Integration**: ESP32 microcontroller streaming flex sensor, pressure sensor, and IMU data.
*   **Containerization**: Docker & Docker Compose for unified cross-platform runtimes.

---

## 🚀 Quick Start & How to Run

### Option A: One-Click Launcher (Recommended for Windows)
If you are on Windows, simply double-click the launcher script at the root directory:
*   [run_app.bat](./run_app.bat)

This launcher will give you a control panel to choose:
1.  **Local Dev Mode**: Automatically opens two command prompt windows (one for the backend virtualenv, one for Vite) and opens your browser.
2.  **Docker Compose Mode**: Spins up the container stack (PostgreSQL + FastAPI + React) in the background and launches your browser.

---

### Option B: Manual Setup

#### 1. Backend Server Setup (FastAPI + SQLite)
```bash
# Navigate to the backend folder
cd backend

# Create and activate a python virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*   **Swagger API Docs**: Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser.

#### 2. Frontend Setup (React)
```bash
# Navigate to the frontend folder
cd frontend

# Install Node modules
npm install

# Start the Vite development server
npm run dev
```
*   **Web Portal**: Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗄️ Database Setup & Seeding Instructions

No manual database installation or table setup is required. The system handles all table creations and data seeding automatically.

### How Seeding Works:
*   **Auto-Migration**: When the backend server boots up, it reads all SQLAlchemy models and builds tables automatically.
*   **Auto-Seeding**: During startup, [main.py](./backend/app/main.py) checks if tables are empty. If they are, it seeds:
    *   **Default Exercises**: 8 standard physiotherapy exercises (Ball Squeeze, Elbow Curls, Wrist Flexion, etc.).
    *   **Default Therapist Account**: `testuser@gmail.com` with password `Password123`.
    *   **Default Patients**: Sample patient profiles for *Sarah Jenkins* and *Marcus Vance*.

### Modifying the Seeds:
If you want to add or modify default database values to share with your teammates, edit the seeding functions in [main.py](./backend/app/main.py#L20-L190). When your teammates pull the updated code and restart their servers, their databases will synchronize automatically.

---

## 🤝 Git Contribution & Pull Request (PR) Workflow

To make collaboration smooth and prevent database or file system conflicts, follow these guidelines:

1.  **Branch Off `main`**: Always write your feature on a clean feature branch:
    ```bash
    git checkout main
    git pull origin main
    git checkout -b feature/your-feature-name
    ```
2.  **Keep Commits Clean**: Focus on specific, descriptive commit messages:
    ```bash
    git add .
    git commit -m "feat(frontend): add real-time charts to patient profile page"
    ```
3.  **Push and Request Review**: Push your branch to GitHub and open a Pull Request (PR). Make sure another team member reviews it before merging into `main`.

---

## 📖 Project Documentation & Agentic Guidelines

For deep-dives into specific aspects of the codebase or to provide detailed context prompts for AI coding agents, refer to the following resources:

*   **Core Guidelines & Setup**: [DEVGUIDE.md](./DEVGUIDE.md) - Docker structures, WebSocket testing details, and contributor rules.
*   **Database Schema**: [04_Database.md](./docs/04_Database.md) - Relational tables and field types.
*   **API Specification**: [05_API_SPEC.md](./docs/05_API_SPEC.md) - Details on endpoint patterns.
*   **UI Foundation**: [06_ui.md](./docs/06_ui.md) - Color configurations and page layout definitions.
*   **AI Development & Prompts**: 
    *   [09_AI_DEVELOPMENT_PLAN.md](./docs/09_AI_DEVELOPMENT_PLAN.md) - Roadmap for implementing ML features.
    *   [10_PROMPT_LIBRARY.md](./docs/10_PROMPT_LIBRARY.md) - Pre-made context prompts for instructing AI coding subagents.
*   **Hardware / ESP32 Specifications**: [11_HARDWARE_SPEC.md](./docs/11_HARDWARE_SPEC.md) - Sleeve electronics details.
