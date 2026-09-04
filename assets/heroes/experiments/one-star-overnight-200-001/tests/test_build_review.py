from __future__ import annotations

import sys
import tempfile
import unittest
import json
from pathlib import Path
from unittest.mock import patch

from PIL import Image

EXPERIMENT = Path(__file__).resolve().parents[1]
SCRIPTS = EXPERIMENT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import build_review  # noqa: E402
from build_review import (  # noqa: E402
    Artifact,
    CANVAS,
    EXPERIMENT_ROOT,
    Pair,
    _json_script_payload,
    _render_pair_page,
    _webp_bytes,
    discover_review_state,
    load_effective_roster,
    materialize_derivative,
    review_roster_entries,
    select_pairs,
)


def artifact(hero_id: str, kind: str, version: int, status: str = "candidate", *, source_target: str = "hero-summon-v1") -> Artifact:
    source = {
        "targetId": source_target,
        "candidatePath": f"assets/x/{hero_id}/summon-v1.png",
        "sha256": "a" * 64,
        "resultPath": f"assets/x/{hero_id}/summon-v1.json",
    } if kind == "combat-chibi" else None
    target_id = f"{hero_id}-{kind}-v{version}"
    target = {
        "targetId": target_id,
        "targetVersion": version,
        "waveId": "wave-01",
        "heroSpec": {"same": True},
        "sourceSummon": source,
        "output": {"resultPath": f"assets/x/{hero_id}/{kind}-v{version}.json"},
    }
    return Artifact(hero_id, kind, version, target, {"status": status}, f"assets/x/{hero_id}/{kind}-v{version}.png", "a" * 64, 10)


def roster(hero_id: str = "hero") -> dict:
    return {
        "heroId": hero_id,
        "displayName": "Hero Name",
        "waveId": "wave-01",
        "physicalManifest": {"designOrdinal": 1, "adultAge": 29},
        "quotaCoordinates": {
            "gender": "woman", "body": "athletic-conditioned", "hairColor": "black",
            "wardrobe": "layered-wrap", "palette": "ochre-cream", "height": "medium",
            "ageBand": "25-30", "detailDensity": "one",
        },
    }


class ReviewBuilderTests(unittest.TestCase):
    def test_webp_derivative_is_fixed_canvas(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            source = Path(temp) / "source.png"
            Image.new("RGBA", (300, 300), (255, 0, 0, 0)).save(source)
            payload = _webp_bytes(source.read_bytes())
            output = Path(temp) / "out.webp"
            output.write_bytes(payload)
            with Image.open(output) as image:
                self.assertEqual(image.size, CANVAS)
                self.assertEqual(image.format, "WEBP")

    def test_selects_highest_candidate_versions_and_requires_source_binding(self) -> None:
        summon_v1 = artifact("hero", "summon", 1)
        summon_v2 = artifact("hero", "summon", 2)
        chibi_v1 = artifact("hero", "combat-chibi", 1, source_target="hero-summon-v1")
        chibi_v2 = artifact("hero", "combat-chibi", 2, source_target="hero-summon-v2")
        # Make source records bind the exact selected summon.
        for chibi, summon in ((chibi_v1, summon_v1), (chibi_v2, summon_v2)):
            chibi.target["sourceSummon"].update({
                "candidatePath": summon.source_path,
                "sha256": summon.source_sha256,
                "resultPath": summon.target["output"]["resultPath"],
            })
        pairs, quarantine = select_pairs([roster()], {"hero": [summon_v1, summon_v2, chibi_v1, chibi_v2]})
        self.assertEqual(len(pairs), 1)
        self.assertEqual((pairs[0].summon.version, pairs[0].chibi.version), (2, 2))
        self.assertEqual(quarantine, [])

    def test_revise_artifact_never_qualifies_as_complete_pair(self) -> None:
        summon = artifact("hero", "summon", 1)
        chibi = artifact("hero", "combat-chibi", 1, status="revise")
        pairs, quarantine = select_pairs([roster()], {"hero": [summon, chibi]})
        self.assertEqual(pairs, [])
        self.assertEqual(len(quarantine), 1)
        self.assertIn("No candidate-status combat chibi", quarantine[0].reasons)

    def test_superseded_revise_does_not_hide_complete_selected_pair(self) -> None:
        summon = artifact("hero", "summon", 1)
        chibi_revise = artifact("hero", "combat-chibi", 1, status="revise")
        chibi = artifact("hero", "combat-chibi", 2)
        chibi.target["sourceSummon"].update({
            "targetId": summon.target["targetId"],
            "candidatePath": summon.source_path,
            "sha256": summon.source_sha256,
            "resultPath": summon.target["output"]["resultPath"],
        })
        pairs, quarantine = select_pairs([roster()], {"hero": [summon, chibi_revise, chibi]})
        self.assertEqual(len(pairs), 1)
        self.assertEqual(pairs[0].chibi.version, 2)
        self.assertEqual(len(quarantine), 1)
        self.assertIn("Superseded", quarantine[0].reasons[0])

    def test_pair_page_keeps_pair_side_by_side_and_full_source_links(self) -> None:
        summon = artifact("hero", "summon", 1)
        chibi = artifact("hero", "combat-chibi", 1)
        chibi.target["sourceSummon"].update({
            "targetId": summon.target["targetId"], "candidatePath": summon.source_path,
            "sha256": summon.source_sha256, "resultPath": summon.target["output"]["resultPath"],
        })
        pair = Pair(roster(), summon, chibi)
        derivatives = {
            ("hero", "summon", 1): {"path": "assets/review/s.webp", "sourcePath": summon.source_path},
            ("hero", "combat-chibi", 1): {"path": "assets/review/c.webp", "sourcePath": chibi.source_path},
        }
        rendered = _render_pair_page(
            "assets/review/index.html", [pair], derivatives, 1, 1,
            {"planned": 200, "complete": 1, "quarantine": 0, "reserves": 0},
        )
        self.assertIn('<div class="pair">', rendered)
        self.assertIn("Summon · full source", rendered)
        self.assertIn("Combat chibi · full source", rendered)
        self.assertIn('data-body="athletic-conditioned"', rendered)
        self.assertIn("1 / 200 complete pairs", rendered)
        self.assertNotIn("runtime asset", rendered.lower())

    def test_pair_page_exposes_accessible_persistent_mutually_exclusive_decisions(self) -> None:
        summon = artifact("hero", "summon", 1)
        chibi = artifact("hero", "combat-chibi", 1)
        chibi.target["sourceSummon"].update({
            "targetId": summon.target["targetId"], "candidatePath": summon.source_path,
            "sha256": summon.source_sha256, "resultPath": summon.target["output"]["resultPath"],
        })
        pair = Pair(roster(), summon, chibi)
        derivatives = {
            ("hero", "summon", 1): {"path": "assets/review/s.webp", "sourcePath": summon.source_path},
            ("hero", "combat-chibi", 1): {"path": "assets/review/c.webp", "sourcePath": chibi.source_path},
        }
        decision_roster = review_roster_entries([roster()], [pair], {"hero": [summon, chibi]})
        rendered = _render_pair_page(
            "assets/review/index.html", [pair], derivatives, 1, 1,
            {"planned": 1, "complete": 1, "quarantine": 0, "reserves": 0},
            decision_roster,
        )
        self.assertIn('data-hero-id="hero"', rendered)
        self.assertIn('<fieldset><legend>Decision</legend>', rendered)
        self.assertEqual(rendered.count('name="decision-hero"'), 5)
        for value in ("keep", "revise-summon", "revise-chibi", "revise-both", "pass"):
            self.assertIn(f'value="{value}" data-decision-choice', rendered)
        self.assertIn('data-filter="decision"', rendered)
        self.assertIn('data-export-decisions', rendered)
        self.assertIn('aria-live="polite"', rendered)
        self.assertIn("localStorage.getItem(storageKey(heroId))", rendered)
        self.assertIn("hero-one-star-review-decisions-v1", rendered)
        self.assertIn("candidate-only; review decisions do not approve or promote candidates", rendered)

    def test_review_roster_export_model_is_stable_and_explicitly_pending(self) -> None:
        entries = []
        artifacts_by_hero = {}
        for ordinal in range(200, 0, -1):
            item = roster(f"hero-{ordinal}")
            item["displayName"] = f"Hero {ordinal}"
            item["physicalManifest"]["designOrdinal"] = ordinal
            entries.append(item)
            artifacts_by_hero[item["heroId"]] = []
        modeled = review_roster_entries(entries, [], artifacts_by_hero)
        self.assertEqual(len(modeled), 200)
        self.assertEqual([entry["designOrdinal"] for entry in modeled], list(range(1, 201)))
        self.assertTrue(all(entry["pairState"] == "unproduced" for entry in modeled))
        self.assertTrue(all("selectedCandidates" not in entry for entry in modeled))

    def test_review_roster_model_distinguishes_started_and_complete_pairs(self) -> None:
        complete = roster("complete-hero")
        complete["physicalManifest"]["designOrdinal"] = 2
        started = roster("started-hero")
        started["physicalManifest"]["designOrdinal"] = 1
        summon = artifact("complete-hero", "summon", 1)
        chibi = artifact("complete-hero", "combat-chibi", 1)
        pair = Pair(complete, summon, chibi)
        modeled = review_roster_entries(
            [complete, started],
            [pair],
            {"complete-hero": [summon, chibi], "started-hero": [artifact("started-hero", "summon", 1)]},
        )
        self.assertEqual([entry["heroId"] for entry in modeled], ["started-hero", "complete-hero"])
        self.assertEqual(modeled[0]["pairState"], "started-incomplete")
        self.assertEqual(modeled[1]["pairState"], "complete-pair")
        self.assertEqual(modeled[1]["selectedCandidates"]["summonTargetId"], summon.target["targetId"])

    def test_embedded_roster_json_cannot_terminate_script_element(self) -> None:
        malicious = [{"heroId": "hero", "displayName": "</script><script>alert(1)</script>\u2028"}]
        payload = _json_script_payload(malicious)
        self.assertNotIn("<", payload)
        self.assertNotIn("\u2028", payload)
        self.assertEqual(json.loads(payload), malicious)

    def test_unstarted_roster_slot_is_pending_not_quarantined(self) -> None:
        pairs, quarantine = select_pairs([roster()], {"hero": []})
        self.assertEqual(pairs, [])
        self.assertEqual(quarantine, [])

    def test_derivative_creation_does_not_mutate_source_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            relative = f"{EXPERIMENT_ROOT}/waves/wave-01/candidates/hero/summon-v1.png"
            source = workspace / relative
            source.parent.mkdir(parents=True)
            Image.new("RGB", (1024, 1536), "#a36938").save(source)
            before = source.read_bytes()
            item = artifact("hero", "summon", 1)
            item = Artifact(
                item.hero_id,
                item.kind,
                item.version,
                item.target,
                item.result,
                relative,
                build_review.sha256_bytes(before),
                len(before),
            )
            record = materialize_derivative(workspace, item)
            self.assertEqual(source.read_bytes(), before)
            self.assertEqual(record["sourceSha256"], build_review.sha256_bytes(before))
            with Image.open(workspace / record["path"]) as image:
                self.assertEqual(image.size, CANVAS)

    def test_effective_roster_consumes_append_only_activation_chain(self) -> None:
        source_roster = json.loads((EXPERIMENT / "roster-plan.json").read_text())
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp)
            roster_path = workspace / EXPERIMENT_ROOT / "roster-plan.json"
            roster_path.parent.mkdir(parents=True)
            roster_path.write_text(json.dumps(source_roster))
            slot = source_roster["active"][0]
            reserve = source_roster["reserves"][0]
            relative = (
                f"{EXPERIMENT_ROOT}/activations/activation-0001-"
                f"{slot['heroId']}--{reserve['heroId']}.json"
            )
            activation_path = workspace / relative
            activation_path.parent.mkdir(parents=True)
            record = {
                "failedActiveHeroId": slot["heroId"],
                "reserveHeroId": reserve["heroId"],
                "destinationWave": slot["waveId"],
                "physicalManifest": slot["physicalManifest"],
                "slotQuotaCoordinates": slot["quotaCoordinates"],
                "failedSlotEvidence": {"heroId": slot["heroId"]},
                "preservedReserveIdentity": {
                    "displayName": reserve["displayName"],
                    "activatedIdentitySignature": "d" * 64,
                },
            }
            activation_path.write_text(json.dumps(record))
            selection = [
                {
                    "slotHeroId": entry["heroId"],
                    "selectedHeroId": (
                        reserve["heroId"] if entry["heroId"] == slot["heroId"] else entry["heroId"]
                    ),
                }
                for entry in source_roster["active"]
            ]
            with patch.object(build_review, "_activation_files", return_value=[relative]), patch.object(
                build_review,
                "_current_selection",
                return_value=(selection, {reserve["heroId"]}, {slot["heroId"]}, "b" * 64, 1),
            ):
                effective, summary = load_effective_roster(workspace)
            selected = next(entry for entry in effective if entry["heroId"] == reserve["heroId"])
            self.assertEqual(len(effective), 200)
            self.assertEqual(selected["waveId"], slot["waveId"])
            self.assertEqual(selected["quotaCoordinates"], slot["quotaCoordinates"])
            self.assertEqual(
                selected["physicalManifest"]["designOrdinal"],
                slot["physicalManifest"]["designOrdinal"],
            )
            self.assertEqual(summary["count"], 1)
            self.assertEqual(summary["paths"][0]["path"], relative)

    def test_replaced_active_slot_is_retained_only_in_quarantine(self) -> None:
        effective = roster("reserve-hero")
        retired = roster("retired-hero")
        retired["physicalManifest"]["designOrdinal"] = 2
        old_summon = artifact("retired-hero", "summon", 1)
        activations = {
            "paths": [{"path": "activation.json", "sha256": "c" * 64}],
            "chainHeadSha256": "d" * 64,
            "count": 1,
            "replacements": [
                {"reserveHeroId": "reserve-hero", "replacesHeroId": "retired-hero"}
            ],
            "transitions": [
                {
                    "slotHeroId": "retired-hero",
                    "deactivatedHeroId": "retired-hero",
                    "replacementHeroId": "reserve-hero",
                    "activationPath": "activation.json",
                    "roster": retired,
                }
            ],
        }
        with patch.object(
            build_review, "load_effective_roster", return_value=([effective], activations)
        ), patch.object(
            build_review, "_load_json_bytes", return_value={"active": [retired]}
        ), patch.object(
            build_review,
            "collect_executions",
            return_value={"reserve-hero": [], "retired-hero": [old_summon]},
        ):
            selected, _acts, _artifacts, pairs, quarantine = discover_review_state(Path("."))
        self.assertEqual([entry["heroId"] for entry in selected], ["reserve-hero"])
        self.assertEqual(pairs, [])
        self.assertEqual(len(quarantine), 1)
        self.assertEqual(quarantine[0].roster["heroId"], "retired-hero")
        self.assertIn("replaced by reserve reserve-hero", quarantine[0].reasons[0])


if __name__ == "__main__":
    unittest.main()
