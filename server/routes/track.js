const express = require("express");
const { getGraphqlClient } = require("../shopify");
const { calculateProgress } = require("../utils/calculations");
const Experiment = require("../models/Experiment");

const router = express.Router();

// Query orders created after a given date, paginated
const ORDERS_QUERY = `query ($query: String!, $cursor: String) {
  orders(first: 50, query: $query, after: $cursor) {
    edges {
      node {
        id
        lineItems(first: 50) {
          edges {
            node {
              variant {
                id
              }
              quantity
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

async function countUnitsSold(client, variantId, sinceDate) {
  const dateStr = sinceDate.toISOString().split("T")[0];
  const query = `created_at:>='${dateStr}'`;
  let totalUnits = 0;
  let cursor = null;

  // Paginate through orders
  for (let i = 0; i < 10; i++) {
    const response = await client.request(ORDERS_QUERY, {
      variables: { query, cursor },
    });

    const orders = response.data.orders.edges;
    for (const { node: order } of orders) {
      for (const { node: lineItem } of order.lineItems.edges) {
        if (lineItem.variant?.id === variantId) {
          totalUnits += lineItem.quantity;
        }
      }
    }

    const pageInfo = response.data.orders.pageInfo;
    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
  }

  return totalUnits;
}

router.get("/", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).json({ error: "Missing shop parameter" });

    const experiments = await Experiment.find({ shop }).sort({ appliedAt: -1 });
    if (experiments.length === 0) {
      return res.json({ shop, experiments: [], message: "No experiments found" });
    }

    const client = await getGraphqlClient(shop);
    const results = [];

    for (const exp of experiments) {
      const unitsSold = await countUnitsSold(client, exp.variantId, exp.appliedAt);

      let targetUnits = null;
      let progressPercent = null;
      let profitStatus = "unknown";

      if (exp.breakEvenPercent != null) {
        const progress = calculateProgress(unitsSold, exp.baselineUnits, exp.breakEvenPercent);
        targetUnits = progress.targetUnits;
        progressPercent = progress.progressPercent;
        profitStatus = progress.profitStatus;
      } else {
        // newProfit <= 0, always a loss
        profitStatus = "loss";
      }

      results.push({
        experimentId: exp._id,
        productId: exp.productId,
        variantId: exp.variantId,
        discount: exp.discount,
        unitsSold,
        targetUnits,
        progressPercent,
        profitStatus,
        appliedAt: exp.appliedAt,
      });
    }

    res.json({ shop, experiments: results });
  } catch (err) {
    console.error("Track error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
