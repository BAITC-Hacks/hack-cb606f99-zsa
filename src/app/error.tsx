"use client";
import { ErrorNotice } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="container page-content">
      <h1>Не удалось открыть страницу</h1>
      <ErrorNotice message="Попробуйте загрузить её ещё раз." retry={reset} />
    </main>
  );
}
