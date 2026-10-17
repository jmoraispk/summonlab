<div align="center">

<img src="assets/agent-summoning-concept.png" alt="A summoner watches an autonomous agent hero emerge through a gate surrounded by possible actions" width="100%">

# Summonlab

**A hero-summoning game where every hero is an autonomous agent.**

</div>

Summon heroes, build a home around them, prepare parties, and climb a randomized
one-hundred-floor tower. Heroes develop through experience, relationships, habits, training, and
the systems the player creates around them.

## Heroes

<table>
  <tr>
    <td align="center" width="25%"><img src="apps/web/static/runtime/summonable-heroes-v1/aear-soro/summon.166b800dc912.webp" alt="Approved full-body summon portrait of Aear Soro" width="200"><br><strong>Aear Soro</strong></td>
    <td align="center" width="25%"><img src="apps/web/static/runtime/summonable-heroes-v1/senia-lorel/summon.7e03bfdf78e6.webp" alt="Approved full-body summon portrait of Senia Lorel" width="200"><br><strong>Senia Lorel</strong></td>
    <td align="center" width="25%"><img src="apps/web/static/runtime/summonable-heroes-v1/nelan-mora/summon.58927db381c4.webp" alt="Approved full-body summon portrait of Nelan Mora" width="200"><br><strong>Nelan Mora</strong></td>
    <td align="center" width="25%"><img src="apps/web/static/runtime/summonable-heroes-v1/ori-loran/summon.36e350872ed6.webp" alt="Approved full-body summon portrait of Ori Loran" width="200"><br><strong>Ori Loran</strong></td>
  </tr>
</table>

A summon begins with a stranger. Learn who arrived: what they want, what they fear, whom they trust,
and where they might find purpose. You are the Master, the nonphysical presence guiding their
settlement. Heroes interpret your directions and make their own choices.

A quiet craftsperson, a patient teacher, and a capable fighter can each become essential to the town.
These four portraits are a small selection from the [200 approved heroes](docs/readme-gallery/heroes.md).

## Home

<img src="docs/evidence/direct-village-summoning-house/village-desktop.png" alt="Prototype Village at night, with the Summoning Circle, Residence, Training Grounds, Forge, and Tower Portal connected by paths" width="100%">

*Village screenshot from the prototype.*

The Hearth is where those strangers become neighbors. The Residence offers a place to rest and share
meals. The Training Grounds give practice a rhythm. The Forge turns preparation into something a hero
can carry. The Summoning Circle brings someone new into a town that already has a history.

The vision is a settlement that keeps living between expeditions: work, friendships, rivalries,
mentorship, and habits. Your choices shape the conditions around those lives. A building matters
because it changes what people can do and whom they meet.

## Enemies

<img src="docs/readme-gallery/enemies.jpg" alt="Five enemy families with three selected progression stages in each, from smaller threats to powerful advanced forms" width="100%">

Beyond the Tower Portal lies a randomized one-hundred-floor campaign. Different monster families
bring distinct forms, battlefield roles, and elemental affinities. The selection above shows how
familiar threats can develop into very different challenges.

The climb is meant to test what a party has learned together. Reading a threat, covering a weakness,
and knowing when to retreat should matter alongside strength.

## Equipment

<img src="docs/readme-gallery/equipment.jpg" alt="Selected equipment sets across three ranks, showing weapons and matching heavy armor, light armor, and robes" width="100%">

Preparation connects the village to the expedition. Weapons, armor, materials, and rank progression
give the Forge a place in the larger story. A complete set gives each hero tools suited to the work
ahead, while supplies, training, and recovery help a party use those tools well.

## Skills

<img src="docs/readme-gallery/skills.jpg" alt="A selection of skill artwork spanning combat, magic, crafting, knowledge, and support" width="100%">

Skills grow through meaningful practice. Fighting, making, learning, teaching, and supporting others
all give a hero ways to contribute. The intended system connects what a person does each day with
what they become capable of doing next.

The long story is the history of a Hearth: who you welcomed, what they became, what you asked of
them, and how the town changed. Reaching Floor 100 gives the campaign a destination. The people give
it a reason to matter.

The sections above describe the intended experience. This repository preserves the prototype,
approved artwork, experiments, and broader design; implementation coverage is recorded in the
[release roadmap](docs/wiki/roadmap/README.md) and [implementation progress](docs/progress.md).

<details>
<summary>Run the prototype locally</summary>

Requires Node `24.19.0` (pinned in `.node-version`) and pnpm `10.33.0`.
Source artwork uses Git LFS; install Git LFS before cloning, or run `git lfs pull` in an existing clone.

```sh
pnpm install
pnpm dev:app
```

Open `http://localhost:5173`. This lightweight mode does not require Docker; database-backed
features report PostgreSQL as unavailable. For the complete stack, including PostgreSQL and
migrations, run `pnpm dev` with Docker available.

```sh
pnpm check     # full repository validation
pnpm test:e2e  # browser tests
pnpm db:stop   # stop local PostgreSQL
```

[Game wiki](docs/wiki/README.md) · [System architecture](docs/system-architecture/README.md) ·
[Web application and deployment](apps/web/README.md)

</details>

---

**Archive notice:** The website is no longer available, and development is paused for now.
This repository preserves Summonlab's prototype, artwork, and intended game design.
