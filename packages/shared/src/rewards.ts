// Rewards contract types — a display-only loyalty scaffold. The data shape and
// ledger exist so the account UI can show a balance, store credit, and a referral
// code; earning/redemption rules are intentionally not implemented yet.

/** How a reward entry was earned/granted. */
export type RewardKind =
  | "signup_bonus"
  | "referral"
  | "order_credit"
  | "promo";

/** One row in the rewards ledger ("how you earned it"). */
export type RewardEvent = {
  kind: RewardKind;
  points: number;
  creditCents: number;
  description: string;
  createdAt: string; // ISO 8601
};

/** A user's rewards balances + shareable referral code. */
export type Rewards = {
  pointsBalance: number;
  creditCents: number;
  referralCode: string;
  ledger: RewardEvent[];
};
