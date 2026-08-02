# SmartPhysio

An Intelligent IoT-Based Physiotherapy Rehabilitation Platform.

## Project Structure
```
smartphysio/
├── frontend/             # React (Vite) + Tailwind CSS web application
├── backend/              # FastAPI + SQLAlchemy backend
├── firmware/             # ESP32 firmware code (placeholder)
├── database/             # Relational SQLite database
├── scripts/              # Helper utility scripts
└── README.md             # This readme file
```

## Running the Project

### Prerequisites
- Node.js (v18+)
- Python (3.9+)

### Running the Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Running the Frontend
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
