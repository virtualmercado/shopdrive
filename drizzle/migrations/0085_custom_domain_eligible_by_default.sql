-- Custom domains: every eligible store (effective plan with the custom-domain entitlement: premium/marca) may configure
-- its own domain unless explicitly blocked (custom_domain_v2_access.enabled = false). The legacy exact pilot row keeps
-- its previous semantics unchanged. Adds the CNAME-only www ingress scope and sanitized Cloudflare observations.
-- Flags are NOT changed here.
SELECT 1;