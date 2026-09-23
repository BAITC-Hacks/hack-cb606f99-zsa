import type {
  AnalyzeDraftResponse,
  TaskCard,
  Proposal,
} from "@/shared/contracts";
import { AnalyzeDraftRequestSchema, ProposalSchema } from "@/shared/contracts";
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

export const DEMO_STORAGE_KEY = "ai-sana-demo-v1";
type Database = {
  version: 1;
  tasks: TaskCard[];
  proposals: Proposal[];
  teams: Team[];
  milestones: Milestone[];
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
          "Локальный деморежим: вопросы подготовлены по шаблону, без обращения к AI.",
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
          "Локальный деморежим: карточка собрана из введённого текста, без обращения к AI.",
      },
    };
  },
  async saveTask({ fields, confirmedFields }, id) {
    await delay();
    if (!fields.title.trim() || fields.initialDescription.trim().length < 10)
      throw new Error(
        "Укажите название и описание задачи (минимум 10 символов).",
      );
    const db = read();
    const previous = id ? findTask(db, id) : undefined;
    const cleaned = Object.fromEntries(
      Object.entries(fieldsOnly(fields)).map(([key, value]) => [
        key,
        value.trim(),
      ]),
    ) as typeof fields;
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
  async publishTask(id) {
    await delay();
    const db = read();
    const task = findTask(db, id);
    if (!task.title || !task.confirmedFields.includes("title"))
      throw new Error("Заполните и подтвердите название перед публикацией.");
    task.status = "published";
    task.updatedAt = timestamp();
    task.publishedAt ??= timestamp();
    task.version += 1;
    write(db);
    return task;
  },
  async listTeams() {
    await delay();
    return read().teams;
  },
  async listProposals(taskId) {
    await delay();
    return read().proposals.filter((item) => item.taskId === taskId);
  },
  async submitProposal(taskId, input) {
    await delay();
    const db = read();
    if (findTask(db, taskId).status !== "published")
      throw new Error("Откликнуться можно после публикации задачи.");
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
  async decideProposal(id, status) {
    await delay();
    const db = read();
    const proposal = findProposal(db, id);
    proposal.status = status;
    proposal.updatedAt = timestamp();
    proposal.decidedAt = timestamp();
    write(db);
    return proposal;
  },
  async listMilestones(taskId) {
    await delay();
    const db = read();
    const ids = db.proposals
      .filter((item) => item.taskId === taskId)
      .map((item) => item.id);
    return db.milestones.filter((item) => ids.includes(item.proposalId));
  },
  async confirmMilestone(proposalId) {
    await delay();
    const db = read();
    const proposal = findProposal(db, proposalId);
    if (proposal.status !== "accepted")
      throw new Error("Сначала выберите команду.");
    const previous = db.milestones.find(
      (item) => item.proposalId === proposalId,
    );
    if (previous) return previous;
    const milestone = { proposalId, points: 25, confirmedAt: timestamp() };
    const team = db.teams.find((item) => item.id === proposal.teamId);
    if (team) team.points = (team.points ?? 0) + milestone.points;
    db.milestones.push(milestone);
    write(db);
    return milestone;
  },
};
