/** Presentation only; subscription authorization remains server-side. */
export const allowsIndependentStoreBilling = (ownedStoreRole: string | null | undefined) => ownedStoreRole !== "secondary";