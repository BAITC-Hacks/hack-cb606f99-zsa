"use client";
import { useRef, useState } from "react";
import { MILESTONE_POINTS, type Milestone } from "@/shared/contracts";
import { taskService } from "@/lib/client/service";
import { errorMessage, safeLink } from "@/lib/client/model";
import { ErrorNotice, Icon } from "./ui";

const labels: Record<Milestone["status"], string> = {
  planned: "Ожидает отчёта команды",
  submitted: "Отчёт на проверке бизнеса",
  changes_requested: "Нужна доработка",
  confirmed: "Подтверждён бизнесом",
};
const versionConflict = (error: unknown) =>
  !!error && typeof error === "object" && "code" in error && error.code === "VERSION_CONFLICT";

export function MilestonePanel({ taskId, proposalId, milestones, mode, disabled = false, onChanged }: {
  taskId: string;
  proposalId: string;
  milestones: Milestone[];
  mode: "business" | "team";
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [updates, setUpdates] = useState<Record<string, Milestone>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const guard = useRef(false);
  const records = new Map(milestones.map((item) => [item.id, item]));
  for (const update of Object.values(updates)) {
    if ((records.get(update.id)?.version ?? 0) <= update.version) records.set(update.id, update);
  }
  const visible = [...records.values()].filter((item) => item.proposalId === proposalId);
  function changed(milestone: Milestone) {
    setUpdates((previous) => ({ ...previous, [milestone.id]: milestone }));
    onChanged();
  }
  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      const current = await taskService.listMilestones(taskId);
      setUpdates(Object.fromEntries(current.map((item) => [item.id, item])));
      onChanged();
      return current;
    } catch (err) {
      setError(errorMessage(err));
      throw err;
    } finally { setRefreshing(false); }
  }
  return (
    <section aria-label="Этапы работы" style={{ marginTop: 24, display: "grid", gap: 20 }}>
      <div className="page-title-row">
        <div>
          <h3>Этапы работы</h3>
          <p className="small-text muted">Отчёт команды → проверка бизнеса → +{MILESTONE_POINTS} баллов. За создание и отправку баллы не начисляются.</p>
        </div>
        <button className="btn btn-ghost btn-small" disabled={refreshing || busy} onClick={() => void refresh().catch(() => {})}>
          {refreshing ? "Обновляем…" : "Обновить этапы"}
        </button>
      </div>
      {error && <ErrorNotice message={error} />}
      {notice && <p role="status" className="success-notice">{notice}</p>}
      {!visible.length && <p className="small-text muted">{mode === "business" ? "Добавьте первый этап с понятным результатом и условиями проверки." : "Бизнес ещё не добавил этапы для этого предложения."}</p>}
      {visible.map((milestone) => (
        <MilestoneWorkItem key={milestone.id} milestone={milestone} mode={mode} disabled={disabled}
          onChanged={changed} onRefresh={refresh} />
      ))}
      {mode === "business" && !disabled && (
        <form className="panel form-panel" onSubmit={async (event) => {
          event.preventDefault();
          if (guard.current) return;
          guard.current = true; setBusy(true); setError(""); setNotice("");
          try {
            const created = await taskService.createMilestone(proposalId, { title, description });
            changed(created); setTitle(""); setDescription("");
            setNotice("Этап создан. Теперь команда может отправить отчёт о выполнении.");
          } catch (err) { setError(errorMessage(err)); }
          finally { guard.current = false; setBusy(false); }
        }}>
          <fieldset disabled={busy}>
            <h4>Новый этап</h4>
            <label className="form-field">Название этапа
              <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, проверенный прототип" />
            </label>
            <label className="form-field">Результат и условия проверки этапа
              <textarea required maxLength={5000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что команда должна показать, чтобы бизнес подтвердил этап?" />
            </label>
            <button className="btn btn-secondary btn-small">{busy ? "Создаём…" : "Добавить этап"}</button>
          </fieldset>
        </form>
      )}
      {disabled && <p className="small-text muted">Этапы доступны только для просмотра: задача должна быть опубликована, а предложение — выбрано бизнесом.</p>}
    </section>
  );
}

function MilestoneWorkItem({ milestone, mode, disabled, onChanged, onRefresh }: {
  milestone: Milestone;
  mode: "business" | "team";
  disabled: boolean;
  onChanged: (milestone: Milestone) => void;
  onRefresh: () => Promise<Milestone[]>;
}) {
  const [report, setReport] = useState(milestone.report);
  const [evidenceUrl, setEvidenceUrl] = useState(milestone.evidenceUrl);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [draftEdited, setDraftEdited] = useState(false);
  const guard = useRef(false);
  async function act(action: () => Promise<Milestone>, success: string) {
    if (guard.current || conflict) return;
    guard.current = true; setBusy(true); setError(""); setNotice("");
    try { onChanged(await action()); setDraftEdited(false); setNotice(success); }
    catch (err) { setError(errorMessage(err)); setConflict(versionConflict(err)); }
    finally { guard.current = false; setBusy(false); }
  }
  const canSubmit = mode === "team" && (milestone.status === "planned" || milestone.status === "changes_requested");
  const canReview = mode === "business" && milestone.status === "submitted";
  return (
    <article className="panel form-panel" aria-label={`Этап: ${milestone.title}`}>
      <div className="proposal-card-header">
        <h4>{milestone.title}</h4>
        <span className={`proposal-status ${milestone.status === "confirmed" ? "accepted" : "pending"}`}>{labels[milestone.status]}</span>
      </div>
      <p style={{ whiteSpace: "pre-wrap", margin: "12px 0" }}>{milestone.description}</p>
      {milestone.report && <div className="detail-sections"><section><h4>Отчёт команды</h4><p>{milestone.report}</p>
        {safeLink(milestone.evidenceUrl) && <a className="text-link" href={safeLink(milestone.evidenceUrl)} target="_blank" rel="noopener noreferrer">Материалы выполнения <Icon name="external" size={14} /></a>}
      </section></div>}
      {milestone.reviewComment && <p className="demo-info">Комментарий бизнеса: {milestone.reviewComment}</p>}
      {milestone.status === "confirmed" && <p className="milestone-done"><Icon name="check" size={15} />Начислено +{milestone.points} баллов. Повторное начисление невозможно.</p>}
      {error && <ErrorNotice message={error} />}
      {notice && <p role="status" className="success-notice">{notice}</p>}
      {conflict && <div className="demo-info">
        <p>Ваш текст сохранён в форме. Обновите состояние этапа и проверьте его перед повторной отправкой.</p>
        <button className="btn btn-secondary btn-small" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await onRefresh(); setConflict(false); setError(""); setNotice("Состояние этапа обновлено. Ваши правки сохранены."); }
          catch (err) { setError(errorMessage(err)); }
          finally { setBusy(false); }
        }}>Обновить этап, сохранив мой текст</button>
      </div>}
      {draftEdited && ((mode === "team" && (!canSubmit || disabled)) || (mode === "business" && (!canReview || disabled))) && (
        <label className="form-field">Ваш несохранённый текст — можно скопировать
          <textarea readOnly rows={4} value={mode === "team" ? [report, evidenceUrl].filter(Boolean).join("\n") : comment} />
        </label>
      )}
      {canSubmit && !disabled && <form onSubmit={(event) => {
        event.preventDefault();
        void act(() => taskService.submitMilestone(milestone.id, { report, evidenceUrl, expectedVersion: milestone.version }), "Отчёт отправлен бизнесу. Баллы появятся после подтверждения.");
      }}>
        <fieldset disabled={busy || conflict}>
          <label className="form-field">Отчёт по этапу «{milestone.title}»
            <textarea required maxLength={5000} rows={4} value={report} onChange={(event) => { setReport(event.target.value); setDraftEdited(true); }} placeholder="Что выполнено и как проверить результат?" />
          </label>
          <label className="form-field">Ссылка на материалы выполнения · необязательно
            <input type="url" pattern="https?://.+" maxLength={2000} value={evidenceUrl} onChange={(event) => { setEvidenceUrl(event.target.value); setDraftEdited(true); }} placeholder="https://…" />
          </label>
          <button className="btn btn-blue btn-small">{busy ? "Отправляем…" : milestone.status === "changes_requested" ? "Отправить доработанный отчёт" : "Отправить отчёт на проверку"}</button>
        </fieldset>
      </form>}
      {canReview && !disabled && <fieldset disabled={busy || conflict}>
        <label className="form-field">Комментарий по этапу «{milestone.title}»
          <textarea maxLength={5000} rows={3} value={comment} onChange={(event) => { setComment(event.target.value); setDraftEdited(true); }} placeholder="Для возврата на доработку укажите, что нужно исправить." />
        </label>
        <div className="form-actions">
          <button className="btn btn-secondary btn-small" onClick={() => {
            if (!comment.trim()) { setError("Опишите, что нужно доработать."); return; }
            void act(() => taskService.reviewMilestone(milestone.id, { decision: "request_changes", comment, expectedVersion: milestone.version }), "Этап возвращён на доработку. Баллы не начислены.");
          }}>Вернуть на доработку</button>
          <button className="btn btn-blue btn-small" onClick={() => void act(
            () => taskService.reviewMilestone(milestone.id, { decision: "confirm", comment, expectedVersion: milestone.version }),
            `Этап подтверждён. Команде начислено ${milestone.points} баллов.`,
          )}>{busy ? "Сохраняем…" : `Подтвердить выполнение · +${milestone.points} баллов`}</button>
        </div>
      </fieldset>}
    </article>
  );
}
