import { useState } from "react";
import { Play } from "lucide-react";

interface HomeVideoSectionProps {
  videoId: string;
  title?: string | null;
  description?: string | null;
  primaryColor?: string;
}

const HomeVideoSection = ({ 
  videoId, 
  title, 
  description,
  primaryColor = "#6a1b9a"
}: HomeVideoSectionProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  const handlePlay = () => {
    setIsPlaying(true);
  };

  return (
    <section className="w-full">
      <div className="space-y-4">
        {/* Title and Description */}
        {(title || description) && (
          <div className="text-center space-y-2">
            {title && (
              <h2 
                className="text-2xl md:text-3xl font-bold"
                style={{ color: primaryColor }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Video Container */}
        <div className="w-full max-w-4xl mx-auto">
          <div 
            className="relative w-full rounded-xl overflow-hidden shadow-lg bg-black/5"
            style={{ aspectRatio: '16 / 9' }}
          >
            {isPlaying ? (
              <iframe
                src={embedUrl}
                title="Vídeo do YouTube da loja"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                loading="lazy"
              />
            ) : (
              <button
                onClick={handlePlay}
                className="absolute inset-0 w-full h-full group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{ 
                  // @ts-ignore
                  '--tw-ring-color': primaryColor 
                }}
                aria-label="Reproduzir vídeo"
              >
                {/* Thumbnail */}
                <img 
                  src={thumbnailUrl} 
                  alt="Vídeo do YouTube da loja" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors duration-200" />
                
                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div 
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-xl transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: '#FF0000' }}
                  >
                    <Play className="w-7 h-7 md:w-9 md:h-9 text-white fill-white ml-1" />
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeVideoSection;
