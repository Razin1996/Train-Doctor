import json
import requests

try:
    from openai import OpenAI
except Exception:
    OpenAI = None


def check_ollama_available(base_url):
    try:
        response = requests.get(f"{base_url.rstrip('/')}/api/tags", timeout=5)
        return response.ok
    except Exception:
        return False


def generate_ollama_explanation(prompt, model_name, base_url):
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": "You are a precise ML segmentation debugging assistant."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
    }
    try:
        response = requests.post(f"{base_url.rstrip('/')}/api/chat", json=payload, timeout=180)
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"], None
    except Exception as e:
        return None, f"Ollama call failed: {e}"


def generate_openai_explanation(prompt, model_name):
    if OpenAI is None:
        return None, "Install openai first: pip install openai"
    import os
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None, "OPENAI_API_KEY is not set."
    try:
        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=model_name,
            instructions="You are a precise ML segmentation debugging assistant.",
            input=prompt,
        )
        return response.output_text, None
    except Exception as e:
        return None, f"OpenAI call failed: {e}"


def generate_rule_based_explanation(findings_df, recommendations_df, health_score, failure_group_df):
    lines = [f"## Executive summary", f"Dataset health score is {health_score}/100.", ""]
    if len(findings_df) == 0:
        lines.append("No major issues were detected from the current rule-based checks.")
    else:
        lines.append("Main issues detected:")
        for _, row in findings_df.head(5).iterrows():
            lines.append(f"- {row['issue']}: {row['evidence']}")
    lines.extend(["", "## Highest-priority next actions"])
    if len(recommendations_df) == 0:
        lines.append("- No recommendation was triggered.")
    else:
        for _, row in recommendations_df.head(5).iterrows():
            lines.append(f"- {row['recommendation']}")
    lines.extend(["", "## Failure groups"])
    if len(failure_group_df) == 0:
        lines.append("- No grouped failures.")
    else:
        for _, row in failure_group_df.head(5).iterrows():
            lines.append(f"- {row['failure_type']}: {row['count']}")
    return "\n".join(lines)


def build_llm_prompt(findings_df, recommendations_df, suggested_config, health_score, failure_group_df):
    findings_text = "\n".join(
        f"- [{row['type']}] {row['issue']} | confidence={row['confidence']} | evidence={row['evidence']}"
        for _, row in findings_df.head(12).iterrows()
    ) if len(findings_df) else "- No findings"

    rec_text = "\n".join(f"- {row['recommendation']}" for _, row in recommendations_df.head(12).iterrows()) \
        if len(recommendations_df) else "- No recommendations"

    failure_text = "\n".join(f"- {row['failure_type']}: {row['count']}" for _, row in failure_group_df.head(10).iterrows()) \
        if len(failure_group_df) else "- No grouped failures"

    return f"""
You are an expert ML segmentation training diagnostician.

Analyze this segmentation training run and produce a concise but insightful diagnosis.

Dataset health score: {health_score}/100

Top findings:
{findings_text}

Failure groups:
{failure_text}

Current auto recommendations:
{rec_text}

Suggested next configuration:
{json.dumps(suggested_config, indent=2)}

Write your answer in these sections:
1. Executive summary
2. What is going wrong
3. Likely root causes
4. Highest-priority next actions
5. Whether data review or training changes should come first

Be specific. Avoid generic filler. Refer to the provided evidence.
""".strip()
