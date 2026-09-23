"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  TaskCard,
  TaskCardFields,
  AnalyzeDraftResponse,
  AiMetadata,
} from "@/shared/contracts";
import { taskService, IS_DEMO, ApiClientError } from "@/lib/client/service";
import { useResource } from "@/lib/client/use-resource";
import {
  EMPTY_FIELDS,
  FIELD_LABELS,
  INDUSTRIES,
  fieldsOnly,
  scorePreview,
  errorMessage,
  type FieldKey,
} from "@/lib/client/model";
import {
  DEMO_ANSWERS,
  DEMO_DESCRIPTION,
  DRAFT_EXAMPLES,
} from "@/lib/client/seeds";
import { Icon, ScorePanel, LoadingState, ErrorNotice } from "./ui";

export function EditTask({ id }: { id: string }) {
  const load = useCallback(() => taskService.getTask(id), [id]);
  const { data, loading, error, retry } = useResource(load);
  if (loading)
    return (
      <main id="main-content" className="container page-content">
        <LoadingState />
      </main>
    );
  if (error || !data)
    return (
      <main id="main-content" className="container page-content">
        <ErrorNotice message={error || "Задача не найдена."} retry={retry} />
        <Link className="text-link" href="/business">
          К моим задачам
        </Link>
      </main>
    );
  if (data.status === "archived")
    return (
      <main id="main-content" className="container page-content">
        <h1>Задача в архиве</h1>
        <p className="muted">
          Карточка и история откликов доступны для просмотра.
        </p>
        <Link className="btn btn-secondary" href={`/tasks/${data.id}`}>
          Посмотреть карточку <Icon name="arrow" />
        </Link>
      </main>
    );
  return <TaskBuilder key={data.id} initialTask={data} />;
}

export function TaskBuilder({ initialTask }: { initialTask?: TaskCard }) {
  const router = useRouter();
  const [step, setStep] = useState(initialTask ? 2 : 0);
  const [description, setDescription] = useState(
    initialTask?.initialDescription ?? "",
  );
  const [industry, setIndustry] = useState(initialTask?.industry ?? "Ритейл");
  const [questions, setQuestions] = useState<AnalyzeDraftResponse["questions"]>(
    [],
  );
  const [answers, setAnswers] = useState<Partial<Record<FieldKey, string>>>({});
  const [fields, setFields] = useState<TaskCardFields>(
    initialTask ? fieldsOnly(initialTask) : EMPTY_FIELDS,
  );
  const [confirmed, setConfirmed] = useState<FieldKey[]>(
    initialTask?.confirmedFields ?? [],
  );
  const [savedTask, setSavedTask] = useState<TaskCard | undefined>(initialTask);
  const [dirty, setDirty] = useState(!initialTask);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);
  const [aiMetadata, setAiMetadata] = useState<AiMetadata | null>(null);
  const [conflict, setConflict] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const requestInFlight = useRef(false);
  useEffect(() => {
    if (initialTask) return;
    try {
      const draft = sessionStorage.getItem("sana-start-description");
      if (draft) {
        queueMicrotask(() => setDescription(draft));
        sessionStorage.removeItem("sana-start-description");
      }
    } catch {
      // The form remains usable when browser storage is disabled.
    }
  }, [initialTask]);
  useEffect(() => {
    if (step > 0) {
      heading.current?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [step]);
  useEffect(() => {
    if (!dirty || (!description && !fields.title)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, description, fields.title]);
  async function perform(label: string, action: () => Promise<void>) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
      if (
        err instanceof ApiClientError &&
        (err.code === "VERSION_CONFLICT" || err.code === "TASK_ARCHIVED")
      )
        setConflict(true);
    } finally {
      setBusy("");
      requestInFlight.current = false;
    }
  }
  function updateField(key: FieldKey, value: string) {
    setFields((previous) => ({ ...previous, [key]: value }));
    setConfirmed((previous) => previous.filter((item) => item !== key));
    setDirty(true);
    setPublishConsent(false);
    setNotice("");
  }
  async function save() {
    const result = await taskService.saveTask(
      {
        fields,
        confirmedFields: confirmed,
        expectedVersion: savedTask?.version,
      },
      savedTask?.id,
    );
    setSavedTask(result);
    setFields(fieldsOnly(result));
    setConfirmed(result.confirmedFields);
    setDirty(false);
    return result;
  }
  const score =
    !dirty && savedTask ? savedTask.score : scorePreview(fields, confirmed);
  const scoredFields: FieldKey[] = [
    "contextAndNeed",
    "targetUsers",
    "dataAndMaterials",
    "expectedResult",
    "successCriteria",
    "constraints",
    "businessContact",
    "interactionFormat",
  ];
  const canSave =
    !conflict &&
    fields.title.trim() &&
    fields.initialDescription.trim().length >= 10;
  const steps = ["Ваша идея", "Уточнения", "Карточка задачи"];
  return (
    <main id="main-content" className="container page-content builder-page">
      <div className="builder-heading">
        <div>
          {!initialTask && <span className="eyebrow">НОВАЯ ЗАДАЧА</span>}
          <h1 ref={heading} tabIndex={-1}>
            {initialTask ? "Редактирование задачи" : "Опишите задачу"}
          </h1>
          <p>Укажите проблему, ожидаемый результат и условия работы</p>
        </div>
        <span className="private-label">
          <Icon name="file" size={15} />
          {savedTask?.status === "published"
            ? "Задача опубликована"
            : "Черновик"}
        </span>
      </div>
      <ol className="stepper">
        {steps.map((label, index) => (
          <li
            className={step === index ? "active" : step > index ? "done" : ""}
            key={label}
          >
            <span>
              {step > index ? <Icon name="check" size={14} /> : `0${index + 1}`}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <div className={`builder-layout ${step === 2 ? "editing" : ""}`}>
        <div className="builder-main">
          {error && <ErrorNotice message={error} />}
          {aiMetadata?.warning && (
            <div className="ai-warning" role="status">
              {aiMetadata.warning}
            </div>
          )}
          {conflict && savedTask && (
            <div className="conflict-notice" role="alert">
              <p>
                Карточка на сервере изменилась. Ваш текст остался в форме:
                скопируйте нужные правки перед загрузкой актуальной версии.
              </p>
              <button
                className="btn btn-secondary btn-small"
                disabled={!!busy}
                onClick={() =>
                  void perform("Загружаем…", async () => {
                    const latest = await taskService.getTask(savedTask.id);
                    setSavedTask(latest);
                    setFields(fieldsOnly(latest));
                    setConfirmed(latest.confirmedFields);
                    setDescription(latest.initialDescription);
                    setDirty(false);
                    setConflict(false);
                    setPublishConsent(false);
                    setNotice(
                      latest.status === "archived"
                        ? "Задача перемещена в архив и доступна только для чтения."
                        : "Загружена актуальная версия. Можно повторно внести правки.",
                    );
                  })
                }
              >
                Заменить мои правки версией сервера
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="success-notice">
              <Icon name="check" />
              {notice}
            </div>
          )}
          {step === 0 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform("Анализируем описание…", async () => {
                  const result = await taskService.analyze(description);
                  setQuestions(result.questions);
                  setAiMetadata(result.ai);
                  setStep(1);
                });
              }}
            >
              <fieldset className="panel form-panel" disabled={!!busy}>
                <label className="field-label" htmlFor="description">
                  Опишите потребность или проблему
                </label>
                <textarea
                  id="description"
                  className="description-input"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    setDirty(true);
                  }}
                  placeholder="Например: у нас кофейня. По утрам длинные очереди, хотим сократить время ожидания…"
                  minLength={10}
                  maxLength={4000}
                  required
                />
                <div className="input-hint">
                  <span>Что происходит сейчас и что хотелось бы изменить?</span>
                  <span>{description.length} / 4000</span>
                </div>
                <label className="field-label" htmlFor="industry">
                  Отрасль
                </label>
                <select
                  id="industry"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                >
                  {INDUSTRIES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <div className="example-area">
                  <span className="small-text muted">
                    Или начните с примера
                  </span>
                  <div className="suggestion-chips">
                    {DRAFT_EXAMPLES.map((example) => (
                      <button
                        type="button"
                        key={example.label}
                        onClick={() => {
                          setDescription(example.text);
                          setIndustry(example.industry);
                          setAnswers({});
                          setDirty(true);
                        }}
                      >
                        {example.label}
                        <Icon name="plus" size={12} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-actions">
                  <span className="small-text muted">
                    {IS_DEMO
                      ? "Деморежим: вопросы по шаблону"
                      : "Далее — уточняющие вопросы"}
                  </span>
                  <button
                    className="btn btn-blue"
                    disabled={!!busy || description.trim().length < 10}
                  >
                    {busy ? (
                      <>
                        <span className="spinner" />
                        {busy}
                      </>
                    ) : (
                      <>
                        Продолжить <Icon name="arrow" size={16} />
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  className="text-link muted manual-entry"
                  disabled={!!busy || description.trim().length < 10}
                  onClick={() => {
                    setFields({
                      ...EMPTY_FIELDS,
                      title: description.trim().slice(0, 180),
                      initialDescription: description.trim(),
                      contextAndNeed: description.trim(),
                      industry,
                    });
                    setConfirmed([]);
                    setDirty(true);
                    setAiMetadata(null);
                    setError("");
                    setStep(2);
                  }}
                >
                  Заполнить карточку вручную <Icon name="arrow" size={14} />
                </button>
              </fieldset>
            </form>
          )}
          {step === 1 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform("Собираем карточку…", async () => {
                  const result = await taskService.generate({
                    initialDescription: description,
                    industry,
                    answers,
                  });
                  setFields(result.card);
                  setAiMetadata(result.ai);
                  setConfirmed([]);
                  setDirty(true);
                  setStep(2);
                });
              }}
            >
              <fieldset className="panel form-panel" disabled={!!busy}>
                <div className="form-section-title">
                  <div>
                    <h2>Уточните детали</h2>
                    <p>
                      Ответьте на вопросы. Если пока не знаете ответ, оставьте
                      поле пустым.
                    </p>
                  </div>
                </div>
                <div className="original-description">{description}</div>
                {description === DEMO_DESCRIPTION && (
                  <button
                    type="button"
                    className="text-link demo-fill"
                    onClick={() => setAnswers({ ...DEMO_ANSWERS })}
                  >
                    <Icon name="plus" size={14} />
                    Вставить пример ответов кофейни
                  </button>
                )}
                <div className="question-list">
                  {questions.map((question, index) => (
                    <div className="question-field" key={question.id}>
                      <label htmlFor={`question-${question.id}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        {question.question}
                      </label>
                      <p>{question.reason}</p>
                      <textarea
                        id={`question-${question.id}`}
                        maxLength={
                          [
                            "title",
                            "industry",
                            "topic",
                            "businessContact",
                          ].includes(question.field)
                            ? 200
                            : 3000
                        }
                        rows={3}
                        value={answers[question.field] ?? ""}
                        onChange={(event) =>
                          setAnswers((previous) => ({
                            ...previous,
                            [question.field]: event.target.value,
                          }))
                        }
                        placeholder="Ваш ответ…"
                      />
                    </div>
                  ))}
                </div>
                <div className="form-actions">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={!!busy}
                    onClick={() => setStep(0)}
                  >
                    <Icon name="back" />
                    Назад
                  </button>
                  <button className="btn btn-blue" disabled={!!busy}>
                    {busy ? (
                      <>
                        <span className="spinner" />
                        {busy}
                      </>
                    ) : (
                      <>
                        Собрать карточку <Icon name="arrow" />
                      </>
                    )}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {step === 2 && (
            <fieldset
              className="panel form-panel"
              disabled={!!busy || savedTask?.status === "archived"}
            >
              <div className="form-section-title">
                <div>
                  <h2>Проверьте карточку</h2>
                  <p>Отметьте достоверные сведения — только они дают баллы.</p>
                </div>
              </div>
              <div className="editor-meta">
                <label>
                  Название задачи
                  <input
                    maxLength={180}
                    value={fields.title}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                  />
                </label>
                <label className="confirm-checkbox title-confirm">
                  <input
                    type="checkbox"
                    aria-label="Подтвердить: Название задачи"
                    checked={confirmed.includes("title")}
                    disabled={!fields.title.trim()}
                    onChange={(event) => {
                      setConfirmed((previous) =>
                        event.target.checked
                          ? [...previous, "title"]
                          : previous.filter((key) => key !== "title"),
                      );
                      setDirty(true);
                      setPublishConsent(false);
                    }}
                  />
                  <span>Подтверждаю название — обязательно для публикации</span>
                </label>
                <div className="two-fields">
                  <label>
                    Отрасль
                    <select
                      value={fields.industry}
                      onChange={(event) =>
                        updateField("industry", event.target.value)
                      }
                    >
                      {[...new Set([...INDUSTRIES, fields.industry])].map(
                        (value) => (
                          <option key={value}>{value}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Тема
                    <input
                      maxLength={80}
                      value={fields.topic}
                      onChange={(event) =>
                        updateField("topic", event.target.value)
                      }
                      placeholder="Например, веб-приложение"
                    />
                  </label>
                </div>
              </div>
              <div className="editor-fields">
                {scoredFields.map((key) => (
                  <div
                    className={`editor-field ${confirmed.includes(key) ? "is-confirmed" : ""}`}
                    key={key}
                  >
                    <div className="editor-label">
                      <label htmlFor={`field-${key}`}>
                        {FIELD_LABELS[key]}
                      </label>
                      <label className="confirm-checkbox">
                        <input
                          type="checkbox"
                          aria-label={`Подтвердить: ${FIELD_LABELS[key]}`}
                          checked={confirmed.includes(key)}
                          disabled={!fields[key].trim() || !!busy}
                          onChange={(event) => {
                            setConfirmed((previous) =>
                              event.target.checked
                                ? [...previous, key]
                                : previous.filter((item) => item !== key),
                            );
                            setDirty(true);
                            setPublishConsent(false);
                          }}
                        />
                        <span>
                          {confirmed.includes(key)
                            ? "Подтверждено"
                            : "Подтверждаю"}
                        </span>
                      </label>
                    </div>
                    <textarea
                      id={`field-${key}`}
                      rows={key === "businessContact" ? 2 : 3}
                      maxLength={key === "businessContact" ? 200 : 3000}
                      value={fields[key]}
                      onChange={(event) => updateField(key, event.target.value)}
                      placeholder="Можно дополнить сейчас или вернуться позже"
                    />
                  </div>
                ))}
              </div>
              <div className="confirm-all">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  disabled={!!busy}
                  onClick={() => {
                    setConfirmed(
                      (["title", ...scoredFields] as FieldKey[]).filter((key) =>
                        fields[key].trim(),
                      ),
                    );
                    setDirty(true);
                    setPublishConsent(false);
                  }}
                >
                  <Icon name="check" size={15} />
                  Подтвердить все заполненные сведения
                </button>
                <p>
                  Нажимая, вы подтверждаете, что проверили их достоверность.
                </p>
              </div>
              <div className="publication-area">
                <label className="publish-consent">
                  <input
                    type="checkbox"
                    checked={publishConsent}
                    onChange={(event) =>
                      setPublishConsent(event.target.checked)
                    }
                    disabled={!!busy}
                  />
                  <span>
                    Я проверил(а) карточку и разрешаю публикацию сведений,
                    включая контакт, в открытом каталоге.
                  </span>
                </label>
                <div className="form-actions">
                  {savedTask?.status !== "published" && (
                    <button
                      className="btn btn-secondary"
                      disabled={!!busy || !canSave}
                      onClick={() =>
                        void perform("Сохраняем…", async () => {
                          await save();
                          setNotice("Изменения сохранены.");
                        })
                      }
                    >
                      {busy === "Сохраняем…" ? (
                        <span className="spinner" />
                      ) : (
                        <Icon name="file" size={16} />
                      )}
                      Сохранить
                    </button>
                  )}
                  <button
                    className="btn btn-blue"
                    disabled={
                      !!busy ||
                      !canSave ||
                      !publishConsent ||
                      !confirmed.includes("title")
                    }
                    onClick={() =>
                      void perform("Публикуем…", async () => {
                        const result = await save();
                        const publishedTask = await taskService.publishTask(
                          result.id,
                          result.version,
                        );
                        setSavedTask(publishedTask);
                        router.push(
                          `/business/tasks/${publishedTask.id}/published`,
                        );
                        setDirty(false);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      })
                    }
                  >
                    {busy === "Публикуем…" ? (
                      <span className="spinner" />
                    ) : (
                      <Icon name="arrow" size={16} />
                    )}
                    {savedTask?.status === "published"
                      ? "Обновить публикацию"
                      : "Опубликовать задачу"}
                  </button>
                </div>
                <p className="small-text muted">
                  Можно опубликовать с любым рейтингом и дополнить позже
                </p>
              </div>
            </fieldset>
          )}
        </div>
        <div className="builder-aside">
          {step === 2 ? (
            <ScorePanel
              fields={fields}
              confirmed={confirmed}
              score={score}
              preview={dirty}
              breakdown={!dirty ? savedTask?.scoreBreakdown : undefined}
            />
          ) : (
            <aside className="builder-guidance">
              <h2>
                Что нужно<br />
                <span>для публикации</span>
              </h2>
              <div className="guidance-points">
                <span>
                  <Icon name="check" />
                  Уточним недостающие детали
                </span>
                <span>
                  <Icon name="check" />
                  Соберём редактируемую карточку
                </span>
                <span>
                  <Icon name="check" />
                  Покажем, как повысить рейтинг
                </span>
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
