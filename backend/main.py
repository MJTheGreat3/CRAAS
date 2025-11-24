from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import contamination, hydrology, endpoints
from app.config import settings

app = FastAPI(
    title="Contamination Risk Analysis & Alert System (CRAS)",
    description="API for analyzing contamination spread in waterway networks",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(contamination.router, prefix="/api/v1/contamination", tags=["contamination"])
app.include_router(hydrology.router, prefix="/api/v1/hydrology", tags=["hydrology"])
app.include_router(endpoints.router, prefix="/api/v1/endpoints", tags=["endpoints"])

@app.get("/")
async def root():
    return {"message": "CRAS API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)
