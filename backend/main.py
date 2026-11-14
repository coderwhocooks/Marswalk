"""
MARSWALK: Martian Astronaut Route and Scientific Exploration Planner
NASA Space Apps Challenge 2026 Core API Service.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.api.routes import api_router

app = FastAPI(
    title="MARSWALK API",
    description="Planetary mission decision-support service for Martian surface traverses in Jezero Crater.",
    version="1.0.0"
)

# Enable CORS for local development and frontend client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/health")
def health():
    return {"status": "healthy"}

# Mount frontend production build if available
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return {
            "project": "MARSWALK",
            "description": "Martian Astronaut Route and Scientific Exploration Planner",
            "challenge": "NASA Space Apps Challenge 2026",
            "region": "Jezero Crater, Mars",
            "status": "OPERATIONAL",
            "docs_url": "/docs"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
