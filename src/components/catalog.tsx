"use client";
import { useCallback, useState } from "react";
import { taskService, IS_DEMO } from "@/lib/client/service";
import { DEMO_STORAGE_KEY } from "@/lib/client/mock-service";
import { LEVELS } from "@/lib/client/model";
import { useResource } from "@/lib/client/use-resource";
import { Icon, TaskTile, LoadingState, ErrorNotice, EmptyState } from "./ui";
import styles from "./catalog.module.css";

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
  const topics = [
    "Все темы",
    ...new Set(tasks?.map((task) => task.topic || task.industry) ?? []),
  ];
  const filtered = (tasks ?? [])
    .filter(
      (task) =>
        (topic === "Все темы" || (task.topic || task.industry) === topic) &&
        (readiness === "all" || task.readinessLevel === readiness) &&
        `${task.title} ${task.contextAndNeed || task.initialDescription} ${task.industry}`
          .toLocaleLowerCase("ru")
          .includes(search.toLocaleLowerCase("ru")),
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
                <TaskTile task={task} business={business} key={task.id} />
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
