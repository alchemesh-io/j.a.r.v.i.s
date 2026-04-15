from enum import Enum


class TaskType(str, Enum):
    refinement = "refinement"
    implementation = "implementation"
    review = "review"


class TaskStatus(str, Enum):
    created = "created"
    done = "done"


class SourceType(str, Enum):
    jira = "jira"
    gcal = "gcal"


class KeyFocusKind(str, Enum):
    delivery = "delivery"
    learning = "learning"
    support = "support"
    operational = "operational"
    side_quest = "side_quest"


class KeyFocusStatus(str, Enum):
    in_progress = "in_progress"
    succeed = "succeed"
    failed = "failed"


class KeyFocusFrequency(str, Enum):
    weekly = "weekly"
    quarterly = "quarterly"


class BlockerStatus(str, Enum):
    opened = "opened"
    resolved = "resolved"


class WorkerState(str, Enum):
    initialized = "initialized"
    working = "working"
    waiting_for_human = "waiting_for_human"
    done = "done"
    archived = "archived"


class WorkerType(str, Enum):
    claude_code = "claude_code"
