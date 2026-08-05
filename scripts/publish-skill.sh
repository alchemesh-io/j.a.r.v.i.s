#!/bin/bash
# Publish a single artifacts/skills/<name>/ directory to the GCP Agent Registry
# Skills API. Invoked per-skill by `make sync-artifacts-skills`.
#
# Usage: publish-skill.sh <skill-dir> <project> <location>
#
# Entirely native `gcloud alpha agent-registry skills` — no GCS bucket, no
# hand-rolled REST/curl. This used to publish via gcsSource (a GCS bucket
# workaround for the registry's own alt=media download 403ing through this
# project's VPC-SC perimeter), but that block turns out to be a DNS routing
# artifact, not a real API restriction: this VPC's default resolution of
# agentregistry.googleapis.com lands in Google's private VIP pool, which
# doesn't support VPC-SC; pinning to the restricted VIP pool instead (see
# worker/entrypoint.sh) makes alt=media work directly. So skills are now
# published with a raw --payload upload, no bucket involved at all.
#
# Empirically observed (v1alpha) API/CLI behavior this script accounts for:
#  - `skills create --payload=...` alone (no --initial-revision-name) silently
#    creates the skill with NO revision at all — the payload is dropped. And
#    --initial-revision-name + --payload together errors ("source is
#    required") in this CLI version. Only reliable path: create the bare
#    skill first (draft, no revision), then attach the payload via a
#    separate `skills revisions create`.
#  - `skills revisions create` requires an explicit revision ID (positional);
#    the registry doesn't auto-assign one the way `skills create` can for a
#    same-request initial revision. Generated here as rev-<uuid>, matching
#    the registry's own convention for revisions it assigns itself.
#  - The registry may assign a different resource id than the requested
#    skillId (e.g. a "private-" prefix for project-owned/unpublished
#    skills), so the actual skill path is resolved by listing and matching
#    displayName + no "publisher" field, never guessed.
#  - Skills MUST be created with targetState=draft — active is rejected at
#    creation time. Activating (targetState=active) requires a
#    defaultRevision to be set in the SAME update call.
#  - --default-revision (and --initial-revision-name, unused here) must be
#    the fully-qualified revision resource name, not the bare ID.
#  - Each `gcloud ... create`/`update` call already blocks until its
#    operation completes — no separate polling loop needed, unlike the old
#    REST-based flow.
set -euo pipefail

SKILL_DIR="$1"
PROJECT="$2"
LOCATION="$3"

SKILL_MD="${SKILL_DIR}SKILL.md"
if [ ! -f "$SKILL_MD" ]; then
    echo "  (no SKILL.md in $SKILL_DIR, skipping)"
    exit 0
fi

DIR_NAME=$(basename "$SKILL_DIR")
SKILL_ID=$(echo "$DIR_NAME" | tr '_' '-' | sed 's/--/-/g')
DESC=$(grep -m1 '^description:' "$SKILL_MD" | sed 's/^description:[[:space:]]*//' || echo "")

echo "  --- ${SKILL_ID} ---"

ZIP=$(mktemp -u).zip
(cd "$SKILL_DIR" && zip -qr "$ZIP" .)

resolve_skill_id() {
    gcloud alpha agent-registry skills list \
        --project="$PROJECT" --location="$LOCATION" --format=json 2>/dev/null \
        | python3 -c "
import json, sys
name = sys.argv[1]
data = json.load(sys.stdin)
for s in data:
    if s.get('displayName') == name and 'publisher' not in s:
        print(s['name'].rsplit('/', 1)[-1])
        break
" "$SKILL_ID"
}

REAL_ID=$(resolve_skill_id) || true

if [ -z "$REAL_ID" ]; then
    echo "  Creating Skill ${SKILL_ID} (draft, no revision yet)..."
    CREATE_JSON=$(gcloud alpha agent-registry skills create "$SKILL_ID" \
        --project="$PROJECT" --location="$LOCATION" \
        --type=simple --display-name="$SKILL_ID" --description="$DESC" \
        --target-state=draft --format=json)
    REAL_ID=$(echo "$CREATE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['name'].rsplit('/',1)[-1])")
fi

if [ -z "$REAL_ID" ]; then
    echo "  ERROR: could not resolve skill id for ${SKILL_ID}" >&2
    rm -f "$ZIP"
    exit 1
fi

REV_ID="rev-$(python3 -c 'import uuid; print(uuid.uuid4())')"
echo "  Publishing revision ${REV_ID} for ${SKILL_ID} (${REAL_ID})..."
REV_JSON=$(gcloud alpha agent-registry skills revisions create "$REV_ID" \
    --skill="$REAL_ID" --project="$PROJECT" --location="$LOCATION" \
    --payload="$ZIP" --format=json)
rm -f "$ZIP"

REV_NAME=$(echo "$REV_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['name'])")
if [ -z "$REV_NAME" ]; then
    echo "  ERROR: failed to create a revision for ${SKILL_ID}" >&2
    exit 1
fi

echo "  Activating ${SKILL_ID} at revision ${REV_ID}..."
gcloud alpha agent-registry skills update "$REAL_ID" \
    --project="$PROJECT" --location="$LOCATION" \
    --target-state=active --default-revision="$REV_NAME" \
    --format=json > /dev/null

echo "  Done: ${SKILL_ID} -> ${REAL_ID} (revision: ${REV_ID})"
