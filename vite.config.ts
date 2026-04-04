import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Plugin that resolves `figma:asset/HASH.ext` → `/HASH.ext` (public folder)
// This makes figma:asset imports work when building outside Figma Make (e.g. Vercel)
function figmaAssetPlugin() {
  return {
    name: 'figma-asset-resolver',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '');
        return `\0figma-asset:${filename}`;
      }
    },
    load(id: string) {
      if (id.startsWith('\0figma-asset:')) {
        const filename = id.replace('\0figma-asset:', '');
        // Resolves to the public folder URL at runtime
        return `export default "/${filename}";`;
      }
    },
  };
}

export default defineConfig({
  plugins: [
    figmaAssetPlugin(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})