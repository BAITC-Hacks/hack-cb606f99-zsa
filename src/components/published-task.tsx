"use client";

import { useCallback } from "react";
import Link from "next/link";
import { taskService } from "@/lib/client/service";
import { useResource } from "@/lib/client/use-resource";
import { ErrorNotice, Icon, LoadingState, getTaskTitle } from "./ui";

export function PublishedTask({ id }: { id: string }) {
  const load = useCallback(() => taskService.getTask(id), [id]);
  const { data: task, error, loading, retry } = useResource(load);
  return (
    <main id="main-content" className="container page-content">
      {loading ? (
        <LoadingState />
      ) : error || !task ? (
        <ErrorNotice message={error || "Задача не найдена."} retry={retry} />
      ) : task.status === "archived" ? (
        <div className="publish-success">
          <h1>Задача в архиве</h1>
          <p>«{getTaskTitle(task)}» закрыта для изменений и новых откликов. История сохранена.</p>
          <div className="action-row">
            <Link className="btn btn-secondary" href={`/tasks/${id}`}>
              Открыть карточку <Icon name="arrow" />
            </Link>
            <Link className="btn btn-secondary" href={`/business/tasks/${id}/proposals`}>
              История откликов
            </Link>
          </div>
        </div>
      ) : task.status === "draft" ? (
        <div className="publish-success">
          <h1>Это пока черновик</h1>
          <p>Проверьте карточку и подтвердите публикацию.</p>
          <Link className="btn btn-blue" href={`/business/tasks/${id}/edit`}>
            Открыть редактор <Icon name="arrow" />
          </Link>
        </div>
      ) : (
        <div className="publish-success">
          <span className="success-icon">
            <Icon name="check" size={35} />
          </span>
          <span className="eyebrow">ОПУБЛИКОВАНО</span>
          <h1>
            Ваша задача
            <br />
            <span>в каталоге</span>
          </h1>
          <p>
            «{getTaskTitle(task)}» доступна всем командам.
            <br />
            Рейтинг готовности — {task.score} из 100.
          </p>
          <div className="action-row">
            <Link className="btn btn-blue" href={`/tasks/${id}`}>
              Посмотреть как команда <Icon name="arrow" />
            </Link>
            <Link
              className="btn btn-secondary"
              href={`/business/tasks/${id}/proposals`}
            >
              Перейти к откликам
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
