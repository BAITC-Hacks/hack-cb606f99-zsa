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
];
