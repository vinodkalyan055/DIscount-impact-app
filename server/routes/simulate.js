const express = require("express");
const { getGraphqlClient } = require("../shopify");
const { calculateDiscount } = require("../utils/calculations");

const router = express.Router();

const PRODUCTS_QUERY = `{
  products(first: 20) {
    edges {
      node {
        id
        title
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
              inventoryItem {
                unitCost {
                  amount
                }
              }
            }
          }
        }
      }
    }
  }
}`;

router.get("/", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).json({ error: "Missing shop parameter" });

    const discountPercent = parseFloat(req.query.discount);
    if (!discountPercent || discountPercent <= 0 || discountPercent >= 100) {
      return res.status(400).json({ error: "Provide a valid discount (1-99)" });
    }

    const client = await getGraphqlClient(shop);
    const response = await client.request(PRODUCTS_QUERY);
    const products = response.data.products.edges;

    const results = [];

    for (const { node: product } of products) {
      for (const { node: variant } of product.variants.edges) {
        const price = parseFloat(variant.price);
        const cost = variant.inventoryItem?.unitCost?.amount
          ? parseFloat(variant.inventoryItem.unitCost.amount)
          : 0;

        const calc = calculateDiscount(price, cost, discountPercent);

        results.push({
          productId: product.id,
          variantId: variant.id,
          title: `${product.title} - ${variant.title}`,
          price,
          cost,
          ...calc,
        });
      }
    }

    res.json({ shop, discount: discountPercent, products: results });
  } catch (err) {
    console.error("Simulate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
