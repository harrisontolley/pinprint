import { beforeEach, describe, expect, it, vi } from "vitest";

// Mirrors digitalDelivery.ts's shape (never throws, idempotent via a
// claim/release pair, env-guarded, order_events logging). Two senders live
// here: sendOrderConfirmationEmail (always sends) and
// sendShipmentNotificationEmail (honors order_updates_opt_in for signed-in
// users; always sends for guests). DB + Resend + accountStore are mocked, same
// approach as digitalDelivery.test.ts.

const getOrderForConfirmationEmail = vi.fn();
const claimConfirmationEmail = vi.fn();
const releaseConfirmationEmailClaim = vi.fn(() => Promise.resolve());
const getOrderForShipmentEmail = vi.fn();
const claimShipmentEmail = vi.fn();
const releaseShipmentEmailClaim = vi.fn(() => Promise.resolve());
const appendOrderEvent = vi.fn(() => Promise.resolve());
vi.mock("./orders.js", () => ({
  getOrderForConfirmationEmail: (...args: unknown[]) => getOrderForConfirmationEmail(...args),
  claimConfirmationEmail: (...args: unknown[]) => claimConfirmationEmail(...args),
  releaseConfirmationEmailClaim: (...args: unknown[]) => releaseConfirmationEmailClaim(...args),
  getOrderForShipmentEmail: (...args: unknown[]) => getOrderForShipmentEmail(...args),
  claimShipmentEmail: (...args: unknown[]) => claimShipmentEmail(...args),
  releaseShipmentEmailClaim: (...args: unknown[]) => releaseShipmentEmailClaim(...args),
  appendOrderEvent: (...args: unknown[]) => appendOrderEvent(...args),
}));

const isResendConfigured = vi.fn();
const sendEmail = vi.fn();
vi.mock("./email.js", () => ({
  isResendConfigured: (...args: unknown[]) => isResendConfigured(...args),
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const getSql = vi.fn();
vi.mock("./db.js", () => ({ getSql: (...args: unknown[]) => getSql(...args) }));

const getOrderUpdatesOptIn = vi.fn();
vi.mock("./accountStore.js", () => ({
  getOrderUpdatesOptIn: (...args: unknown[]) => getOrderUpdatesOptIn(...args),
}));

const { sendOrderConfirmationEmail, sendShipmentNotificationEmail } = await import("./orderEmails.js");

function baseConfirmationOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord-1",
    orderNumber: "PP-ABCD1234",
    email: "buyer@example.com",
    currency: "usd",
    subtotalCents: 9500,
    shippingCents: 0,
    totalCents: 9500,
    confirmationEmailSentAt: null,
    shippingAddress: { name: "Ada Lovelace", line1: "1 Analytical Way", city: "London", postal: "SW1A 1AA", country: "GB" },
    items: [{ productLabel: "16 x 24 in print", quantity: 1, unitPriceCents: 9500 }],
    ...overrides,
  };
}

function baseShipmentOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "ord-1",
    orderNumber: "PP-ABCD1234",
    email: "buyer@example.com",
    userId: null,
    shippedEmailSentAt: null,
    deliveredEmailSentAt: null,
    tracking: { carrier: "UPS", number: "1Z1", url: "https://ups.example.com/1Z1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSql.mockReturnValue({});
  isResendConfigured.mockReturnValue(true);
  claimConfirmationEmail.mockResolvedValue(true);
  claimShipmentEmail.mockResolvedValue(true);
  getOrderUpdatesOptIn.mockResolvedValue(true);
  sendEmail.mockResolvedValue({ id: "resend-1" });
});

describe("sendOrderConfirmationEmail — env guards", () => {
  it("no-ops when Resend is unconfigured", async () => {
    isResendConfigured.mockReturnValue(false);
    const result = await sendOrderConfirmationEmail("ord-1");
    expect(result).toEqual({ sent: false, reason: "unconfigured" });
    expect(getOrderForConfirmationEmail).not.toHaveBeenCalled();
  });

  it("no-ops when the DB is unconfigured", async () => {
    getSql.mockReturnValue(null);
    const result = await sendOrderConfirmationEmail("ord-1");
    expect(result).toEqual({ sent: false, reason: "unconfigured" });
  });

  it("returns order_not_found when the order row is absent", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(null);
    const result = await sendOrderConfirmationEmail("ord-1");
    expect(result).toEqual({ sent: false, reason: "order_not_found" });
  });
});

describe("sendOrderConfirmationEmail — idempotency", () => {
  it("no-ops when confirmation_email_sent_at is already set", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(
      baseConfirmationOrder({ confirmationEmailSentAt: "2026-01-01T00:00:00.000Z" }),
    );
    const result = await sendOrderConfirmationEmail("ord-1");
    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(claimConfirmationEmail).not.toHaveBeenCalled();
  });

  it("treats a lost claim race as already_sent and sends no email", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(baseConfirmationOrder());
    claimConfirmationEmail.mockResolvedValue(false);
    const result = await sendOrderConfirmationEmail("ord-1");
    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a second call after a successful send no-ops", async () => {
    getOrderForConfirmationEmail.mockResolvedValueOnce(baseConfirmationOrder());
    const first = await sendOrderConfirmationEmail("ord-1");
    expect(first).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    getOrderForConfirmationEmail.mockResolvedValueOnce(
      baseConfirmationOrder({ confirmationEmailSentAt: "2026-01-01T00:00:00.000Z" }),
    );
    const second = await sendOrderConfirmationEmail("ord-1");
    expect(second).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("sendOrderConfirmationEmail — content + success path", () => {
  it("sends to the order's email with the order number in the subject", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(baseConfirmationOrder());
    const result = await sendOrderConfirmationEmail("ord-1");
    expect(result).toEqual({ sent: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe("buyer@example.com");
    expect(arg.subject).toContain("PP-ABCD1234");
    expect(arg.html).toContain("16 x 24 in print");
  });

  it("marks sent and appends an order_event on success", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(baseConfirmationOrder());
    await sendOrderConfirmationEmail("ord-1");
    expect(claimConfirmationEmail).toHaveBeenCalledWith("ord-1");
    expect(releaseConfirmationEmailClaim).not.toHaveBeenCalled();
    expect(appendOrderEvent).toHaveBeenCalledWith(
      "ord-1",
      expect.objectContaining({ message: expect.stringContaining("confirm"), source: "system" }),
    );
  });
});

describe("sendOrderConfirmationEmail — send failure", () => {
  it("releases the claim, logs an order_event, and returns email_send_failed", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(baseConfirmationOrder());
    sendEmail.mockResolvedValue(null);
    const result = await sendOrderConfirmationEmail("ord-1");
    expect(result).toEqual({ sent: false, reason: "email_send_failed" });
    expect(releaseConfirmationEmailClaim).toHaveBeenCalledWith("ord-1");
  });
});

describe("sendOrderConfirmationEmail — never throws", () => {
  it("swallows an order-load exception", async () => {
    getOrderForConfirmationEmail.mockRejectedValue(new Error("db exploded"));
    await expect(sendOrderConfirmationEmail("ord-1")).resolves.toEqual({ sent: false, reason: "load_failed" });
  });

  it("swallows a claim exception", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(baseConfirmationOrder());
    claimConfirmationEmail.mockRejectedValue(new Error("db exploded"));
    await expect(sendOrderConfirmationEmail("ord-1")).resolves.toEqual({ sent: false, reason: "claim_failed" });
  });

  it("swallows a sendEmail exception", async () => {
    getOrderForConfirmationEmail.mockResolvedValue(baseConfirmationOrder());
    sendEmail.mockRejectedValue(new Error("resend down"));
    await expect(sendOrderConfirmationEmail("ord-1")).resolves.toEqual({ sent: false, reason: "email_send_failed" });
    expect(releaseConfirmationEmailClaim).toHaveBeenCalledWith("ord-1");
  });
});

describe("sendShipmentNotificationEmail — env guards", () => {
  it("no-ops when Resend is unconfigured", async () => {
    isResendConfigured.mockReturnValue(false);
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: false, reason: "unconfigured" });
    expect(getOrderForShipmentEmail).not.toHaveBeenCalled();
  });

  it("returns order_not_found when the order row is absent", async () => {
    getOrderForShipmentEmail.mockResolvedValue(null);
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: false, reason: "order_not_found" });
  });
});

describe("sendShipmentNotificationEmail — idempotency (independent per kind)", () => {
  it("no-ops shipped when shippedEmailSentAt is already set", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder({ shippedEmailSentAt: "2026-01-01T00:00:00.000Z" }));
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("still sends delivered even though shipped was already sent (independent claims)", async () => {
    getOrderForShipmentEmail.mockResolvedValue(
      baseShipmentOrder({ shippedEmailSentAt: "2026-01-01T00:00:00.000Z", deliveredEmailSentAt: null }),
    );
    const result = await sendShipmentNotificationEmail("ord-1", "delivered");
    expect(result).toEqual({ sent: true });
    expect(claimShipmentEmail).toHaveBeenCalledWith("ord-1", "delivered");
  });

  it("treats a lost claim race as already_sent", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder());
    claimShipmentEmail.mockResolvedValue(false);
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("sendShipmentNotificationEmail — opt-out (signed-in users only)", () => {
  it("always sends for a guest order (no userId), without checking opt-in", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder({ userId: null }));
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: true });
    expect(getOrderUpdatesOptIn).not.toHaveBeenCalled();
  });

  it("sends for a signed-in user who is opted in", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder({ userId: "user-1" }));
    getOrderUpdatesOptIn.mockResolvedValue(true);
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: true });
    expect(getOrderUpdatesOptIn).toHaveBeenCalledWith("user-1");
  });

  it("skips (does not claim or send) for a signed-in user who opted out", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder({ userId: "user-1" }));
    getOrderUpdatesOptIn.mockResolvedValue(false);
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: false, reason: "opted_out" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(claimShipmentEmail).not.toHaveBeenCalled();
  });
});

describe("sendShipmentNotificationEmail — content + success path", () => {
  it("sends to the order's email with the order number and kind in the subject", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder());
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: true });
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe("buyer@example.com");
    expect(arg.subject).toContain("PP-ABCD1234");
    expect(arg.html).toContain("UPS");
  });

  it("marks sent and appends an order_event on success", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder());
    await sendShipmentNotificationEmail("ord-1", "delivered");
    expect(claimShipmentEmail).toHaveBeenCalledWith("ord-1", "delivered");
    expect(releaseShipmentEmailClaim).not.toHaveBeenCalled();
    expect(appendOrderEvent).toHaveBeenCalledWith(
      "ord-1",
      expect.objectContaining({ source: "system" }),
    );
  });
});

describe("sendShipmentNotificationEmail — send failure", () => {
  it("releases the claim for the matching kind, logs an order_event, and returns email_send_failed", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder());
    sendEmail.mockResolvedValue(null);
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: false, reason: "email_send_failed" });
    expect(releaseShipmentEmailClaim).toHaveBeenCalledWith("ord-1", "shipped");
  });
});

describe("sendShipmentNotificationEmail — never throws", () => {
  it("swallows an order-load exception", async () => {
    getOrderForShipmentEmail.mockRejectedValue(new Error("db exploded"));
    await expect(sendShipmentNotificationEmail("ord-1", "shipped")).resolves.toEqual({
      sent: false,
      reason: "load_failed",
    });
  });

  it("swallows a claim exception", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder());
    claimShipmentEmail.mockRejectedValue(new Error("db exploded"));
    await expect(sendShipmentNotificationEmail("ord-1", "shipped")).resolves.toEqual({
      sent: false,
      reason: "claim_failed",
    });
  });

  it("swallows a sendEmail exception", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder());
    sendEmail.mockRejectedValue(new Error("resend down"));
    await expect(sendShipmentNotificationEmail("ord-1", "shipped")).resolves.toEqual({
      sent: false,
      reason: "email_send_failed",
    });
    expect(releaseShipmentEmailClaim).toHaveBeenCalledWith("ord-1", "shipped");
  });

  it("swallows an opt-in lookup exception by treating it as opted-in (fails safe, still notifies)", async () => {
    getOrderForShipmentEmail.mockResolvedValue(baseShipmentOrder({ userId: "user-1" }));
    getOrderUpdatesOptIn.mockRejectedValue(new Error("db exploded"));
    const result = await sendShipmentNotificationEmail("ord-1", "shipped");
    expect(result).toEqual({ sent: true });
  });
});
