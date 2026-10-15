"""Background screener worker for processing analysis jobs"""

import logging
import signal
import time

from sqlalchemy import select

from screener.db.models.job import AnalysisJob
from screener.db.session import SessionLocal
from screener.services.analysis_service import AnalysisService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("screener_worker")


class ScreenerWorker:
    """Worker to poll and execute background analysis jobs."""

    def __init__(self, poll_interval: float = 3.0):
        self.poll_interval = poll_interval
        self.running = False

    def process_pending_jobs(self) -> int:
        processed_count = 0
        with SessionLocal() as db:
            # Pick pending jobs
            pending_jobs = list(
                db.scalars(
                    select(AnalysisJob).where(AnalysisJob.status == "PENDING").order_by(AnalysisJob.id.asc()).limit(5)
                ).all()
            )

            for job in pending_jobs:
                logger.info(f"Processing job {job.id} (type: {job.job_type})")
                try:
                    AnalysisService.execute_job(db, job.id)
                    logger.info(f"Successfully finished job {job.id}")
                    processed_count += 1
                except Exception as e:
                    logger.error(f"Error processing job {job.id}: {e}", exc_info=True)

        return processed_count

    def run_loop(self) -> None:
        self.running = True
        logger.info(f"Screener worker started (polling interval: {self.poll_interval}s)...")

        def handle_signal(sig, frame):
            logger.info("Termination signal received. Shutting down worker...")
            self.running = False

        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)

        while self.running:
            try:
                processed = self.process_pending_jobs()
                if processed == 0:
                    time.sleep(self.poll_interval)
            except Exception as e:
                logger.error(f"Unexpected worker error: {e}", exc_info=True)
                time.sleep(self.poll_interval)

        logger.info("Screener worker stopped.")


def run():
    worker = ScreenerWorker()
    worker.run_loop()


if __name__ == "__main__":
    run()
