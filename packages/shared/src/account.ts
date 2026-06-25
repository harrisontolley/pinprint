// Account contract types — profile preferences and saved shipping addresses.
// Display identity (name, email, avatar) is owned by Neon Auth; these are the
// app-owned fields keyed by the auth user id.

/** Distance units, matching the studio's Units. */
export type AccountUnits = "km" | "mi";

/** A saved shipping address. */
export type Address = {
  id: string;
  label?: string; // "Home", "Mum"
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postal: string;
  country: string; // ISO-3166 alpha-2
  isDefault: boolean;
};

/** Payload for creating/replacing an address (server assigns id). */
export type AddressInput = Omit<Address, "id" | "isDefault"> & {
  isDefault?: boolean;
};

/** App-owned account profile + notification preferences. */
export type AccountProfile = {
  userId: string;
  email?: string; // echoed from the auth token for convenience
  name?: string;
  marketingOptIn: boolean;
  orderUpdatesOptIn: boolean;
  preferredUnits: AccountUnits;
};

/** Partial update to the mutable profile fields. */
export type AccountProfilePatch = Partial<
  Pick<AccountProfile, "marketingOptIn" | "orderUpdatesOptIn" | "preferredUnits">
>;
