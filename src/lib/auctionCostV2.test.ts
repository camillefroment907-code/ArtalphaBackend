import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAuctionCost } from './auctionCostV2.ts';

test('calculates transparent total from explicitly supplied fees', () => {
  const result = calculateAuctionCost({
    hammerPrice: 1000, buyerPremiumPercent: 25, vatOnPremiumPercent: 20,
    additionalTaxes: 10, shippingAndInsurance: 40, otherFees: 0,
  });
  assert.deepEqual(result, {
    hammerPrice: 1000, buyerPremium: 250, vatOnPremium: 50,
    additionalTaxes: 10, shippingAndInsurance: 40, otherFees: 0, total: 1350,
  });
});

test('allows legitimately zero fees', () => {
  const result = calculateAuctionCost({
    hammerPrice: 99.99, buyerPremiumPercent: 0, vatOnPremiumPercent: 0,
    additionalTaxes: 0, shippingAndInsurance: 0, otherFees: 0,
  });
  assert.equal(result.total, 99.99);
});

test('rejects negative, non-finite, and implausible rates', () => {
  const valid = {
    hammerPrice: 100, buyerPremiumPercent: 10, vatOnPremiumPercent: 20,
    additionalTaxes: 0, shippingAndInsurance: 0, otherFees: 0,
  };
  assert.throws(() => calculateAuctionCost({ ...valid, hammerPrice: -1 }));
  assert.throws(() => calculateAuctionCost({ ...valid, additionalTaxes: NaN }));
  assert.throws(() => calculateAuctionCost({ ...valid, shippingAndInsurance: Infinity }));
  assert.throws(() => calculateAuctionCost({ ...valid, buyerPremiumPercent: 101 }));
  assert.throws(() => calculateAuctionCost({ ...valid, vatOnPremiumPercent: 101 }));
});

test('rounds monetary amounts to cents', () => {
  const result = calculateAuctionCost({
    hammerPrice: 100.01, buyerPremiumPercent: 10, vatOnPremiumPercent: 20,
    additionalTaxes: 0, shippingAndInsurance: 0, otherFees: 0,
  });
  assert.equal(result.buyerPremium, 10);
  assert.equal(result.vatOnPremium, 2);
  assert.equal(result.total, 112.01);
});
