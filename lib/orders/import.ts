/** Future inbound-email adapter boundary. No prices, checkout action or email side effects. */
export interface EmailOrderDraft {
  source: "email";
  sourceMessageId: string;
  customerConfirmed: false;
  proposedFields: Partial<Record<"product" | "size" | "quantity" | "firstName" | "lastName" | "email" | "addressLine1" | "addressLine2" | "postalCode" | "city" | "country" | "phone", string>>;
}
/** The future confirmation endpoint must validate fields with parseOrder and call createOrder
 * only after the customer explicitly confirms. Never feed extracted amounts into that API. */
export function prepareEmailDraft(sourceMessageId: string, proposedFields: EmailOrderDraft["proposedFields"]): EmailOrderDraft {
  if (!sourceMessageId || sourceMessageId.length > 500) throw new Error("INVALID_SOURCE_MESSAGE_ID");
  const allowed = ["product", "size", "quantity", "firstName", "lastName", "email", "addressLine1", "addressLine2", "postalCode", "city", "country", "phone"];
  return { source: "email", sourceMessageId, customerConfirmed: false,
    proposedFields: Object.fromEntries(Object.entries(proposedFields).filter(([key, value]) => allowed.includes(key) && typeof value === "string" && value.length <= 500)) };
}
