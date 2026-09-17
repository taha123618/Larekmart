import pytest
import numpy as np
import pandas as pd
from app.algorithms.collaborative import (
    compute_item_similarity_matrix,
    predict_item_collaborative_scores,
)
from app.algorithms.content_based import score_content_match
from app.algorithms.ranking import CandidateScore, calculate_composite_rank
from app.algorithms.similarity import batch_cosine_similarity, cosine_similarity, l2_normalize


def test_collaborative_item_similarity_computation():
    interactions = [
        {"userId": "u1", "productId": 101, "weight": 5.0},
        {"userId": "u1", "productId": 102, "weight": 4.0},
        {"userId": "u2", "productId": 101, "weight": 3.0},
        {"userId": "u2", "productId": 102, "weight": 5.0},
        {"userId": "u3", "productId": 103, "weight": 2.0},
    ]

    sim_df = compute_item_similarity_matrix(interactions)
    assert not sim_df.empty
    assert 101 in sim_df.index
    assert 102 in sim_df.index
    # Products 101 and 102 co-occur frequently so similarity should be positive
    sim_101_102 = sim_df.loc[101, 102]
    assert sim_101_102 > 0.5


def test_predict_item_collaborative_scores():
    # Synthetic item similarity matrix
    sim_df = pd.DataFrame(
        [
            [1.0, 0.8, 0.1],
            [0.8, 1.0, 0.2],
            [0.1, 0.2, 1.0],
        ],
        index=[101, 102, 103],
        columns=[101, 102, 103],
    )

    user_weights = {101: 5.0}
    preds = predict_item_collaborative_scores(user_weights, sim_df, top_k=2)
    assert len(preds) == 2
    # 102 should have highest predicted score
    top_item, top_score = preds[0]
    assert top_item == 102
    assert top_score > 0.5


def test_content_based_scoring():
    target = {
        "categorySlug": "t-shirts",
        "brand": "Adidas",
        "tags": ["cotton", "sport", "summer"],
        "price": 50.0,
    }
    candidate_match = {
        "categorySlug": "t-shirts",
        "brand": "Adidas",
        "tags": ["cotton", "sport"],
        "price": 55.0,
    }
    candidate_different = {
        "categorySlug": "jackets",
        "brand": "Nike",
        "tags": ["winter"],
        "price": 180.0,
    }

    match_score = score_content_match(target, candidate_match)
    diff_score = score_content_match(target, candidate_different)

    assert match_score > 0.8
    assert diff_score < 0.2
    assert match_score > diff_score


def test_ranking_composite_filtering():
    c1 = CandidateScore(product_id=1, collaborative_score=0.9, content_score=0.8, popularity_score=0.7)
    c2 = CandidateScore(product_id=2, collaborative_score=0.4, content_score=0.3, popularity_score=0.2)
    c3 = CandidateScore(product_id=3, collaborative_score=1.0, content_score=1.0, popularity_score=1.0)

    ranked = calculate_composite_rank(
        candidates=[c1, c2, c3],
        excluded_product_ids={3},  # Exclude c3
        limit=5,
    )

    assert len(ranked) == 2
    assert ranked[0].product_id == 1
    assert ranked[1].product_id == 2
    assert ranked[0].final_score > ranked[1].final_score
