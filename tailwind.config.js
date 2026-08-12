/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0B0E13",
        surface: "#151A22",
        surfaceRaised: "#1C222C",
        accent: "#2F8FFF",
        accentSoft: "#7AB8FF",
        mist: "#F4F7FB",
        paper: "#FAFAF8",
        night: "#0B1120",
        panel: "#151A22",
        navy: "#0B0E13",
        navyDeep: "#0B0E13",
        gold: "#2F8FFF",
        goldSoft: "#7AB8FF",
        brandTeal: "#17C3A2",
        brandTealSoft: "#5EEAD4",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        tamil: ["Noto Sans Tamil", "Inter", "sans-serif"],
      },
      backgroundImage: {
        "blueprint-grid": "linear-gradient(rgba(47,143,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(47,143,255,0.05) 1px, transparent 1px)",
        "blueprint-grid-dark": "linear-gradient(rgba(47,143,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(47,143,255,0.07) 1px, transparent 1px)",
      },
      backgroundSize: {
        blueprint: "18px 18px",
      },
      keyframes: {
        blink: { "50%": { opacity: "0" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        blink: "blink 1s step-end infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
