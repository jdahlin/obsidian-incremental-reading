#!/usr/bin/env python3
"""
Speech-to-text transcription pipeline optimized for Apple Silicon (M-series).
Uses MLX Whisper for fast transcription with English/Swedish support.

Swedish: Uses KBLab's KB-Whisper (47% better WER for Swedish)
English: Uses standard Whisper large-v3-turbo
"""

import argparse
import sys
import subprocess
import tempfile
from pathlib import Path

# Model paths
SCRIPT_DIR = Path(__file__).parent
KB_WHISPER_MODEL = SCRIPT_DIR / "models" / "kb-whisper-large-mlx"
DEFAULT_MODEL = "mlx-community/whisper-large-v3-turbo"
SMALL_MODEL = "mlx-community/whisper-small-mlx"


def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import mlx_whisper
        return True
    except ImportError:
        print("Error: mlx-whisper not installed.")
        print("Install with: pip install mlx-whisper")
        return False


def detect_language(audio_path: str) -> str:
    """Detect language from audio using Whisper's language detection."""
    import mlx_whisper

    # Use a smaller model for quick language detection
    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=SMALL_MODEL,
        word_timestamps=False,
    )
    return result.get("language", "en")


def extract_audio(video_path: Path, output_path: Path) -> bool:
    """Extract audio from video file using ffmpeg."""
    try:
        cmd = [
            "ffmpeg", "-i", str(video_path),
            "-vn",  # No video
            "-acodec", "pcm_s16le",  # PCM 16-bit
            "-ar", "16000",  # 16kHz sample rate (Whisper expects this)
            "-ac", "1",  # Mono
            "-y",  # Overwrite
            str(output_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        print("Error: ffmpeg not found. Install with: brew install ffmpeg")
        return False


def transcribe(
    input_path: str,
    language: str | None = None,
    model: str | None = None,
    output_path: str | None = None,
    word_timestamps: bool = False,
    auto_model: bool = True,
) -> dict:
    """
    Transcribe audio/video file using MLX Whisper.

    Args:
        input_path: Path to MP4/audio file
        language: Language code ('en', 'sv') or None for auto-detect
        model: MLX Whisper model to use (if None, auto-selects based on language)
        output_path: Optional path to save transcription
        word_timestamps: Include word-level timestamps
        auto_model: Auto-select best model based on detected language

    Returns:
        Transcription result dictionary
    """
    import mlx_whisper

    input_file = Path(input_path)

    if not input_file.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Handle video files - extract audio first
    audio_path = input_path
    temp_audio = None

    if input_file.suffix.lower() in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
        print(f"Extracting audio from video: {input_file.name}")
        temp_audio = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_audio.close()

        if not extract_audio(input_file, Path(temp_audio.name)):
            raise RuntimeError("Failed to extract audio from video")

        audio_path = temp_audio.name

    try:
        # Detect language if not specified
        detected_lang = language
        if not language:
            print("Auto-detecting language...")
            detected_lang = detect_language(audio_path)
            print(f"Detected language: {detected_lang}")

        # Auto-select model based on language
        if model:
            selected_model = model
        elif auto_model and detected_lang == "sv" and KB_WHISPER_MODEL.exists():
            selected_model = str(KB_WHISPER_MODEL)
            print(f"Using KB-Whisper (optimized for Swedish)")
        else:
            selected_model = DEFAULT_MODEL

        # Build transcription options
        options = {
            "path_or_hf_repo": selected_model,
            "word_timestamps": word_timestamps,
            "language": detected_lang,
        }

        print(f"Using model: {selected_model}")
        print("Transcribing...")

        result = mlx_whisper.transcribe(audio_path, **options)

        # Output transcription
        transcription_text = result.get("text", "").strip()

        if output_path:
            output_file = Path(output_path)
            output_file.write_text(transcription_text, encoding="utf-8")
            print(f"\nTranscription saved to: {output_path}")
        else:
            print("\n" + "=" * 60)
            print("TRANSCRIPTION:")
            print("=" * 60)
            print(transcription_text)
            print("=" * 60)

        # Add detected language to result
        result["language"] = detected_lang
        return result

    finally:
        # Clean up temp file
        if temp_audio:
            Path(temp_audio.name).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe MP4/audio files using MLX Whisper (Apple Silicon optimized)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s video.mp4                      # Auto-detect language
  %(prog)s video.mp4 -l sv                # Force Swedish
  %(prog)s video.mp4 -l en -o output.txt  # English, save to file
  %(prog)s audio.wav --word-timestamps    # With word timing

Supported languages: en (English), sv (Swedish), or auto-detect
        """
    )

    parser.add_argument(
        "input",
        help="Input MP4 or audio file"
    )
    parser.add_argument(
        "-l", "--language",
        choices=["en", "sv"],
        default=None,
        help="Language code (en=English, sv=Swedish). Auto-detects if not specified."
    )
    parser.add_argument(
        "-o", "--output",
        help="Output file path for transcription (prints to console if not specified)"
    )
    parser.add_argument(
        "-m", "--model",
        default=None,
        help="MLX Whisper model (auto-selects KB-Whisper for Swedish if available)"
    )
    parser.add_argument(
        "--word-timestamps",
        action="store_true",
        help="Include word-level timestamps in output"
    )
    parser.add_argument(
        "--no-auto-model",
        action="store_true",
        help="Disable automatic model selection (always use default model)"
    )

    args = parser.parse_args()

    if not check_dependencies():
        sys.exit(1)

    try:
        transcribe(
            input_path=args.input,
            language=args.language,
            model=args.model,
            output_path=args.output,
            word_timestamps=args.word_timestamps,
            auto_model=not args.no_auto_model,
        )
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
