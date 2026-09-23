import type {
  AnalyzeDraftResponse,
  TaskCard,
  Proposal,
} from "@/shared/contracts";
import {
  AnalyzeDraftRequestSchema, ProposalSchema, MILESTONE_POINTS,
  CreateMilestoneRequestSchema, SubmitMilestoneRequestSchema, ReviewMilestoneRequestSchema,
} from "@/shared/contracts";
import {
  EMPTY_FIELDS,
  fieldsOnly,
  readinessPreview,
  type TaskService,
  type Team,
  type Milestone,
} from "./model";
import { seedTasks, seedProposals, SEED_TEAMS } from "./seeds";
import { DemoDatabaseSchema } from "./schemas";
import { ApiClientError } from "./api-error";

export const DEMO_STORAGE_KEY = "ai-sana-demo-v1";
type Database = {
  version: 1;
  tasks: TaskCard[];
  proposals: Proposal[];
  teams: Team[];
  milestones: Milestone[];
  legacyMilestones: { proposalId: string; points: number; confirmedAt: string }[];
};
function read(): Database {
  const raw = localStorage.getItem(DEMO_STORAGE_KEY);
  if (!raw)
    return {
      version: 1,
      tasks: seedTasks(),
      proposals: seedProposals(),
      teams: structuredClone(SEED_TEAMS),
      milestones: [],
      legacyMilestones: [],
    };
  try {
    return DemoDatabaseSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      "Демо-данные повреждены. Сбросьте их кнопкой внизу страницы «Мои задачи».",
    );
  }
}
function write(db: Database) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(db));
  } catch {
    throw new Error(
      "Браузер не разрешил сохранить данные. Проверьте доступ к локальному хранилищу.",
    );
  }
}
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 380));
const timestamp = () => new Date().toISOString();
function findTask(db: Database, id: string) {
  const task = db.tasks.find((item) => item.id === id);
  if (!task)
    throw new Error("Задача не найдена. Возможно, демо-данные были сброшены.");
  return task;
}
function findProposal(db: Database, id: string) {
  const proposal = db.proposals.find((item) => item.id === id);
  if (!proposal) throw new Error("Предложение не найдено.");
  return proposal;
}
function requireSelectedProposal(db: Database, proposalId: string) {
  const proposal = findProposal(db, proposalId);
  if (findTask(db, proposal.taskId).status !== "published") throw new ApiClientError("TASK_NOT_PUBLISHED", "Этапы доступны только для опубликованной задачи.");
  if (proposal.status !== "accepted") throw new ApiClientError("PROPOSAL_NOT_ACCEPTED", "Сначала выберите команду.");
  return proposal;
}
function findMilestone(db: Database, id: string) {
  const milestone = db.milestones.find((item) => item.id === id);
  if (!milestone) throw new Error("Этап не найден.");
  return milestone;
}
function checkMilestoneVersion(milestone: Milestone, version: number) {
  if (milestone.version !== version) throw new ApiClientError("VERSION_CONFLICT", "Этап уже изменён. Обновите его перед повторным действием.");
}
export const mockService: TaskService = {
  supportsMilestones: true,
  async listTasks(includeDrafts = false) {
    await delay();
    return read()
      .tasks.filter((task) => includeDrafts || task.status === "published")
      .sort((a, b) => b.score - a.score);
  },
  async getTask(id) {
    await delay();
    return findTask(read(), id);
  },
  async analyze(description, fields) {
    await delay();
    const parsed = AnalyzeDraftRequestSchema.safeParse({
      initialDescription: description,
      fields,
    });
    if (!parsed.success)
      throw new Error("Проверьте описание задачи (минимум 10 символов) и заполненные поля.");
    const knownFields = { ...EMPTY_FIELDS, ...parsed.data.fields };
    const questions: AnalyzeDraftResponse["questions"] = [
      {
        id: "users",
        field: "targetUsers",
        question: "Кто будет пользоваться решением?",
        reason: "Команде нужно понять, для кого она создаёт продукт.",
      },
      {
        id: "data",
        field: "dataAndMaterials",
        question: "Какие данные или примеры вы можете предоставить?",
        reason: "Данные и материалы дают до 20 баллов готовности.",
      },
      {
        id: "result",
        field: "expectedResult",
        question: "Какой конкретный результат вы хотите получить?",
        reason:
          "Например, веб-прототип, аналитический отчёт или работающий сервис.",
      },
      {
        id: "success",
        field: "successCriteria",
        question: "Как вы поймёте, что задача решена?",
        reason: "Опишите измеримый результат или сценарий приёмки.",
      },
      {
        id: "limits",
        field: "constraints",
        question: "Какие есть сроки и ограничения?",
        reason: "Укажите технологии, доступы и границы первой версии.",
      },
      {
        id: "contact",
        field: "businessContact",
        question: "С кем команда сможет связаться?",
        reason: "Имя и рабочая почта или другой удобный контакт.",
      },
      {
        id: "format",
        field: "interactionFormat",
        question: "Как будете общаться и давать обратную связь?",
        reason: "Например, короткий созвон раз в неделю.",
      },
    ];
    const missingQuestions = questions.filter(
      (question) => !knownFields[question.field]?.trim(),
    );
    const selectedQuestions = [...missingQuestions];
    // A complete card still gets three optional reviews, not requests to repeat facts.
    for (const question of questions) {
      if (selectedQuestions.length >= 3) break;
      const knownValue = knownFields[question.field]?.trim();
      if (!knownValue) continue;
      selectedQuestions.push({
        ...question,
        question: `Проверка: уже указано «${knownValue.slice(0, 200)}»; нужно ли дополнить? Если да, укажите полную исправленную формулировку.`,
        reason: "Сведения уже известны. Если правок нет, ответ можно пропустить.",
      });
    }
    return {
      questions: selectedQuestions,
      missingFields: missingQuestions.map((question) => question.field),
      ai: {
        provider: "mock",
        fallback: false,
        warning:
          "Деморежим: вопросы подготовлены по локальному шаблону.",
      },
    };
  },
  async generate(input) {
    await delay();
    return {
      card: {
        ...EMPTY_FIELDS,
        ...input.answers,
        title: input.initialDescription.trim().slice(0, 75),
        initialDescription: input.initialDescription.trim(),
        contextAndNeed: input.initialDescription.trim(),
        industry: input.industry,
        topic: input.industry,
      },
      confirmedFields: [],
      ai: {
        provider: "mock",
        fallback: false,
        warning:
          "Деморежим: карточка собрана из введённого текста по локальному шаблону.",
      },
    };
  },
  async saveTask({ fields, confirmedFields, expectedVersion }, id) {
    await delay();
    if (fields.initialDescription.trim().length < 10)
      throw new Error(
        "Укажите описание задачи (минимум 10 символов).",
      );
    const db = read();
    const previous = id ? findTask(db, id) : undefined;
    if (previous?.status === "archived") throw new ApiClientError("TASK_ARCHIVED", "Задача в архиве и доступна только для чтения.");
    if (previous && expectedVersion !== undefined && previous.version !== expectedVersion)
      throw new ApiClientError("VERSION_CONFLICT", "Карточка изменилась. Загрузите актуальную версию.");
    const cleaned = Object.fromEntries(
      Object.entries(fieldsOnly(fields)).map(([key, value]) => [
        key,
        value.trim(),
      ]),
    ) as typeof fields;
    if (previous?.status === "published" && !cleaned.title)
      throw new ApiClientError("TITLE_REQUIRED", "У опубликованной задачи должно быть название.");
    // The editor clears confirmation on edit; an explicit re-confirmation applies to the new value.
    const confirmed = [...new Set(confirmedFields)].filter(
      (key) => cleaned[key],
    );
    const task: TaskCard = {
      ...cleaned,
      id: id ?? crypto.randomUUID(),
      status: previous?.status ?? "draft",
      ...readinessPreview(cleaned, confirmed),
      version: (previous?.version ?? 0) + 1,
      publishedAt: previous?.publishedAt ?? null,
      confirmedFields: confirmed,
      createdAt: previous?.createdAt ?? timestamp(),
      updatedAt: timestamp(),
    };
    db.tasks = [task, ...db.tasks.filter((item) => item.id !== task.id)];
    write(db);
    return task;
  },
  async publishTask(id, expectedVersion) {
    await delay();
    const db = read();
    const task = findTask(db, id);
    if (task.status === "archived") throw new ApiClientError("TASK_ARCHIVED", "Задача в архиве и доступна только для чтения.");
    if (expectedVersion !== undefined && task.version !== expectedVersion)
      throw new ApiClientError("VERSION_CONFLICT", "Карточка изменилась. Загрузите актуальную версию.");
    if (!task.title || !task.confirmedFields.includes("title"))
      throw new ApiClientError("REVIEW_REQUIRED", "Заполните и подтвердите название перед публикацией.");
    if (task.status === "published") return task;
    task.status = "published";
    task.updatedAt = timestamp();
    task.publishedAt ??= timestamp();
    task.version += 1;
    write(db);
    return task;
  },
  async archiveTask(id, expectedVersion) {
    await delay();
    const db = read();
    const task = findTask(db, id);
    if (expectedVersion !== undefined && task.version !== expectedVersion)
      throw new ApiClientError("VERSION_CONFLICT", "Карточка изменилась. Загрузите актуальную версию.");
    if (task.status === "archived") return task;
    task.status = "archived";
    task.updatedAt = timestamp();
    task.version += 1;
    write(db);
    return task;
  },
  async listTeams() {
    await delay();
    const db = read();
    return db.teams.map((team) => ({ ...team, points: db.milestones
      .filter((milestone) => milestone.teamId === team.id && milestone.status === "confirmed")
      .reduce((sum, milestone) => sum + milestone.points, 0) }));
  },
  async listProposals(taskId) {
    await delay();
    return read().proposals.filter((item) => item.taskId === taskId);
  },
  async submitProposal(taskId, input) {
    await delay();
    const db = read();
    if (findTask(db, taskId).status !== "published")
      throw new ApiClientError("TASK_NOT_PUBLISHED", "Откликнуться можно после публикации задачи.");
    if (!db.teams.some((team) => team.id === input.teamId))
      throw new Error("Выберите команду.");
    const proposal: Proposal = {
      ...input,
      taskId,
      id: crypto.randomUUID(),
      status: "pending",
      createdAt: timestamp(),
      updatedAt: timestamp(),
      decidedAt: null,
      decisionComment: "",
    };
    if (
      !ProposalSchema.safeParse(proposal).success ||
      (input.prototypeUrl && !/^https?:\/\//i.test(input.prototypeUrl))
    )
      throw new Error(
        "Заполните идею, план и срок. Ссылка должна начинаться с https:// или http://.",
      );
    db.proposals.push(proposal);
    write(db);
    return proposal;
  },
  async decideProposal(id, status, decisionComment = "") {
    await delay();
    const db = read();
    const proposal = findProposal(db, id);
    if (findTask(db, proposal.taskId).status !== "published")
      throw new ApiClientError("TASK_NOT_PUBLISHED", "Решения доступны только для опубликованной задачи.");
    proposal.status = status;
    proposal.decisionComment = decisionComment.trim();
    proposal.updatedAt = timestamp();
    proposal.decidedAt = timestamp();
    write(db);
    return proposal;
  },
  async listMilestones(taskId) {
    await delay();
    const db = read();
    findTask(db, taskId);
    return db.milestones.filter((item) => item.taskId === taskId);
  },
  async createMilestone(proposalId, input) {
    await delay();
    const db = read();
    const proposal = requireSelectedProposal(db, proposalId);
    const fields = CreateMilestoneRequestSchema.parse(input);
    const now = timestamp();
    const milestone: Milestone = {
      ...fields, id: crypto.randomUUID(), proposalId, taskId: proposal.taskId, teamId: proposal.teamId,
      points: MILESTONE_POINTS, status: "planned", report: "", evidenceUrl: "", reviewComment: "",
      version: 1, createdAt: now, updatedAt: now, submittedAt: null, confirmedAt: null,
    };
    db.milestones.push(milestone);
    write(db);
    return milestone;
  },
  async submitMilestone(id, input) {
    await delay();
    const request = SubmitMilestoneRequestSchema.parse(input);
    const db = read();
    const milestone = findMilestone(db, id);
    requireSelectedProposal(db, milestone.proposalId);
    checkMilestoneVersion(milestone, request.expectedVersion);
    if (milestone.status !== "planned" && milestone.status !== "changes_requested") throw new ApiClientError("MILESTONE_STATE_CONFLICT", "Этот этап уже отправлен или подтверждён.");
    Object.assign(milestone, { report: request.report, evidenceUrl: request.evidenceUrl ?? "", reviewComment: "", status: "submitted", version: milestone.version + 1, submittedAt: timestamp(), updatedAt: timestamp() });
    write(db);
    return milestone;
  },
  async reviewMilestone(id, input) {
    await delay();
    const request = ReviewMilestoneRequestSchema.parse(input);
    const db = read();
    const milestone = findMilestone(db, id);
    requireSelectedProposal(db, milestone.proposalId);
    if (milestone.status === "confirmed" && request.decision === "confirm") return milestone;
    checkMilestoneVersion(milestone, request.expectedVersion);
    if (milestone.status !== "submitted") throw new ApiClientError("MILESTONE_STATE_CONFLICT", "Сначала команда должна отправить отчёт по этапу.");
    Object.assign(milestone, { status: request.decision === "confirm" ? "confirmed" : "changes_requested", reviewComment: request.comment ?? "", version: milestone.version + 1, updatedAt: timestamp(), confirmedAt: request.decision === "confirm" ? timestamp() : null });
    write(db);
    return milestone;
  },
};
