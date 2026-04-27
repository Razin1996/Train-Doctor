from typing import Any, Dict, List


def _score_from_hits(hits: int, divisor: int = 2) -> int:
    return min(5, max(1, hits // divisor + 1))


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
    """

    text = (llm_text or "").lower()
    suggested_config = suggested_config or {}
    recommendations = recommendations or []
    notes = notes or []

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
    ]
    relevance_hits = sum(1 for keyword in relevance_keywords if keyword in text)
    relevance = _score_from_hits(relevance_hits)

    risky_phrases = [
        "guaranteed",
        "definitely",
        "always",
        "perfect",
        "100%",
        "will fix",
        "no error",
        "fully solved",
    ]
    risky_hits = sum(1 for phrase in risky_phrases if phrase in text)
    faithfulness = max(1, 5 - risky_hits)

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
    ]
    action_hits = sum(1 for keyword in action_keywords if keyword in text)
    if recommendations:
        action_hits += min(4, len(recommendations))
    if suggested_config:
        action_hits += 2
    actionability = _score_from_hits(action_hits)

    word_count = len(text.split())
    has_structure = any(marker in llm_text for marker in ["\n", "-", "•", "1.", "2."])
    if word_count < 30:
        clarity = 2
    elif word_count <= 350 and has_structure:
        clarity = 5
    elif word_count <= 500:
        clarity = 4
    else:
        clarity = 3

    unsafe_phrases = [
        "no human review needed",
        "completely reliable",
        "fully replaces experts",
        "ignore the data",
        "do not inspect",
    ]
    unsafe_hits = sum(1 for phrase in unsafe_phrases if phrase in text)
    safety = max(1, 5 - unsafe_hits)

    overall_score = round(
        (relevance + faithfulness + actionability + clarity + safety) / 5,
        2,
    )

    return {
        "relevance": relevance,
        "faithfulness": faithfulness,
        "actionability": actionability,
        "clarity": clarity,
        "safety": safety,
        "overall_score": overall_score,
        "interpretation": _interpret_score(overall_score),
        "method": "Rule-based LLM evaluation using relevance, faithfulness, actionability, clarity, and safety.",
        "human_review_required": overall_score < 3.5,
    }


def _interpret_score(score: float) -> str:
    if score >= 4.5:
        return "Excellent LLM response"
    if score >= 3.5:
        return "Good LLM response"
    if score >= 2.5:
        return "Acceptable, but human review is recommended"
    return "Weak response; human review is strongly recommended"