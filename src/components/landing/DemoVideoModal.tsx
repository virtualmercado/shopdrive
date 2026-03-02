import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface DemoVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  title?: string;
}

const DemoVideoModal = ({ isOpen, onClose, videoId, title }: DemoVideoModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 bg-black/90 border-none [&>button]:hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
        {title && (
          <p className="text-white text-center text-sm pt-4 px-4 font-medium">{title}</p>
        )}
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title || "Vídeo de demonstração"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemoVideoModal;
