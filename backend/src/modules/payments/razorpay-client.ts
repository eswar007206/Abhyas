import crypto from "node:crypto";

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export class RazorpayClient {
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  get publishableKeyId(): string {
    return this.keyId;
  }

  async createOrder(input: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<RazorpayOrderResponse> {
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Razorpay order creation failed: ${body}`);
    }

    return (await response.json()) as RazorpayOrderResponse;
  }

  verifyPaymentSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const payload = `${input.orderId}|${input.paymentId}`;
    const expected = crypto.createHmac("sha256", this.keySecret).update(payload).digest("hex");
    return expected === input.signature;
  }

  verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
    const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    return expected === signature;
  }
}
