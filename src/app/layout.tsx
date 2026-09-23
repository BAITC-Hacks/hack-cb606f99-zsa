import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Sana Tasks",
    template: "%s | AI Sana Tasks",
  },
  description:
    "Платформа подготовки, рейтинга и открытого выбора бизнес-задач.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
