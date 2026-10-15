"""Background screener worker for processing analysis jobs"""

from screener.core.worker import ScreenerWorker, run

__all__ = ["ScreenerWorker", "run"]

if __name__ == "__main__":
    run()
