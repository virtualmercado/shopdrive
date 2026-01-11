import { useState, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  Clock, 
  Search, 
  Eye, 
  Copy, 
  Trash2,
  FolderOpen,
  X
} from "lucide-react";
import { toast } from "sonner";

type FileType = "image" | "pdf";
type FilterType = "all" | "images" | "pdfs" | "recent";

interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: FileType;
  size: number;
  width?: number;
  height?: number;
  uploadedAt: Date;
}

// Mock data for demonstration
const mockFiles: MediaFile[] = [
  {
    id: "1",
    name: "hero-banner.jpg",
    url: "/placeholder.svg",
    type: "image",
    size: 245000,
    width: 1920,
    height: 720,
    uploadedAt: new Date("2024-01-10")
  },
  {
    id: "2",
    name: "produto-destaque.png",
    url: "/placeholder.svg",
    type: "image",
    size: 180000,
    width: 800,
    height: 600,
    uploadedAt: new Date("2024-01-09")
  },
  {
    id: "3",
    name: "manual-lojista.pdf",
    url: "/placeholder.svg",
    type: "pdf",
    size: 1500000,
    uploadedAt: new Date("2024-01-08")
  },
  {
    id: "4",
    name: "banner-promocao.webp",
    url: "/placeholder.svg",
    type: "image",
    size: 120000,
    width: 1200,
    height: 400,
    uploadedAt: new Date("2024-01-07")
  },
  {
    id: "5",
    name: "logo-vm.svg",
    url: "/placeholder.svg",
    type: "image",
    size: 15000,
    width: 200,
    height: 60,
    uploadedAt: new Date("2024-01-06")
  },
  {
    id: "6",
    name: "termos-uso.pdf",
    url: "/placeholder.svg",
    type: "pdf",
    size: 850000,
    uploadedAt: new Date("2024-01-05")
  }
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AdminMediaLibrary = () => {
  const [files, setFiles] = useState<MediaFile[]>(mockFiles);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);

  const filteredFiles = files.filter(file => {
    // Apply search filter
    if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Apply type filter
    switch (filter) {
      case "images":
        return file.type === "image";
      case "pdfs":
        return file.type === "pdf";
      case "recent":
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return file.uploadedAt >= weekAgo;
      default:
        return true;
    }
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileUpload(droppedFiles);
  }, []);

  const handleFileUpload = (uploadedFiles: File[]) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "application/pdf"];
    
    uploadedFiles.forEach(file => {
      if (!validTypes.includes(file.type)) {
        toast.error(`Arquivo "${file.name}" não é suportado. Use JPG, PNG, WEBP, SVG ou PDF.`);
        return;
      }

      // In a real implementation, this would upload to Supabase Storage
      const newFile: MediaFile = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type === "application/pdf" ? "pdf" : "image",
        size: file.size,
        uploadedAt: new Date()
      };

      // Get image dimensions if it's an image
      if (newFile.type === "image") {
        const img = new Image();
        img.onload = () => {
          newFile.width = img.width;
          newFile.height = img.height;
          setFiles(prev => [newFile, ...prev]);
        };
        img.src = newFile.url;
      } else {
        setFiles(prev => [newFile, ...prev]);
      }

      toast.success(`"${file.name}" enviado com sucesso!`);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFileUpload(selectedFiles);
    e.target.value = "";
  };

  const handleCopyUrl = (url: string, fileName: string) => {
    navigator.clipboard.writeText(url);
    toast.success(`URL de "${fileName}" copiada!`);
  };

  const handleDelete = (fileId: string, fileName: string) => {
    // In a real implementation, check if file is in use before deleting
    setFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success(`"${fileName}" excluído com sucesso!`);
  };

  const filterButtons: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "Todos", icon: <FolderOpen className="h-4 w-4" /> },
    { key: "images", label: "Imagens", icon: <ImageIcon className="h-4 w-4" /> },
    { key: "pdfs", label: "PDFs", icon: <FileText className="h-4 w-4" /> },
    { key: "recent", label: "Recentes", icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <p className="text-muted-foreground">
            Gerencie todas as imagens, arquivos e mídias utilizadas pela plataforma VirtualMercado.
          </p>
        </div>

      {/* Main Card */}
      <Card className="shadow-sm border">
        <CardContent className="p-6 space-y-6">
          {/* Upload Area */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-all
              ${isDragOver 
                ? "border-[#6a1b9a] bg-[#6a1b9a]/5" 
                : "border-gray-300 hover:border-[#6a1b9a]/50"
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-[#6a1b9a] mb-4" />
            <p className="text-muted-foreground mb-4">
              Arraste arquivos aqui ou clique para enviar.
            </p>
            <label>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.svg,.pdf"
                className="hidden"
                onChange={handleInputChange}
              />
              <Button 
                asChild
                className="bg-[#FB8C00] hover:bg-[#FB8C00]/90 text-white cursor-pointer"
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Arquivos
                </span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-3">
              Formatos aceitos: JPG, PNG, WEBP, SVG e PDF
            </p>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {filterButtons.map(({ key, label, icon }) => (
                <Button
                  key={key}
                  variant={filter === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(key)}
                  className={
                    filter === key
                      ? "bg-[#6a1b9a] hover:bg-[#6a1b9a]/90 text-white"
                      : "hover:border-[#6a1b9a] hover:text-[#6a1b9a]"
                  }
                >
                  {icon}
                  <span className="ml-1.5">{label}</span>
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar arquivos…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Files Grid */}
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || filter !== "all" 
                  ? "Nenhum arquivo encontrado com os filtros aplicados."
                  : "Nenhum arquivo na biblioteca. Envie seu primeiro arquivo!"
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative bg-gray-50 rounded-lg overflow-hidden border hover:shadow-md transition-all"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square flex items-center justify-center bg-gray-100">
                    {file.type === "image" ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="h-12 w-12 text-[#6a1b9a]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                    {file.width && file.height && (
                      <p className="text-xs text-muted-foreground">
                        {file.width}×{file.height} px
                      </p>
                    )}
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 bg-white/20 hover:bg-[#6a1b9a] text-white"
                      onClick={() => setPreviewFile(file)}
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 bg-white/20 hover:bg-[#FB8C00] text-white"
                      onClick={() => handleCopyUrl(file.url, file.name)}
                      title="Copiar URL"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 bg-white/20 hover:bg-red-500 text-white"
                      onClick={() => handleDelete(file.id, file.name)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4 pt-4 border-t text-sm text-muted-foreground">
            <span>
              <strong className="text-[#6a1b9a]">{files.length}</strong> arquivos na biblioteca
            </span>
            <span>
              <strong className="text-[#6a1b9a]">{files.filter(f => f.type === "image").length}</strong> imagens
            </span>
            <span>
              <strong className="text-[#6a1b9a]">{files.filter(f => f.type === "pdf").length}</strong> PDFs
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewFile && (
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-[#6a1b9a]">{previewFile.name}</h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPreviewFile(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4">
              {previewFile.type === "image" ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full h-auto"
                />
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-24 w-24 mx-auto text-[#6a1b9a] mb-4" />
                  <p className="text-muted-foreground">Preview de PDF não disponível</p>
                  <Button 
                    className="mt-4 bg-[#FB8C00] hover:bg-[#FB8C00]/90"
                    onClick={() => window.open(previewFile.url, "_blank")}
                  >
                    Abrir PDF
                  </Button>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 text-sm text-muted-foreground">
              <p><strong>Tamanho:</strong> {formatFileSize(previewFile.size)}</p>
              {previewFile.width && previewFile.height && (
                <p><strong>Dimensões:</strong> {previewFile.width}×{previewFile.height} px</p>
              )}
              <p><strong>Enviado em:</strong> {previewFile.uploadedAt.toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

export default AdminMediaLibrary;
