import { TaskCardFieldsSchema, type BuildCardRequest, type TaskField } from "../src/shared/contracts";
import { createSeed } from "../src/server/repositories/seed";

export type AiCase = {
  id: string;
  input: BuildCardRequest;
  known: Partial<Record<TaskField, RegExp>>;
  absent: TaskField[];
  exact?: Partial<Record<TaskField, string>>;
};

const fullFields = TaskCardFieldsSchema.omit({ initialDescription: true }).parse(createSeed().tasks[0]);
export const AI_CASES: AiCase[] = [
  {
    id: "bakery-sparse",
    input: { initialDescription: "У нас небольшая пекарня. Каждый вечер остаётся непроданная выпечка. Хотим уменьшить списания." },
    known: { contextAndNeed: /списания|непроданная/iu },
    absent: ["dataAndMaterials", "successCriteria", "constraints", "businessContact", "interactionFormat"],
  },
  {
    id: "clubs-known-facts",
    input: { initialDescription: "Родители не могут быстро найти подходящий кружок для ребёнка. Нужен каталог кружков с фильтрами по возрасту и району. Есть таблица из 50 кружков с адресами и расписанием." },
    known: { contextAndNeed: /найти/iu, expectedResult: /каталог/iu, dataAndMaterials: /50/iu, targetUsers: /родители/iu },
    absent: ["successCriteria", "constraints", "businessContact", "interactionFormat"],
  },
  {
    id: "repair-specifics",
    input: { initialDescription: "Клиенты постоянно звонят в сервисный центр узнать статус ремонта. Нужна веб-страница просмотра статуса заказа по коду. Пользователи — клиенты сервисного центра. Есть CSV заказов с этапами ремонта. Срок — 2 недели. Контакт — demo-repair@example.com. Встречи по пятницам, обратная связь за 2 дня." },
    known: { contextAndNeed: /звонят/iu, expectedResult: /веб-страница/iu, targetUsers: /клиенты/iu, dataAndMaterials: /CSV/iu, constraints: /2 недели/iu, businessContact: /demo-repair@example\.com/iu, interactionFormat: /пятницам/iu },
    absent: ["successCriteria"],
  },
  {
    id: "complete-user-edits",
    input: {
      initialDescription: "Пекарня хочет уменьшить списания. Ранее обсуждался срок 2 недели.",
      fields: { ...fullFields, constraints: "Новый согласованный срок — 3 недели." },
      answers: [{ field: "constraints", answer: "Окончательный срок — 4 недели." }],
    },
    known: { contextAndNeed: /списывает/iu, expectedResult: /прототип/iu, dataAndMaterials: /CSV/iu, successCriteria: /20%/iu, targetUsers: /пекарь/iu, businessContact: /example\.com/iu, interactionFormat: /пятницам/iu, constraints: /недели/iu },
    absent: [], exact: { constraints: "Окончательный срок — 4 недели." },
  },
  {
    id: "farm-no-digital-data",
    input: { initialDescription: "На ферме график полива ведут в бумажной тетради. Агроном хочет видеть запланированные и выполненные поливы на общей доске. Исторической цифровой базы нет. Пользователь — агроном." },
    known: { contextAndNeed: /полив/iu, expectedResult: /доске/iu, dataAndMaterials: /нет/iu, targetUsers: /агроном/iu },
    absent: ["successCriteria", "constraints", "businessContact", "interactionFormat"],
  },
  {
    id: "museum-stated-deliverable",
    input: { initialDescription: "Музей вручную собирает отзывы посетителей. Нужен отчёт с распределением отзывов по темам. Пользователи — сотрудники музея. Исторических данных нет." },
    known: { contextAndNeed: /отзыв/iu, expectedResult: /отчёт/iu, targetUsers: /сотрудники музея/iu, dataAndMaterials: /нет/iu },
    absent: ["successCriteria", "constraints", "businessContact", "interactionFormat"],
  },
  {
    id: "rejected-deliverables",
    input: { initialDescription: "Пекарня теряет деньги на списаниях. Мы не хотим панель и не планируем создавать каталог. Формат результата ещё не выбран. Данных пока нет." },
    known: { contextAndNeed: /списаниях/iu, dataAndMaterials: /нет/iu },
    absent: ["expectedResult", "successCriteria", "businessContact", "interactionFormat"],
  },
  {
    id: "question-is-not-data",
    input: { initialDescription: "Есть CSV? Ответ: данных нет. Нам не нужен каталог. Итоговый формат ещё обсуждается. Нужно сократить время обработки заявок." },
    known: { dataAndMaterials: /нет/iu },
    absent: ["expectedResult", "successCriteria", "businessContact", "interactionFormat"],
  },
  {
    id: "cancelled-result",
    input: { initialDescription: "Заявки бизнеса теряются в переписке. Нужен каталог заявок. Позже от этой идеи отказались. Новый результат ещё не выбран. Данных нет." },
    known: { contextAndNeed: /заявки|заявок/iu, dataAndMaterials: /нет/iu },
    absent: ["expectedResult", "successCriteria", "businessContact", "interactionFormat"],
  },
  {
    id: "conflicting-data-sources",
    input: { initialDescription: "Заявки обрабатываются вручную. Один представитель сообщает: Есть CSV заказов. Другой представитель сообщает: CSV нет. Противоречие пока не разрешено. Нужна панель заявок." },
    known: { contextAndNeed: /заявки|заявок/iu, expectedResult: /панель/iu },
    absent: ["dataAndMaterials", "successCriteria", "businessContact", "interactionFormat"],
  },
  {
    id: "explicit-answer-overrides",
    input: {
      initialDescription: "Нам не нужен каталог. Данных нет. Срок 2 недели.",
      fields: { expectedResult: "Каталог заявок после пересмотра решения.", dataAndMaterials: "Теперь доступен CSV за 6 месяцев.", constraints: "Новый срок 4 недели." },
      answers: [{ field: "constraints", answer: "Последнее решение: срок 5 недель." }],
    },
    known: { expectedResult: /Каталог заявок/iu, dataAndMaterials: /CSV за 6 месяцев/iu, constraints: /недел/iu },
    absent: ["successCriteria", "businessContact", "interactionFormat"],
    exact: { constraints: "Последнее решение: срок 5 недель." },
  },
  {
    id: "conditional-data-english",
    input: { initialDescription: "Customers call to ask about repair progress. We need a status page. If access is granted, CSV is available. Access approval is still pending." },
    known: { contextAndNeed: /repair|Customers/iu, expectedResult: /status page/iu },
    absent: ["dataAndMaterials", "successCriteria", "businessContact", "interactionFormat"],
  },
];
