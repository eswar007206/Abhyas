declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
}

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(input: {
  keyId: string;
  amountPaise: number;
  currency: string;
  orderId: string;
  title: string;
  description: string;
  email?: string;
  name?: string;
  onSuccess: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) => Promise<void>;
}): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new Error("Could not load Razorpay checkout.");
  }

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: input.keyId,
      amount: input.amountPaise,
      currency: input.currency,
      name: input.title,
      description: input.description,
      order_id: input.orderId,
      prefill: { email: input.email, name: input.name },
      theme: { color: "#2563eb" },
      handler: async (response) => {
        try {
          await input.onSuccess({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      },
    });
    checkout.open();
  });
}
