import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/tokens/index.ts" },
    outDir: "dist/tokens",
    format: ["esm"],
    dts: true,
    clean: false,
  },
  {
    entry: { index: "src/tailwind/index.ts" },
    outDir: "dist/tailwind",
    format: ["esm"],
    dts: true,
    clean: false,
  },
  {
    entry: { index: "src/react/index.ts" },
    outDir: "dist/react",
    format: ["esm"],
    dts: true,
    clean: false,
    external: ["react", "react-dom"],
  },
]);
