import { randomUUID } from "node:crypto";
import {
  ArchiveTaskRequestSchema, CreateMilestoneRequestSchema, CreateProposalRequestSchema, CreateTaskRequestSchema,
  CreateTeamRequestSchema, DecideProposalRequestSchema, IdSchema, ProposalQuerySchema,
  PublishTaskRequestSchema, ReviewMilestoneRequestSchema, SubmitMilestoneRequestSchema,
  MILESTONE_POINTS, TASK_FIELDS, TaskQuerySchema, UpdateTaskRequestSchema,
  emptyTaskFields, type Milestone, type TaskCardFields, type TaskField, type TaskRecord, type TeamRecord,
} from "../../shared/contracts";
import { taskCard } from "../domain/readiness";
import { AppError, notFound } from "../errors";
import type { Database, Repository } from "../repositories/database";

function findTask(database: Database, id: string) {
  IdSchema.parse(id);
  return database.tasks.find((task) => task.id === id) ?? notFound("Задача");
}
function findMilestone(database: Database, id: string) {
  IdSchema.parse(id);
  return database.milestones.find((milestone) => milestone.id === id) ?? notFound("Этап");
}
function activeProposal(database: Database, id: string) {
  IdSchema.parse(id);
  const proposal = database.proposals.find((item) => item.id === id) ?? notFound("Заявка");
  if (findTask(database, proposal.taskId).status !== "published") {
    throw new AppError(409, "TASK_NOT_PUBLISHED", "Работа с этапами доступна только для опубликованной задачи.");
  }
  if (proposal.status !== "accepted") {
    throw new AppError(409, "PROPOSAL_NOT_ACCEPTED", "Сначала бизнес должен выбрать команду.");
  }
  return proposal;
}
function teamWithPoints(database: Database, team: TeamRecord) {
  // Confirmations are the ledger: no stored team total or client-supplied award is trusted.
  const points = database.milestones.filter((item) => item.teamId === team.id && item.status === "confirmed")
    .reduce((total) => total + MILESTONE_POINTS, 0);
  return { ...team, points };
}
function checkVersion(task: TaskRecord, expectedVersion?: number) {
  if (expectedVersion !== undefined && task.version !== expectedVersion) {
    throw new AppError(409, "VERSION_CONFLICT", "Карточка уже изменена. Загрузите её заново.");
  }
}
function validateConfirmations(fields: TaskCardFields, confirmed: TaskField[]) {
  const empty = confirmed.filter((field) => !fields[field].trim());
  if (empty.length) throw new AppError(422, "EMPTY_CONFIRMATION", "Нельзя подтвердить пустые поля.",
    empty.map((field) => ({ path: `confirmedFields.${field}`, message: "Сначала заполните поле" })));
}
function touch(task: Pick<TaskRecord, "version" | "updatedAt">) {
  task.version += 1;
  task.updatedAt = new Date().toISOString();
}

export class PlatformService {
  constructor(private readonly repository: Repository) {}

  async listTasks(input: unknown = {}) {
    const query = TaskQuerySchema.parse(input);
    const database = await this.repository.read();
    const equal = (a: string, b: string) => a.toLocaleLowerCase("ru") === b.toLocaleLowerCase("ru");
    const tasks = database.tasks.map(taskCard).filter((task) => {
      if (query.status !== "all" && task.status !== query.status) return false;
      if (query.readinessLevel && task.readinessLevel !== query.readinessLevel) return false;
      if (query.topic && !equal(task.topic, query.topic)) return false;
      if (query.industry && !equal(task.industry, query.industry)) return false;
      return !query.q || [task.title, task.initialDescription, task.contextAndNeed, task.topic, task.industry]
        .join(" ").toLocaleLowerCase("ru").includes(query.q.toLocaleLowerCase("ru"));
    }).sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    return { tasks, total: tasks.length };
  }

  async getTask(id: string) {
    return { task: taskCard(findTask(await this.repository.read(), id)) };
  }

  async createTask(input: unknown) {
    const { confirmedFields, ...fields } = CreateTaskRequestSchema.parse(input);
    const completeFields = { ...emptyTaskFields(fields.initialDescription), ...fields };
    validateConfirmations(completeFields, confirmedFields);
    return this.repository.transaction((database) => {
      const timestamp = new Date().toISOString();
      const record: TaskRecord = { ...completeFields, id: randomUUID(), status: "draft", confirmedFields,
        version: 1, createdAt: timestamp, updatedAt: timestamp, publishedAt: null };
      database.tasks.push(record);
      return { task: taskCard(record) };
    });
  }

  async updateTask(id: string, input: unknown) {
    const { expectedVersion, confirmedFields, ...fields } = UpdateTaskRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const record = findTask(database, id);
      checkVersion(record, expectedVersion);
      if (record.status === "archived") throw new AppError(409, "TASK_ARCHIVED", "Архивная задача доступна только для чтения.");
      const changed = TASK_FIELDS.filter((field) => fields[field] !== undefined && fields[field] !== record[field]);
      const confirmations = confirmedFields ?? (changed.includes("initialDescription") ? [] : record.confirmedFields.filter((field) => !changed.includes(field)));
      Object.assign(record, fields);
      validateConfirmations(record, confirmations);
      record.confirmedFields = confirmations;
      // Editing a published title must still leave the card identifiable.
      if (record.status === "published" && !record.title) throw new AppError(422, "TITLE_REQUIRED", "У опубликованной задачи должно быть название.");
      touch(record);
      return { task: taskCard(record) };
    });
  }

  async publishTask(id: string, input: unknown) {
    const request = PublishTaskRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const record = findTask(database, id);
      checkVersion(record, request.expectedVersion);
      if (record.status === "archived") throw new AppError(409, "TASK_ARCHIVED", "Нельзя опубликовать архивную задачу.");
      if (!record.title || !record.confirmedFields.includes("title")) {
        throw new AppError(422, "REVIEW_REQUIRED", "Заполните и подтвердите название перед публикацией.");
      }
      if (record.status !== "published") {
        record.status = "published";
        record.publishedAt = new Date().toISOString();
        touch(record);
      }
      return { task: taskCard(record) };
    });
  }

  async archiveTask(id: string, input: unknown) {
    const request = ArchiveTaskRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const record = findTask(database, id);
      checkVersion(record, request.expectedVersion);
      if (record.status !== "archived") { record.status = "archived"; touch(record); }
      return { task: taskCard(record) };
    });
  }

  async listTeams() {
    const database = await this.repository.read();
    const teams = database.teams.map((team) => teamWithPoints(database, team));
    return { teams, total: teams.length };
  }

  async getTeam(id: string) {
    IdSchema.parse(id);
    const database = await this.repository.read();
    const team = database.teams.find((team) => team.id === id) ?? notFound("Команда");
    return { team: teamWithPoints(database, team) };
  }

  async createTeam(input: unknown) {
    const fields = CreateTeamRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const team = { ...fields, id: randomUUID(), createdAt: new Date().toISOString() };
      database.teams.push(team);
      return { team: teamWithPoints(database, team) };
    });
  }

  async listProposals(input: unknown = {}, taskId?: string) {
    const query = ProposalQuerySchema.parse(input);
    const database = await this.repository.read();
    if (taskId !== undefined) findTask(database, taskId);
    const proposals = database.proposals.filter((proposal) =>
      (!taskId || proposal.taskId === taskId) && (!query.teamId || proposal.teamId === query.teamId) &&
      (!query.status || proposal.status === query.status),
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    return { proposals, total: proposals.length };
  }

  async createProposal(taskId: string, input: unknown) {
    const fields = CreateProposalRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const task = findTask(database, taskId);
      if (task.status !== "published") throw new AppError(409, "TASK_NOT_PUBLISHED", "Отклик доступен только на опубликованную задачу.");
      if (!database.teams.some((team) => team.id === fields.teamId)) notFound("Команда");
      const timestamp = new Date().toISOString();
      const proposal = { ...fields, id: randomUUID(), taskId, status: "pending" as const,
        decisionComment: "", createdAt: timestamp, updatedAt: timestamp, decidedAt: null };
      database.proposals.push(proposal);
      return { proposal };
    });
  }

  async decideProposal(id: string, input: unknown) {
    IdSchema.parse(id);
    const decision = DecideProposalRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const proposal = database.proposals.find((item) => item.id === id) ?? notFound("Заявка");
      if (findTask(database, proposal.taskId).status !== "published") {
        throw new AppError(409, "TASK_NOT_PUBLISHED", "Решение доступно только для опубликованной задачи.");
      }
      Object.assign(proposal, decision, { updatedAt: new Date().toISOString(), decidedAt: new Date().toISOString() });
      return { proposal };
    });
  }

  async listMilestones(taskId: string) {
    const database = await this.repository.read();
    findTask(database, taskId);
    const milestones = database.milestones.filter((item) => item.taskId === taskId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return { milestones, total: milestones.length };
  }

  async createMilestone(proposalId: string, input: unknown) {
    const fields = CreateMilestoneRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const proposal = activeProposal(database, proposalId);
      const timestamp = new Date().toISOString();
      const milestone: Milestone = {
        ...fields, id: randomUUID(), proposalId, taskId: proposal.taskId, teamId: proposal.teamId,
        points: MILESTONE_POINTS, status: "planned", report: "", evidenceUrl: "", reviewComment: "",
        version: 1, createdAt: timestamp, updatedAt: timestamp, submittedAt: null, confirmedAt: null,
      };
      database.milestones.push(milestone);
      return { milestone };
    });
  }

  async submitMilestone(id: string, input: unknown) {
    const request = SubmitMilestoneRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const milestone = findMilestone(database, id);
      activeProposal(database, milestone.proposalId);
      if (milestone.version !== request.expectedVersion) {
        throw new AppError(409, "VERSION_CONFLICT", "Этап уже изменён. Загрузите его заново.");
      }
      if (milestone.status !== "planned" && milestone.status !== "changes_requested") {
        throw new AppError(409, "MILESTONE_STATE_CONFLICT", "На проверку можно отправить только запланированный этап или доработку.");
      }
      milestone.report = request.report;
      milestone.evidenceUrl = request.evidenceUrl;
      milestone.reviewComment = "";
      milestone.status = "submitted";
      milestone.submittedAt = new Date().toISOString();
      touch(milestone);
      return { milestone };
    });
  }

  async reviewMilestone(id: string, input: unknown) {
    const request = ReviewMilestoneRequestSchema.parse(input);
    return this.repository.transaction((database) => {
      const milestone = findMilestone(database, id);
      activeProposal(database, milestone.proposalId);
      // A repeated confirmation, including a retry with the submitted version, is a no-op.
      // The confirmed record itself awards points exactly once; there is no incrementing balance.
      if (milestone.status === "confirmed" && request.decision === "confirm") return { milestone };
      if (milestone.version !== request.expectedVersion) {
        throw new AppError(409, "VERSION_CONFLICT", "Этап уже изменён. Загрузите его заново.");
      }
      if (milestone.status !== "submitted") {
        throw new AppError(409, "MILESTONE_STATE_CONFLICT", "Бизнес может проверить только сданный этап.");
      }
      milestone.status = request.decision === "confirm" ? "confirmed" : "changes_requested";
      milestone.reviewComment = request.comment;
      milestone.confirmedAt = request.decision === "confirm" ? new Date().toISOString() : null;
      touch(milestone);
      return { milestone };
    });
  }
}
