from datetime import date, datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# Singapore Standard Time (UTC+8)
_SGT = timezone(timedelta(hours=8))

# Draw results are published at 6:30 PM SGT for all games (4D and TOTO)
_RESULTS_HOUR = 18
_RESULTS_MINUTE = 30


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()


def schedule_poll(ticket_id: str, draw_date: date) -> None:
    """
    Register a recurring 30-minute poll job for a future draw ticket.
    The first poll fires at 6:30 PM SGT on the draw date (when results are
    published). Subsequent polls run every 30 minutes until results are found
    and remove_poll() is called.
    If draw_date is already in the past, APScheduler fires the first poll
    immediately (start_date in the past triggers right away).
    Does nothing if a job for this ticket already exists.
    """
    from services.checker import poll_and_check

    job_id = f"poll_{ticket_id}"
    if scheduler.get_job(job_id):
        return

    first_poll = datetime(
        draw_date.year, draw_date.month, draw_date.day,
        _RESULTS_HOUR, _RESULTS_MINUTE,
        tzinfo=_SGT,
    )

    scheduler.add_job(
        poll_and_check,
        trigger="interval",
        minutes=30,
        start_date=first_poll,
        args=[ticket_id],
        id=job_id,
        replace_existing=False,
    )


def remove_poll(ticket_id: str) -> None:
    """Remove the polling job once results have been found."""
    job_id = f"poll_{ticket_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
