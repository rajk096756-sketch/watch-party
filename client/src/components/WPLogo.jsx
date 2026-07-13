import React from 'react';

/**
 * WPLogo — the Watch Party brand mark.
 * Stylised "WP": W with an integrated play-triangle (purple→violet gradient)
 * + P with a chat-bubble bowl (cyan gradient) + three dots.
 *
 * Props:
 *   size   — pixel size of the square container (default 40)
 *   className — extra classes on the outer <div>
 */
export default function WPLogo({ size = 40, className = '' }) {
  return (
    <div
      className={`flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Watch Party logo"
        role="img"
      >
        <defs>
          {/* Purple → violet for W */}
          <linearGradient id="wpW" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c026d3" />
            <stop offset="50%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          {/* Cyan for P */}
          <linearGradient id="wpP" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
          {/* Full brand gradient (W+P together) */}
          <linearGradient id="wpFull" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="60%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>

        {/* ── W shape ── */}
        <polyline
          points="6,20 19,68 33,40 47,68 60,20"
          fill="none"
          stroke="url(#wpW)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Play triangle integrated in W's centre V */}
        <polygon points="27,46 27,62 43,54" fill="#9333ea" />

        {/* ── P stem ── */}
        <line
          x1="65" y1="20" x2="65" y2="78"
          stroke="url(#wpP)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* P bowl — chat-bubble shape with a small tail */}
        <path
          d="M65 20 Q65 11 74 11 L86 11 Q95 11 95 24 Q95 38 86 38 L65 38"
          fill="none"
          stroke="url(#wpP)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Tail of chat bubble pointing bottom-left */}
        <path
          d="M70 38 L65 46 L78 38"
          fill="#06b6d4"
        />

        {/* Three dots inside P bowl */}
        <circle cx="74" cy="25" r="2.8" fill="white" opacity="0.9" />
        <circle cx="81" cy="25" r="2.8" fill="white" opacity="0.9" />
        <circle cx="88" cy="25" r="2.8" fill="white" opacity="0.9" />
      </svg>
    </div>
  );
}
