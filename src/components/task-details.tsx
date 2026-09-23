"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { taskService, ApiClientError } from "@/lib/client/service";
import { useResource } from "@/lib/client/use-resource";
import {
  FIELD_LABELS,
  errorMessage,
  type FieldKey,
  type ProposalInput,
} from "@/lib/client/model";
import {
  Icon,
  Badge,
  ScorePanel,
  TaskArtwork,
  LoadingState,
  ErrorNotice,
  EmptyState,
  getTaskTitle,
} from "./ui";

export function TaskDetails({ id }: { id: string }) {
  const load = useCallback(async () => {
    const [task, teams, proposals] = await Promise.all([
      taskService.getTask(id),
      taskService.listTeams(),
      taskService.listProposals(id),
    ]);
    return { task, teams, proposals };
  }, [id]);
  const { data, loading, error, retry } = useResource(load);
  const [form, setForm] = useState<ProposalInput>({
    teamId: "",
    solutionIdea: "",
    plan: "",
    estimatedDuration: "",
    prototypeUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [sent, setSent] = useState(false);
  const guard = useRef(false);
  const proposalForm = useRef<HTMLDivElement>(null);
  if (loading)
    return (
      <main id="main-content" className="container page-content">
        <LoadingState />
      </main>
    );
  if (error || !data)
    return (
      <main id="main-content" className="container page-content">
        <ErrorNotice message={error || "Задача не найдена"} retry={retry} />
        <Link className="text-link" href="/catalog">
          К каталогу
        </Link>
      </main>
    );
  const { task, teams, proposals } = data;
  const published = task.status === "published";
  const keys: FieldKey[] = [
    "contextAndNeed",
    "targetUsers",
    "expectedResult",
    "successCriteria",
    "dataAndMaterials",
    "constraints",
    "businessContact",
    "interactionFormat",
  ];
  function update(key: keyof ProposalInput, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  return (
    <main id="main-content" className="container page-content detail-page">
      <div className="detail-heading">
        <div>
          <div className="inline-meta">
            <span className="eyebrow">
              {[...new Set([task.industry, task.topic].filter(Boolean))].join(" / ")}
            </span>
            <Badge score={task.score} />
          </div>
          <h1>{getTaskTitle(task)}</h1>
          <div className="detail-meta">
            <span>
              <Icon name="users" size={16} />
              Откликов: {proposals.length}
            </span>
            <span>
              <Icon name="clock" size={16} />
              {new Date(task.createdAt).toLocaleDateString("ru-RU")}
            </span>
            <Link href={`/business/tasks/${task.id}/edit`}>
              Открыть как бизнес <Icon name="arrow" size={14} />
            </Link>
          </div>
        </div>
        <button
          className="btn btn-blue"
          disabled={!published || teams.length === 0}
          onClick={() => {
            proposalForm.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
            proposalForm.current
              ?.querySelector("select")
              ?.focus({ preventScroll: true });
          }}
        >
          Предложить решение <Icon name="arrow" />
        </button>
      </div>
      {!published && (
        <p className="demo-info">
          {task.status === "archived"
            ? "Задача в архиве. Новые отклики закрыты, история сохранена."
            : "Это неопубликованный черновик. Отклики станут доступны после публикации."}
        </p>
      )}
      <div className="detail-layout">
        <div>
          <TaskArtwork task={task} detail />
          <div className="detail-sections">
            {keys.map((key) => (
              <section key={key}>
                <div className="detail-field-title">
                  <h2>{FIELD_LABELS[key]}</h2>
                  {task.confirmedFields.includes(key) && (
                    <span>
                      <Icon name="check" size={13} />
                      Подтверждено
                    </span>
                  )}
                </div>
                <p className={!task[key] ? "muted" : ""}>
                  {task[key] || "Не указано"}
                </p>
              </section>
            ))}
          </div>
          <div
            className="panel form-panel proposal-form"
            ref={proposalForm}
            id="proposal"
          >
            {sent ? (
              <div className="proposal-success" role="status">
                <span className="success-icon">
                  <Icon name="check" size={26} />
                </span>
                <h2>Предложение отправлено</h2>
                <p>
                  Теперь бизнес сможет познакомиться с вашей идеей и принять
                  решение.
                </p>
                <Link
                  className="btn btn-blue"
                  href={`/business/tasks/${id}/proposals`}
                >
                  Посмотреть отклики как бизнес <Icon name="arrow" size={16} />
                </Link>
                <button
                  className="text-link muted"
                  onClick={() => {
                    setSent(false);
                    setForm({
                      ...form,
                      solutionIdea: "",
                      plan: "",
                      estimatedDuration: "",
                      prototypeUrl: "",
                    });
                  }}
                >
                  Отправить ещё одно предложение
                </button>
              </div>
            ) : teams.length === 0 ? (
              <EmptyState
                title="Команды пока не добавлены"
                description="Для отправки предложения нужен профиль команды. Обновите список после его добавления."
              >
                <button type="button" className="btn btn-secondary" onClick={retry}>
                  Обновить список команд
                </button>
              </EmptyState>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (guard.current) return;
                  guard.current = true;
                  setBusy(true);
                  setSubmitError("");
                  try {
                    await taskService.submitProposal(id, {
                      ...form,
                      teamId: form.teamId || teams[0]?.id || "",
                    });
                    setSent(true);
                    retry();
                  } catch (err) {
                    setSubmitError(errorMessage(err));
                    if (err instanceof ApiClientError &&
                      ["TASK_ARCHIVED", "TASK_NOT_PUBLISHED"].includes(err.code)) retry();
                  } finally {
                    setBusy(false);
                    guard.current = false;
                  }
                }}
              >
                <div className="form-section-title">
                  <div>
                    <h2>Предложите решение</h2>
                    <p>Укажите план работы, сроки и состав команды</p>
                  </div>
                </div>
                {submitError && <ErrorNotice message={submitError} />}
                <fieldset disabled={busy || !published}>
                  <label className="form-field">
                    Команда
                    <select
                      value={form.teamId || teams[0]?.id || ""}
                      onChange={(event) => update("teamId", event.target.value)}
                      required
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} / {team.skills.join(", ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    Идея решения
                    <textarea
                      rows={4}
                      maxLength={3000}
                      required
                      value={form.solutionIdea}
                      onChange={(event) =>
                        update("solutionIdea", event.target.value)
                      }
                      placeholder="Что вы предлагаете и почему это поможет?"
                    />
                  </label>
                  <label className="form-field">
                    План работы
                    <textarea
                      rows={4}
                      maxLength={3000}
                      required
                      value={form.plan}
                      onChange={(event) => update("plan", event.target.value)}
                      placeholder="Основные этапы: исследование, прототип, проверка…"
                    />
                  </label>
                  <div className="two-fields">
                    <label className="form-field">
                      Ожидаемый срок
                      <input
                        required
                        maxLength={120}
                        placeholder="Например, 2 недели"
                        value={form.estimatedDuration}
                        onChange={(event) =>
                          update("estimatedDuration", event.target.value)
                        }
                      />
                    </label>
                    <label className="form-field">
                      Ссылка на прототип{" "}
                      <span className="muted">(необязательно)</span>
                      <input
                        type="url"
                        pattern="https?://.+"
                        maxLength={1000}
                        placeholder="https://…"
                        value={form.prototypeUrl}
                        onChange={(event) =>
                          update("prototypeUrl", event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-blue">
                      {busy ? (
                        <span className="spinner" />
                      ) : (
                        <Icon name="arrow" size={16} />
                      )}
                      Отправить предложение
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
          </div>
        </div>
        <div className="detail-aside">
          <ScorePanel
            fields={task}
            confirmed={task.confirmedFields}
            score={task.score}
            breakdown={task.scoreBreakdown}
            showLevel={false}
          />
        </div>
      </div>
    </main>
  );
}
