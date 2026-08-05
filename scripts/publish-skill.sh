#!/bin/bash
# Publish a single artifacts/skills/<name>/ directory to the GCP Agent Registry
# Skills API. Invoked per-skill by `make sync-artifacts-skills` and by the
# artifacts-publish CI workflow.
#
# Usage: publish-skill.sh <skill-dir> <project> <location> <gcs-bucket>
#
# Empirically observed (v1alpha) API behavior this script accounts for:
#  - Skills MUST be created with targetState=TARGET_STATE_DRAFT (or DISABLED) —
#    ACTIVE is rejected at creation time.
#  - The registry may assign a different resource id than the requested skillId
#    (e.g. a "private-" prefix for project-owned/unpublished skills), so the
#    actual skill path is resolved by listing and matching displayName + no
#    "publisher" field, never guessed.
#  - Promoting to ACTIVE requires a follow-up PATCH setting both targetState
#    and defaultRevision together — ACTIVE is rejected without a defaultRevision.
#  - The registry's own archiveUploadSource + alt=media download path is blocked
#    by this project's VPC-SC perimeter for in-cluster callers (see the comment
#    at the top of agent_registry.tf in the infra repo) — revisions are
#    published via gcsSource instead, and workers fetch the payload directly
#    from GCS (see worker/entrypoint.sh's fetch_skill()).
set -euo pipefail

SKILL_DIR="$1"
PROJECT="$2"
LOCATION="$3"
BUCKET="$4"

SKILL_MD="${SKILL_DIR}SKILL.md"
if [ ! -f "$SKILL_MD" ]; then
    echo "  (no SKILL.md in $SKILL_DIR, skipping)"
    exit 0
fi

DIR_NAME=$(basename "$SKILL_DIR")
SKILL_ID=$(echo "$DIR_NAME" | tr '_' '-' | sed 's/--/-/g')
DESC=$(grep -m1 '^description:' "$SKILL_MD" | sed 's/^description:[[:space:]]*//' || echo "")
ROOT="https://agentregistry.googleapis.com/v1alpha/projects/${PROJECT}/locations/${LOCATION}"
TOKEN=$(gcloud auth print-access-token)

echo "  --- ${SKILL_ID} ---"

ZIP=$(mktemp -u).zip
(cd "$SKILL_DIR" && zip -qr "$ZIP" .)

GCS_OBJECT="gs://${BUCKET}/${SKILL_ID}/$(date +%s).zip"
gcloud storage cp "$ZIP" "$GCS_OBJECT" > /dev/null
rm -f "$ZIP"

resolve_skill_path() {
    curl -sf -H "Authorization: Bearer ${TOKEN}" "${ROOT}/skills" \
        | python3 -c "
import json, sys
name = sys.argv[1]
d = json.load(sys.stdin)
matches = [s['name'] for s in d.get('skills', []) if s.get('displayName') == name and 'publisher' not in s]
print(matches[0] if matches else '')
" "$SKILL_ID"
}

SKILL_PATH=$(resolve_skill_path)
REV_PATH=""

if [ -n "$SKILL_PATH" ]; then
    echo "  Publishing new revision for ${SKILL_ID} (${SKILL_PATH})..."
    # metadata.target on the create-revision operation names the specific new
    # revision directly — the skill may already have other ACTIVE revisions, so
    # polling the collection for "any ACTIVE revision" (as opposed to this exact
    # one) can resolve to a stale one instead of waiting for this new one.
    REV_OP=$(curl -sf -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
        "https://agentregistry.googleapis.com/v1alpha/${SKILL_PATH}/revisions" \
        -d "{\"gcsSource\":{\"uri\":\"${GCS_OBJECT}\"}}")
    REV_PATH=$(echo "$REV_OP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('metadata',{}).get('target',''))")
else
    echo "  Creating Skill ${SKILL_ID} with initial revision (draft)..."
    CREATE_OP=$(curl -sf -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
        "${ROOT}/skills?skillId=${SKILL_ID}" \
        -d "{\"type\":\"SIMPLE\",\"displayName\":\"${SKILL_ID}\",\"description\":\"${DESC}\",\"targetState\":\"TARGET_STATE_DRAFT\",\"initialRevision\":{\"gcsSource\":{\"uri\":\"${GCS_OBJECT}\"}}}")
    SKILL_PATH=$(echo "$CREATE_OP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('metadata',{}).get('target',''))")
fi

if [ -z "$SKILL_PATH" ]; then
    echo "  ERROR: could not resolve skill path for ${SKILL_ID}" >&2
    exit 1
fi

# For a brand-new skill, the initial revision's exact name isn't in the create
# operation's metadata (that names the Skill, not the revision) — but since it's
# the only revision that can exist yet, resolving "the" revision unambiguously
# works there.
if [ -z "$REV_PATH" ]; then
    REV_PATH=$(curl -sf -H "Authorization: Bearer ${TOKEN}" "https://agentregistry.googleapis.com/v1alpha/${SKILL_PATH}/revisions" \
        | python3 -c "import json,sys; revs=json.load(sys.stdin).get('skillRevisions',[]); print(revs[0]['name'] if revs else '')")
fi

if [ -z "$REV_PATH" ]; then
    echo "  ERROR: could not resolve a revision for ${SKILL_ID}" >&2
    exit 1
fi

# Poll this exact revision (not "any ACTIVE revision" in the collection) until
# it settles — freshly created revisions start in CREATING state.
REV_STATE=""
for attempt in 1 2 3 4 5 6; do
    REV_STATE=$(curl -sf -H "Authorization: Bearer ${TOKEN}" "https://agentregistry.googleapis.com/v1alpha/${REV_PATH}" \
        | python3 -c "import json,sys; print(json.load(sys.stdin).get('state','?'))")
    if [ "$REV_STATE" = "ACTIVE" ]; then break; fi
    echo "  (revision ${REV_PATH##*/} state=${REV_STATE}, retrying in 10s...)"
    sleep 10
done

if [ "$REV_STATE" != "ACTIVE" ]; then
    echo "  ERROR: revision ${REV_PATH##*/} for ${SKILL_ID} did not become ACTIVE (state=${REV_STATE})" >&2
    exit 1
fi

echo "  Activating ${SKILL_ID} at revision ${REV_PATH##*/}..."
# A freshly created revision can take a few seconds to become eligible as
# defaultRevision (empirically observed eventual-consistency lag) — retry with
# backoff rather than a single attempt.
activated=0
for attempt in 1 2 3 4 5; do
    if curl -sf -X PATCH -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
        "https://agentregistry.googleapis.com/v1alpha/${SKILL_PATH}?updateMask=targetState,defaultRevision" \
        -d "{\"targetState\":\"TARGET_STATE_ACTIVE\",\"defaultRevision\":\"${REV_PATH}\"}" > /dev/null; then
        activated=1
        break
    fi
    echo "  (activation attempt ${attempt} not ready yet, retrying in 5s...)"
    sleep 5
done
if [ "$activated" -ne 1 ]; then
    echo "  ERROR: failed to activate ${SKILL_ID} after 5 attempts" >&2
    exit 1
fi

echo "  Done: ${SKILL_ID} -> ${SKILL_PATH} (payload: ${GCS_OBJECT})"
