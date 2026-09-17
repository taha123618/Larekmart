import numpy as np


def l2_normalize(vec: np.ndarray | list[float]) -> np.ndarray:
    """L2-normalizes a 1D vector."""
    arr = np.asarray(vec, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm == 0.0:
        return arr
    return arr / norm


def cosine_similarity(
    vec_a: np.ndarray | list[float],
    vec_b: np.ndarray | list[float],
) -> float:
    """Computes cosine similarity between two 1D vectors."""
    a = l2_normalize(vec_a)
    b = l2_normalize(vec_b)
    dot = float(np.dot(a, b))
    return max(0.0, min(1.0, dot))


def batch_cosine_similarity(
    query_vec: np.ndarray | list[float],
    candidate_matrix: np.ndarray,
) -> np.ndarray:
    """
    Computes cosine similarity between a 1D query vector and a 2D candidate matrix (N, D).
    Assumes query_vec and candidate_matrix rows may or may not be normalized.
    """
    q = l2_normalize(query_vec)
    if candidate_matrix.ndim != 2:
        raise ValueError("candidate_matrix must be 2-dimensional")

    norms = np.linalg.norm(candidate_matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normalized_candidates = candidate_matrix / norms

    scores = np.dot(normalized_candidates, q)
    return np.clip(scores, 0.0, 1.0)


def top_k_similar(
    query_vec: np.ndarray | list[float],
    candidate_matrix: np.ndarray,
    product_ids: list[int],
    k: int = 10,
) -> list[tuple[int, float]]:
    """
    Computes top-k highest similarity items given candidate matrix and corresponding product IDs.
    Returns list of (product_id, score) sorted descending by score.
    """
    if len(product_ids) != candidate_matrix.shape[0]:
        raise ValueError("product_ids length must match candidate_matrix rows")

    if len(product_ids) == 0:
        return []

    scores = batch_cosine_similarity(query_vec, candidate_matrix)
    k_actual = min(k, len(scores))
    top_indices = np.argpartition(scores, -k_actual)[-k_actual:]
    sorted_top = top_indices[np.argsort(-scores[top_indices])]

    return [(product_ids[idx], float(scores[idx])) for idx in sorted_top]
