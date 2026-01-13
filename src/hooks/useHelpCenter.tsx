import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HelpArticle {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  content: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: HelpCategory;
}

// Fetch all active categories
export function useHelpCategories() {
  return useQuery({
    queryKey: ["help-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_categories")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as HelpCategory[];
    },
  });
}

// Fetch all categories for admin
export function useHelpCategoriesAdmin() {
  return useQuery({
    queryKey: ["help-categories-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as HelpCategory[];
    },
  });
}

// Fetch articles by category
export function useHelpArticlesByCategory(categorySlug: string | null) {
  return useQuery({
    queryKey: ["help-articles", categorySlug],
    queryFn: async () => {
      if (!categorySlug) return [];

      // First get the category
      const { data: category, error: catError } = await supabase
        .from("help_categories")
        .select("id")
        .eq("slug", categorySlug)
        .eq("is_active", true)
        .single();

      if (catError) throw catError;

      const { data, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("category_id", category.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as HelpArticle[];
    },
    enabled: !!categorySlug,
  });
}

// Fetch single article by slug
export function useHelpArticle(categorySlug: string | null, articleSlug: string | null) {
  return useQuery({
    queryKey: ["help-article", categorySlug, articleSlug],
    queryFn: async () => {
      if (!categorySlug || !articleSlug) return null;

      // First get the category
      const { data: category, error: catError } = await supabase
        .from("help_categories")
        .select("*")
        .eq("slug", categorySlug)
        .eq("is_active", true)
        .single();

      if (catError) throw catError;

      const { data, error } = await supabase
        .from("help_articles")
        .select("*")
        .eq("category_id", category.id)
        .eq("slug", articleSlug)
        .eq("is_active", true)
        .single();

      if (error) throw error;
      return { ...data, category } as HelpArticle;
    },
    enabled: !!categorySlug && !!articleSlug,
  });
}

// Search articles
export function useSearchHelpArticles(searchQuery: string) {
  return useQuery({
    queryKey: ["help-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const { data, error } = await supabase
        .from("help_articles")
        .select(`
          *,
          category:help_categories(*)
        `)
        .eq("is_active", true)
        .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);

      if (error) throw error;
      return data as (HelpArticle & { category: HelpCategory })[];
    },
    enabled: searchQuery.length >= 2,
  });
}

// Admin: Fetch all articles
export function useHelpArticlesAdmin() {
  return useQuery({
    queryKey: ["help-articles-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("help_articles")
        .select(`
          *,
          category:help_categories(*)
        `)
        .order("category_id", { ascending: true })
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data as (HelpArticle & { category: HelpCategory })[];
    },
  });
}

// Admin: Create category
export function useCreateHelpCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (category: Omit<HelpCategory, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("help_categories")
        .insert([category])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-categories"] });
      queryClient.invalidateQueries({ queryKey: ["help-categories-admin"] });
    },
  });
}

// Admin: Update category
export function useUpdateHelpCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HelpCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from("help_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-categories"] });
      queryClient.invalidateQueries({ queryKey: ["help-categories-admin"] });
    },
  });
}

// Admin: Delete category
export function useDeleteHelpCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("help_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-categories"] });
      queryClient.invalidateQueries({ queryKey: ["help-categories-admin"] });
      queryClient.invalidateQueries({ queryKey: ["help-articles-admin"] });
    },
  });
}

// Admin: Create article
export function useCreateHelpArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (article: Omit<HelpArticle, "id" | "created_at" | "updated_at" | "category">) => {
      const { data, error } = await supabase
        .from("help_articles")
        .insert([article])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-articles"] });
      queryClient.invalidateQueries({ queryKey: ["help-articles-admin"] });
    },
  });
}

// Admin: Update article
export function useUpdateHelpArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HelpArticle> & { id: string }) => {
      const { data, error } = await supabase
        .from("help_articles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-articles"] });
      queryClient.invalidateQueries({ queryKey: ["help-articles-admin"] });
    },
  });
}

// Admin: Delete article
export function useDeleteHelpArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("help_articles")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["help-articles"] });
      queryClient.invalidateQueries({ queryKey: ["help-articles-admin"] });
    },
  });
}
