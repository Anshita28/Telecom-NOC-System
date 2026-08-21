"""Backward-compatible entry point. Prefer: python -m model.train_all"""

from model.train_all import main

if __name__ == "__main__":
    main()
