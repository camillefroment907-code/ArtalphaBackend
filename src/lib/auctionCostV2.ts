/**
 * Auction total-cost estimator. Pure arithmetic; no external data collection.
 * All rates must be provided by the user or an explicitly licensed source.
 * Values are illustrative, not a binding quote from an auction house.
 */
export type AuctionCostInput = {
  hammerPrice: number;
  buyerPremiumPercent: number;
  vatOnPremiumPercent: number;
  additionalTaxes: number;
  shippingAndInsurance: number;
  otherFees: number;
};

export type AuctionCostBreakdown = {
  hammerPrice: number;
  buyerPremium: number;
  vatOnPremium: number;
  additionalTaxes: number;
  shippingAndInsurance: number;
  otherFees: number;
  total: number;
};

export function calculateAuctionCost(input: AuctionCostInput): AuctionCostBreakdown {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid ${key}: expected a finite non-negative number`);
    }
  }
  if (input.buyerPremiumPercent > 100 || input.vatOnPremiumPercent > 100) {
    throw new Error("Percentages cannot exceed 100");
  }
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const buyerPremium = round(input.hammerPrice * input.buyerPremiumPercent / 100);
  const vatOnPremium = round(buyerPremium * input.vatOnPremiumPercent / 100);
  return {
    hammerPrice: round(input.hammerPrice),
    buyerPremium,
    vatOnPremium,
    additionalTaxes: round(input.additionalTaxes),
    shippingAndInsurance: round(input.shippingAndInsurance),
    otherFees: round(input.otherFees),
    total: round(input.hammerPrice + buyerPremium + vatOnPremium + input.additionalTaxes + input.shippingAndInsurance + input.otherFees),
  };
}
