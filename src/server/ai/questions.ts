import type { z } from "zod";
import type { ClarifyingQuestionSchema, TaskCardFields, TaskField } from "../../shared/contracts";

type Question = z.infer<typeof ClarifyingQuestionSchema>;
const QUESTIONS: Partial<Record<TaskField, [string, string]>> = {
  contextAndNeed: ["Как сейчас решается проблема и что именно не устраивает?", "Нужны текущий процесс и потребность бизнеса."],
  expectedResult: ["Что команда должна передать вам: прототип, сервис, отчёт или другой результат?", "Это определит объём работы команды."],
  dataAndMaterials: ["Какие данные доступны, в каком формате и как команда получит к ним доступ? Если данных нет, укажите это явно.", "Данные влияют на реализуемость решения."],
  successCriteria: ["По какой метрике, целевому значению и проверке вы примете результат?", "Нужны измеримые условия приёмки."],
  constraints: ["Какие ограничения по срокам, бюджету, технологиям и данным нужно учесть?", "Нужны границы задачи."],
  targetUsers: ["Кто будет пользоваться результатом и в какой ситуации?", "Нужны пользователи и сценарий применения."],
  businessContact: ["Кто со стороны бизнеса отвечает на вопросы команды и как с ним связаться?", "Команде нужен ответственный представитель бизнеса."],
  interactionFormat: ["Как часто команда сможет встречаться с вами и за какое время получать обратную связь?", "Нужно согласовать общение команды с бизнесом в ходе работы."],
  title: ["Как коротко назвать задачу?", "Название поможет найти её в каталоге."],
  industry: ["К какой отрасли относится задача?", "Отрасль используется для поиска задач."],
  topic: ["Какую тему указать для задачи?", "Тема используется в фильтрах каталога."],
};
const PRIORITY: TaskField[] = ["expectedResult", "dataAndMaterials", "successCriteria", "constraints", "targetUsers", "businessContact", "interactionFormat", "contextAndNeed", "title", "industry", "topic"];
const REVIEWS: { field: TaskField; question: string }[] = [
  { field: "successCriteria", question: "какие пограничные случаи нужно включить в проверку результата? При необходимости дополните весь текст критериев." },
  { field: "constraints", question: "есть ли исключения или зависимости, которые нужно добавить к ограничениям? Если да, укажите полную исправленную формулировку." },
  { field: "dataAndMaterials", question: "нужны ли дополнительные условия доступа или обезличивания? Если да, дополните полный текст о данных." },
  { field: "expectedResult", question: "нужно ли уточнить состав передаваемого результата? Если да, укажите полную исправленную формулировку." },
  { field: "targetUsers", question: "нужно ли добавить отдельный сценарий использования? Если да, дополните полный текст о пользователях." },
];

export function relevantQuestions(proposed: Question[], card: TaskCardFields, missingFields: TaskField[]): Question[] {
  const missing = new Set(missingFields);
  const context = (card.title || card.initialDescription).slice(0, 100);
  const selected: Omit<Question, "id">[] = [];
  const textSeen = new Set<string>();
  for (const field of PRIORITY.filter((field) => missing.has(field)).slice(0, 8)) {
    const candidate = proposed.find((item) => item.field === field && !textSeen.has(item.question.toLocaleLowerCase("ru")));
    const [question, reason] = QUESTIONS[field]!;
    const item = candidate ?? { field, question: `Для задачи «${context}»: ${question}`, reason };
    selected.push(item);
    textSeen.add(item.question.toLocaleLowerCase("ru"));
  }
  // Complete cards still need three useful checks, without asking users to re-enter known facts.
  for (const review of REVIEWS) {
    if (selected.length >= 3) break;
    if (!card[review.field]) continue;
    selected.push({
      field: review.field,
      question: `Проверка: уже указано «${card[review.field].slice(0, 200)}»; ${review.question}`,
      reason: "Сведения уже известны. Это дополнительная проверка; если правок нет, ответ можно пропустить.",
    });
  }
  return selected.map((question, index) => ({ ...question, id: `question-${index + 1}` }));
}
