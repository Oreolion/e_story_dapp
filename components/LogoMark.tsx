interface LogoMarkProps {
  size?: number;
  className?: string;
  variant?: "dark" | "light";
}

export function LogoMark({
  size = 32,
  className = "",
  variant = "dark",
}: LogoMarkProps) {
  if (variant === "light") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <linearGradient
            id="lLP"
            x1="88"
            y1="90"
            x2="18"
            y2="155"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#b07832" />
            <stop offset="35%" stopColor="#7c5cc0" />
            <stop offset="100%" stopColor="#4a2890" />
          </linearGradient>
          <linearGradient
            id="lRP"
            x1="92"
            y1="88"
            x2="168"
            y2="152"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#b07832" />
            <stop offset="30%" stopColor="#7c5cc0" />
            <stop offset="100%" stopColor="#4e2c98" />
          </linearGradient>
          <linearGradient
            id="lPen"
            x1="126"
            y1="78"
            x2="156"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#c49030" />
            <stop offset="100%" stopColor="#8a5a20" />
          </linearGradient>
          <linearGradient
            id="lSpine"
            x1="90"
            y1="80"
            x2="90"
            y2="158"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#c49030" />
            <stop offset="100%" stopColor="#8a5a20" />
          </linearGradient>
        </defs>
        {/* Left page */}
        <path
          d="M 22,76 Q 55,81 88,86 C 87,108 87,134 88,156 Q 55,153 22,152 Z"
          fill="url(#lLP)"
          opacity="1"
        />
        <path
          d="M 24,77 Q 55,81.5 86,86"
          stroke="rgba(255,255,255,.2)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 22,76 L 22,152"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 87,88 C 86,108 86,134 87,154"
          stroke="rgba(0,0,0,.12)"
          strokeWidth="1.8"
          fill="none"
        />
        {/* Right page */}
        <path
          d="M 92,86 Q 128,79 168,72 L 168,150 Q 128,153 92,156 Z"
          fill="url(#lRP)"
          opacity="1"
        />
        <path
          d="M 94,86 Q 130,79.5 166,73"
          stroke="rgba(255,255,255,.25)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M 93,88 C 94,108 94,134 93,154"
          stroke="rgba(0,0,0,.1)"
          strokeWidth="1.8"
          fill="none"
        />
        <path
          d="M 168,73 L 168,150"
          stroke="rgba(255,255,255,.12)"
          strokeWidth="1.5"
        />
        {/* Spine */}
        <line
          x1="90"
          y1="84"
          x2="90"
          y2="157"
          stroke="url(#lSpine)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Text lines left */}
        <line
          x1="32"
          y1="98"
          x2="78"
          y2="96"
          stroke="rgba(0,0,0,.08)"
          strokeWidth=".6"
          strokeLinecap="round"
        />
        <line
          x1="30"
          y1="108"
          x2="80"
          y2="106"
          stroke="rgba(0,0,0,.06)"
          strokeWidth=".6"
          strokeLinecap="round"
        />
        <path
          d="M 28,118 Q 45,116 55,118 Q 65,120 78,117"
          stroke="rgba(0,0,0,.05)"
          strokeWidth=".6"
          fill="none"
        />
        <line
          x1="32"
          y1="128"
          x2="75"
          y2="127"
          stroke="rgba(0,0,0,.04)"
          strokeWidth=".5"
        />
        {/* Wave lines right */}
        <path
          d="M 102,96 Q 118,93 130,96 Q 142,99 155,95"
          stroke="rgba(160,100,30,.15)"
          strokeWidth=".8"
          fill="none"
        />
        <path
          d="M 100,106 Q 115,102 128,106 Q 140,110 158,104"
          stroke="rgba(160,100,30,.12)"
          strokeWidth=".7"
          fill="none"
        />
        <path
          d="M 102,116 Q 120,113 132,117 Q 145,121 160,115"
          stroke="rgba(100,60,160,.08)"
          strokeWidth=".6"
          fill="none"
        />
        <path
          d="M 100,127 Q 115,124 126,127 Q 138,130 155,126"
          stroke="rgba(100,60,160,.06)"
          strokeWidth=".6"
          fill="none"
        />
        {/* Pen */}
        <path
          d="M 153,22 C 147,34 138,52 127.5,76 L 126,79 L 125.5,76.5 C 136,53 145,34 151,21 Z"
          fill="url(#lPen)"
        />
        <line
          x1="127"
          y1="75"
          x2="126.2"
          y2="78.5"
          stroke="rgba(100,60,20,.3)"
          strokeWidth=".3"
        />
        {/* Spark */}
        <circle cx="126" cy="79" r="8" fill="rgba(196,144,48,.2)" />
        <circle cx="126" cy="79" r="1.4" fill="#8a5a20" />
        {/* Bottom binding */}
        <path
          d="M 26,153 Q 55,158 90,157 Q 125,158 164,152"
          stroke="rgba(0,0,0,.04)"
          strokeWidth=".8"
          fill="none"
        />
      </svg>
    );
  }

  // Dark variant (default)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="dLP"
          x1="88"
          y1="90"
          x2="18"
          y2="155"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#c8923a" />
          <stop offset="35%" stopColor="#9878c8" />
          <stop offset="100%" stopColor="#5c35a8" />
        </linearGradient>
        <linearGradient
          id="dRP"
          x1="92"
          y1="88"
          x2="168"
          y2="152"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#c8923a" />
          <stop offset="30%" stopColor="#9878c8" />
          <stop offset="100%" stopColor="#6038b8" />
        </linearGradient>
        <linearGradient
          id="dPen"
          x1="126"
          y1="78"
          x2="156"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ecc054" />
          <stop offset="50%" stopColor="#d4a04a" />
          <stop offset="100%" stopColor="#a87830" />
        </linearGradient>
        <linearGradient
          id="dSpine"
          x1="90"
          y1="80"
          x2="90"
          y2="158"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#e8b84a" />
          <stop offset="100%" stopColor="#b8762a" />
        </linearGradient>
        <radialGradient
          id="dSpark"
          cx="126"
          cy="80"
          r="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#fff" stopOpacity=".95" />
          <stop offset="30%" stopColor="#ecc054" stopOpacity=".6" />
          <stop offset="100%" stopColor="#ecc054" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowSoft">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
        </filter>
        <filter id="pageShadow">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="#000"
            floodOpacity=".2"
          />
        </filter>
      </defs>

      {/* Ambient glow */}
      <ellipse
        cx="92"
        cy="120"
        rx="55"
        ry="40"
        fill="#d4a04a"
        opacity=".04"
        filter="url(#glowSoft)"
      />

      {/* Left page */}
      <path
        d="M 22,76 Q 55,81 88,86 C 87,108 87,134 88,156 Q 55,153 22,152 Z"
        fill="url(#dLP)"
        opacity="1"
        filter="url(#pageShadow)"
      />
      <path
        d="M 22,76 Q 55,81 88,86"
        stroke="rgba(255,255,255,.18)"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M 22,76 L 22,152"
        stroke="rgba(255,255,255,.1)"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M 87,88 C 86,108 86,134 87,154"
        stroke="rgba(0,0,0,.2)"
        strokeWidth="1.8"
        fill="none"
      />

      {/* Right page */}
      <path
        d="M 92,86 Q 128,79 168,72 L 168,150 Q 128,153 92,156 Z"
        fill="url(#dRP)"
        opacity="1"
        filter="url(#pageShadow)"
      />
      <path
        d="M 92,86 Q 130,79.5 168,72"
        stroke="rgba(255,255,255,.18)"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M 93,88 C 94,108 94,134 93,154"
        stroke="rgba(0,0,0,.18)"
        strokeWidth="1.8"
        fill="none"
      />
      <path
        d="M 168,73 L 168,150"
        stroke="rgba(255,255,255,.12)"
        strokeWidth="1.5"
      />

      {/* Spine */}
      <line
        x1="90"
        y1="84"
        x2="90"
        y2="157"
        stroke="url(#dSpine)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="90"
        y1="86"
        x2="90"
        y2="155"
        stroke="#e8b84a"
        strokeWidth="6"
        opacity=".08"
        filter="url(#glowSoft)"
      />

      {/* Text lines left (settled stories) */}
      <line
        x1="32"
        y1="98"
        x2="78"
        y2="96"
        stroke="rgba(255,255,255,.12)"
        strokeWidth=".7"
        strokeLinecap="round"
      />
      <line
        x1="30"
        y1="108"
        x2="80"
        y2="106"
        stroke="rgba(255,255,255,.10)"
        strokeWidth=".7"
        strokeLinecap="round"
      />
      <path
        d="M 28,118 Q 45,116 55,118 Q 65,120 78,117"
        stroke="rgba(255,255,255,.09)"
        strokeWidth=".7"
        fill="none"
        strokeLinecap="round"
      />
      <line
        x1="32"
        y1="128"
        x2="75"
        y2="127"
        stroke="rgba(255,255,255,.07)"
        strokeWidth=".6"
        strokeLinecap="round"
      />
      <line
        x1="30"
        y1="138"
        x2="72"
        y2="137"
        stroke="rgba(255,255,255,.06)"
        strokeWidth=".6"
        strokeLinecap="round"
      />

      {/* Wave lines right (voice being written) */}
      <path
        d="M 102,96 Q 118,93 130,96 Q 142,99 155,95"
        stroke="rgba(232,184,74,.22)"
        strokeWidth=".9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 100,106 Q 115,102 128,106 Q 140,110 158,104"
        stroke="rgba(232,184,74,.18)"
        strokeWidth=".8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 102,116 Q 120,113 132,117 Q 145,121 160,115"
        stroke="rgba(200,160,80,.14)"
        strokeWidth=".7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 100,127 Q 115,124 126,127 Q 138,130 155,126"
        stroke="rgba(155,120,200,.1)"
        strokeWidth=".7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 102,137 Q 118,134 130,137 Q 142,140 158,136"
        stroke="rgba(108,60,190,.08)"
        strokeWidth=".6"
        fill="none"
        strokeLinecap="round"
      />

      {/* Pen */}
      <line
        x1="128"
        y1="82"
        x2="148"
        y2="42"
        stroke="rgba(0,0,0,.08)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 153,22 C 147,34 138,52 127.5,76 L 126,79 L 125.5,76.5 C 136,53 145,34 151,21 Z"
        fill="url(#dPen)"
      />
      <path
        d="M 152,23 C 146,35 138,52 127,76"
        stroke="rgba(255,255,255,.15)"
        strokeWidth=".5"
        fill="none"
      />
      <line
        x1="127"
        y1="75"
        x2="126.2"
        y2="78.5"
        stroke="rgba(140,90,30,.4)"
        strokeWidth=".35"
      />

      {/* Spark */}
      <circle cx="126" cy="79" r="12" fill="url(#dSpark)" filter="url(#glow)" />
      <circle cx="126" cy="79" r="1.6" fill="#fff" />

      {/* Bottom binding */}
      <path
        d="M 26,153 Q 55,158 90,157 Q 125,158 164,152"
        stroke="rgba(255,255,255,.05)"
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
