# Affinity review database doctor

The affinity review workflow has a read-only database preflight. It checks connectivity, the
`summonlab_migrations` ledger, every repository migration through the current latest file, and the
tables, columns, and indexes introduced by migrations 0013–0017.

Run it directly without invoking the migration runner:

```bash
pnpm doctor:affinity-review-db
```

The command returns `ready`, `blocked`, or `unavailable` and exits nonzero unless it is ready. It
opens a PostgreSQL `READ ONLY` transaction, issues only catalog and ledger `SELECT` statements,
never applies migrations or writes data, and never includes the database URL or driver error text in
its report. A blocked result lists missing migrations and schema objects. Apply migrations only
through the separately authorized `pnpm db:migrate` workflow; the doctor intentionally cannot do so.
