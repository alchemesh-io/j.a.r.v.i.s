---
name: planner-daily-wrap-up
description: End-of-day wrap-up that processes today's Google Calendar meetings -- extracts Gemini notes transcripts updates JARVIS task notes with summaries, and creates action items from next steps. Use proactively when the user says "wrap up my day", "daily summary", "process today's meetings", or asks about meeting follow-ups and action items.
allowed_tools: [mcp__jarvis__list_tasks, mcp__claude_ai_Google_Calendar__get_event, "Bash(gws calendar *)", "Bash(gws drive *)", mcp__jarvis__list_task_notes, mcp__jarvis__create_task_note, mcp__jarvis__list_key_focuses, mcp__jarvis__create_task, mcp__jarvis__add_task_to_key_focus]
---

## Planner daily wrap up

**IDEMPOTENCY**: This process can be safely re-run multiple times a day without creating duplicates or inconsistent states. Always check for existing notes and tasks before creating new ones, and ensure that updates are idempotent.

### Phase 1 - Identify meetings with Gemini notes

1. List today's JARVIS tasks that are linked to Google Calendar events using `mcp__jarvis__list_tasks` with the filter `source:gcal` and `status:not_completed` for the current day.
2. For each task, retrieve the GCal event via `mcp__claude_ai_Google_Calendar__get_event`.
3. For each event, fetch attachments `Bash(gws calendar events get --params '{"calendarId": "primary", "eventId": "<EVENT_ID>"}' --sanitize <SANITIZE_TEMPLATE> 2>/dev/null | jq '[.attachments[] | {(.fileId): .title}] | add')` 
4. Keep only events that have an attachment related to `Gemini notes`. Skip events without one.

Retrieve the sanitize template, here is an example: `"projects/doctolib-gws-cli/locations/europe-west4/templates/gws-filter"`
**FAILURE MANAGEMENT**: If any of the step fail, log the error and skip to the next event, DO NOT STOP THE WHOLE PROCESS.

### Phase 2 - Update JARVIS task notes
For each remaining event:

1. Export the Gemini notes document: `Bash(gws drive files export --params '{"fileId": "<DOC_ID>", "mimeType": "text/markdown"}' --sanitize <SANITIZE_TEMPLATE> -o ./<DOC_ID>.md )`.See `references/gemini_notes/` for example outputs:
  - **Summary**: a summary of the meeting
  - **Next steps**: a list of next steps with the format `- [ ] \[Person\] Action: Description`
  - **Details**: a detailed description of the meeting

**FAILURE MANAGEMENT**: If any of the step fail, log the error and skip to the next event, DO NOT STOP THE WHOLE PROCESS.

2. Extract the **Summary** section, translate to English if needed.
3. Add it as a note via `mcp__jarvis__create_task_note`. See `references/gemini_notes_summary_to_notes/` for examples.
4. Clean up the downloaded file.

### Phase 3 - Create action items from next steps
 
1. Present ALL items from the **Next steps** section to the user as a interactive selectable list. Do not pre-filter by person
2. Retrieve **quarterly** key focuses via `mcp__jarvis__list_key_focuses`.
2. For each selected items:
    a. Search JARVIS for similar existing tasks. Present matches to the user for confirmation.
    b. For each matching tasks validate with me to be sure that those are really matching NEVER take initiative without validating with me.
    c. Create the task with: explicit title, associated key focuses, for the note body use the following examples `references/gemini_notes_create_task_notes/`.
3. Present the created tasks for final review. Apply corrections as requested.