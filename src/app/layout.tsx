import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SiteHeader, SiteFooter } from "@/components/site-shell";

export const metadata: Metadata = {
  title: {
    default: "Task Hub — от идеи к решению",
    template: "%s | Task Hub",
  },
  description:
    "Платформа подготовки, рейтинга и открытого выбора бизнес-задач.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ru"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main-content">
          Перейти к содержимому
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
