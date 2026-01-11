import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Image as ImageIcon, 
  FileText, 
  Clock, 
  FolderOpen,
  Check,
  Loader2,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

type FileType = "image" | "pdf";
type FilterType = "all" | "images" | "pdfs" | "recent";

interface MediaFile {
  id: string;
  name: string;
  url: string;
  file_path: string;
  file_type: FileType;
  size: number;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
  created_at: string;
}

interface MediaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (file: MediaFile) => void;
  allowedTypes?: FileType[];
  title?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const MediaSelectorModal = ({
  isOpen,
  onClose,
  onSelect,
  allowedTypes = ["image"],
  title = "Selecionar Mídia"
}: MediaSelectorModalProps) => {
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch media files from database
  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ["media-files-selector"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_files")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Error fetching media files:", error);
        throw error;
      }
      
      return (data || []).map((file: any) => ({
        id: file.id,
        name: file.name,
        url: file.url,
        file_path: file.file_path,
        file_type: file.file_type as FileType,
        size: file.size,
        width: file.width,
        height: file.height,
        mime_type: file.mime_type,
        created_at: file.created_at,
      }));
    },
    enabled: isOpen,
  });

  const filteredFiles = files.filter(file => {
    // Filter by allowed types
    if (!allowedTypes.includes(file.file_type)) {
      return false;
    }

    // Apply search filter
    if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Apply type filter
    switch (filter) {
      case "images":
        return file.file_type === "image";
      case "pdfs":
        return file.file_type === "pdf";
      case "recent":
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(file.created_at) >= weekAgo;
      default:
        return true;
    }
  });

  const handleConfirm = () => {
    if (selectedFile) {
      onSelect(selectedFile);
      setSelectedFile(null);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    onClose();
  };

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const handleFileUpload = async (uploadedFiles: File[]) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    
    setIsUploading(true);
    
    for (const file of uploadedFiles) {
      if (!validTypes.includes(file.type)) {
        toast.error(`Arquivo "${file.name}" não é suportado. Use JPG, PNG, WEBP ou SVG.`);
        continue;
      }

      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("media-library")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          toast.error(`Erro ao enviar "${file.name}": ${uploadError.message}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("media-library")
          .getPublicUrl(filePath);

        const publicUrl = urlData.publicUrl;

        let width: number | null = null;
        let height: number | null = null;

        try {
          const img = await loadImage(URL.createObjectURL(file));
          width = img.width;
          height = img.height;
        } catch (e) {
          console.error("Error getting image dimensions:", e);
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { error: dbError } = await supabase
          .from("media_files")
          .insert({
            name: file.name,
            file_path: filePath,
            url: publicUrl,
            file_type: "image",
            size: file.size,
            width,
            height,
            mime_type: file.type,
            uploaded_by: user?.id || null,
          });

        if (dbError) {
          toast.error(`Erro ao salvar metadados de "${file.name}"`);
          continue;
        }

        toast.success(`"${file.name}" enviado com sucesso!`);
      } catch (error) {
        toast.error(`Erro ao enviar "${file.name}"`);
      }
    }

    setIsUploading(false);
    refetch();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFileUpload(selectedFiles);
    e.target.value = "";
  };

  const filterButtons: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "Todos", icon: <FolderOpen className="h-4 w-4" /> },
    { key: "images", label: "Imagens", icon: <ImageIcon className="h-4 w-4" /> },
    { key: "recent", label: "Recentes", icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <div className="p-2 bg-[#6a1b9a]/10 rounded-lg">
              <ImageIcon className="h-5 w-5 text-[#6a1b9a]" />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
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

            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <label>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.svg"
                  className="hidden"
                  onChange={handleInputChange}
                  disabled={isUploading}
                />
                <Button 
                  asChild
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  disabled={isUploading}
                >
                  <span>
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">Upload</span>
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Files Grid */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 mx-auto text-[#6a1b9a] animate-spin mb-4" />
                <p className="text-muted-foreground">Carregando arquivos...</p>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12">
                <FolderOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || filter !== "all" 
                    ? "Nenhum arquivo encontrado."
                    : "Nenhum arquivo na biblioteca. Faça upload de um arquivo!"
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`
                      relative bg-gray-50 rounded-lg overflow-hidden border-2 cursor-pointer transition-all
                      ${selectedFile?.id === file.id 
                        ? "border-[#6a1b9a] ring-2 ring-[#6a1b9a]/30" 
                        : "border-transparent hover:border-gray-300"
                      }
                    `}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square flex items-center justify-center bg-gray-100">
                      {file.file_type === "image" ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="h-10 w-10 text-[#6a1b9a]" />
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
                    </div>

                    {/* Selected indicator */}
                    {selectedFile?.id === file.id && (
                      <div className="absolute top-2 right-2 bg-[#6a1b9a] rounded-full p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={handleClose} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!selectedFile}
              className="flex-1 sm:flex-none bg-[#FB8C00] hover:bg-[#FB8C00]/90 text-white"
            >
              Confirmar Seleção
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MediaSelectorModal;
