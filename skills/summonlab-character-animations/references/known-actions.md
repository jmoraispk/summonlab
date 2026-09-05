# Known character actions

## `classical-human-run-5`

Use this repository-owned, classical five-frame human-run motion contract when the requested action
is known and the character can adapt its stride without changing the support alternation. It defines
motion mechanics, not costume, body proportions, or camera.

- Support/contact sequence: `left, left, none, right, right`
- Reference: [classical human-run sequence](classical-human-run.svg)

| Beat | Name          | Support | Motion                                                                       |
| ---- | ------------- | ------- | ---------------------------------------------------------------------------- |
| 1    | Contact A     | left    | The left foot reaches and accepts weight while the right leg trails.         |
| 2    | Compression A | left    | The left knee loads low and the planted foot drives into takeoff.            |
| 3    | Airborne pass | none    | Neither foot is planted; the right knee passes forward.                      |
| 4    | Contact B     | right   | The right foot lands clearly ahead in a silhouette distinct from Contact A.  |
| 5    | Recovery B    | right   | Weight moves over the right foot while the left leg advances into Contact A. |

Reject a candidate when either foot is planted for more than two consecutive frames, Contact B is
missing, the airborne pass reads as planted support, or duplicated/reordered poses are presented as
progression. Reject a loop whose recovery B cannot continue naturally into contact A.
