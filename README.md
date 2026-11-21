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

---

## ⚡ Hardware Pinout & Wiring Specification

### Confirmed Pinout (All ADC1 Channels, Wi-Fi Safe)

| Channel | Sensor | ESP32 GPIO | ADC Channel | Calibrated Benchmarks (Raw 12-Bit) |
|:---|:---|:---|:---|:---|
| **Ch 1** | **Thumb Flex** | **GPIO 36 (VP)** | `ADC1_CH0` | Flat: 250, Bent: 180 (placeholder) |
| **Ch 2** | **Index Flex** | **GPIO 33 (D33)** | `ADC1_CH5` | Flat: 173, Bent: 108 |
| **Ch 3** | **Middle Flex** | **GPIO 34 (D34)** | `ADC1_CH6` | Flat: 265, Bent: 220 |
| **Ch 4** | **Ring Flex** | **GPIO 35 (D35)** | `ADC1_CH7` | Flat: 216, Bent: 180 |
| **Ch 5** | **Little Flex** | **GPIO 32 (D32)** | `ADC1_CH4` | Flat: 148, Bent: 41 (Confirmed) |
| **Elbow** | **Elbow Flex** | **GPIO 39 (VN)** | `ADC1_CH3` | 10kΩ Pull-down to GND |
| **Force** | **Pressure Squeeze** | **GPIO 25 (D25)** | `ADC2_CH8` | 10kΩ Pull-down to GND |
| **IMU** | **MPU6050 I2C** | **GPIO 21 (SDA) / 22 (SCL)** | I2C | 4.7kΩ Onboard Pull-ups |

### Voltage Divider Wiring Circuit
For each of the 5 finger flex sensors:
```text
           +3.3V Power Rail
                 │
                 ├──[ Flex Sensor (~25kΩ - 60kΩ+) ]
                 │
                 ├── Node ─────────────────────────> ESP32 ADC Pin (GPIO 36, 33, 34, 35, 32)
                 │     │
                 │     └──[ 0.1µF Ceramic Capacitor ]── GND (Filters Wi-Fi ADC noise)
                 │
                 └──[ Fixed Resistor R (10kΩ - 22kΩ) ]
                         │
                        GND Common Rail
```
- **Recommended Resistor (R)**: $10\text{k}\Omega\text{ to }22\text{k}\Omega$ pull-down resistor matched to sensor midpoint.
- **Direction**: Flex ADC value **DECREASES** when bent ($\text{Flat} > \text{Bent}$).
- **Fault Detection**:
  - An unplugged channel with a pull-down resistor reads $\approx 0\text{ ADC}$ ($< 10$) and immediately flags a **FAULT** (holding the finger open at $-15^\circ$; never curling into a fist).
  - A floating pin (e.g. ungrounded GPIO 32) produces sample spread $> 150\text{ counts}$ across 16-sample bursts and immediately flags a **FAULT**.

---

## 📋 Manual Verification Checklist

Follow these steps to verify full end-to-end integration across hardware, firmware, backend, and 3D hand visualization:

1. **Serial vs WebSocket Telemetry Match:**
   - Open Serial Monitor at `115200` baud. Check the single rate-limited log line:
     `[ 12345 ms] T: 250 0% I: 173 0% M: 265 0% R: 216 0% L: 148 0%`
   - Run `python tools/ws_probe.py`.
   - Verify that raw ADC values and `curl %` match between Serial and WebSocket frames 1:1.
2. **Power-Cycle & Disconnect Safety (No Phantom Animation):**
   - Unplug or power-cycle the ESP32.
   - The web UI connection badge must flip to **`NO DEVICE`** within 1 second.
   - The 3D hand must **freeze in its neutral position** and NOT keep animating.
3. **Sensor Unplugged / Ground Fault (No Fist Lock):**
   - Unplug the Little finger flex sensor from 3.3V (pulled to GND by resistor).
   - Sensor reads $\approx 0\text{ ADC} < 10$.
   - Serial displays `L: 0 0% !FAULT`.
   - Web UI displays **`FAULT`** and the 3D Little finger **remains open (flat at $-15^\circ$)**, never curling into a fist.
4. **Touch GPIO 32 to GND:**
   - Touch GPIO 32 directly to GND.
   - It reads $0\text{ ADC}$, flags `!FAULT`, and the 3D bone does not curl.
5. **Single-Finger Isolation:**
   - Gently bend only the Little finger from Flat (`148`) toward Bent (`41`).
   - Only the Little finger bone rotates smoothly on the 3D hand (between $-15^\circ$ and $70^\circ$).
   - Other fingers remain completely still.
