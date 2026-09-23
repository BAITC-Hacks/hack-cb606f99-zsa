import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Isolated production-server smoke test. Never touches data/db.json or calls OpenAI.
const directory = await mkdtemp(join(tmpdir(), "hackalem-smoke-"));
const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const port = portProbe.address().port;
await new Promise((done, reject) => portProbe.close((error) => error ? reject(error) : done()));
const base = `http://127.0.0.1:${port}`;
let output = "";
let server;
let closed;
function start() {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...process.env, AI_PROVIDER: "mock", DATA_FILE_PATH: join(directory, "db.json"), NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  closed = new Promise((done) => { server.once("close", done); server.once("error", done); });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (chunk) => { output = (output + chunk).slice(-10000); });
}
async function stop() {
  if (server && server.exitCode === null) server.kill();
  await closed;
}
async function ready() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch { /* wait for bind */ }
    await delay(200);
  }
  throw new Error(`Server not ready: ${output}`);
}
async function call(path, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return data;
}

try {
  start();
  await ready();
  const health = await call("/api/health");
  assert.deepEqual(health.counts, { tasks: 5, teams: 5, proposals: 5 });
  assert.deepEqual(health.checks, { storage: "read_write_ok", ai: "not_checked" });
  // Reads may still work while writes are blocked; readiness must not stay green.
  const legacyLock = join(directory, "db.json.lock");
  await writeFile(legacyLock, "", { flag: "wx" });
  try {
    const unavailable = await call("/api/health", "GET", undefined, 503);
    assert.equal(unavailable.error.code, "STORAGE_LOCK_INVALID");
    assert.equal((await call("/api/tasks")).total, 4);
  } finally { await unlink(legacyLock); }
  assert.equal((await call("/api/health")).status, "ok");
  assert.equal((await call("/api/tasks")).total, 4);
  assert.equal((await call("/api/tasks?status=all")).total, 5);
  assert.equal((await call("/api/tasks?readinessLevel=draft")).tasks[0].score, 20);
  assert.equal((await call("/api/teams")).total, 5);
  assert.equal((await call("/api/proposals")).total, 5);

  const initialDescription = "Пекарня хочет снизить ежедневные списания непроданной выпечки";
  const analysis = await call("/api/ai/questions", "POST", { initialDescription });
  assert.ok(analysis.questions.length >= 3);
  assert.equal(analysis.ai.provider, "mock");
  const generated = await call("/api/ai/card", "POST", { initialDescription, answers: [
    { field: "title", answer: "План выпечки" },
    { field: "dataAndMaterials", answer: "CSV продаж за полгода" },
    { field: "expectedResult", answer: "Прогноз на завтра" },
    { field: "successCriteria", answer: "Ошибка не более 20%" },
    { field: "constraints", answer: "Срок 2 недели" },
    { field: "targetUsers", answer: "Управляющий пекарни" },
    { field: "businessContact", answer: "demo@example.com" },
    { field: "interactionFormat", answer: "Еженедельный созвон; ответ за 2 дня" },
  ] });
  assert.deepEqual(generated.confirmedFields, []);
  const { task } = await call("/api/tasks", "POST", generated.card, 201);
  assert.equal(task.score, 0);
  assert.equal(task.status, "draft");
  const path = `/api/tasks/${task.id}`;
  await call(`${path}/publish`, "POST", { confirmed: true }, 422);
  await call(path, "PATCH", { score: 100 }, 400);
  const confirmedFields = Object.keys(generated.card).filter((key) => generated.card[key]);
  const reviewed = await call(path, "PATCH", { confirmedFields, expectedVersion: task.version });
  assert.equal(reviewed.task.score, 100);
  await call(path, "PATCH", { title: "Stale update", expectedVersion: task.version }, 409);
  await call(`${path}/publish`, "POST", { confirmed: true, expectedVersion: reviewed.task.version });
  assert.ok((await call("/api/tasks")).tasks.some((item) => item.id === task.id));
  const edited = await call(path, "PATCH", { successCriteria: "Ошибка не более 10%" });
  assert.equal(edited.task.score, 85);
  assert.ok(edited.task.unconfirmedFields.includes("successCriteria"));

  const team = await call("/api/teams", "POST", { name: "Smoke Team", interests: ["Аналитика"], skills: ["Backend"], technologies: ["Node.js"] }, 201);
  assert.equal((await call(`/api/teams/${team.team.id}`)).team.name, "Smoke Team");
  const submission = { teamId: team.team.id, solutionIdea: "Панель прогноза", plan: "Данные, прототип, тест", estimatedDuration: "2 недели", prototypeUrl: "https://example.com/demo" };
  const first = await call(`${path}/proposals`, "POST", submission, 201);
  const second = await call(`${path}/proposals`, "POST", { ...submission, teamId: "team-2" }, 201);
  const milestoneUrl = `/api/proposals/${first.proposal.id}/milestones`;
  const milestoneInput = { title: "Прототип прогноза", description: "Передать работающий прогноз на тестовом CSV и описать проверку точности" };
  await call(milestoneUrl, "POST", milestoneInput, 409);
  for (const { proposal } of [first, second]) await call(`/api/proposals/${proposal.id}/status`, "PATCH", { status: "accepted" });
  assert.equal((await call(`${path}/proposals?status=accepted`)).total, 2);
  assert.equal((await call(`/api/proposals?teamId=${team.team.id}`)).total, 1);

  // Team progress is a separate, manually reviewed workflow, never an award for acceptance alone.
  assert.equal((await call(`/api/teams/${team.team.id}`)).team.points, 0);
  await call(milestoneUrl, "POST", { ...milestoneInput, points: 999 }, 400);
  const planned = (await call(milestoneUrl, "POST", milestoneInput, 201)).milestone;
  assert.equal(planned.status, "planned");
  assert.equal(planned.points, 10);
  const milestonePath = `/api/milestones/${planned.id}`;
  await call(`${milestonePath}/review`, "POST", { decision: "confirm", expectedVersion: planned.version }, 409);
  await call(`${milestonePath}/submit`, "POST", { report: "", expectedVersion: planned.version }, 400);
  const submitted = (await call(`${milestonePath}/submit`, "POST", {
    report: "Подготовили прототип и проверили прогноз на CSV", evidenceUrl: "https://example.com/prototype", expectedVersion: planned.version,
  })).milestone;
  assert.equal((await call(`/api/teams/${team.team.id}`)).team.points, 0);
  await call(`${milestonePath}/review`, "POST", { decision: "request_changes", expectedVersion: submitted.version }, 400);
  const returned = (await call(`${milestonePath}/review`, "POST", {
    decision: "request_changes", comment: "Добавьте сравнение с базовым прогнозом", expectedVersion: submitted.version,
  })).milestone;
  assert.equal(returned.status, "changes_requested");
  await call(`${milestonePath}/submit`, "POST", { report: "Устаревшая форма", expectedVersion: submitted.version }, 409);
  const resubmitted = (await call(`${milestonePath}/submit`, "POST", {
    report: "Добавили сравнение с базовым прогнозом и результаты теста", expectedVersion: returned.version,
  })).milestone;
  const confirmed = (await call(`${milestonePath}/review`, "POST", {
    decision: "confirm", expectedVersion: resubmitted.version,
  })).milestone;
  assert.equal(confirmed.status, "confirmed");
  await call(`${milestonePath}/review`, "POST", { decision: "confirm", expectedVersion: confirmed.version });
  assert.equal((await call(`/api/teams/${team.team.id}`)).team.points, 10);
  assert.equal((await call(`${path}/milestones`)).total, 1);
  await call(`${milestonePath}/submit`, "POST", { report: "Попытка повторной сдачи", expectedVersion: confirmed.version }, 409);

  await call(`/api/proposals/${first.proposal.id}/status`, "PATCH", { status: "rejected", decisionComment: "Уточнить план" });
  assert.equal((await call(`${path}/proposals?status=rejected`)).total, 1);
  assert.equal((await call(`/api/teams/${team.team.id}`)).team.points, 10);
  await call(milestoneUrl, "POST", milestoneInput, 409);

  // A zero-score published task must still accept a proposal.
  const low = await call("/api/tasks", "POST", { initialDescription, title: "Пока мало данных", confirmedFields: ["title"] }, 201);
  await call(`/api/tasks/${low.task.id}/publish`, "POST", { confirmed: true });
  await call(`/api/tasks/${low.task.id}/proposals`, "POST", submission, 201);
  assert.ok((await call("/api/tasks?readinessLevel=draft")).tasks.some((item) => item.id === low.task.id));
  await call("/api/tasks/task-5/proposals", "POST", submission, 409);
  await call("/api/tasks/missing", "GET", undefined, 404);
  await call("/api/tasks?status=invalid", "GET", undefined, 400);
  await call("/api/ai/questions", "POST", { initialDescription: "short" }, 400);
  await call(`${path}/archive`, "POST", {});
  await call(`${path}/proposals`, "POST", submission, 409);

  await stop();
  start();
  await ready();
  assert.equal((await call(path)).task.status, "archived");
  assert.equal((await call(`${path}/proposals`)).total, 2);
  assert.equal((await call(`${path}/milestones`)).milestones[0].status, "confirmed");
  assert.equal((await call(`/api/teams/${team.team.id}`)).team.points, 10);
  assert.equal((await call("/api/health")).counts.tasks, 7);
  console.log("PASS: production HTTP workflow, AI mock, scoring, catalogue, proposals, milestone review/points, readiness, validation and restart persistence.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await stop();
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.includes("hackalem-smoke-")) throw new Error("Unsafe cleanup path");
  await rm(directory, { recursive: true, force: true });
}
