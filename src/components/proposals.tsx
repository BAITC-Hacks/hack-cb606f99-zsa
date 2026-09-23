"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { taskService, ApiClientError } from "@/lib/client/service";
import { useResource } from "@/lib/client/use-resource";
import { errorMessage, safeLink } from "@/lib/client/model";
import { Icon, Badge, LoadingState, ErrorNotice, EmptyState, getTaskTitle } from "./ui";

const labels = {
  pending: "На рассмотрении",
  accepted: "Команда выбрана",
  rejected: "Отклонено",
};
export function Proposals({ id }: { id: string }) {
  const load = useCallback(async () => {
    const [task, proposals, teams, milestones] = await Promise.all([
      taskService.getTask(id),
      taskService.listProposals(id),
      taskService.listTeams(),
      taskService.supportsMilestones
        ? taskService.listMilestones(id)
        : Promise.resolve([]),
    ]);
    return { task, proposals, teams, milestones };
  }, [id]);
  const { data, loading, error, retry } = useResource(load);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState("");
  const guard = useRef(false);
  async function act(
    key: string,
    action: () => Promise<unknown>,
    message: string,
  ) {
    if (guard.current) return;
    guard.current = true;
    setBusy(key);
    setActionError("");
    setNotice("");
    try {
      await action();
      retry();
      setNotice(message);
    } catch (err) {
      setActionError(errorMessage(err));
      if (err instanceof ApiClientError &&
        ["TASK_ARCHIVED", "TASK_NOT_PUBLISHED"].includes(err.code)) retry();
    } finally {
      guard.current = false;
      setBusy("");
      setConfirming("");
    }
  }
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
        <Link className="text-link" href="/business">
          К моим задачам
        </Link>
      </main>
    );
  const { task, teams, proposals, milestones } = data;
  const filtered = proposals.filter(
    (proposal) => filter === "all" || proposal.status === filter,
  );
  return (
    <main id="main-content" className="container page-content proposals-page">
      <div className="page-title-row">
        <div>
          <h1>Предложения команд</h1>
          <p>
            Выберите подходящие команды
          </p>
        </div>
        <Link className="btn btn-secondary" href={`/tasks/${id}`}>
          Открыть задачу <Icon name="external" size={16} />
        </Link>
      </div>
      <div className="proposal-task-bar">
        <div>
          <Icon name="file" />
          <strong>{getTaskTitle(task)}</strong>
        </div>
        <Badge score={task.score} />
      </div>
      <div className="proposals-toolbar">
        <div className="topic-tabs">
          {[
            { key: "all", label: "Все отклики" },
            { key: "pending", label: "На рассмотрении" },
            { key: "accepted", label: "Выбранные" },
            { key: "rejected", label: "Отклонённые" },
          ].map((tab) => (
            <button
              key={tab.key}
              className={filter === tab.key ? "active" : ""}
              aria-pressed={filter === tab.key}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              <span>
                {tab.key === "all"
                  ? proposals.length
                  : proposals.filter((item) => item.status === tab.key).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      {actionError && <ErrorNotice message={actionError} />}
      {notice && (
        <div className="success-notice" role="status">
          <Icon name="check" />
          {notice}
        </div>
      )}
      <div className="proposal-list content-enter" key={filter}>
        {filtered.length ? (
          filtered.map((proposal) => {
            const team = teams.find((item) => item.id === proposal.teamId);
            const milestone = milestones.find(
              (item) => item.proposalId === proposal.id,
            );
            return (
              <article
                className={`panel proposal-card ${proposal.status}`}
                key={proposal.id}
              >
                <div className="proposal-card-header">
                  <div className="team-heading">
                    <span
                      className={`avatar ${team?.id === "orbit" ? "violet" : "blue"}`}
                    >
                      {team?.name.slice(0, 1) ?? "T"}
                    </span>
                    <div>
                      <h2>{team?.name ?? "Команда"}</h2>
                      <p>{team?.skills.join(", ")}</p>
                    </div>
                  </div>
                  <span className={`proposal-status ${proposal.status}`}>
                    {proposal.status === "accepted" && (
                      <Icon name="check" size={14} />
                    )}
                    {labels[proposal.status]}
                  </span>
                </div>
                <div className="proposal-copy">
                  <div>
                    <span className="eyebrow">ИДЕЯ РЕШЕНИЯ</span>
                    <p>{proposal.solutionIdea}</p>
                  </div>
                  <div>
                    <span className="eyebrow">ПЛАН РАБОТЫ</span>
                    <p>{proposal.plan}</p>
                  </div>
                </div>
                <div className="proposal-meta">
                  <span>
                    <Icon name="clock" size={16} />
                    {proposal.estimatedDuration}
                  </span>
                  {safeLink(proposal.prototypeUrl) && (
                    <a
                      href={safeLink(proposal.prototypeUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Посмотреть прототип <Icon name="external" size={14} />
                    </a>
                  )}
                  {taskService.supportsMilestones && (
                    <span className="muted">
                      Баллы команды: {team?.points ?? 0}
                    </span>
                  )}
                  {!!team?.technologies?.length && (
                    <span className="muted">
                      {team.technologies.join(", ")}
                    </span>
                  )}
                </div>
                {proposal.decisionComment && (
                  <p className="small-text muted">
                    Комментарий бизнеса: {proposal.decisionComment}
                  </p>
                )}
                {task.status === "archived" && (
                  <p className="small-text muted">
                    Задача в архиве. Решения доступны только для просмотра.
                  </p>
                )}
                <fieldset
                  className="proposal-actions"
                  disabled={task.status !== "published"}
                >
                  {proposal.status === "pending" ? (
                    <>
                      <div>
                        <button
                          className="btn btn-secondary btn-small"
                          disabled={!!busy}
                          onClick={() =>
                            void act(
                              proposal.id,
                              () =>
                                taskService.decideProposal(
                                  proposal.id,
                                  "rejected",
                                  proposal.decisionComment,
                                ),
                              "Предложение отклонено.",
                            )
                          }
                        >
                          Отклонить
                        </button>
                        <button
                          className="btn btn-blue btn-small"
                          disabled={!!busy}
                          onClick={() =>
                            void act(
                              proposal.id,
                              () =>
                                taskService.decideProposal(
                                  proposal.id,
                                  "accepted",
                                  proposal.decisionComment,
                                ),
                              `Команда ${team?.name ?? ""} выбрана`,
                            )
                          }
                        >
                          {busy === proposal.id ? (
                            <span className="spinner" />
                          ) : (
                            <Icon name="check" size={15} />
                          )}
                          Выбрать команду
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        className="text-link muted"
                        disabled={!!busy}
                        onClick={() =>
                          void act(
                            proposal.id,
                            () =>
                              taskService.decideProposal(
                                proposal.id,
                                proposal.status === "accepted"
                                  ? "rejected"
                                  : "accepted",
                                proposal.decisionComment,
                              ),
                            proposal.status === "accepted"
                              ? "Предложение отклонено."
                              : "Команда выбрана.",
                          )
                        }
                      >
                        {proposal.status === "accepted"
                          ? "Отклонить предложение"
                          : "Выбрать команду"}
                      </button>
                      {taskService.supportsMilestones &&
                        proposal.status === "accepted" &&
                        (milestone ? (
                          <span className="milestone-done">
                            <Icon name="check" size={15} />
                            Этап подтверждён: +{milestone.points} баллов
                          </span>
                        ) : confirming === proposal.id ? (
                          <div className="milestone-confirm">
                            <span>Прототип проверен бизнесом?</span>
                            <button
                              className="btn btn-blue btn-small"
                              disabled={!!busy}
                              onClick={() =>
                                void act(
                                  proposal.id,
                                  () =>
                                    taskService.confirmMilestone(proposal.id),
                                  "Прогресс подтверждён. Команде начислено 25 баллов.",
                                )
                              }
                            >
                              Да, подтвердить
                            </button>
                            <button
                              className="btn btn-ghost btn-small"
                              disabled={!!busy}
                              onClick={() => setConfirming("")}
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-secondary btn-small"
                            disabled={!!busy}
                            onClick={() => setConfirming(proposal.id)}
                          >
                            Подтвердить этап (+25 баллов)
                          </button>
                        ))}
                    </>
                  )}
                </fieldset>
              </article>
            );
          })
        ) : (
          <EmptyState
            title={
              proposals.length
                ? "Здесь пока нет откликов"
                : "На задачу пока никто не откликнулся"
            }
            description={
              proposals.length
                ? "Посмотрите другие вкладки"
                : "Отклики появятся здесь"
            }
          />
        )}
      </div>
    </main>
  );
}
