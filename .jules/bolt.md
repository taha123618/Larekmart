## 2024-10-16 - Zustand Full Store Destructuring Anti-pattern
**Learning:** Destructuring the entire Zustand store (e.g., `const { addToCart } = useCartStore()`) in high-cardinality components like `ProductCard` subscribes the component to the *entire* store. This causes all cards in a product grid to unnecessarily re-render whenever any unrelated state (like the cart items array) changes.
**Action:** Always use fine-grained selectors (`const addToCart = useCartStore(state => state.addToCart)`) when pulling from Zustand stores, especially in components rendered multiple times in a list/grid.
