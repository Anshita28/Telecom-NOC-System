"""
Convenience launcher for the Telecom NOC FastAPI backend.

Usage:
    python -m backend.run                # default port 8000
    python -m backend.run --port 9000    # custom port
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["backend", "ai", "sql", "model"],
    )
