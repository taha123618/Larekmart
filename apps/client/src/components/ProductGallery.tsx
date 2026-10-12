"use client";

import { useState, useEffect } from "react";
import MediaImage from "./MediaImage";
import { ZoomIn } from "lucide-react";

interface ProductGalleryProps {
  images: Record<string, string> | string[] | undefined;
  productName: string;
  selectedColor?: string;
  onColorSelect?: (color: string) => void;
}

export default function ProductGallery({
  images,
  productName,
  selectedColor,
  onColorSelect,
}: ProductGalleryProps) {
  // Normalize images into a list of { color, url }
  const imageList: Array<{ color?: string; url: string }> = [];

  if (images && typeof images === "object" && !Array.isArray(images)) {
    Object.entries(images).forEach(([color, url]) => {
      if (url) imageList.push({ color, url });
    });
  } else if (Array.isArray(images)) {
    images.forEach((url) => {
      if (url) imageList.push({ url });
    });
  }

  // Active image fallback
  const initialImage =
    (selectedColor &&
      images &&
      typeof images === "object" &&
      !Array.isArray(images) &&
      images[selectedColor]) ||
    imageList[0]?.url ||
    "/placeholder.png";

  const [activeUrl, setActiveUrl] = useState<string>(initialImage);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (
      selectedColor &&
      images &&
      typeof images === "object" &&
      !Array.isArray(images) &&
      images[selectedColor]
    ) {
      setActiveUrl(images[selectedColor]);
    }
  }, [selectedColor, images]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top, width, height } =
      e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  const handleThumbnailClick = (item: { color?: string; url: string }) => {
    setActiveUrl(item.url);
    if (item.color && onColorSelect) {
      onColorSelect(item.color);
    }
  };

  return (
    <div className="flex flex-col-reverse md:flex-row gap-4 items-start w-full">
      {/* Thumbnails Strip */}
      {imageList.length > 1 && (
        <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto max-h-[460px] no-scrollbar shrink-0">
          {imageList.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleThumbnailClick(item)}
              className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all p-1 bg-white dark:bg-slate-900/80 shrink-0 cursor-pointer ${
                activeUrl === item.url
                  ? "border-indigo-600 ring-2 ring-indigo-500/50 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 shadow-md scale-105"
                  : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100"
              }`}
            >
              <MediaImage
                src={item.url}
                alt={`${productName} thumbnail ${idx + 1}`}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      )}

      {/* Main Large Image Viewer with Interactive Zoom */}
      <div
        className="relative w-full aspect-[3/4] bg-white dark:bg-slate-950/70 dark:backdrop-blur-md rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center cursor-crosshair group shadow-xs dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      >
        <div className="absolute top-3.5 right-3.5 z-10 px-2.5 py-1 rounded-full bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10 shadow-sm">
          <ZoomIn className="w-3 h-3 text-indigo-400" />
          <span>Hover to Zoom</span>
        </div>

        <MediaImage
          src={activeUrl}
          alt={productName}
          className={`w-full h-full object-contain p-6 transition-transform duration-300 ${
            isZoomed ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Zoomed Lens Layer */}
        {isZoomed && (
          <div
            className="absolute inset-0 pointer-events-none bg-no-repeat bg-white dark:bg-slate-950 transition-opacity"
            style={{
              backgroundImage: `url(${activeUrl})`,
              backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
              backgroundSize: "220%",
            }}
          />
        )}
      </div>
    </div>
  );
}
