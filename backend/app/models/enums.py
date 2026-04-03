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
