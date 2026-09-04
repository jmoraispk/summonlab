# Equipment v3 worker protocol

1. Read exactly one immutable target and assignment pair.
2. Verify the prompt hash and every reference hash before generation.
3. Generate one dedicated image; progression-sheet crops and multi-item substitutions are forbidden.
4. Persist only through `persist-equipment-rank-first-output-v3.ts`; it validates canvas, ownership, references, and exclusive-create semantics.
5. Write only the assignment's candidate and provenance-result paths. Candidate never means approved.
6. A failed call is terminal evidence. Retry only as a separately assigned versioned attempt; never overwrite.
7. Never edit v1/v2, approved/runtime catalogs, other visual domains, shared contracts, reviews, or checkpoint receipts.

Root lanes preserve class context and run F→S. Armour pieces remain locked until a hash-bound full-set unlock receipt exists.
