# Material Equipment v1 root review packet

This packet is a review aid for `material-equipment-v1-run-001`. Everything shown here is
production evidence only: no candidate is approved or available to runtime code.

## Run result

| Rank | Candidate | Revise | Failed | Image files |
| --- | ---: | ---: | ---: | ---: |
| F | 4 | 6 | 1 | 10 |
| E | 3 | 8 | 0 | 11 |
| D | 3 | 8 | 0 | 11 |
| C | 2 | 9 | 0 | 11 |
| B | 3 | 8 | 0 | 11 |
| A | 1 | 10 | 0 | 11 |
| S | 0 | 11 | 0 | 11 |
| **Total** | **16** | **60** | **1** | **76** |

All 77 root jobs have a verified provenance result and a hash-bound terminal event. The Ash staff
is the one failed job: its single permitted generation call returned no bindable image source, so
the run records the failure and intentionally has no candidate PNG for that target.

The 84 dependent armour-piece jobs remain gated and unproduced. Accepting a full-set source is a
separate human-review action that can unlock exactly its four pieces; this packet performs no such
action.

## Reading the sheets

- Green: `candidate` — passed the worker's objective checks, but is still unapproved.
- Amber: `revise` — a reviewable image exists, with one or more recorded criterion failures.
- Red: `failed` — no reviewable image exists; consult the provenance result.

The contact sheets are derived previews. The canonical review inputs are the individual PNGs under
`../../candidates/`, paired with the JSON provenance results under `../../results/`.

## Rank sheets

### F

![F-rank Equipment root candidates](./f-rank-root-contact-sheet.png)

### E

![E-rank Equipment root candidates](./e-rank-root-contact-sheet.png)

### D

![D-rank Equipment root candidates](./d-rank-root-contact-sheet.png)

### C

![C-rank Equipment root candidates](./c-rank-root-contact-sheet.png)

### B

![B-rank Equipment root candidates](./b-rank-root-contact-sheet.png)

### A

![A-rank Equipment root candidates](./a-rank-root-contact-sheet.png)

### S

![S-rank Equipment root candidates](./s-rank-root-contact-sheet.png)
