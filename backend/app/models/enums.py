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
