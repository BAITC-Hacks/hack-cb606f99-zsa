import Link from "next/link";

const workspaces = [
  {
    href: "/business/new",
    title: "Конструктор задачи",
    description: "Черновик, AI-вопросы, карточка и подтверждение бизнеса.",
    owner: "Frontend + Backend",
  },
  {
    href: "/catalog",
    title: "Каталог задач",
    description: "Сортировка по рейтингу, фильтры и открытый выбор команды.",
    owner: "Frontend",
  },
  {
    href: "/tasks/demo-task",
    title: "Карточка задачи",
    description: "Описание задачи и отправка предложения студенческой команды.",
    owner: "Frontend + Backend",
  },
  {
    href: "/business/tasks/demo-task/proposals",
    title: "Отклики бизнеса",
    description: "Ручное принятие или отклонение предложений команд.",
    owner: "Frontend + Backend",
  },
] as const;

export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "AI Sana Tasks";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10 sm:px-10 lg:py-16">
      <header className="flex flex-col gap-6 rounded-3xl bg-brand px-7 py-9 text-white shadow-lg shadow-slate-300/40 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold tracking-[0.18em] text-blue-100 uppercase">
            HackAlem AI
          </span>
          <span className="rounded-full bg-white/12 px-3 py-1 text-sm text-blue-50">
            Каркас проекта готов
          </span>
        </div>
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {appName}
          </h1>
          <p className="text-lg leading-8 text-blue-50">
            MVP платформы, где бизнес улучшает описание задачи и её рейтинг,
            а студенческие команды самостоятельно выбирают задачи и отправляют
            предложения.
          </p>
        </div>
      </header>

      <section className="space-y-5">
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">
            Рабочие области
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">
            Точки параллельной разработки
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.href}
              href={workspace.href}
              className="group rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg hover:shadow-slate-200/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold group-hover:text-brand">
                    {workspace.title}
                  </h3>
                  <p className="mt-2 leading-7 text-muted">
                    {workspace.description}
                  </p>
                </div>
                <span aria-hidden="true" className="text-2xl text-brand">
                  →
                </span>
              </div>
              <p className="mt-5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {workspace.owner}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-6 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted">Frontend</p>
          <p className="mt-1 font-semibold">src/app · src/components</p>
        </div>
        <div>
          <p className="text-sm text-muted">Backend</p>
          <p className="mt-1 font-semibold">src/server · src/app/api</p>
        </div>
        <div>
          <p className="text-sm text-muted">Общие контракты</p>
          <p className="mt-1 font-semibold">src/shared</p>
        </div>
      </section>
    </main>
  );
}
