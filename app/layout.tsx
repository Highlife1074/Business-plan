import type { Metadata, Viewport } from "next";
import "./globals.css";
import CloudProvider from "@/components/CloudProvider";

// Chemin de publication (GitHub Pages : /Business-plan) pour les fichiers de /public
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Simulateur de business plan",
  description: "Business plans simulés avec Claude : rentabilité, trésorerie, juridique, SWOT et devis.",
  // Installable sur l'écran d'accueil Android (plein écran, icône de l'app)
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: `${base}/apple-touch-icon.png`,
  },
  appleWebApp: { capable: true, title: "Business Plan", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // occupe tout l'écran (bords incurvés, caméra) ; marges via env(safe-area-inset-*)
  interactiveWidget: "resizes-content", // le clavier Android réduit la page au lieu de masquer le champ
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#12161c" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <CloudProvider>{children}</CloudProvider>
      </body>
    </html>
  );
}
