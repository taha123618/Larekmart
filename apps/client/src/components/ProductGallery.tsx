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
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
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
              className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all p-1 bg-slate-50 shrink-0 ${
                activeUrl === item.url
                  ? "border-indigo-600 shadow-md scale-105"
                  : "border-slate-200/80 hover:border-slate-300 opacity-80 hover:opacity-100"
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
        className="relative w-full aspect-[3/4] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/80 flex items-center justify-center cursor-crosshair group shadow-xs"
        onMouseEnter={() => setIsZoomed(true)}
        onMouseLeave={() => setIsZoomed(false)}
        onMouseMove={handleMouseMove}
      >
        <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <ZoomIn className="w-3 h-3" />
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
            className="absolute inset-0 pointer-events-none bg-no-repeat bg-white transition-opacity"
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
