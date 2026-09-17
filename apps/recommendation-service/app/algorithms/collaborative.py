import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


def compute_item_similarity_matrix(
    interactions: list[dict[str, float | int | str]],
) -> pd.DataFrame:
    """
    Builds a user-product interaction pivot table and computes item-to-item
    cosine similarity matrix using scikit-learn.
    interactions should have 'userId', 'productId', 'weight' keys.
    """
    if not interactions:
        return pd.DataFrame()

    df = pd.DataFrame(interactions)
    user_col = "userId" if "userId" in df.columns else "user_id"
    prod_col = "productId" if "productId" in df.columns else "product_id"
    weight_col = "weight" if "weight" in df.columns else "affinity_score"

    pivot = df.pivot_table(
        index=prod_col,
        columns=user_col,
        values=weight_col,
        fill_value=0.0,
        aggfunc="sum",
    )

    if pivot.empty or pivot.shape[0] < 2:
        return pd.DataFrame(index=pivot.index, columns=pivot.index, data=np.eye(len(pivot.index)))

    sim_matrix = cosine_similarity(pivot.values)
    return pd.DataFrame(sim_matrix, index=pivot.index, columns=pivot.index)


def predict_item_collaborative_scores(
    user_item_weights: dict[int, float],
    item_sim_df: pd.DataFrame,
    top_k: int = 20,
) -> list[tuple[int, float]]:
    """
    Given a user's known interacted products and their weights, scores unvisited
    candidate products using item-item similarity.
    Returns sorted list of (product_id, score).
    """
    if item_sim_df.empty or not user_item_weights:
        return []

    scores: dict[int, float] = {}
    known_products = set(user_item_weights.keys())

    for prod_id in item_sim_df.index:
        if prod_id in known_products:
            continue

        weighted_sum = 0.0
        sim_sum = 0.0

        for interacted_id, weight in user_item_weights.items():
            if interacted_id in item_sim_df.columns:
                sim = float(item_sim_df.loc[prod_id, interacted_id])
                if sim > 0:
                    weighted_sum += sim * weight
                    sim_sum += sim

        if sim_sum > 0:
            pred_score = min(1.0, weighted_sum / (sim_sum * max(user_item_weights.values())))
            scores[int(prod_id)] = round(pred_score, 4)

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return ranked[:top_k]
