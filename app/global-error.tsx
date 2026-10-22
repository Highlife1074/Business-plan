"use client";

import "./globals.css";
import ErrorView from "@/components/ErrorView";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body>
        <ErrorView {...props} />
      </body>
    </html>
  );
}
