from typing import Any, Dict, List


def _bounded_score(score: float) -> int:
    return int(max(1, min(5, round(score))))


def evaluate_llm_response(
    llm_text: str,
    suggested_config: Dict[str, Any] | None = None,
    recommendations: List[Dict[str, Any]] | None = None,
    notes: List[str] | None = None,
) -> Dict[str, Any]:
    """
    Lightweight rule-based evaluator for LLM explanation quality.

    Scores:
    1 = poor
    2 = weak
    3 = acceptable
    4 = good
    5 = excellent

    This is not a benchmark evaluation. It is a practical quality-control layer
    for checking whether generated explanations are relevant, grounded, useful,
    clear, and safe.
    """

    raw_text = llm_text or ""
    text = raw_text.lower()
    suggested_config = suggested_config or {}
    recommendations = recommendations or []
    notes = notes or []

    word_count = len(text.split())

    # ---------------------------------------------------------
    # 1. Relevance
    # Checks whether the response discusses diagnosis-related terms.
    # ---------------------------------------------------------
    relevance_keywords = [
        "class imbalance",
        "imbalance",
        "iou",
        "dice",
        "precision",
        "recall",
        "failure",
        "annotation",
        "label",
        "augmentation",
        "dataset",
        "training",
        "configuration",
        "model",
        "recommendation",
        "metric",
        "performance",
    ]

    relevance_hits = sum(1 for keyword in relevance_keywords if keyword in text)

    if relevance_hits >= 10:
        relevance = 5
    elif relevance_hits >= 6:
        relevance = 4
    elif relevance_hits >= 3:
        relevance = 3
    elif relevance_hits >= 1:
        relevance = 2
    else:
        relevance = 1

    # ---------------------------------------------------------
    # 2. Faithfulness
    # Penalizes overconfident or unsupported wording.
    # ---------------------------------------------------------
    risky_phrases = [
        "guaranteed",
        "definitely",
        "always",
        "perfect",
        "100%",
        "will fix",
        "no error",
        "fully solved",
        "certainly",
        "without any issue",
    ]

    uncertainty_good_phrases = [
        "may",
        "might",
        "suggests",
        "likely",
        "appears",
        "could",
        "based on",
    ]

    risky_hits = sum(1 for phrase in risky_phrases if phrase in text)
    grounded_hits = sum(1 for phrase in uncertainty_good_phrases if phrase in text)

    faithfulness = 4

    if grounded_hits >= 2:
        faithfulness += 1

    faithfulness -= risky_hits

    faithfulness = _bounded_score(faithfulness)

    # ---------------------------------------------------------
    # 3. Actionability
    # Checks whether the response gives specific next steps.
    # ---------------------------------------------------------
    action_keywords = [
        "increase",
        "decrease",
        "reduce",
        "adjust",
        "add",
        "remove",
        "balance",
        "augment",
        "retrain",
        "inspect",
        "improve",
        "tune",
        "change",
        "collect",
        "review",
        "validate",
    ]

    action_hits = sum(1 for keyword in action_keywords if keyword in text)

    if recommendations:
        action_hits += min(3, len(recommendations))

    if suggested_config:
        action_hits += 2

    if action_hits >= 8:
        actionability = 5
    elif action_hits >= 5:
        actionability = 4
    elif action_hits >= 3:
        actionability = 3
    elif action_hits >= 1:
        actionability = 2
    else:
        actionability = 1

    # ---------------------------------------------------------
    # 4. Clarity
    # Checks whether response has enough detail but is not too long.
    # ---------------------------------------------------------
    has_structure = any(marker in raw_text for marker in ["\n", "-", "•", "1.", "2."])

    if word_count < 30:
        clarity = 2
    elif 30 <= word_count <= 250 and has_structure:
        clarity = 5
    elif 30 <= word_count <= 350:
        clarity = 4
    elif 350 < word_count <= 550:
        clarity = 3
    else:
        clarity = 2

    # ---------------------------------------------------------
    # 5. Safety
    # Penalizes misleading claims that remove human oversight.
    # ---------------------------------------------------------
    unsafe_phrases = [
        "no human review needed",
        "completely reliable",
        "fully replaces experts",
        "ignore the data",
        "do not inspect",
        "trust the model completely",
        "no need to validate",
    ]

    unsafe_hits = sum(1 for phrase in unsafe_phrases if phrase in text)

    safety = 5 - unsafe_hits
    safety = _bounded_score(safety)

    # ---------------------------------------------------------
    # Overall
    # ---------------------------------------------------------
    overall_score = round(
        (relevance + faithfulness + actionability + clarity + safety) / 5,
        2,
    )

    # ---------------------------------------------------------
    # Disagreement Detection
    # ---------------------------------------------------------
    disagreement_flags = []

    if clarity >= 4 and faithfulness <= 2:
        disagreement_flags.append(
            "The response is clear but may not be faithful to the available evidence."
        )

    if actionability >= 4 and relevance <= 2:
        disagreement_flags.append(
            "The response gives actions, but they may not be relevant to the diagnosis."
        )

    if relevance >= 4 and actionability <= 2:
        disagreement_flags.append(
            "The response discusses relevant issues but does not provide enough actionable next steps."
        )

    if overall_score >= 4.5 and (risky_hits > 0 or unsafe_hits > 0):
        disagreement_flags.append(
            "The overall score is high, but risky or unsafe wording was detected."
        )

    evidence_strength = 0

    if relevance_hits >= 6:
        evidence_strength += 1

    if action_hits >= 4:
        evidence_strength += 1

    if word_count >= 40:
        evidence_strength += 1

    if suggested_config:
        evidence_strength += 1

    if recommendations:
        evidence_strength += 1

    confidence_score = round((evidence_strength / 5) * 100, 1)

    if disagreement_flags:
        confidence_score = max(0, confidence_score - 15)

    return {
        "relevance": relevance,
        "faithfulness": faithfulness,
        "actionability": actionability,
        "clarity": clarity,
        "safety": safety,
        "overall_score": overall_score,
        "confidence_score": confidence_score,
        "disagreement_flags": disagreement_flags,
        "interpretation": _interpret_score(overall_score),
        "method": (
            "Rule-based LLM evaluation using keyword relevance, overclaim detection, "
            "actionability checks, clarity heuristics, safety screening, confidence scoring, "
            "and disagreement detection."
        ),
        "human_review_required": overall_score < 3.5 or confidence_score < 60 or len(disagreement_flags) > 0,
        "details": {
            "word_count": word_count,
            "relevance_hits": relevance_hits,
            "action_hits": action_hits,
            "risky_phrase_hits": risky_hits,
            "grounded_language_hits": grounded_hits,
            "unsafe_phrase_hits": unsafe_hits,
            "evidence_strength": evidence_strength,
        },
    }


def _interpret_score(score: float) -> str:
    if score >= 4.5:
        return "Excellent LLM response"
    if score >= 3.5:
        return "Good LLM response"
    if score >= 2.5:
        return "Acceptable, but human review is recommended"
    return "Weak response; human review is strongly recommended"