import type { CSSProperties, ReactNode, SVGProps } from "react";
import Link from "next/link";
import type { TaskCard, TaskCardFields } from "@/shared/contracts";
import {
  FIELD_LABELS,
  levelFor,
  scoreBreakdown,
  type FieldKey,
} from "@/lib/client/model";

type IconName =
  | "arrow"
  | "arrowUp"
  | "spark"
  | "check"
  | "plus"
  | "search"
  | "grid"
  | "list"
  | "chevron"
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
  spark: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
      <path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5Z" />
    </>
  ),
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
      <span className="dot" />
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
  breakdown,
}: {
  fields: TaskCardFields;
  confirmed: FieldKey[];
  score: number;
  preview?: boolean;
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
        Готовность задачи {preview && <span>· предпросмотр</span>}
      </div>
      <div className="score-hero">
        <ScoreRing score={score} />
        <Badge score={score} />
      </div>
      <p className="muted small-text">
        Чем понятнее задача, тем выше её позиция в каталоге.
      </p>
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
          <Icon name="spark" />
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
            Все сведения подтверждены. Команды могут сразу приступить к
            обсуждению.
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
export function TaskArtwork({
  industry,
  compact = false,
}: {
  industry: string;
  compact?: boolean;
}) {
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
      <span className="art-word">
        {
          {
            coffee: "less waiting.\nmore coffee.",
            eco: "a greener\neveryday.",
            study: "learn.\ncreate. repeat.",
            delivery: "make\nyour move.",
            ai: "a little\nmore human.",
          }[theme]
        }
      </span>
      <span className="art-caption">TASK HUB / {industry.toUpperCase()}</span>
      <span className="art-plus">+</span>
    </div>
  );
}
export function TaskTile({
  task,
  business = false,
}: {
  task: TaskCard;
  business?: boolean;
}) {
  return (
    <article className="task-tile">
      <Link
        className="art-link"
        href={
          business ? `/business/tasks/${task.id}/edit` : `/tasks/${task.id}`
        }
        tabIndex={-1}
        aria-hidden="true"
      >
        <TaskArtwork industry={task.industry} />
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
          href={
            business ? `/business/tasks/${task.id}/edit` : `/tasks/${task.id}`
          }
        >
          {task.title}
        </Link>
        <p className="tile-description">{task.contextAndNeed}</p>
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
