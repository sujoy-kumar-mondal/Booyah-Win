import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, MessageSquareHeart, Swords, Gift, Sparkles, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.js';

interface BannerSlide {
  id: string;
  badge?: string;
  title: string;
  highlight: string;
  subtitle: string;
  ctaText: string;
  targetUrl: string;
  bgGradient: string;
  accentColor: string;
  icon: React.ReactNode;
}

export const BannerCarousel: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slides: BannerSlide[] = [
    {
      id: 'feedback',
      badge: 'COMMUNITY',
      title: language === 'bn' ? 'আপনার মতামত' : 'WE WANT YOUR',
      highlight: language === 'bn' ? 'আমাদের জানান' : 'FEEDBACK',
      subtitle:
        language === 'bn'
          ? 'আমাদের টুর্নামেন্ট অভিজ্ঞতা আরও উন্নত করতে রেটিং দিন'
          : 'Rate us & help us build India\'s best esports platform',
      ctaText: language === 'bn' ? 'ক্লিক করুন' : 'Click Here',
      targetUrl: '/support',
      bgGradient: 'from-amber-600/90 via-orange-600/80 to-sky-900/90',
      accentColor: 'from-amber-400 to-yellow-300',
      icon: <MessageSquareHeart className="h-6 w-6 text-amber-200" />,
    },
    {
      id: 'matches',
      badge: 'DAILY SCRIMS',
      title: language === 'bn' ? 'প্রতিদিনের টুর্নামেন্ট' : 'DAILY BATTLE',
      highlight: language === 'bn' ? 'খেলুন ও জিতুন' : 'ROYALE & CS',
      subtitle:
        language === 'bn'
          ? 'ফ্রি ফায়ার কাস্টম রুমে খেলুন এবং জিতে নিন আসল ক্যাশ'
          : 'Compete in Free Fire verified rooms with instant UPI payouts',
      ctaText: language === 'bn' ? 'ম্যাচ দেখুন' : 'Explore Matches',
      targetUrl: '/matches',
      bgGradient: 'from-violet-900/90 via-purple-900/80 to-slate-950',
      accentColor: 'from-violet-400 to-fuchsia-400',
      icon: <Swords className="h-6 w-6 text-violet-300" />,
    },
    {
      id: 'referral',
      badge: 'SPECIAL BONUS',
      title: language === 'bn' ? 'বন্ধুদের রেফার করুন' : 'REFER & EARN',
      highlight: language === 'bn' ? '₹১০ ক্যাশব্যাক' : '₹10 CASHBACK',
      subtitle:
        language === 'bn'
          ? 'প্রতিটি রেফারে পান অতিরিক্ত ক্যাশব্যাক বোনাস'
          : 'Invite your Free Fire squad and earn bonus rewards per invite',
      ctaText: language === 'bn' ? 'রেফার করুন' : 'Invite Squad',
      targetUrl: '/referral',
      bgGradient: 'from-emerald-900/90 via-teal-900/80 to-slate-950',
      accentColor: 'from-emerald-400 to-teal-300',
      icon: <Gift className="h-6 w-6 text-emerald-300" />,
    },
  ];

  // Auto-slide effect
  useEffect(() => {
    const startTimer = () => {
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
      }, 4500);
    };

    startTimer();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length]);

  const handleSlideChange = (index: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrentIndex(index);
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
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    } else if (isRightSwipe) {
      setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  const currentSlide = slides[currentIndex];

  return (
    <div className="relative w-full space-y-2.5">
      {/* Banner Container */}
      <div
        onClick={() => navigate(currentSlide.targetUrl)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-r ${currentSlide.bgGradient} p-4 sm:p-5 text-left shadow-xl cursor-pointer select-none transition-all duration-500 hover:border-slate-600 active:scale-[0.99]`}
      >
        {/* Subtle Background Glow Elements */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-black/30 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between min-h-[140px] sm:min-h-[155px]">
          {/* Top Star Rating & Badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
              <div className="flex items-center text-amber-300 gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber-300 text-amber-300" />
                ))}
              </div>
              <span className="text-[10px] font-bold text-amber-200 ml-1">5.0</span>
            </div>

            <div className="flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-200 border border-white/10">
              <Sparkles className="h-3 w-3 text-amber-300" />
              <span>{currentSlide.badge}</span>
            </div>
          </div>

          {/* Central Typography Header */}
          <div className="my-auto py-2">
            <h3 className="text-lg sm:text-xl font-black uppercase tracking-wide text-white drop-shadow-md leading-tight">
              {currentSlide.title}{' '}
              <span className={`block text-xl sm:text-2xl font-black bg-gradient-to-r ${currentSlide.accentColor} bg-clip-text text-transparent drop-shadow-sm`}>
                {currentSlide.highlight}
              </span>
            </h3>
            <p className="mt-1 text-xs text-slate-100/90 line-clamp-1 max-w-[85%] font-medium drop-shadow-sm">
              {currentSlide.subtitle}
            </p>
          </div>

          {/* Bottom Action Button */}
          <div className="flex items-center justify-between pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-3.5 py-1.5 text-xs font-black text-slate-950 shadow-md transition-all hover:scale-105 active:scale-95">
              <span>{currentSlide.ctaText}</span>
              <ChevronRight className="h-3.5 w-3.5 stroke-[3]" />
            </span>

            <span className="text-[10px] text-white/70 font-semibold tracking-wider">
              BOOYAH WIN
            </span>
          </div>
        </div>
      </div>

      {/* Indicator Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-0.5">
        {slides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => handleSlideChange(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 transition-all duration-300 ${
                isActive
                  ? 'w-6 rounded-full bg-violet-500 shadow-sm shadow-violet-500/50'
                  : 'w-1.5 rounded-full bg-slate-700 hover:bg-slate-600'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};
