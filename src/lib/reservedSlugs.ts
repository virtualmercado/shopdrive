/**
 * Reserved slugs that cannot be used as store slugs.
 * Used to prevent conflicts with internal platform routes when serving
 * stores at the root path (shopdrive.com.br/nome-da-loja).
 */
export const RESERVED_SLUGS = new Set<string>([
  // Auth
  "login",
  "register",
  "criar-conta",
  "reset-password",
  "forgot-password",
  "onboarding",
  "auth",

  // Merchant dashboard
  "lojista",
  "dashboard",

  // Master / admin panel
  "gestor",
  "admin",
  "master",

  // Public store legacy prefix
  "loja",
  "lojas",

  // Landing / institutional
  "sobre-nos",
  "sobre",
  "blog",
  "central-de-ajuda",
  "ajuda",
  "suporte",
  "fale-conosco",
  "contato",
  "termos-de-uso",
  "termos",
  "politica-de-privacidade",
  "privacidade",
  "politica-de-cookies",
  "cookies",
  "programa-de-afiliados",
  "afiliados",
  "revenda",
  "planos",
  "precos",
  "templates",

  // Functional
  "buscar",
  "search",
  "checkout",
  "carrinho",
  "cart",
  "pedido-confirmado",
  "print",
  "public",
  "link-indisponivel",

  // System / infra
  "api",
  "assets",
  "static",
  "public",
  "uploads",
  "media",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.json",
  "404",
  "500",
]);

export const isReservedSlug = (slug: string | undefined | null): boolean => {
  if (!slug) return true;
  return RESERVED_SLUGS.has(slug.toLowerCase());
};
