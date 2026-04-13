## Short description

Implement the concept of worker, which is a dedicated claude code session composed of an initial prompt, a set of skills to locally pull, a local folder path or git repository to pull if not existing and associated to a task.

## Context

## Implementation details

### Chunk 1 \- Worker model

* **states**: The state in which the worker session is  
  * Initialized: The worker pod is created, the skills are loaded  
  * Working: A claude code session is running with claude working (not waiting for human input)  
  * Waiting for human: Claude code session is waiting for new input from human  
  * Done: The prompt session is finished but can be re-take if needed (pod of the worker still alive)  
  * Archived: Backup of the prompt history but the pod is gone and can’t comeback  
* **task\_id**: JARVIS task the worker is related to  
* **repositories**:  The list of git repositories to clone in the working folder  
* **type**: for now only Claude code is supported, in the future we plan to support Github copilot

### Chunk 2 \- Repositories model

- Git repository url  
- branch (default: main)

git repo and branch couple: must be unique over all JARVIS 

### Chunk 3 \- Workers in UI

Introduce a new page on the JARVIS UI enabling to manage workers. On this page we have the ability to:

- Manage repositories  
- See the full list of JARVIS workers (always using card pattern like for tasks and key focuses)

### Chunk 3 \- Worker composition

Docker image containing:

* A workdir \~/jarvis, where all the work should happens  
* A claude code basic installation with npm package (FIX the version used)  
* JARVIS worker UI  
* JARVIS worker endpoint  
* Last version of arctl cli to be able to pull artefacts from agent registry (jaar)  
* Pre-create \~/.claude folder

Reuse the code [https://github.com/erdrix/claude-code](https://github.com/erdrix/claude-code) (download and inspect it) implement a worker UI that enables it to interact with the claude code session.  
**IMPORTANT**: the worker should all be accessible to the [jaw.jarvis.io](http://jaw.jarvis.io) CNAME, but route based on /\<worker\_id\> within the gateway.

The worker should expose an endpoint stating the worker state based on the pod activity \!

### Chunk 4 \- Minikube and host pre-requisite

The following files must be replicated and sync in configmap mounted in the same path on all the workers:

* \~/.claude/policy-limits.json  
* \~/.claude/remote-settings.json  
* \~/.claude.json  
* \~/.claude/settings.json

### Chunk 5 \- Worker initialisation

If no worker exist yet for a given task, the user can click on a “play” button on the task to initiate a new worker following the model:

* **Skills**: by default all the skills available in the agent registry (jaar) are selected  
* **Repositories**: by default none are selected, and you can add as much as repositories as you want for the worker  
* **Type**: The type of worker that will be deployed

When a worker start, it creates a pod that:

* use a kubernetes secret containing a Github token to clone the repositories  
* use a Kubernetes secret containing either ANTHROPIC\_API\_KEY or CLAUDE\_CODE\_OAUTH\_TOKEN  
* Mount the configmap of the chunk 4 in an init folder

Once the pod start it initialize by:

* Initialize claude code setup, by copying the chunk 4 mounted configmap in the right folders:  
  * \~/.claude/policy-limits.json  
  * \~/.claude/remote-settings.json  
  * \~/.claude.json  
  * \~/.claude/settings.json  
* Add the configuration for JARVIS mcp server  
* Perform a git clone in \~/jarvis folder for all repositories  
* Pull all selected skills from the agent registry using arctl command line

Once the initialization is done, run in the worker pod the endpoint, the worker UI and an initial claude code session (with id matching the worker id, this means the worker id should match the requirement of the session id). 

### Chunk 6 \- Worker and task

On each task add the worker status using an appropriate icon, reflecting the worker state, and when clicked redirecting to the worker chat UI

### Chunk 7 \- Enable VSCode instance run

Add a VScode icon for each task that has a worker, so that when clicked it opens a VSCode remote on the worker pod, and runs in the terminal the Claude code session with the right id.

### 

