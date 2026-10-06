/** Lojas FICTÍCIAS para testes e demonstração do editorial_01 (nenhum dado real). */
import type { CatalogSource, RawProductRow, RawStoreProfile } from "../types";

const profile = (id: string, over: Partial<RawStoreProfile>): RawStoreProfile => ({
  id, store_name: null, store_slug: null, store_logo_url: null, primary_color: null, secondary_color: null,
  button_bg_color: null, button_text_color: null, price_color: null, whatsapp_number: null, email: null,
  instagram_url: null, facebook_url: null, youtube_url: null, x_url: null, about_us_title: null, about_us_text: null,
  address: null, address_number: null, address_neighborhood: null, address_city: null, address_state: null, ...over,
});

const row = (storeId: string, i: number, over: Partial<RawProductRow>): RawProductRow => ({
  id: `${storeId}-p${String(i).padStart(3, "0")}`, user_id: storeId, name: `Produto ${i}`, description: null,
  price: 49.9, promotional_price: null, image_url: `fixture://p${i % 14}.jpg`, images: null, category_id: null,
  brand_id: null, inventory_mode: "simple", is_active: true, is_featured: false, is_new: false, weight: null,
  shipping_weight: null, height: null, width: null, length: null, created_at: `2026-01-${String((i % 27) + 1).padStart(2, "0")}T10:00:00Z`, ...over,
});

export const FIXTURE_STORE_A = "fixture-store-a";
export const FIXTURE_STORE_B = "fixture-store-b";

export const fixtureStoreA = (): CatalogSource => {
  const s = FIXTURE_STORE_A;
  const names = [
    "Sabonete de Argila Verde", "Óleo Corporal de Castanha", "Hidratante de Cupuaçu", "Shampoo Sólido Açaí",
    "Condicionador Nutritivo de Murumuru com Óleo de Pracaxi e Manteiga de Tucumã — Edição Especial 500 ml",
    "Bálsamo Labial", "Esfoliante de Café",
  ];
  const products: RawProductRow[] = [
    ...names.map((name, i) => row(s, i, { name, category_id: "a-cat-corpo", brand_id: i % 2 ? "a-br-1" : null,
      description: i === 0 ? "<p><strong>Limpeza suave</strong> com argila verde &amp; óleos essenciais.</p><ul><li>Vegano</li><li>Sem parabenos</li></ul><script>alert(1)</script>" : i === 6 ? null : "Fórmula artesanal produzida em pequenos lotes, com ingredientes de origem vegetal e fragrância delicada. Ideal para uso diário.",
      price: 39.9 + i * 10, promotional_price: i === 4 ? 89.9 : i === 2 ? 49.9 : null, is_featured: i === 1, image_url: i === 3 ? null : `fixture://p${i}.jpg` })),
    row(s, 7, { name: "Vela Aromática Cedro & Âmbar", category_id: "a-cat-casa", description: "Cera vegetal, pavio de algodão. Aproximadamente 40 horas de queima.", price: 79.9, image_url: "fixture://p7.jpg" }),
    row(s, 8, { name: "Difusor de Ambientes Lavanda", category_id: "a-cat-casa", description: "Perfuma ambientes por até 60 dias.", price: 119, promotional_price: 99, image_url: "fixture://p8.jpg" }),
    row(s, 9, { name: "Kit Presente Coração da Floresta", category_id: "a-cat-kits", description: "Seleção especial com três itens da linha corporal, embalados em caixa reciclável.", price: 249.9, image_url: "fixture://p9.jpg" }),
    row(s, 10, { name: "Produto inativo — não deve aparecer", category_id: "a-cat-corpo", is_active: false }),
  ];
  return {
    storeId: s,
    profile: profile(s, { store_name: "Empório Serra Verde", store_slug: "emporio-serra-verde", store_logo_url: "fixture://logoA.png",
      primary_color: "#2E5E3E", button_bg_color: "#C58B3A", whatsapp_number: "92991234567", email: "contato@serraverde.exemplo",
      instagram_url: "https://instagram.com/serraverde.exemplo", about_us_text: "<p>Cosmética natural feita à mão, com ingredientes da sociobiodiversidade brasileira e embalagens recicláveis.</p>",
      address_city: "Manaus", address_state: "AM" }),
    products,
    categories: [
      { id: "a-cat-corpo", user_id: s, name: "Corpo & Banho", icon_url: null },
      { id: "a-cat-casa", user_id: s, name: "Casa Perfumada", icon_url: null },
      { id: "a-cat-kits", user_id: s, name: "Kits & Presentes", icon_url: null },
    ],
    brands: [{ id: "a-br-1", user_id: s, name: "Linha Origem", logo_url: null }],
    galleryByProduct: {},
    variantsByProduct: {},
  };
};

export const fixtureStoreB = (count = 4): CatalogSource => {
  const s = FIXTURE_STORE_B;
  return {
    storeId: s,
    profile: profile(s, { store_name: "Oficina Rubi Calçados", store_slug: "oficina-rubi", store_logo_url: "fixture://logoB.png", primary_color: "#962838", whatsapp_number: "5511988887777" }),
    products: Array.from({ length: count }, (_, i) => row(s, i, { name: `Tênis Urbano Modelo ${i + 1}`, category_id: i % 2 ? "b-cat-2" : "b-cat-1", description: "Cabedal em couro, palmilha anatômica e solado de borracha natural.", price: 199.9 + i, promotional_price: i % 5 === 0 ? 179.9 + i : null })),
    categories: [{ id: "b-cat-1", user_id: s, name: "Masculino", icon_url: null }, { id: "b-cat-2", user_id: s, name: "Feminino", icon_url: null }],
    brands: [],
    galleryByProduct: {},
    variantsByProduct: {},
  };
};
