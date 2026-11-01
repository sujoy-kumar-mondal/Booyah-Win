import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Sparkles } from 'lucide-react';
import { fetchActiveBanners } from '../../api/banners.js';
import { resolveImageUrl } from '../../utils/imageUrl.js';
import type { BannerDto } from '@booyah/shared';

export const BannerCarousel: React.FC = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [banners, setBanners] = useState<BannerDto[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Safely fetch active banners without requiring an external QueryClientProvider
  useEffect(() => {
    let isMounted = true;
    fetchActiveBanners()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setBanners(data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const totalSlides = banners.length;
  const safeIndex = totalSlides > 0 ? currentIndex % totalSlides : 0;

  // Auto-slide effect when there are 2 or more banners
  useEffect(() => {
    if (totalSlides <= 1) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [totalSlides]);

  const handleSlideChange = (index: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrentIndex(index);
  };

  const handleNavigate = (url: string) => {
    if (!url) return;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url.startsWith('/') ? url : `/${url}`);
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || totalSlides <= 1) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    } else if (isRightSwipe) {
      setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    }
  };

  // If no banners configured by admin, do not render carousel
  if (totalSlides === 0) {
    return null;
  }

  const currentBanner = banners[safeIndex];

  return (
    <div className="relative w-full space-y-2.5" data-testid="banner-carousel">
      {/* Dynamic Custom Admin Banner Slide */}
      <div
        onClick={() => handleNavigate(currentBanner.targetUrl)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-900 shadow-xl cursor-pointer select-none transition-all duration-500 hover:border-slate-600 active:scale-[0.99] aspect-[16/7] w-full"
      >
        {failedImages[currentBanner.id] ? (
          <div className="w-full h-full bg-gradient-to-br from-violet-950 via-slate-900 to-indigo-950 flex flex-col justify-center items-center p-4 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600/30 border border-violet-500/40 text-violet-400 mb-2">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="text-sm font-black text-slate-100 tracking-wide">
              {currentBanner.title || 'Booyah Win'}
            </p>
          </div>
        ) : (
          <img
            src={resolveImageUrl(currentBanner.imageUrl)}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setFailedImages((prev) => ({ ...prev, [currentBanner.id]: true }))}
          />
        )}
        {currentBanner.title && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-3 sm:p-4 flex items-end justify-between">
            <span className="text-xs sm:text-sm font-bold text-white drop-shadow-md line-clamp-1">
              {currentBanner.title}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shrink-0 ml-2">
              <span>Open</span>
              <ChevronRight className="h-3 w-3 stroke-[3]" />
            </span>
          </div>
        )}
      </div>

      {/* Indicator Dots (Only if multiple banners) */}
      {totalSlides > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          {banners.map((banner, idx) => {
            const isActive = idx === safeIndex;
            return (
              <button
                key={banner.id}
                type="button"
                onClick={() => handleSlideChange(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 transition-all duration-300 ${
                  isActive
                    ? 'w-6 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    : 'w-1.5 rounded-full bg-slate-700 hover:bg-slate-600'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
