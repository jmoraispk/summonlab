# ADR 0017: Reconnect streams project authoritative events

Status: accepted on 2026-08-24.

## Context

Hearth 01 advances while a browser is closed, so a returning player needs both immediate state and
an intelligible account of what changed. Delivery cannot become another source of truth: dropped
connections, retries, duplicate notifications, or generated prose must never create, reorder, or
invent outcomes. The same mechanism must support a continuously open settlement and a browser that
reconnects after missing many events.

## Decision

- Every committed engine event publishes its resulting cursor through a run-specific PostgreSQL
  `LISTEN/NOTIFY` channel inside the same transaction. PostgreSQL releases the notification only
  after commit; idempotent command retries publish nothing new.
- Event reads use a bounded `afterCursor` page over the append-only event store. A page reports its
  requested, next, and latest cursors, whether more events remain, and a typed `cursor_ahead` or
  `missing_events` gap instead of guessing.
- `GET /api/runs/:runId/events` subscribes before its initial database read. The initial read closes
  the subscribe/read race, and later notifications only wake another ordered read. Each SSE event
  uses the authoritative sequence as its `id`; reconnect gives `Last-Event-ID` precedence over the
  original query cursor. Heartbeats and `no-transform`/no-buffer headers keep intermediaries from
  silently batching the stream.
- A cursor gap causes the browser to discard its projection and reload the latest server snapshot.
  Offline commands are still not queued or replayed speculatively.
- The local prototype records the last acknowledged event cursor per run in browser storage. A
  newly returned page compares that cursor with the server head. An unacknowledged recap survives a
  reload; choosing **Continue to settlement** or **Inspect full log** acknowledges it.
- `GET /api/runs/:runId/recap?after=…` catches up due work, then projects the canonical interval.
  SQL computes exact event counts, plan/routine/activity/arrival/failure counts, and net reward or
  progression deltas over the entire range. At most 128 recent events are candidates for six
  readable highlights, with no more than two highlights of one event type.
- Highlights reuse journal entries and therefore retain their exact event IDs, game times, action
  sources, numerical deltas, and replay cursors. The headline and summary are deterministic domain
  projections. No language-model narration is allowed to supply facts or numbers.

## Consequences

Connected clients observe committed state without polling or running a client simulation. A
reconnecting client can resume exactly, detect impossible history, and inspect every summarized
claim in Replay. Browser-local acknowledgment is sufficient for current private local playtests;
account-synchronized projection cursors remain future multi-device work. Scene-level `applyEvent`
animation is deferred to SET-008, which can now consume the same ordered stream.
