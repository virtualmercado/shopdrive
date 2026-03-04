import { useState, useEffect, useRef, useCallback } from "react";
import { Play } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMobile = useIsMobile();
  
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`;
  
  // Set initial thumbnail with quality optimization
  useEffect(() => {
    if (videoId) {
      // Start with maxresdefault for best quality
      setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`);
    }
  }, [videoId]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  // Reset to initial state when video ends or user wants to reset
  const handleReset = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Listen for YouTube API messages to detect video end
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        // YouTube sends state changes: 0 = ended, 1 = playing, 2 = paused
        if (data.event === "onStateChange" && data.info === 0) {
          handleReset();
        }
      } catch {
        // Ignore parse errors from non-YouTube messages
      }
    };

    if (isPlaying) {
      window.addEventListener("message", handleMessage);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isPlaying, handleReset]);

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

        {/* Video Container - Contained Width */}
        <div className="w-full max-w-5xl mx-auto">
          <div 
            className="relative w-full rounded-xl overflow-hidden shadow-lg bg-black/5"
            style={{ aspectRatio: '16 / 9' }}
            onMouseEnter={() => !isMobile && setIsHovered(true)}
            onMouseLeave={() => !isMobile && setIsHovered(false)}
          >
            {isPlaying ? (
              <>
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  title="Vídeo do YouTube da loja"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                  loading="lazy"
                />
                {/* Close/Reset button overlay */}
                <button
                  onClick={handleReset}
                  className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-all duration-200 opacity-0 hover:opacity-100 focus:opacity-100"
                  aria-label="Fechar vídeo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </>
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
                  onError={(e) => {
                    const currentSrc = (e.currentTarget as HTMLImageElement).src;
                    if (currentSrc.includes('maxresdefault')) {
                      setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/sddefault.jpg`);
                    } else if (currentSrc.includes('sddefault')) {
                      setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
                    }
                  }}
                />
                
            {/* Dark Overlay */}
                <div 
                  className="absolute inset-0 rounded-xl transition-all duration-300 ease-in-out"
                  style={{ 
                    background: isMobile 
                      ? 'rgba(0,0,0,0.35)' 
                      : isHovered 
                        ? 'rgba(0,0,0,0.45)' 
                        : 'rgba(0,0,0,0.35)'
                  }}
                />
                
                {/* Centered Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  {/* Play Button - white bg, red icon */}
                  <div 
                    className="rounded-full flex items-center justify-center transition-transform duration-300 ease-in-out"
                    style={{ 
                      width: isMobile ? 80 : 70,
                      height: isMobile ? 80 : 70,
                      backgroundColor: '#ffffff',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                      transform: !isMobile && isHovered ? 'scale(1.08)' : 'scale(1)',
                    }}
                  >
                    <Play 
                      className="ml-1"
                      style={{ 
                        width: isMobile ? 36 : 30, 
                        height: isMobile ? 36 : 30, 
                        color: '#FF0000', 
                        fill: '#FF0000' 
                      }} 
                    />
                  </div>
                  
                  {/* Text */}
                  <span 
                    className="text-white font-medium text-sm md:text-base transition-opacity duration-300"
                    style={{ 
                      textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                      opacity: isMobile || isHovered ? 1 : 0 
                    }}
                  >
                    Clique para assistir o vídeo
                  </span>
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
