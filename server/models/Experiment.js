const mongoose = require("mongoose");

const experimentSchema = new mongoose.Schema({
  shop: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  variantId: { type: String, required: true },
  originalPrice: { type: Number, required: true },
  newPrice: { type: Number, required: true },
  originalProfit: { type: Number, required: true },
  newProfit: { type: Number, required: true },
  discount: { type: Number, required: true },
  breakEvenPercent: { type: Number, default: null },
  baselineUnits: { type: Number, required: true },
  appliedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Experiment", experimentSchema);
