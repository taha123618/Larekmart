import { prisma } from "./client.js";

export const SEED_CATEGORIES = [
  { name: "Shoes", slug: "shoes" },
  { name: "T-Shirts", slug: "t-shirts" },
  { name: "Jackets", slug: "jackets" },
  { name: "Hoodies", slug: "hoodies" },
  { name: "Clothing", slug: "clothing" },
];

export const SEED_PRODUCTS = [
  {
    id: 102,
    name: "Trail Boot",
    shortDescription: "Rugged trail boot with extreme grip on any terrain.",
    description:
      "Engineered for harsh outdoor trails, providing water resistance, ankle support, and deep-lug traction.",
    price: 9000,
    categorySlug: "shoes",
    sizes: ["40", "41", "42", "43", "44"],
    colors: ["black", "brown"],
    images: {
      black: "https://cdn.example.com/trail-boot-black.jpg",
      brown: "https://cdn.example.com/trail-boot-brown.jpg",
    },
  },
  {
    id: 101,
    name: "Air Runner",
    shortDescription: "Lightweight daily runner for road and track.",
    description:
      "A fast, ultra-breathable shoe designed for high-mileage daily running with responsive air cushioning.",
    price: 5000,
    categorySlug: "shoes",
    sizes: ["40", "41", "42", "43"],
    colors: ["red", "white"],
    images: {
      red: "https://cdn.example.com/air-runner-red.jpg",
      white: "https://cdn.example.com/air-runner-white.jpg",
    },
  },
  {
    id: 103,
    name: "Ghost Sneaker",
    shortDescription: "Stealth urban sneaker with ultra-light foam.",
    description:
      "Minimalist design for daily streetwear, featuring memory foam cushioning and sleek monochromatic styling.",
    price: 1000,
    categorySlug: "shoes",
    sizes: ["39", "40", "41", "42"],
    colors: ["black", "red"],
    images: {
      black: "https://cdn.example.com/ghost-black.jpg",
      red: "https://cdn.example.com/ghost.jpg",
    },
  },
  {
    id: 1,
    name: "Adidas CoreFit T-Shirt",
    shortDescription: "Breathable athletic training t-shirt.",
    description:
      "Engineered for daily workouts with moisture-wicking technology and ergonomic seams.",
    price: 3990,
    categorySlug: "t-shirts",
    sizes: ["s", "m", "l", "xl", "xxl"],
    colors: ["gray", "purple", "green"],
    images: {
      gray: "/products/1g.png",
      purple: "/products/1p.png",
      green: "/products/1gr.png",
    },
  },
  {
    id: 2,
    name: "Puma Ultra Warm Zip",
    shortDescription: "Thermal full-zip running jacket.",
    description:
      "Keeps you warm on chilly outdoor runs and casual winter walks with wind-resistant fabric.",
    price: 5990,
    categorySlug: "jackets",
    sizes: ["s", "m", "l", "xl"],
    colors: ["gray", "green"],
    images: {
      gray: "/products/2g.png",
      green: "/products/2gr.png",
    },
  },
  {
    id: 3,
    name: "Nike Air Essentials Pullover",
    shortDescription: "Cozy fleece pullover hoodie.",
    description:
      "Classic everyday comfort with brushed fleece interior, ribbed cuffs, and spacious kangaroo pocket.",
    price: 6990,
    categorySlug: "hoodies",
    sizes: ["s", "m", "l", "xl"],
    colors: ["green", "blue", "black"],
    images: {
      green: "/products/3gr.png",
      blue: "/products/3b.png",
      black: "/products/3bl.png",
    },
  },
  {
    id: 4,
    name: "Nike Dri Flex T-Shirt",
    shortDescription: "Lightweight performance training tee.",
    description:
      "Stay cool and dry with flexible 4-way stretch polyester blend designed for mobility.",
    price: 2990,
    categorySlug: "t-shirts",
    sizes: ["s", "m", "l", "xl"],
    colors: ["white", "pink"],
    images: {
      white: "/products/4w.png",
      pink: "/products/4p.png",
    },
  },
  {
    id: 5,
    name: "Under Armour StormFleece",
    shortDescription: "Water-resistant athletic fleece.",
    description:
      "Durable water-repellent finish without sacrificing breathability for all-weather training.",
    price: 4990,
    categorySlug: "jackets",
    sizes: ["s", "m", "l", "xl"],
    colors: ["red", "orange", "black"],
    images: {
      red: "/products/5r.png",
      orange: "/products/5o.png",
      black: "/products/5bl.png",
    },
  },
  {
    id: 6,
    name: "Nike Air Max 270",
    shortDescription: "Iconic lifestyle sneaker with max air unit.",
    description:
      "Delivers unmatched all-day comfort with bold aesthetics and a large volume heel air bag.",
    price: 15990,
    categorySlug: "shoes",
    sizes: ["40", "41", "42", "43", "44"],
    colors: ["gray", "white"],
    images: {
      gray: "/products/6g.png",
      white: "/products/6w.png",
    },
  },
];

export async function seedProductDatabase(): Promise<void> {
  console.log("[Seed] Starting product database seeding...");

  for (const cat of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: { name: cat.name, slug: cat.slug },
    });
    console.log(`[Seed] Category upserted: ${cat.name} (${cat.slug})`);
  }

  for (const prod of SEED_PRODUCTS) {
    await prisma.product.upsert({
      where: { id: prod.id },
      update: {
        name: prod.name,
        shortDescription: prod.shortDescription,
        description: prod.description,
        price: prod.price,
        categorySlug: prod.categorySlug,
        sizes: prod.sizes,
        colors: prod.colors,
        images: prod.images,
      },
      create: {
        id: prod.id,
        name: prod.name,
        shortDescription: prod.shortDescription,
        description: prod.description,
        price: prod.price,
        categorySlug: prod.categorySlug,
        sizes: prod.sizes,
        colors: prod.colors,
        images: prod.images,
      },
    });
    console.log(`[Seed] Product upserted: ${prod.name} (id: ${prod.id})`);
  }

  console.log(`[Seed] Finished seeding ${SEED_PRODUCTS.length} products.`);
  await prisma.$disconnect();
}

// Direct execution
if (process.argv[1]?.endsWith("seed.ts")) {
  seedProductDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[Seed] Seeding failed:", err);
      process.exit(1);
    });
}
