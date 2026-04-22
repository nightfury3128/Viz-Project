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
      - applying custom decision rules to select dominant emotion
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

    # ----- Custom emotion mapping logic -----
    anger = averaged_scores.get("anger", 0.0)
    fear = averaged_scores.get("fear", 0.0)
    sadness = averaged_scores.get("sadness", 0.0)
    disgust = averaged_scores.get("disgust", 0.0)

    # Rule 1 — Disgust reinterpretation
    if disgust > 0.4 and sadness > 0.2:
        dominant_emotion = "sadness"
    # Rule 2 — Strong sadness override
    elif sadness > 0.4:
        dominant_emotion = "sadness"
    # Rule 3 — Anger detection
    elif anger > 0.4:
        dominant_emotion = "anger"
    # Rule 4 — Fear detection
    elif fear > 0.4:
        dominant_emotion = "fear"
    # Rule 5 — Default fallback to max
    else:
        dominant_emotion = max(averaged_scores, key=averaged_scores.get)

    # Normalize final labels
    allowed_labels = {"anger", "fear", "sadness", "joy", "neutral"}
    if dominant_emotion == "disgust":
        dominant_emotion = "sadness"
    elif dominant_emotion not in allowed_labels:
        dominant_emotion = "neutral"

    # Stable ordering for reproducibility (store original averaged scores)
    ordered_scores = dict(sorted(averaged_scores.items(), key=lambda x: x[0]))
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