import type { TaskCard, TaskCardFields, Proposal } from "@/shared/contracts";
import {
  EMPTY_FIELDS,
  readinessPreview,
  type FieldKey,
  type Team,
} from "./model";

export const DEMO_DESCRIPTION =
  "У нас кофейня. По утрам длинные очереди, хотим сократить время ожидания заказа.";
export const DEMO_ANSWERS: Partial<Record<FieldKey, string>> = {
  targetUsers: "Гости кофейни, бариста и администратор утренней смены.",
  dataAndMaterials:
    "Обезличенная выгрузка 500 заказов за месяц: время оформления, выдачи и состав заказа. Передадим CSV.",
  expectedResult:
    "Веб-прототип предзаказа с меню и экраном очереди для бариста.",
  successCriteria:
    "На тесте из 20 заказов среднее ожидание не превышает 5 минут, каждый заказ виден бариста.",
  constraints:
    "Прототип за 2 недели. Без онлайн-оплаты и интеграции с кассой на первом этапе.",
  businessContact: "Алия, менеджер кофейни: coffee@example.com.",
  interactionFormat:
    "Созвон по вторникам на 20 минут, обратная связь по прототипу в течение двух рабочих дней.",
};
export const DRAFT_EXAMPLES = [
  { label: "Кофейня", industry: "Ритейл", text: DEMO_DESCRIPTION },
  {
    label: "Обучение",
    industry: "Образование",
    text: "Студенты пропускают практические задания. Хотим сделать процесс обучения понятнее и интереснее.",
  },
  {
    label: "Доставка",
    industry: "Логистика",
    text: "Небольшому магазину нужно планировать доставку. Сейчас заказы и адреса хранятся в таблице.",
  },
  {
    label: "Экология",
    industry: "Экология",
    text: "Хотим помочь жителям находить пункты приёма вторсырья в своём районе.",
  },
  {
    label: "Сервис",
    industry: "Сервисы",
    text: "Клиенты долго ждут ответа на типовые вопросы. Есть база из 100 ответов и один оператор.",
  },
];

function seed(
  id: string,
  fields: Partial<TaskCardFields>,
  confirmed: FieldKey[],
): TaskCard {
  const all = { ...EMPTY_FIELDS, ...fields };
  return {
    ...all,
    id,
    ...readinessPreview(all, confirmed),
    confirmedFields: [...confirmed, "title"],
    version: 1,
    publishedAt: "2026-09-23T08:00:00.000Z",
    status: "published",
    createdAt: "2026-09-23T08:00:00.000Z",
    updatedAt: "2026-09-23T08:00:00.000Z",
  };
}
const allScored: FieldKey[] = [
  "contextAndNeed",
  "dataAndMaterials",
  "expectedResult",
  "successCriteria",
  "constraints",
  "targetUsers",
  "businessContact",
  "interactionFormat",
];
export function seedTasks(): TaskCard[] {
  return [
    seed(
      "demo-task",
      {
        ...DEMO_ANSWERS,
        title: "Кофе без очереди",
        initialDescription: DEMO_DESCRIPTION,
        industry: "Ритейл",
        topic: "Веб-приложение",
        contextAndNeed: DEMO_DESCRIPTION,
      },
      allScored,
    ),
    seed(
      "green-city",
      {
        title: "Город, в котором проще сортировать",
        initialDescription: DRAFT_EXAMPLES[3].text,
        industry: "Экология",
        topic: "Карта и данные",
        contextAndNeed:
          "Жителям сложно найти работающие пункты приёма вторсырья и узнать, какие материалы там принимают.",
        dataAndMaterials:
          "Таблица 35 пунктов с адресами и часами работы; координаты требуют проверки.",
        expectedResult:
          "Интерактивная карта с поиском по району и виду вторсырья.",
        successCriteria:
          "Пользователь находит ближайший подходящий пункт не более чем за 3 действия.",
        targetUsers: "Жители города и волонтёры.",
        businessContact: "Команда экоцентра: green@example.com",
        interactionFormat: "Еженедельная встреча с координатором.",
      },
      allScored.filter((key) => key !== "constraints"),
    ),
    seed(
      "study-flow",
      {
        title: "Практика, к которой хочется вернуться",
        initialDescription: DRAFT_EXAMPLES[1].text,
        industry: "Образование",
        topic: "Геймификация",
        contextAndNeed: DRAFT_EXAMPLES[1].text,
        expectedResult:
          "Прототип личного кабинета с прогрессом практических заданий.",
        successCriteria:
          "Студент видит следующее задание и может отправить результат без помощи преподавателя.",
        constraints:
          "Демонстрация через 10 дней. Использовать тестовые данные.",
        targetUsers: "Студенты первого курса.",
        businessContact: "Методист: study@example.com",
        interactionFormat: "Обратная связь после каждой демонстрации.",
      },
      allScored.filter((key) => key !== "dataAndMaterials"),
    ),
    seed(
      "local-delivery",
      {
        title: "Умный маршрут для локального магазина",
        initialDescription: DRAFT_EXAMPLES[2].text,
        industry: "Логистика",
        topic: "Автоматизация",
        contextAndNeed: DRAFT_EXAMPLES[2].text,
        dataAndMaterials: "Пример таблицы на 30 тестовых заказов.",
        expectedResult: "Экран распределения заказов по курьерам.",
        targetUsers: "Диспетчер и курьеры магазина.",
      },
      ["contextAndNeed", "dataAndMaterials", "expectedResult", "targetUsers"],
    ),
    seed(
      "support",
      {
        title: "Помощник для службы поддержки",
        initialDescription: DRAFT_EXAMPLES[4].text,
        industry: "Сервисы",
        topic: "AI-помощник",
        contextAndNeed: DRAFT_EXAMPLES[4].text,
        targetUsers: "Клиенты сервиса и оператор.",
      },
      ["contextAndNeed", "targetUsers"],
    ),
  ];
}
export const SEED_TEAMS: Team[] = [
  {
    id: "zsa",
    name: "ZSA",
    skills: ["React", "TypeScript", "AI"],
    interests: ["Веб-приложения", "Автоматизация"],
    points: 0,
  },
  {
    id: "orbit",
    name: "Orbit",
    skills: ["Python", "Data", "UI/UX"],
    interests: ["Экология", "Аналитика"],
    points: 0,
  },
  {
    id: "nomad",
    name: "Nomad Dev",
    skills: ["React", "Node.js"],
    interests: ["Ритейл", "Логистика"],
    points: 0,
  },
  {
    id: "qadam",
    name: "Qadam",
    skills: ["Figma", "Python"],
    interests: ["Образование"],
    points: 0,
  },
  {
    id: "byte",
    name: "Byte Crew",
    skills: ["TypeScript", "AI"],
    interests: ["Сервисы"],
    points: 0,
  },
];
export function seedProposals(): Proposal[] {
  return SEED_TEAMS.map((team, index) => ({
    id: `seed-proposal-${index}`,
    taskId: index < 3 ? "demo-task" : index === 3 ? "study-flow" : "support",
    teamId: team.id,
    solutionIdea: [
      "Сделаем предзаказ по QR-коду и понятный экран очереди для бариста.",
      "Начнём с анализа времени приготовления и предложим простой план улучшений.",
      "Предлагаем мобильную веб-страницу меню с выбором времени выдачи.",
      "Соберём прототип кабинета с небольшими заданиями и видимым прогрессом.",
      "Сделаем поиск по базе готовых ответов для оператора поддержки.",
    ][index],
    plan: "Уточним сценарий с бизнесом, соберём прототип и проверим его на тестовых данных.",
    estimatedDuration: "2 недели",
    prototypeUrl: "https://example.com/prototype",
    status: "pending",
    createdAt: "2026-09-23T09:00:00.000Z",
    updatedAt: "2026-09-23T09:00:00.000Z",
    decisionComment: "",
    decidedAt: null,
  }));
}
