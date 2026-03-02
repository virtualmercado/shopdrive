import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import DemoVideoModal from "./DemoVideoModal";

interface HeroContentLeftProps {
  badge: string;
  title: string;
  subtitle: string;
  buttonPrimary: string;
  buttonSecondary: string;
  infoText: string;
  demoVideo?: {
    url: string;
    title: string;
    behavior: "modal" | "new_tab";
    videoId: string | null;
  };
}

const HeroContentLeft = ({
  badge,
  title,
  subtitle,
  buttonPrimary,
  buttonSecondary,
  infoText,
  demoVideo,
}: HeroContentLeftProps) => {
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  const hasDemoVideo = demoVideo?.url && demoVideo.videoId;

  const handleDemoClick = () => {
    if (!demoVideo || !demoVideo.videoId) return;
    if (demoVideo.behavior === "new_tab") {
      window.open(demoVideo.url, "_blank");
    } else {
      setVideoModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Badge */}
      <Badge 
        variant="secondary" 
        className="text-sm px-4 py-2 bg-primary text-white border-none rounded-md"
      >
        {badge}
      </Badge>

      {/* Title */}
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
        {title}
      </h1>

      {/* Subtitle */}
      <p className="text-lg md:text-xl text-muted-foreground max-w-lg">
        {subtitle}
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <Button asChild size="lg" className="text-lg px-8 w-full sm:w-auto">
          <Link to="/register">{buttonPrimary}</Link>
        </Button>
        {hasDemoVideo && (
          <Button 
            variant="outline" 
            size="lg" 
            className="text-lg px-8 w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={handleDemoClick}
          >
            {buttonSecondary}
          </Button>
        )}
      </div>

      {/* Info Text */}
      <p className="text-2xl text-primary pt-2">
        {infoText}
      </p>

      {/* Video Modal */}
      {hasDemoVideo && demoVideo.videoId && (
        <DemoVideoModal
          isOpen={videoModalOpen}
          onClose={() => setVideoModalOpen(false)}
          videoId={demoVideo.videoId}
          title={demoVideo.title}
        />
      )}
    </div>
  );
};

export default HeroContentLeft;
