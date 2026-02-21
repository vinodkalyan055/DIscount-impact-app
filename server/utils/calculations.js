function calculateDiscount(price, cost, discountPercent) {
  const newPrice = +(price * (1 - discountPercent / 100)).toFixed(2);
  const currentProfit = +(price - cost).toFixed(2);
  const newProfit = +(newPrice - cost).toFixed(2);

  let breakEvenIncrease = null;
  if (newProfit > 0) {
    breakEvenIncrease = +((currentProfit / newProfit - 1) * 100).toFixed(2);
  }

  return { newPrice, currentProfit, newProfit, breakEvenIncrease };
}

function calculateProgress(actualUnitsSold, baselineUnits, breakEvenPercent) {
  const targetUnits = baselineUnits * (1 + breakEvenPercent / 100);
  const progressPercent = +((actualUnitsSold / targetUnits) * 100).toFixed(2);

  let profitStatus;
  if (progressPercent < 100) profitStatus = "loss";
  else if (progressPercent === 100) profitStatus = "break-even";
  else profitStatus = "profit";

  return { targetUnits: +targetUnits.toFixed(2), progressPercent, profitStatus };
}

module.exports = { calculateDiscount, calculateProgress };
