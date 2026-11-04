// Payment abstraction. BETA uses "mock" (always succeeds, no money moves).
// To go live, implement a real provider here (Razorpay / Stripe):
//   1. create an order/payment intent on the provider
//   2. send the customer to checkout
//   3. confirm via the provider's WEBHOOK (never trust the browser) and only then create the bottle.
// See README section 9.

export type ChargeResult = { provider: string; ref: string };

export async function chargeCustomer(input: {
  amountMinor: number;
  userId: string;
  description: string;
}): Promise<ChargeResult> {
  const provider = process.env.PAYMENT_PROVIDER || "mock";
  if (provider === "mock") {
    console.info(`[payments:mock] charged ${input.amountMinor} for "${input.description}" (user ${input.userId})`);
    return { provider: "mock", ref: `MOCK-${Date.now()}` };
  }
  throw new Error(`Payment provider "${provider}" is not implemented yet.`);
}
