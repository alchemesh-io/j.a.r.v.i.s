## Short description

Enable to add set of notes to the tasks in JARVIS

## Context

The current implementation of the tasks within JARVIS only support a title, dates and the saource id informations.

## Implementation details

We want to add the ability to add markdown notes to each task.

### Chunk 1 — Enable notes for tasks on backend

You can have multiple tasks associated to one task:
- Update the data base modeling enabling to create multiple notes (in a dedicated table) associated to one task
- Update the backend modeling to simply manage the notes associated to the task (delete, update, create etc.)
- The drop of a task implies the deletion

### Chunck 2 - Adapt UI
- Add a dedicated task button on the task to access a dedicated 
- Ask for deletion confirmation of a task
- Mardown outside of edition should be rendered in the UI

### Chunk 3 - Adapt MCP
- Propagate the changes so that the mcp support the new notes feature