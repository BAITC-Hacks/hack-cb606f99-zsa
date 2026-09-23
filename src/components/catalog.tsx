"use client";
import { useCallback, useRef, useState } from "react";
import { taskService, IS_DEMO, ApiClientError } from "@/lib/client/service";
import { DEMO_STORAGE_KEY } from "@/lib/client/mock-service";
import { LEVELS, errorMessage } from "@/lib/client/model";
import { useResource } from "@/lib/client/use-resource";
import type { TaskCard } from "@/shared/contracts";
import { Icon, TaskTile, LoadingState, ErrorNotice, EmptyState, getTaskTitle } from "./ui";
import styles from "./catalog.module.css";

function ArchiveTaskAction({
  task,
  onArchived,
  onRefresh,
}: {
  task: TaskCard;
  onArchived: (task: TaskCard) => void;
  onRefresh: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);

  async function archive() {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setError("");
    try {
      onArchived(await taskService.archiveTask(task.id, task.version));
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof ApiClientError &&
        ["VERSION_CONFLICT", "TASK_ARCHIVED", "TASK_NOT_PUBLISHED"].includes(err.code)) {
        setConfirming(false);
        onRefresh();
      }
    } finally {
      guard.current = false;
      setPending(false);
    }
  }

  return (
    <div className={confirming ? "publication-area" : undefined}>
      {error && <ErrorNotice message={error} />}
      {confirming ? (
        <>
          <p className="small-text muted">
            Убрать «{getTaskTitle(task)}» в архив? Задача исчезнет из каталога,
            изменения и новые отклики закроются. История сохранится.
            Восстановить задачу из архива нельзя.
          </p>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary btn-small" disabled={pending} onClick={() => void archive()}>
              {pending && <span className="spinner" />}
              {pending ? "Архивируем…" : "В архив"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => setConfirming(false)}>
              Отмена
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="text-link muted" onClick={() => { setError(""); setConfirming(true); }}>
          Архивировать
        </button>
      )}
    </div>
  );
}

export function Catalog({ business = false }: { business?: boolean }) {
  const load = useCallback(() => taskService.listTasks(business), [business]);
  const { data: tasks, loading, error, retry } = useResource(load);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("Все темы");
  const [readiness, setReadiness] = useState("all");
  const [sort, setSort] = useState("score");
  const [view, setView] = useState("grid");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState("");
  const [archivedTasks, setArchivedTasks] = useState<Record<string, TaskCard>>({});
  const [notice, setNotice] = useState("");
  const visibleTasks = (tasks ?? []).map((task) => archivedTasks[task.id] ?? task);
  const topics = [
    "Все темы",
    ...new Set(visibleTasks.map((task) => task.topic || task.industry)),
  ];
  const filtered = visibleTasks
    .filter(
      (task) =>
        (topic === "Все темы" || (task.topic || task.industry) === topic) &&
        (readiness === "all" || task.readinessLevel === readiness) &&
        [task.title, task.initialDescription, task.contextAndNeed, task.topic, task.industry]
          .join(" ")
          .toLocaleLowerCase("ru")
          .includes(search.trim().toLocaleLowerCase("ru")),
    )
    .sort((a, b) =>
      sort === "new"
        ? b.createdAt.localeCompare(a.createdAt)
        : b.score - a.score,
    );
  const clearFilters = () => {
    setSearch("");
    setTopic("Все темы");
    setReadiness("all");
  };
  return (
    <main id="main-content" className={`container page-content ${styles.catalog}`}>
      <div className="page-title-row">
        <div>
          <h1>{business ? "Ваши задачи" : "Каталог задач"}</h1>
          <p>
            {business
              ? "Черновики, публикации и отклики"
              : "Выберите задачу бизнеса и предложите решение"}
          </p>
        </div>
      </div>
      {!business && (
        <details className="catalog-rating-note">
          <summary>Как считается рейтинг</summary>
          <p>Баллы за заполненные и подтверждённые сведения. Откликнуться можно на задачу с любым рейтингом</p>
        </details>
      )}
      {IS_DEMO && business && (
        <p className="demo-info">
          Демо-кабинет одного бизнеса. Задачи и отклики доступны только в этом
          браузере.
        </p>
      )}
      {notice && <div className="success-notice" role="status"><Icon name="check" />{notice}</div>}
      <div className="filter-toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по задачам"
            aria-label="Поиск задач"
          />
        </label>
        <select
          aria-label="Уровень готовности"
          value={readiness}
          onChange={(event) => setReadiness(event.target.value)}
        >
          <option value="all">Любая готовность</option>
          {LEVELS.map((level) => (
            <option value={level.key} key={level.key}>
              {level.label} ({level.min}–{level.max})
            </option>
          ))}
        </select>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="score">Сначала готовые</option>
          <option value="new">Сначала новые</option>
        </select>
      </div>
      <div className="catalog-subtoolbar">
        <div className="topic-tabs" aria-label="Темы задач">
          {topics.map((item) => (
            <button
              className={item === topic ? "active" : ""}
              aria-pressed={item === topic}
              key={item}
              onClick={() => setTopic(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="view-controls">
          <button
            className={view === "grid" ? "active" : ""}
            aria-label="Сетка"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Icon name="grid" size={16} />
          </button>
          <button
            className={view === "list" ? "active" : ""}
            aria-label="Список"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <Icon name="list" size={18} />
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorNotice message={error} retry={retry} />
      ) : (
        <>
          <div className="result-meta">
            <span>Найдено: {filtered.length}</span>
          </div>
          {filtered.length ? (
            <div key={`${topic}:${readiness}:${sort}:${view}`} className={`task-grid motion-grid ${view === "list" ? "list-view" : ""}`}>
              {filtered.map((task) => (
                <TaskTile
                  task={task}
                  business={business}
                  key={task.id}
                  actions={business && task.status !== "archived" ? (
                    <ArchiveTaskAction
                      task={task}
                      onRefresh={retry}
                      onArchived={(archived) => {
                        setArchivedTasks((previous) => ({ ...previous, [archived.id]: archived }));
                        setNotice(`«${getTaskTitle(archived)}» в архиве`);
                        retry();
                      }}
                    />
                  ) : undefined}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Пока ничего не нашлось"
              description="Попробуйте другую тему или измените поисковый запрос."
            >
              <button className="btn btn-secondary" onClick={clearFilters}>
                Сбросить фильтры
              </button>
            </EmptyState>
          )}
        </>
      )}
      {business && IS_DEMO && (
        <div className="reset-area">
          {resetOpen ? (
            <>
              <p>
                Удалить ваши локальные демо-изменения и восстановить примеры?
              </p>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => {
                  try {
                    localStorage.removeItem(DEMO_STORAGE_KEY);
                    setResetOpen(false);
                    setResetError("");
                    setArchivedTasks({});
                    setNotice("");
                    retry();
                  } catch {
                    setResetError("Не удалось сбросить данные браузера.");
                  }
                }}
              >
                Да, восстановить примеры
              </button>
              <button
                className="btn btn-ghost btn-small"
                onClick={() => setResetOpen(false)}
              >
                Отмена
              </button>
            </>
          ) : (
            <button
              className="text-link muted"
              onClick={() => setResetOpen(true)}
            >
              Восстановить демо-данные
            </button>
          )}
          {resetError && <ErrorNotice message={resetError} />}
        </div>
      )}
    </main>
  );
}
