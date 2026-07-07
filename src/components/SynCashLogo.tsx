import React from "react";

interface SynCashLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
}

export default function SynCashLogo({
  size = "md",
  showText = true,
  showSubtitle = true,
  className = ""
}: SynCashLogoProps) {
  // Determine dimensions based on size
  const dimensions = {
    sm: { symbolSize: 40, textSize: "text-lg", subtitleSize: "text-[10px]" },
    md: { symbolSize: 64, textSize: "text-2xl", subtitleSize: "text-xs" },
    lg: { symbolSize: 96, textSize: "text-3xl", subtitleSize: "text-sm" },
    xl: { symbolSize: 140, textSize: "text-4xl", subtitleSize: "text-base" }
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      {/* SVG Icon Logo symbol */}
      <svg
        width={dimensions.symbolSize}
        height={dimensions.symbolSize}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_4px_12px_rgba(212,175,55,0.15)] select-none"
      >
        <defs>
          {/* Rich Metallic Gold Gradient */}
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF099" />
            <stop offset="30%" stopColor="#D4AF37" />
            <stop offset="70%" stopColor="#AA7C11" />
            <stop offset="100%" stopColor="#F3E5AB" />
          </linearGradient>

          {/* Premium Platinum/Silver Gradient */}
          <linearGradient id="silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#E2E8F0" />
            <stop offset="70%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>

          {/* Golden glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Golden Upper S-Arc */}
        <path
          d="M170,45 C150,25 100,25 70,45 C40,65 42,105 75,120 C85,125 105,125 125,120 C110,123 90,121 82,115 C62,100 58,75 80,62 C95,52 135,52 150,65 L170,45 Z"
          fill="url(#gold-grad)"
        />

        {/* 2. Silver Lower S-Arc */}
        <path
          d="M70,155 C90,175 140,175 170,155 C200,135 198,95 165,80 C155,75 135,75 115,80 C130,77 150,79 158,85 C178,100 182,125 160,138 C145,148 105,148 90,135 L70,155 Z"
          fill="url(#silver-grad)"
        />

        {/* 3. Golden Bar Chart inside the Silver Loop */}
        {/* Left Bar (Small) */}
        <rect
          x="100"
          y="110"
          width="12"
          height="18"
          rx="2"
          fill="url(#gold-grad)"
        />
        {/* Middle Bar (Medium) */}
        <rect
          x="118"
          y="95"
          width="12"
          height="33"
          rx="2"
          fill="url(#gold-grad)"
        />
        {/* Right Bar (Large) */}
        <rect
          x="136"
          y="75"
          width="12"
          height="53"
          rx="2"
          fill="url(#gold-grad)"
        />
      </svg>

      {/* Brand Text */}
      {showText && (
        <div className="mt-4 select-none">
          <h2
            className={`font-sans tracking-[0.25em] font-extrabold uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-slate-100 to-amber-200 ${dimensions.textSize} leading-none`}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            — SYNCASH —
          </h2>

          {/* Thin elegant separator with center dot */}
          <div className="flex items-center justify-center gap-3 my-2.5 opacity-60">
            <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-amber-500/50"></div>
            <div className="w-1 h-1 rounded-full bg-amber-400"></div>
            <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-amber-500/50"></div>
          </div>

          {showSubtitle && (
            <p className={`font-medium tracking-wide text-amber-400/90 font-sans ${dimensions.subtitleSize}`}>
              יוצרים חיבורים. מקדמים עסקאות.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
