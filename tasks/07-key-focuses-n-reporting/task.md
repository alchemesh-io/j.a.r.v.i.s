
## Short description

Add support in JARVIS of two new types of feature: key focuses and reporting

## Context

As an assistant J.A.R.V.I.S first job will be to help work organization through task management through a backlog of tasks, daily plannings grouping a set of tasks (and same task can be in multiple daily planning, weekly aggregate a view of all the task integrated for daily planning of the week). 

## Implementation details

### Chunk 1 \- Key focuses data modeling

A key focus is an item composed of:

* A title  
* A short description: defining the major outcomes / outputs of the focus  
* A kind: the must be one of the following set:   
  * **Delivery:** Help to directly deliver value  
  * **Learning:** Improve personal knowledge  
  * **Support:** Gives assistance to other team to achieve their own objectives  
  * **Operational:** Support the operational excellence through multiple axes (incident management, bug, risks, costs etc.)  
  * **Side quest:** Personal or none mandatory achievement to perform the extra-mile  
* A status:  
  * In progress  
  * Succeed  
  * Failed

A key focus can have be of one of the following frequency:

* Weekly  
* Quarterly

Reuse the existing weekly table 

### Chunk 2 \- Task and key focuses relation

* Update the task modeling so that it can references one or multiple key focuses  
* Add support within the UI to manage key focuses for a given task  
* Add support within the UI to show the list of key focuses related to the given task (on the card directly as badge for example)

### Chunk 3 \- Blocker data modeling

* A blocker is an item that can be associated to either a task or a key focus  
* A blocker can only be linked to one task or one key focus  
* A blocker can have two states:  
  * Opened  
  * Resolved

### Chunk 5 \- Front end rendering

New views

* Modify the tasks view name to something more generic  
* With this view add three clickable button on the left:  
  * Tasks  
  * Key focuses  
  * Reports  
* Replicate for the two new views the same header than for task, for the calendar, frequency selection  
* For the key focuses, the rendering is the same as for tasks (with cards) just adapt based on the data modeling.

Support blocker:

* As for the notes add a button to associate blockers to a task or a key focus

### Chunk 6 \- MCP propagation

* Propagate the backend changes to the MCP server tools

