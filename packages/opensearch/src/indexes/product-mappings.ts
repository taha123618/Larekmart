/**
 * OpenSearch index mapping and settings for the Larekmart product catalog.
 *
 * Key design decisions:
 * - `name` field has three sub-fields:
 *   - `.keyword` for aggregations and exact sorting
 *   - `.autocomplete` indexed with edge-ngram for prefix/autocomplete search
 * - `sku` is keyword-primary with a `.text` sub-field for partial matching
 * - `brand`, `category` use `.keyword` sub-field for faceted aggregations
 * - Shards/replicas default to single-node dev values; scale up in production
 */
export const PRODUCT_INDEX_SETTINGS = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      tokenizer: {
        edge_ngram_tokenizer: {
          type: "edge_ngram",
          min_gram: 2,
          max_gram: 15,
          token_chars: ["letter", "digit"],
        },
      },
      analyzer: {
        autocomplete_analyzer: {
          type: "custom",
          tokenizer: "edge_ngram_tokenizer",
          filter: ["lowercase", "asciifolding"],
        },
        autocomplete_search_analyzer: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase", "asciifolding"],
        },
        text_search_analyzer: {
          type: "custom",
          tokenizer: "standard",
          filter: ["lowercase", "asciifolding", "stop"],
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: "keyword" },
      sku: {
        type: "keyword",
        fields: {
          text: { type: "text", analyzer: "standard" },
        },
      },
      slug: { type: "keyword" },
      name: {
        type: "text",
        analyzer: "text_search_analyzer",
        fields: {
          keyword: { type: "keyword", ignore_above: 256 },
          autocomplete: {
            type: "text",
            analyzer: "autocomplete_analyzer",
            search_analyzer: "autocomplete_search_analyzer",
          },
        },
      },
      shortDescription: {
        type: "text",
        analyzer: "text_search_analyzer",
      },
      description: {
        type: "text",
        analyzer: "text_search_analyzer",
      },
      brand: {
        type: "text",
        fields: { keyword: { type: "keyword" } },
      },
      category: {
        type: "text",
        fields: { keyword: { type: "keyword" } },
      },
      categorySlug: { type: "keyword" },
      category_id: { type: "integer" },
      subcategories: { type: "keyword" },
      tags: { type: "keyword" },
      attributes: {
        type: "object",
        dynamic: true,
      },
      price: { type: "integer" },
      compareAtPrice: { type: "integer" },
      discountPercentage: { type: "float" },
      currency: { type: "keyword" },
      sizes: { type: "keyword" },
      colors: { type: "keyword" },
      images: {
        type: "object",
        dynamic: true,
      },
      inStock: { type: "boolean" },
      stockQuantity: { type: "integer" },
      rating: { type: "float" },
      reviewCount: { type: "integer" },
      sellerId: { type: "keyword" },
      sellerName: { type: "keyword" },
      isActive: { type: "boolean" },
      isFeatured: { type: "boolean" },
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
    },
  },
} as const;
