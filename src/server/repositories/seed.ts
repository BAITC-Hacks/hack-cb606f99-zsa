import { emptyTaskFields, TASK_FIELDS, type TaskCardFields, type TaskField } from "../../shared/contracts";
import { DatabaseSchema, type Database } from "./database";

// Fictional demo data. No real contacts or production data.
export function createSeed(): Database {
  const timestamp = "2026-09-23T00:00:00.000Z";
  const examples: Partial<TaskCardFields>[] = [
    {
      title: "Учёт остатков пекарни", initialDescription: "У нас пекарня, хотим меньше списывать непроданные булочки.",
      industry: "Ритейл", topic: "Аналитика", contextAndNeed: "Пекарня ежедневно списывает непроданную выпечку. Нужен прогноз спроса.",
      dataAndMaterials: "CSV продаж и списаний за 6 месяцев; предоставим обезличенную выборку.",
      expectedResult: "Веб-прототип прогноза на следующий день и отчёт по остаткам.",
      successCriteria: "Ошибка прогноза не более 20% на отложенной недельной выборке.",
      constraints: "Без интеграции с кассой; прототип за 2 недели.", targetUsers: "Управляющий и пекарь.",
      businessContact: "demo-bakery@example.com", interactionFormat: "Онлайн-встреча по пятницам, обратная связь в течение 2 дней.",
    },
    {
      title: "Навигатор кружков", initialDescription: "Хотим помочь родителям находить детские кружки рядом с домом.",
      industry: "Образование", topic: "Поиск", contextAndNeed: "Родители ищут кружки в разрозненных чатах.",
      dataAndMaterials: "Таблица из 50 кружков с адресами и расписанием.", expectedResult: "Каталог с поиском по возрасту и району.",
      successCriteria: "Не менее 8 из 10 тестовых родителей находят подходящий кружок за 2 минуты.",
      targetUsers: "Родители детей 6–14 лет.", businessContact: "demo-clubs@example.com",
      interactionFormat: "Демонстрация раз в неделю; комментарии координатора в течение дня.",
    },
    {
      title: "Очередь в сервисном центре", initialDescription: "Клиенты долго ждут ремонта и постоянно звонят узнать статус.",
      industry: "Услуги", topic: "Автоматизация", contextAndNeed: "Мастера отвлекаются на звонки о статусе ремонта.",
      dataAndMaterials: "Обезличенная таблица текущих заказов и этапов ремонта.",
      expectedResult: "Страница проверки статуса заказа по коду.", targetUsers: "Клиенты и администраторы центра.",
    },
    {
      title: "Планирование полива", initialDescription: "Ферме нужен понятный способ планировать полив полей.",
      industry: "Агро", topic: "Планирование", contextAndNeed: "График полива сейчас ведётся в бумажной тетради.",
    },
    {
      title: "Помощник волонтёров", initialDescription: "Хотим удобнее распределять заявки на помощь между волонтёрами.",
      industry: "Социальные проекты", topic: "Координация", targetUsers: "Координаторы волонтёрского центра.",
    },
  ];
  const confirmations: TaskField[][] = [
    [...TASK_FIELDS],
    ["title", "contextAndNeed", "dataAndMaterials", "expectedResult", "successCriteria", "targetUsers"],
    ["title", "contextAndNeed", "dataAndMaterials"],
    ["title", "contextAndNeed"],
    [],
  ];
  const tasks = examples.map((example, index) => ({
    ...emptyTaskFields(example.initialDescription!), ...example,
    id: `task-${index + 1}`, status: index === 4 ? "draft" as const : "published" as const,
    confirmedFields: confirmations[index], version: 1,
    createdAt: timestamp, updatedAt: timestamp, publishedAt: index === 4 ? null : timestamp,
  }));
  const teams = [
    { name: "Data Nomads", interests: ["Аналитика"], skills: ["Анализ данных"], technologies: ["Python", "pandas"] },
    { name: "Qadam", interests: ["Образование"], skills: ["UX", "Frontend"], technologies: ["React", "TypeScript"] },
    { name: "Steppe Dev", interests: ["Автоматизация"], skills: ["Backend"], technologies: ["Node.js", "PostgreSQL"] },
    { name: "Green Code", interests: ["Агро"], skills: ["Визуализация"], technologies: ["Next.js"] },
    { name: "Birge", interests: ["Социальные проекты"], skills: ["Дизайн", "Fullstack"], technologies: ["Figma", "React"] },
  ].map((team, index) => ({ ...team, id: `team-${index + 1}`, createdAt: timestamp }));
  const ideas = [
    "Прогноз спроса по дням недели с отчётом по остаткам.",
    "Карта кружков с фильтрами по возрасту и расписанию.",
    "Личный код заказа и публичная страница статуса ремонта.",
    "Календарь полива с ручным вводом наблюдений агронома.",
    "Простая панель списаний пекарни с графиком по категориям.",
  ];
  const proposals = ideas.map((solutionIdea, index) => ({
    id: `proposal-${index + 1}`, taskId: `task-${index % 4 + 1}`, teamId: `team-${index + 1}`,
    solutionIdea, plan: "Уточнить требования, подготовить данные, собрать прототип, провести тест с бизнесом.",
    estimatedDuration: "2 недели", prototypeUrl: `https://example.com/demo/${index + 1}`,
    status: index === 0 ? "accepted" as const : index === 1 ? "rejected" as const : "pending" as const,
    decisionComment: index === 0 ? "Приглашаем обсудить прототип." : index === 1 ? "Нужно уточнить работу без карты." : "",
    createdAt: timestamp, updatedAt: timestamp, decidedAt: index < 2 ? timestamp : null,
  }));
  return DatabaseSchema.parse({ schemaVersion: 1, tasks, teams, proposals });
}
