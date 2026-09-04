# Project Packaging & Transfer Guide

This project needs to be packaged cleanly so it can be transferred and run easily by any user (freelance client) without hassle. Use the instructions below as a prompt for an AI agent to prepare, dockerize, and document the project setup.

## AI Agent Prompt

**Task:** Prepare and package the SmartPhysio Rehab project for transfer to a client. Ensure it can be easily run using Docker.

**Steps to Execute:**

1. **Clean Up the Repository:**
   - Remove any temporary directories, `.DS_Store`, build artifacts (`node_modules/`, `venv/`, `__pycache__/`, `dist/`, etc.).
   - Ensure a proper `.gitignore` and `.dockerignore` file is in place to ignore these during build.

2. **Dockerization:**
   - **Backend (`/backend`)**: Create a `Dockerfile` for the FastAPI backend. Use a lightweight python image (e.g., `python:3.10-slim`). Install `requirements.txt` and expose the correct port (e.g., 8000). Ensure the SQLite database path works within the container.
   - **Frontend (`/frontend`)**: Create a `Dockerfile` for the React/Vite frontend. Build the static files using Node and serve them with Nginx. Expose port 80.
   - **Docker Compose**: Create a `docker-compose.yml` in the root directory that orchestrates both the `backend` and `frontend` services. Set appropriate environment variables so the frontend communicates with the backend container correctly.

3. **Setup and Run Scripts:**
   - Provide a clean, robust script (e.g., `start.sh` or `start.bat`) that simply runs `docker-compose up --build -d`.

4. **Generate README.md (User-facing):**
   - Create a `README_CLIENT.md` (or replace the main `README.md`) written for a non-technical end-user.
   - Include:
     - Brief overview of the project.
     - Prerequisites: (e.g., Install Docker Desktop).
     - **Quickstart Guide:** Exactly how to run the project (e.g., "Double click `start.bat` or run `docker-compose up`").
     - How to access the application (e.g., "Open `http://localhost:80` in your browser").
     - How to connect the ESP32 sleeve hardware (Wi-Fi setup instructions or endpoints).

5. **Final Review:**
   - Verify that there are no hardcoded local IP addresses (use relative paths or configurable env variables).
   - Ensure the database initialization script runs automatically on the first boot.
