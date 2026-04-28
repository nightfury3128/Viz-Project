import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
from tqdm import tqdm
from transformers import AutoTokenizer, pipeline


LOCATION_PATTERN = re.compile(r"\[\s*LOCATION\s*:\s*(.*?)\s*\]", re.IGNORECASE)
BRACKET_MARKER_PATTERN = re.compile(r"^\[\s*(.*?)\s*\]$")
EPISODE_PATTERN = re.compile(r"(?P<season>\d{2})x(?P<episode>\d{2})", re.IGNORECASE)
SPEAKER_PATTERN = re.compile(r"^\s*(?P<speaker>[A-Z][A-Z0-9 .'\-()/&]+?)\s*:\s*(?P<line>.+?)\s*$")

EMOTION_LABELS = ("anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise")
NEGATIVE_TOKENS = {
    "kill",
    "dead",
    "die",
    "blood",
    "hurt",
    "pain",
    "afraid",
    "fear",
    "threat",
    "danger",
    "hate",
    "angry",
    "rage",
    "devil",
    "hell",
    "guilty",
    "betray",
    "betrayed",
}
POSITIVE_TOKENS = {
    "love",
    "thank",
    "thanks",
    "hope",
    "safe",
    "trust",
    "friend",
    "friends",
    "family",
    "care",
    "caring",
    "forgive",
    "forgiven",
    "better",
    "happy",
    "proud",
    "together",
}
SURPRISE_TOKENS = {"what", "wait", "why", "how", "suddenly", "impossible", "seriously"}
SADNESS_TOKENS = {"sorry", "loss", "grief", "alone", "cry", "cried", "miss", "regret"}


def parse_file(file_path: Path) -> Tuple[str, int]:
    """
    Parse season/episode from file name and return episode code + season number.
    Example: 01x01 - Into the Ring.txt -> ("S01E01", 1)
    """
    match = EPISODE_PATTERN.search(file_path.stem)
    if not match:
        raise ValueError(f"Could not parse season/episode from filename: {file_path.name}")

    season = int(match.group("season"))
    episode = int(match.group("episode"))
    episode_code = f"S{season:02d}E{episode:02d}"
    return episode_code, season


def clean_line(text: str) -> str:
    """
    Remove stage directions and normalize whitespace.
    Handles patterns like:
      *(sighs)*, (laughing), *laughs*, [inaudible]
    """
    if not text:
        return ""

    cleaned = text

    # Remove *...* stage directions
    cleaned = re.sub(r"\*[^*]*\*", " ", cleaned)

    # Remove (...) stage directions
    cleaned = re.sub(r"\([^)]*\)", " ", cleaned)

    # Remove [...] stage directions (except location markers which are processed separately)
    cleaned = re.sub(r"\[[^\]]*\]", " ", cleaned)

    # Normalize spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def normalize_speaker(raw_speaker: str) -> str:
    """
    Normalize speaker labels:
      - Remove parenthetical notes
      - Normalize spacing
      - Convert to title case
    Example:
      "MATT MURDOCK (masked)" -> "Matt Murdock"
    """
    speaker = re.sub(r"\([^)]*\)", "", raw_speaker)
    speaker = re.sub(r"\[[^\]]*\]", "", speaker)
    speaker = re.sub(r"\s+", " ", speaker).strip()
    return speaker.title()


def parse_location_marker(raw_line: str) -> Optional[str]:
    """
    Extract scene location markers from transcript lines.

    Supports:
      - [LOCATION: ...]
      - [COFFEE SHOP - MORNING] style bracket markers used in later seasons
    """
    source = raw_line.replace("**", "").strip()

    explicit = LOCATION_PATTERN.search(source)
    if explicit:
        loc = explicit.group(1).strip()
        return loc or "UNKNOWN"

    bracket = BRACKET_MARKER_PATTERN.match(source)
    if not bracket:
        return None

    content = bracket.group(1).strip()
    if not content:
        return None

    # Heuristic: location headers are usually section-like and often include "-".
    # Ignore simple direction tags such as [LAUGHING] or [SIGHS].
    looks_like_location = (" - " in content) or (len(content.split()) >= 3 and content.isupper())
    if not looks_like_location:
        return None

    return content


def extract_scenes(
    lines: List[str],
    episode_code: str,
    season: int,
) -> Tuple[List[Dict], List[Dict]]:
    """
    Parse transcript lines into:
      1) line-level records
      2) scene-level records (without emotions yet)
    """
    line_records: List[Dict] = []
    scene_records: List[Dict] = []

    scene_counter = 0
    current_scene_id: Optional[str] = None
    current_location = "UNKNOWN"
    current_turn = 0
    current_scene_lines: List[str] = []

    def flush_scene():
        if current_scene_id is None:
            return
        scene_text = " ".join(current_scene_lines).strip()
        scene_records.append(
            {
                "episode": episode_code,
                "season": season,
                "scene_id": current_scene_id,
                "location": current_location,
                "scene_text": scene_text,
            }
        )

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        raw_location = parse_location_marker(raw_line)
        if raw_location is not None:
            # Close previous scene
            flush_scene()

            # Start new scene
            scene_counter += 1
            current_scene_id = f"{episode_code}_SCENE_{scene_counter}"
            # Normalize location: strip markdown, normalize dashes/whitespace
            normalized_location = raw_location.replace("**", "")
            normalized_location = normalized_location.replace("—", "-")
            normalized_location = re.sub(r"\s+", " ", normalized_location).strip()
            current_location = normalized_location or "UNKNOWN"
            current_turn = 0
            current_scene_lines = []
            continue

        # Strip simple markdown bold markers before matching speakers
        speaker_source = line.replace("**", "")
        speaker_match = SPEAKER_PATTERN.match(speaker_source)
        if not speaker_match:
            continue

        # If this is the first dialogue before any explicit scene marker,
        # create an implicit scene with UNKNOWN location.
        if current_scene_id is None:
            scene_counter += 1
            current_scene_id = f"{episode_code}_SCENE_{scene_counter}"
            current_location = "UNKNOWN"
            current_turn = 0
            current_scene_lines = []

        speaker_raw = speaker_match.group("speaker").strip()
        dialogue_raw = speaker_match.group("line").strip()
        dialogue_cleaned = clean_line(dialogue_raw)

        if not dialogue_cleaned:
            continue

        current_turn += 1
        speaker_normalized = normalize_speaker(speaker_raw)

        line_records.append(
            {
                "episode": episode_code,
                "season": season,
                "scene_id": current_scene_id,
                "location": current_location,
                "speaker": speaker_raw,
                "normalized_speaker": speaker_normalized,
                "line": dialogue_cleaned,
                "conversation_turn": current_turn,
            }
        )

        current_scene_lines.append(f"{speaker_normalized}: {dialogue_cleaned}")

    # Flush final scene
    flush_scene()

    return line_records, scene_records


def _chunk_text_by_tokens(
    text: str,
    tokenizer: AutoTokenizer,
    max_tokens: int = 450,
) -> List[str]:
    """
    Split text into chunks by token count.
    """
    if not text.strip():
        return []

    token_ids = tokenizer.encode(text, add_special_tokens=False)
    if len(token_ids) <= max_tokens:
        return [text]

    chunks: List[str] = []
    for i in range(0, len(token_ids), max_tokens):
        chunk_ids = token_ids[i : i + max_tokens]
        chunk_text = tokenizer.decode(chunk_ids, skip_special_tokens=True).strip()
        if chunk_text:
            chunks.append(chunk_text)
    return chunks


def _normalize_emotion_space(scores: Dict[str, float]) -> Dict[str, float]:
    normalized = {label: 0.0 for label in EMOTION_LABELS}
    for label, value in scores.items():
        if label in normalized:
            normalized[label] = max(0.0, float(value))

    total = sum(normalized.values())
    if total <= 0:
        normalized["neutral"] = 1.0
        return normalized

    for label in normalized:
        normalized[label] /= total
    return normalized


def _heuristic_emotion_scores(scene_text: str) -> Dict[str, float]:
    lower_text = scene_text.lower()
    tokens = re.findall(r"[a-z']+", lower_text)
    token_count = max(1, len(tokens))

    positive_hits = sum(1 for t in tokens if t in POSITIVE_TOKENS)
    negative_hits = sum(1 for t in tokens if t in NEGATIVE_TOKENS)
    sadness_hits = sum(1 for t in tokens if t in SADNESS_TOKENS)
    surprise_hits = sum(1 for t in tokens if t in SURPRISE_TOKENS)

    questions = scene_text.count("?")
    exclamations = scene_text.count("!")
    speaker_turns = sum(1 for segment in scene_text.split(" ") if segment.endswith(":"))

    positive_density = positive_hits / token_count
    negative_density = negative_hits / token_count
    sadness_density = sadness_hits / token_count
    surprise_density = surprise_hits / token_count
    intensity = min(1.0, (questions + exclamations) / 12.0)
    social_density = min(1.0, speaker_turns / 20.0)

    # Base priors keep distributions non-degenerate but weak.
    heuristics = {
        "anger": 0.10 + 1.20 * negative_density + 0.30 * intensity,
        "disgust": 0.08 + 0.55 * negative_density,
        "fear": 0.10 + 0.85 * negative_density + 0.45 * intensity,
        "joy": 0.08 + 1.30 * positive_density + 0.40 * social_density,
        "neutral": 0.20 + 0.20 * max(0.0, 1.0 - (positive_density + negative_density + intensity)),
        "sadness": 0.10 + 1.15 * sadness_density + 0.35 * negative_density,
        "surprise": 0.08 + 0.90 * surprise_density + 0.55 * intensity,
    }
    return _normalize_emotion_space(heuristics)


def _blend_scores(model_scores: Dict[str, float], heuristic_scores: Dict[str, float]) -> Dict[str, float]:
    # Model is primary signal; heuristics provide social/context correction.
    model_weight = 0.75
    heuristic_weight = 0.25
    combined: Dict[str, float] = {}
    for label in EMOTION_LABELS:
        combined[label] = (
            model_weight * model_scores.get(label, 0.0)
            + heuristic_weight * heuristic_scores.get(label, 0.0)
        )
    return _normalize_emotion_space(combined)


def compute_emotion(
    scene_text: str,
    classifier,
    tokenizer: AutoTokenizer,
    max_tokens: int = 450,
) -> Tuple[str, str]:
    """
    Compute scene-level emotion by:
      - chunking long scene text
      - scoring each chunk with HF pipeline(return_all_scores=True)
      - averaging emotion scores across chunks
      - selecting dominant emotion from averaged scores
    Returns:
      dominant_emotion, emotion_scores_json
    """
    if not scene_text or not scene_text.strip():
        empty_scores = {}
        return "unknown", json.dumps(empty_scores)

    chunks = _chunk_text_by_tokens(scene_text, tokenizer, max_tokens=max_tokens)
    if not chunks:
        empty_scores = {}
        return "unknown", json.dumps(empty_scores)

    aggregate_scores: Dict[str, float] = {}
    chunk_count = 0

    for chunk in chunks:
        result = classifier(chunk, truncation=True, return_all_scores=True)

        # Expected shape:
        # - [[{'label': 'joy', 'score': ...}, ...]] for single input
        # Fallback for APIs that may return [{'label':..., 'score':...}, ...]
        scores = result[0] if result and isinstance(result[0], list) else result

        for item in scores:
            label = item["label"]
            score = float(item["score"])
            aggregate_scores[label] = aggregate_scores.get(label, 0.0) + score

        chunk_count += 1

    if chunk_count == 0 or not aggregate_scores:
        return "unknown", json.dumps({})

    averaged_scores = {k: v / chunk_count for k, v in aggregate_scores.items()}
    model_scores = _normalize_emotion_space(averaged_scores)
    heuristic_scores = _heuristic_emotion_scores(scene_text)
    blended_scores = _blend_scores(model_scores, heuristic_scores)

    # Keep the model's native emotion space so the dashboard can show the full
    # emotional mix instead of collapsing categories via manual remapping.
    dominant_emotion = max(blended_scores, key=blended_scores.get)

    # Reduce "neutral" overuse in emotionally rich scenes.
    if dominant_emotion == "neutral":
        ranked = sorted(blended_scores.items(), key=lambda x: x[1], reverse=True)
        second_label, second_score = ranked[1]
        top_score = ranked[0][1]
        emotional_mass = 1.0 - blended_scores.get("neutral", 0.0)
        if emotional_mass >= 0.45 and (top_score - second_score) <= 0.08:
            dominant_emotion = second_label

    # Normalize final labels to known categories used in the frontend.
    allowed_labels = {
        "anger",
        "fear",
        "sadness",
        "joy",
        "neutral",
        "disgust",
        "surprise",
    }
    if dominant_emotion not in allowed_labels:
        dominant_emotion = "neutral"

    # Stable ordering for reproducibility.
    ordered_scores = dict(sorted(blended_scores.items(), key=lambda x: x[0]))
    return dominant_emotion, json.dumps(ordered_scores, ensure_ascii=False)


def main(input_dir: str, output_dir: str):
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if not input_path.exists() or not input_path.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_path}")

    files = sorted(input_path.glob("*.txt"))
    if not files:
        raise FileNotFoundError(f"No .txt files found in: {input_path}")

    all_line_records: List[Dict] = []
    all_scene_records: List[Dict] = []

    for file_path in tqdm(files, desc="Parsing transcripts", unit="file"):
        try:
            episode_code, season = parse_file(file_path)
        except ValueError as e:
            print(f"Skipping {file_path.name}: {e}")
            continue

        with file_path.open("r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        line_records, scene_records = extract_scenes(lines, episode_code, season)
        all_line_records.extend(line_records)
        all_scene_records.extend(scene_records)

    # Build DataFrames
    line_df = pd.DataFrame(
        all_line_records,
        columns=[
            "episode",
            "season",
            "scene_id",
            "location",
            "speaker",
            "normalized_speaker",
            "line",
            "conversation_turn",
        ],
    )

    scene_df = pd.DataFrame(
        all_scene_records,
        columns=[
            "episode",
            "season",
            "scene_id",
            "location",
            "scene_text",
        ],
    )

    # Initialize model
    model_name = "j-hartmann/emotion-english-distilroberta-base"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    classifier = pipeline(
        "text-classification",
        model=model_name,
        tokenizer=tokenizer,
    )

    dominant_emotions: List[str] = []
    emotion_scores_json: List[str] = []

    for idx, (_, row) in enumerate(
        tqdm(scene_df.iterrows(), total=len(scene_df), desc="Emotion analysis", unit="scene")
    ):
        dominant, scores_json = compute_emotion(
            scene_text=row["scene_text"],
            classifier=classifier,
            tokenizer=tokenizer,
            max_tokens=450,
        )
        dominant_emotions.append(dominant)
        emotion_scores_json.append(scores_json)

        # Debugging: print sample outputs for early scenes
        if idx < 5:
            try:
                scores_dict = json.loads(scores_json) if scores_json else {}
            except json.JSONDecodeError:
                scores_dict = {}
            print("SCENE:", row["scene_id"])
            print("LOCATION:", row["location"])
            print("RAW SCORES:", scores_dict)
            print("FINAL EMOTION:", dominant)

    scene_df["dominant_emotion"] = dominant_emotions
    scene_df["emotion_scores"] = emotion_scores_json

    # Save outputs
    line_output = output_path / "line_data.csv"
    scene_output = output_path / "scene_data.csv"

    line_df.to_csv(line_output, index=False, encoding="utf-8")
    scene_df.to_csv(scene_output, index=False, encoding="utf-8")

    print(f"Saved line-level data: {line_output}")
    print(f"Saved scene-level data: {scene_output}")
    print(f"Line records: {len(line_df):,}")
    print(f"Scene records: {len(scene_df):,}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract structured Daredevil transcript data and run scene-level emotion analysis."
    )
    parser.add_argument(
        "--input_dir",
        type=str,
        default="daredevil_txt",
        help="Path to folder containing transcript .txt files.",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=".",
        help="Directory to save line_data.csv and scene_data.csv.",
    )

    args = parser.parse_args()
    main(args.input_dir, args.output_dir)