#!/usr/bin/env bash
# Run quick QA on batch rigs as they finish: rebuild the manifest, bench every API rig of the batch that has
# no QA sheet yet, repeat until the batch log says it is done and nothing is left.
# usage: rigging/scripts/qa_loop.sh <batch log> <batch json>
set -u
LOG=$1; BATCH=$2
# id:last-step pairs; a subject is ready once its last step (last clip, or the rig when no clips exist) succeeded.
ids() { python3 -c "
import json
last = {'biped': 'anim-1', 'quadruped': 'anim-0', 'hexapod': 'anim-0', 'octopod': 'anim-0', 'serpentine': 'anim-0'}
for s in json.load(open('$BATCH'))['subjects']:
    if not s.get('done') and s['kind'] != 'equipment':
        print(s['id'] + ':' + last.get(s['body'], 'rig-' + s['body']))"; }
while true; do
  node rigging/scripts/build_manifest.mjs > /dev/null
  todo=()
  for pair in $(ids); do
    id=${pair%%:*}; last=${pair#*:}
    entry="api/${id}-neutral"
    grep -q "\"$entry\"" rigging/manifest.json || continue
    grep -q "\[success\] ${id}-neutral--${last} " "$LOG" || continue
    [ -f "rigging/previews/api-${id}-neutral/qa.webp" ] || todo+=("$entry")
  done
  if [ ${#todo[@]} -gt 0 ]; then PARTS=quick node rigging/scripts/engine_tests.mjs "${todo[@]}" 2>&1 | grep -E "^done|pageerror" ; fi
  if grep -q "batch used" "$LOG" && [ ${#todo[@]} -eq 0 ]; then echo "QA loop finished"; break; fi
  sleep 60
done
