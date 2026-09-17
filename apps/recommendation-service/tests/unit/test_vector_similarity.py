import numpy as np
from app.vector.similarity import (
    batch_cosine_similarity,
    cosine_similarity,
    l2_normalize,
    top_k_similar,
)


def test_l2_normalize() -> None:
    vec = [3.0, 4.0]
    normed = l2_normalize(vec)
    assert np.isclose(np.linalg.norm(normed), 1.0)
    assert np.isclose(normed[0], 0.6)
    assert np.isclose(normed[1], 0.8)


def test_cosine_similarity() -> None:
    vec_a = [1.0, 0.0]
    vec_b = [1.0, 0.0]
    assert np.isclose(cosine_similarity(vec_a, vec_b), 1.0)

    vec_c = [0.0, 1.0]
    assert np.isclose(cosine_similarity(vec_a, vec_c), 0.0)


def test_batch_cosine_similarity() -> None:
    query = [1.0, 0.0]
    candidates = np.array([
        [1.0, 0.0],
        [0.0, 1.0],
        [0.7071, 0.7071],
    ])
    scores = batch_cosine_similarity(query, candidates)
    assert len(scores) == 3
    assert np.isclose(scores[0], 1.0)
    assert np.isclose(scores[1], 0.0)
    assert scores[2] > 0.7


def test_top_k_similar() -> None:
    query = [1.0, 0.0]
    candidates = np.array([
        [0.1, 0.9],
        [0.9, 0.1],
        [0.5, 0.5],
    ])
    product_ids = [101, 102, 103]
    top = top_k_similar(query, candidates, product_ids, k=2)
    assert len(top) == 2
    # 102 should be first because [0.9, 0.1] has highest dot product with [1.0, 0.0]
    assert top[0][0] == 102
