import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Daily, DailyTask, Task, Weekly
from app.models.enums import TaskStatus, TaskType


def test_create_weekly(db_session):
    w = Weekly(week_start=datetime.date(2026, 3, 29))
    db_session.add(w)
    db_session.commit()
    assert w.id is not None
    assert w.week_start == datetime.date(2026, 3, 29)


def test_duplicate_week_start_rejected(db_session):
    w1 = Weekly(week_start=datetime.date(2026, 3, 29))
    w2 = Weekly(week_start=datetime.date(2026, 3, 29))
    db_session.add(w1)
    db_session.commit()
    db_session.add(w2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_create_daily_linked_to_weekly(db_session):
    w = Weekly(week_start=datetime.date(2026, 3, 29))
    db_session.add(w)
    db_session.commit()
    d = Daily(date=datetime.date(2026, 3, 30), weekly_id=w.id)
    db_session.add(d)
    db_session.commit()
    assert d.id is not None
    assert d.weekly_id == w.id
    db_session.refresh(w)
    assert len(w.dailies) == 1


def test_cascade_delete_weekly_deletes_dailies(db_session):
    w = Weekly(week_start=datetime.date(2026, 3, 29))
    db_session.add(w)
    db_session.commit()
    d = Daily(date=datetime.date(2026, 3, 30), weekly_id=w.id)
    db_session.add(d)
    db_session.commit()
    daily_id = d.id
    db_session.delete(w)
    db_session.commit()
    assert db_session.get(Daily, daily_id) is None


def test_create_task(db_session):
    t = Task(
        jira_ticket_id="JAR-123",
        title="Implement login",
        type=TaskType.implementation,
        status=TaskStatus.created,
    )
    db_session.add(t)
    db_session.commit()
    assert t.id is not None
    assert t.jira_ticket_id == "JAR-123"


def test_create_task_without_jira(db_session):
    t = Task(title="Ad-hoc task", type=TaskType.review, status=TaskStatus.created)
    db_session.add(t)
    db_session.commit()
    assert t.jira_ticket_id is None


def test_daily_task_association(db_session):
    w = Weekly(week_start=datetime.date(2026, 3, 29))
    db_session.add(w)
    db_session.commit()
    d = Daily(date=datetime.date(2026, 3, 30), weekly_id=w.id)
    t = Task(title="Test task", type=TaskType.refinement, status=TaskStatus.created)
    db_session.add_all([d, t])
    db_session.commit()
    dt = DailyTask(daily_id=d.id, task_id=t.id, priority=1)
    db_session.add(dt)
    db_session.commit()
    assert dt.priority == 1


def test_duplicate_priority_rejected(db_session):
    w = Weekly(week_start=datetime.date(2026, 3, 29))
    db_session.add(w)
    db_session.commit()
    d = Daily(date=datetime.date(2026, 3, 30), weekly_id=w.id)
    t1 = Task(title="Task 1", type=TaskType.refinement, status=TaskStatus.created)
    t2 = Task(title="Task 2", type=TaskType.implementation, status=TaskStatus.created)
    db_session.add_all([d, t1, t2])
    db_session.commit()
    dt1 = DailyTask(daily_id=d.id, task_id=t1.id, priority=1)
    dt2 = DailyTask(daily_id=d.id, task_id=t2.id, priority=1)
    db_session.add_all([dt1, dt2])
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_task_in_multiple_dailies(db_session):
    w = Weekly(week_start=datetime.date(2026, 3, 29))
    db_session.add(w)
    db_session.commit()
    d1 = Daily(date=datetime.date(2026, 3, 30), weekly_id=w.id)
    d2 = Daily(date=datetime.date(2026, 3, 31), weekly_id=w.id)
    t = Task(title="Shared task", type=TaskType.review, status=TaskStatus.created)
    db_session.add_all([d1, d2, t])
    db_session.commit()
    dt1 = DailyTask(daily_id=d1.id, task_id=t.id, priority=1)
    dt2 = DailyTask(daily_id=d2.id, task_id=t.id, priority=2)
    db_session.add_all([dt1, dt2])
    db_session.commit()
    db_session.refresh(t)
    assert len(t.daily_entries) == 2


def test_enum_values():
    assert TaskType.refinement.value == "refinement"
    assert TaskType.implementation.value == "implementation"
    assert TaskType.review.value == "review"
    assert TaskStatus.created.value == "created"
    assert TaskStatus.done.value == "done"
