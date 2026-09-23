import type { ComponentProps, CSSProperties, ReactNode, SVGProps } from "react";
import Link from "next/link";
import Image from "next/image";
import type { TaskCard, TaskCardFields } from "@/shared/contracts";
import { taskCover } from "@/lib/client/task-artwork";
import artworkStyles from "./task-artwork.module.css";
import {
  FIELD_LABELS,
  levelFor,
  scoreBreakdown,
  type FieldKey,
} from "@/lib/client/model";

type IconName =
  | "arrow"
  | "arrowUp"
  | "check"
  | "plus"
  | "search"
  | "grid"
  | "list"
  | "chevron"
  | "chevronDown"
  | "back"
  | "users"
  | "clock"
  | "external"
  | "file"
  | "close"
  | "bolt";
const paths: Record<IconName, ReactNode> = {
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  arrowUp: <path d="M12 20V4m-6 6 6-6 6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: <path d="M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01" />,
  chevron: <path d="m8 4 8 8-8 8" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  back: <path d="M20 12H5m6-6-6 6 6 6" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H5v20h14V7Z M14 2v6h5M8 13h8M8 17h6" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  bolt: <path d="m13 2-9 12h7l-1 8L21 9h-8Z" />,
};
export function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
export function Select({ children, ...props }: ComponentProps<"select">) {
  return (
    <span className="select-control">
      <select {...props}>{children}</select>
      <Icon name="chevronDown" size={16} className="select-chevron" />
    </span>
  );
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
export function Badge({ score }: { score: number }) {
  const level = levelFor(score);
  return (
    <span className={`badge level-${level.key}`}>
      {level.label}
    </span>
  );
}
export function ScoreRing({
  score,
  small = false,
}: {
  score: number;
  small?: boolean;
}) {
  return (
    <div
      className={`score-ring ${small ? "small" : ""}`}
      style={{ "--score": `${score}%` } as CSSProperties}
    >
      <div>
        <strong>{score}</strong>
        {!small && <span>из 100</span>}
      </div>
    </div>
  );
}
export function ScorePanel({
  fields,
  confirmed,
  score,
  preview = false,
  showLevel = true,
  breakdown,
}: {
  fields: TaskCardFields;
  confirmed: FieldKey[];
  score: number;
  preview?: boolean;
  showLevel?: boolean;
  breakdown?: TaskCard["scoreBreakdown"];
}) {
  const rows = breakdown
    ? breakdown.map((row) => ({
        ...row,
        complete: row.earned === row.weight,
        missing: [...row.missingFields, ...row.unconfirmedFields],
      }))
    : scoreBreakdown(fields, confirmed);
  return (
    <aside className="panel score-panel">
      <div className="eyebrow">
        Готовность задачи {preview && <span>(предпросмотр)</span>}
      </div>
      <div className="score-hero">
        <ScoreRing score={score} />
        {showLevel && <Badge score={score} />}
      </div>
      <div className="score-rows">
        {rows.map((row) => (
          <div className="score-row" key={row.key}>
            <span className={row.complete ? "completed" : ""}>
              {row.complete ? (
                <Icon name="check" size={14} />
              ) : (
                <span className="empty-check" />
              )}
              {row.label}
            </span>
            <span>
              {row.earned}
              <span className="dim"> / {row.weight}</span>
            </span>
          </div>
        ))}
      </div>
      {rows.some((row) => !row.complete) ? (
        <div className="score-tip">
          <Icon name="file" />
          <p>
            Следующий шаг: заполните и подтвердите{" "}
            <strong>
              {rows
                .find((row) => !row.complete)
                ?.missing.map((key) => FIELD_LABELS[key].toLowerCase())
                .join(" и ")}
            </strong>
            .
          </p>
        </div>
      ) : (
        <div className="score-tip complete">
          <Icon name="check" />
          <p>
            Все сведения заполнены и подтверждены
          </p>
        </div>
      )}
    </aside>
  );
}
const industryStyles: Record<string, string> = {
  Ритейл: "coffee",
  Экология: "eco",
  Образование: "study",
  Логистика: "delivery",
  Сервисы: "ai",
};

function ArtworkCopy({ headline, description }: { headline: string; description?: string }) {
  return (
    <div className={artworkStyles.copy}>
      <strong className={artworkStyles.headline}>{headline}</strong>
      {description && <span className={artworkStyles.description}>{description}</span>}
    </div>
  );
}

export function TaskArtwork({
  task,
  compact = false,
  detail = false,
}: {
  task: Pick<TaskCard, "id" | "title" | "industry">;
  compact?: boolean;
  detail?: boolean;
}) {
  const { industry } = task;
  const cover = taskCover(task);
  if (cover) {
    return (
      <div aria-hidden="true" className={`task-art task-art-image cover-${cover.theme}`}>
        <Image
          src={cover.src}
          alt=""
          fill
          sizes={detail
            ? "(max-width: 760px) 100vw, 65vw"
            : "(max-width: 620px) 100vw, (max-width: 1100px) 50vw, 33vw"}
          className="task-cover-image"
        />
        {cover.headline && (
          <ArtworkCopy headline={cover.headline} description={cover.description} />
        )}
      </div>
    );
  }
  const theme = industryStyles[industry] ?? "ai";
  return (
    <div
      aria-hidden="true"
      className={`task-art art-${theme} ${compact ? "compact" : ""}`}
    >
      <div className="art-grid" />
      <div className="art-object">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <ArtworkCopy
        headline={
          {
            coffee: "Заказы\nбез очереди",
            eco: "Сбор\nвторсырья",
            study: "Учебные\nпроекты",
            delivery: "Маршруты\nдоставки",
            ai: "Рабочие\nпроцессы",
          }[theme] ?? "Рабочие\nпроцессы"
        }
      />
      <span className="art-plus">+</span>
    </div>
  );
}
export function getTaskTitle(task: Pick<TaskCard, "title">) {
  return task.title.trim() || "Задача без названия";
}

export function TaskTile({
  task,
  business = false,
  actions,
}: {
  task: TaskCard;
  business?: boolean;
  actions?: ReactNode;
}) {
  const taskHref = business && task.status !== "archived"
    ? `/business/tasks/${task.id}/edit`
    : `/tasks/${task.id}`;
  return (
    <article className="task-tile">
      <Link
        className="art-link"
        href={taskHref}
        tabIndex={-1}
        aria-hidden="true"
      >
        <TaskArtwork task={task} />
        <span className="art-arrow">
          <Icon name="arrow" />
        </span>
      </Link>
      <div className="tile-body">
        <div className="tile-top">
          <span className="overline">{task.industry}</span>
          <Badge score={task.score} />
        </div>
        <Link
          className="tile-title"
          href={taskHref}
        >
          <h2>{getTaskTitle(task)}</h2>
        </Link>
        <p className="tile-description">
          {task.contextAndNeed || task.initialDescription}
        </p>
        <div className="tile-bottom">
          <span className="tag">{task.topic || task.industry}</span>
          <span className="tile-score">
            <span className="tiny-track">
              <i style={{ width: `${task.score}%` }} />
            </span>
            {task.score}
            <span className="dim">/100</span>
          </span>
        </div>
        {business && (
          <div className="business-tile-actions">
            <span className={`status-label ${task.status}`}>
              {task.status === "published"
                ? "Опубликована"
                : task.status === "archived"
                  ? "В архиве"
                  : "Черновик"}
            </span>
            <Link href={`/business/tasks/${task.id}/proposals`}>
              Отклики <Icon name="arrow" size={15} />
            </Link>
          </div>
        )}
        {actions}
      </div>
    </article>
  );
}
export function LoadingState({
  label = "Загружаем данные…",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="btn btn-secondary btn-small" onClick={retry}>
          Попробовать снова
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name="search" size={24} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
