import { useEffect, useRef } from "react";
import loaderAsset from "@/assets/asclion-loader.mp4.asset.json";

type AsclionLoaderProps = {
  size?: "compact" | "section" | "page";
  label?: string;
  className?: string;
};

const sizeClasses = {
  compact: "w-20",
  section: "w-32 sm:w-40",
  page: "w-44 sm:w-56",
};

export default function AsclionLoader({
  size = "section",
  label = "Chargement en cours",
  className = "",
}: AsclionLoaderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = 1;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      video.pause();
      video.currentTime = 0;
      return;
    }

    void video.play().catch(() => undefined);
  }, []);

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <video
        ref={videoRef}
        src={loaderAsset.url}
        className={`${sizeClasses[size]} h-auto max-w-full object-contain`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}