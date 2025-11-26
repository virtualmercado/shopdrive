interface StoreBannerProps {
  desktopBannerUrl?: string;
  mobileBannerUrl?: string;
}

const StoreBanner = ({ desktopBannerUrl, mobileBannerUrl }: StoreBannerProps) => {
  if (!desktopBannerUrl && !mobileBannerUrl) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Desktop/Tablet Banner */}
      {desktopBannerUrl && (
        <img
          src={desktopBannerUrl}
          alt="Banner principal"
          className="hidden md:block w-full h-64 lg:h-96 object-cover"
        />
      )}
      
      {/* Mobile Banner */}
      {mobileBannerUrl && (
        <img
          src={mobileBannerUrl}
          alt="Banner principal"
          className="md:hidden w-full h-48 object-cover"
        />
      )}
      
      {/* Fallback: use desktop banner on mobile if no mobile banner */}
      {!mobileBannerUrl && desktopBannerUrl && (
        <img
          src={desktopBannerUrl}
          alt="Banner principal"
          className="md:hidden w-full h-48 object-cover"
        />
      )}
    </div>
  );
};

export default StoreBanner;
