## Short description

We want in J.A.R.V.I.S task manager UI be able to create new tasks by importing them from either a JIRA ticket or a Google Calendar meeting

## Context

As an assistant J.A.R.V.I.S first job will be to help work organization through task management through a backlog of tasks, daily plannings grouping a set of tasks (and same task can be in multiple daily planning, weekly aggregate a view of all the task integrated for daily planning of the week).

## Implementation details

### Chunk 1 \- Integration with JIRA tickets

When creating a new task, we want to be able to directly take it from JIRA.

* When deploying J.A.R.V.I.S allow through the backend to take as configuration:  
  * a JIRA project URL,   
  * a JIRA API key   
  * and a JQL query (that will do a prefiltering of the ticket).  
* When creating a new task, using this integration with JIRA, the user should be able to select a JIRA tickets to automatically create a correctly formatted task  
* If a task which is not in done state already exist referencing the JIRA ticket, filter out if of the proposed list  
* When a jira ticket id is set on the task add a clickable icon of JIRA that will redirect to the actual JIRA ticket

### Chunk 2 \- Integration with Google Calendar

When creating a new task, we want to be able to directly take it from Google Calendar.

* The backend should be able to connect to a Google Calendar. This is the most critical part for Google integrations. You must define the OAuth2 flow so the client knows how to handle the "Login with Google" redirect. Using this integration with Google Calendar, the user should be able to select a calendar event to automatically create a correctly formatted task.  
* The task doesn’t have jira ticket link