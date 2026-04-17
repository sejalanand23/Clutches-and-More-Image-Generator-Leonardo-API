"""
src/prompts.py
Prompt templates for bags and jewelry, with per-variation modifiers.
"""
from __future__ import annotations
import random

# ─── Base prompts ─────────────────────────────────────────────────────────────

_BASE_BAGS = (
    "ultra realistic fashion photoshoot of a woman carrying a luxury handbag, "
    "natural skin texture, soft studio lighting, realistic shadows, "
    "DSLR photography, 85mm lens, ecommerce product photography"
)

_BASE_JEWELRY = (
    "close-up portrait of a woman wearing elegant jewelry, natural skin texture, "
    "soft lighting, high-end fashion photography, detailed skin texture, "
    "macro lens, realistic shadows"
)

# ─── Variation modifiers (appended to base prompt) ────────────────────────────

_VARIATIONS_BAGS = [
    "front-facing pose, direct eye contact, neutral background",
    "three-quarter angle, off-shoulder look, gradient background",
    "side profile, walking motion, urban studio backdrop",
    "over-the-shoulder candid shot, bokeh background, natural light",
    "seated pose, bag resting on lap, white seamless backdrop",
    "low angle upward shot, model standing tall, dramatic lighting",
    "close-up on bag with hands, shallow depth of field",
    "lifestyle shot, model at cafe table, warm ambient light",
]

_VARIATIONS_JEWELRY = [
    "facing camera, soft smile, white seamless background",
    "three-quarter turn, chin slightly down, dark moody background",
    "side profile showing earring, hair pinned up, neutral backdrop",
    "close-up macro on necklace, elegant collarbone, bokeh background",
    "looking up, statement ring on fingers, warm golden-hour lighting",
    "half-face shot highlighting ear and jawline, jewelry centered",
    "hands clasped showing bracelet, shallow depth of field, soft focus",
    "full neck and decolletage portrait, multiple layered necklaces",
]

# Negative prompt applied to all generations
NEGATIVE_PROMPT = (
    "ugly, deformed, blurry, distorted, cartoon, illustration, painting, "
    "anime, cgi, unrealistic skin, extra fingers, missing fingers, low quality, "
    "watermark, text, logo, signature"
)

# ─── Scene prompts (Place into New Scene blueprint) ───────────────────────────
# These describe premium environmental settings where the product is the hero.

_SCENE_BASE_BAGS = (
    "commercial studio photography, beautifully lit environment, highly detailed, sharp focus"
)

_SCENE_BASE_JEWELRY = (
    "commercial studio photography, beautifully lit environment, highly detailed, sharp focus, macro detail"
)

_SCENE_VARIATIONS_BAGS = [
    "held elegantly by a fashion model walking down a city street, chic designer outfit",
    "marble countertop, soft diffused natural window light, cream and ivory tones, minimal styling",
    "held gracefully by a seated model wearing an elegant evening dress, atmospheric lighting",
    "sunlit beige linen surface, warm golden-hour light rays, soft shadows, Parisian boutique feel",
    "model holding the bag over her shoulder in a high-end luxury boutique setting",
    "glass shelf in a minimalist luxury showroom, cool blue ambient light, reflections on glass",
    "held by a woman wearing gloves, close up on the hands and bag, editorial style",
    "poolside travertine surface, bright midday sun, turquoise water reflection in background",
]

_SCENE_VARIATIONS_JEWELRY = [
    "worn by an elegant fashion model, close up portrait, softly lit studio",
    "white marble surface with rose petals, soft feminine natural light, pastel background",
    "worn on the neck of a beautiful woman looking over her shoulder, dark moody background, haute couture",
    "gold-tinted reflective surface, warm candlelight glow, bokeh, romantic editorial",
    "hands clasped wearing the jewelry, soft focus background, editorial lighting",
    "mirrored tray with eucalyptus sprigs, soft white diffused light, spa and wellness aesthetic",
    "worn by a model with a subtle smile, white seamless background, bright commercial lighting",
    "tropical setting with large monstera leaves, bright natural light, vibrant green backdrop",
]


def get_prompts(
    category: str,
    n: int = 5,
    seed: int | None = None,
    base_prompt: str | None = None,
) -> list[str]:
    """
    Return `n` varied prompts for the given category.

    Args:
        category:    "bags" or "jewelry"
        n:           number of prompts to generate (1–8)
        seed:        optional random seed for reproducibility
        base_prompt: optional custom base prompt from the web UI.
                     If provided, replaces the category template as the base.
                     Variation modifiers are still appended for diversity.

    Returns:
        List of prompt strings, one per image to be generated.
    """
    if category == "bags":
        default_base = _BASE_BAGS
        modifiers = _VARIATIONS_BAGS
    elif category == "jewelry":
        default_base = _BASE_JEWELRY
        modifiers = _VARIATIONS_JEWELRY
    else:
        raise ValueError(f"Unknown category: {category!r}")

    base = base_prompt.strip() if base_prompt else default_base

    rng = random.Random(seed)
    chosen = rng.sample(modifiers, k=min(n, len(modifiers)))

    # If n > available unique modifiers, cycle through them
    while len(chosen) < n:
        chosen.append(rng.choice(modifiers))

    return [f"{base}, {mod}" for mod in chosen[:n]]


def get_scene_prompts(
    category: str,
    n: int = 5,
    seed: int | None = None,
    base_prompt: str | None = None,
) -> list[str]:
    """
    Return `n` scene-placement prompts for the 'Place into New Scene' blueprint.

    Unlike get_prompts(), these scene prompts describe the *environment* around
    the product rather than a model wearing/carrying it.

    Args:
        category:    \"bags\" or \"jewelry\"
        n:           number of scene prompts to generate (1–8)
        seed:        optional random seed for reproducibility
        base_prompt: optional custom base prompt from the web UI.

    Returns:
        List of prompt strings, one per image to be generated.
    """
    if category == "bags":
        default_base = _SCENE_BASE_BAGS
        modifiers = _SCENE_VARIATIONS_BAGS
    elif category == "jewelry":
        default_base = _SCENE_BASE_JEWELRY
        modifiers = _SCENE_VARIATIONS_JEWELRY
    else:
        raise ValueError(f"Unknown category: {category!r}")

    base = base_prompt.strip() if base_prompt else default_base

    rng = random.Random(seed)
    chosen = rng.sample(modifiers, k=min(n, len(modifiers)))

    while len(chosen) < n:
        chosen.append(rng.choice(modifiers))

    return [f"{base}, {mod}" for mod in chosen[:n]]
