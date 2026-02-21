const express = require("express");
const { getGraphqlClient } = require("../shopify");
const { calculateDiscount } = require("../utils/calculations");
const Experiment = require("../models/Experiment");

const router = express.Router();

const VARIANT_QUERY = `query ($id: ID!) {
  productVariant(id: $id) {
    id
    price
    inventoryItem {
      unitCost {
        amount
      }
    }
  }
}`;

const VARIANT_UPDATE = `mutation ($input: ProductVariantInput!) {
  productVariantUpdate(input: $input) {
    productVariant {
      id
      price
    }
    userErrors {
      field
      message
    }
  }
}`;

router.post("/", async (req, res) => {
  try {
    const { shop, products, discount, baselineUnits } = req.body;

    if (!shop) return res.status(400).json({ error: "Missing shop" });
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "Provide at least one product" });
    }
    if (!discount || discount <= 0 || discount >= 100) {
      return res.status(400).json({ error: "Provide a valid discount (1-99)" });
    }
    if (!baselineUnits || baselineUnits <= 0) {
      return res.status(400).json({ error: "Provide a valid baselineUnits" });
    }

    const client = await getGraphqlClient(shop);
    const results = [];

    for (const { productId, variantId } of products) {
      // Fetch current variant data
      const variantRes = await client.request(VARIANT_QUERY, {
        variables: { id: variantId },
      });
      const variant = variantRes.data.productVariant;
      if (!variant) {
        results.push({ variantId, error: "Variant not found" });
        continue;
      }

      const price = parseFloat(variant.price);
      const cost = variant.inventoryItem?.unitCost?.amount
        ? parseFloat(variant.inventoryItem.unitCost.amount)
        : 0;

      const calc = calculateDiscount(price, cost, discount);

      // Update variant price in Shopify
      const updateRes = await client.request(VARIANT_UPDATE, {
        variables: {
          input: { id: variantId, price: String(calc.newPrice) },
        },
      });

      const userErrors = updateRes.data.productVariantUpdate.userErrors;
      if (userErrors.length > 0) {
        results.push({ variantId, error: userErrors });
        continue;
      }

      // Save experiment to MongoDB
      const experiment = await Experiment.create({
        shop,
        productId,
        variantId,
        originalPrice: price,
        newPrice: calc.newPrice,
        originalProfit: calc.currentProfit,
        newProfit: calc.newProfit,
        discount,
        breakEvenPercent: calc.breakEvenIncrease,
        baselineUnits,
      });

      results.push({
        variantId,
        originalPrice: price,
        newPrice: calc.newPrice,
        experimentId: experiment._id,
        status: "applied",
      });
    }

    res.json({ shop, discount, results });
  } catch (err) {
    console.error("Apply error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
