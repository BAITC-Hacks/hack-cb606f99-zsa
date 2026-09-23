import Link from "next/link";

type FeaturePlaceholderProps = {
  title: string;
  description: string;
  owner: "Frontend" | "Backend" | "Frontend + Backend";
  nextSteps: readonly string[];
};

export function FeaturePlaceholder({
  title,
  description,
  owner,
  nextSteps,
}: FeaturePlaceholderProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12 sm:px-10">
      <Link href="/" className="w-fit text-sm font-semibold text-brand hover:underline">
        ← На главную
      </Link>
      <section className="rounded-3xl border border-border bg-surface p-7 shadow-sm sm:p-10">
        <p className="text-sm font-semibold tracking-wide text-brand uppercase">
          Владелец: {owner}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
          {description}
        </p>
        <div className="mt-8 border-t border-border pt-6">
          <h2 className="font-bold">Следующие шаги</h2>
          <ul className="mt-4 space-y-3 text-muted">
            {nextSteps.map((step) => (
              <li key={step} className="flex gap-3">
                <span className="font-bold text-brand">•</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
