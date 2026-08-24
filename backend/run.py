"""
Convenience launcher for the Telecom NOC FastAPI backend.

Usage:
    python -m backend.run                # default port 8000
    python -m backend.run --port 9000    # custom port
"""

import os
import uvicorn

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=None)
    args = parser.parse_args()

    PORT = args.port or int(os.getenv("PORT", "8000"))

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=PORT,
        reload=True,
        reload_dirs=["backend", "ai", "sql", "model"],
    )
