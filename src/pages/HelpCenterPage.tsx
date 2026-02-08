import { useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import LandingLayout from "@/components/layout/LandingLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, 
  Rocket, 
  Package, 
  CreditCard, 
  Truck, 
  User, 
  Shield,
  ArrowLeft,
  ChevronRight
} from "lucide-react";
import { useHelpCategories, useHelpArticlesByCategory, useHelpArticle, useSearchHelpArticles, HelpCategory } from "@/hooks/useHelpCenter";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Package,
  CreditCard,
  Truck,
  User,
  Shield,
};

const HelpCenterPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  
  const categorySlug = searchParams.get("categoria");
  const articleSlug = searchParams.get("artigo");

  const { data: categories = [], isLoading: categoriesLoading } = useHelpCategories();
  const { data: articles = [], isLoading: articlesLoading } = useHelpArticlesByCategory(categorySlug);
  const { data: article, isLoading: articleLoading } = useHelpArticle(categorySlug, articleSlug);
  const { data: searchResults = [] } = useSearchHelpArticles(searchQuery);

  const currentCategory = useMemo(() => {
    return categories.find(c => c.slug === categorySlug);
  }, [categories, categorySlug]);

  const handleCategoryClick = (category: HelpCategory) => {
    setSearchParams({ categoria: category.slug });
    setSearchQuery("");
  };

  const handleArticleClick = (categorySlug: string, articleSlug: string) => {
    setSearchParams({ categoria: categorySlug, artigo: articleSlug });
    setSearchQuery("");
  };

  const handleBack = () => {
    if (articleSlug) {
      setSearchParams({ categoria: categorySlug! });
    } else if (categorySlug) {
      setSearchParams({});
    }
    setSearchQuery("");
  };

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        return <br key={index} />;
      }
      
      // Check if line is all uppercase (header)
      if (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && /[A-Z]/.test(trimmedLine)) {
        return (
          <h3 key={index} className="text-lg font-semibold text-foreground mt-6 mb-3">
            {trimmedLine}
          </h3>
        );
      }
      
      // Check if line starts with number + period (ordered list)
      if (/^\d+\.\s/.test(trimmedLine)) {
        return (
          <p key={index} className="text-muted-foreground leading-relaxed pl-4">
            {trimmedLine}
          </p>
        );
      }
      
      // Check if line starts with dash (list item)
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
        return (
          <li key={index} className="text-muted-foreground leading-relaxed ml-4 list-disc">
            {trimmedLine.substring(1).trim()}
          </li>
        );
      }
      
      return (
        <p key={index} className="text-muted-foreground leading-relaxed mb-2">
          {trimmedLine}
        </p>
      );
    });
  };

  // Article view
  if (article && articleSlug) {
    return (
      <LandingLayout>
        <div className="min-h-screen bg-background py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6 text-[#6a1b9a] hover:text-[#6a1b9a]/80"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para {currentCategory?.name || "categorias"}
            </Button>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
                  {article.title}
                </h1>
                <div className="prose prose-sm max-w-none">
                  {renderContent(article.content)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </LandingLayout>
    );
  }

  // Articles list view
  if (categorySlug && currentCategory) {
    return (
      <LandingLayout>
        <div className="min-h-screen bg-background py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-6 text-[#6a1b9a] hover:text-[#6a1b9a]/80"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para categorias
            </Button>

            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {currentCategory.name}
              </h1>
              <p className="text-muted-foreground">
                Artigos de ajuda nesta categoria
              </p>
            </div>

            {articlesLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Carregando artigos...
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum artigo disponível nesta categoria.
              </div>
            ) : (
              <div className="space-y-3">
                {articles.map((article) => (
                  <Card
                    key={article.id}
                    className="cursor-pointer hover:border-[#6a1b9a]/30 transition-all hover:shadow-md"
                    onClick={() => handleArticleClick(categorySlug!, article.slug)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="font-medium text-foreground">
                        {article.title}
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </LandingLayout>
    );
  }

  // Main categories view
  return (
    <LandingLayout>
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Central de Ajuda ShopDrive
            </h1>
            <p className="text-lg text-muted-foreground">
              Encontre respostas e aprenda a usar sua loja
            </p>
          </div>

          {/* Search */}
          <div className="max-w-2xl mx-auto mb-10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Busque por um tema ou pergunta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-6 text-lg rounded-xl border-2 focus:border-[#6a1b9a]"
              />
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div className="mt-4 bg-card rounded-xl border shadow-lg overflow-hidden">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum resultado encontrado para "{searchQuery}"
                  </div>
                ) : (
                  <div className="divide-y">
                    {searchResults.slice(0, 8).map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleArticleClick(result.category?.slug || "", result.slug)}
                        className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                      >
                        <p className="font-medium text-foreground">{result.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {result.category?.name}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Categories Grid */}
          {categoriesLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando categorias...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((category) => {
                const IconComponent = iconMap[category.icon || ""] || Package;
                return (
                  <Card
                    key={category.id}
                    className="cursor-pointer hover:border-[#6a1b9a]/50 transition-all hover:shadow-lg group"
                    onClick={() => handleCategoryClick(category)}
                  >
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="p-3 bg-[#6a1b9a]/10 rounded-xl group-hover:bg-[#6a1b9a]/20 transition-colors">
                        <IconComponent className="h-6 w-6 text-[#6a1b9a]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-1">
                          {category.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Clique para ver artigos
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-[#6a1b9a] transition-colors" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </LandingLayout>
  );
};

export default HelpCenterPage;
