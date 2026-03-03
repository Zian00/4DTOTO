from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()


def schedule_poll(ticket_id: str, draw_date: date) -> None:
    """
    Register a recurring 30-minute poll job for a future draw ticket.
    Does nothing if a job for this ticket already exists.
    """
    from services.checker import poll_and_check

    job_id = f"poll_{ticket_id}"
    if scheduler.get_job(job_id):
        return

    scheduler.add_job(
        poll_and_check,
        trigger="interval",
        minutes=30,
        args=[ticket_id],
        id=job_id,
        replace_existing=False,
    )


def remove_poll(ticket_id: str) -> None:
    """Remove the polling job once results have been found."""
    job_id = f"poll_{ticket_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
