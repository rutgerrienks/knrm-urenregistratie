/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // KNRM huisstijl: officieel reddingoranje (#F58220) + diep marineblauw.
        knrm: {
          orange: "#F58220",
          "orange-dark": "#D96E12",
          "orange-light": "#FBA04E",
          navy: "#121B21",
          "navy-light": "#1E2C36",
          sky: "#EAF1F4",
          sand: "#FBF8F4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,41,60,0.08), 0 8px 24px rgba(0,41,60,0.06)",
      },
    },
  },
  plugins: [],
};
