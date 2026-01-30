/**
 * Builds a Google Maps search URL from an address string
 * @param address - The full address to search for
 * @returns The Google Maps search URL or null if address is empty
 */
export const buildGoogleMapsSearchUrl = (address: string): string | null => {
  if (!address || address.trim() === '') {
    return null;
  }
  
  const encodedAddress = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
};

/**
 * Builds a complete address string from structured address fields
 * Handles null/undefined values gracefully
 */
export const buildAddressString = (fields: {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string;
}): string => {
  const parts: string[] = [];
  
  // Line 1: street, number, complement
  const line1Parts: string[] = [];
  if (fields.street) line1Parts.push(fields.street);
  if (fields.number) line1Parts.push(fields.number);
  if (fields.complement) line1Parts.push(fields.complement);
  if (fields.neighborhood) line1Parts.push(fields.neighborhood);
  
  if (line1Parts.length > 0) {
    parts.push(line1Parts.join(', '));
  }
  
  // Line 2: city, state, zipCode
  const line2Parts: string[] = [];
  if (fields.city) line2Parts.push(fields.city);
  if (fields.state) line2Parts.push(fields.state);
  if (fields.zipCode) line2Parts.push(fields.zipCode);
  
  if (line2Parts.length > 0) {
    parts.push(line2Parts.join(' - '));
  }
  
  // Add country if provided
  if (fields.country) {
    parts.push(fields.country);
  }
  
  return parts.join(', ');
};
