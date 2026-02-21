const express = require("express");
const { getGraphqlClient } = require("../shopify");

const router = express.Router();

const PRODUCTS_QUERY = `{
  products(first: 50) {
    edges {
      node {
        id
        title
        status
        vendor
        productType
        featuredImage {
          url
          altText
        }
        totalInventory
        variants(first: 1) {
          edges {
            node {
              price
            }
          }
        }
        variantsCount {
          count
        }
      }
    }
  }
}`;

router.get("/", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).json({ error: "Missing shop parameter" });

    const client = await getGraphqlClient(shop);
    const response = await client.request(PRODUCTS_QUERY);
    const products = response.data.products.edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      status: node.status,
      vendor: node.vendor,
      productType: node.productType,
      image: node.featuredImage?.url || null,
      imageAlt: node.featuredImage?.altText || node.title,
      totalInventory: node.totalInventory,
      price: node.variants.edges[0]?.node.price || "0.00",
      variantsCount: node.variantsCount?.count || 1,
    }));

    res.json({ shop, products });
  } catch (err) {
    console.error("Products error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
