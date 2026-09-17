from typing import Any


def calculate_jaccard_similarity(set_a: set[Any], set_b: set[Any]) -> float:
    """Computes Jaccard similarity between two sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


def score_content_match(
    target_product: dict[str, Any],
    candidate_product: dict[str, Any],
) -> float:
    """
    Computes a content similarity score [0.0, 1.0] based on category,
    brand, tags, and price proximity.
    """
    score = 0.0

    # 1. Category match (high weight)
    target_cat = target_product.get("categorySlug") or target_product.get("category_slug")
    cand_cat = candidate_product.get("categorySlug") or candidate_product.get("category_slug")
    if target_cat and cand_cat and target_cat == cand_cat:
        score += 0.45

    # 2. Brand match
    target_brand = (target_product.get("brand") or "").lower().strip()
    cand_brand = (candidate_product.get("brand") or "").lower().strip()
    if target_brand and cand_brand and target_brand == cand_brand:
        score += 0.25

    # 3. Tags overlap (Jaccard similarity)
    target_tags = set(target_product.get("tags") or [])
    cand_tags = set(candidate_product.get("tags") or [])
    tag_sim = calculate_jaccard_similarity(target_tags, cand_tags)
    score += 0.20 * tag_sim

    # 4. Price band proximity
    t_price = target_product.get("price")
    c_price = candidate_product.get("price")
    if t_price is not None and c_price is not None and t_price > 0 and c_price > 0:
        ratio = min(t_price, c_price) / max(t_price, c_price)
        score += 0.10 * ratio
    else:
        score += 0.05

    return min(1.0, round(score, 4))
