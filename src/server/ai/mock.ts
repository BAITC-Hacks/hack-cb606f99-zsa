import { emptyTaskFields, type AnalyzeDraftRequest, type TaskField } from "../../shared/contracts";
import type { AiProvider, CardInput } from "./provider";

const QUESTIONS: { field: TaskField; question: string; reason: string }[] = [
  { field: "contextAndNeed", question: "Как сейчас решается эта проблема и что именно не устраивает?", reason: "Нужен понятный контекст и потребность бизнеса." },
  { field: "expectedResult", question: "Какой конкретный результат должна передать команда: прототип, отчёт или сервис?", reason: "Команда должна понимать границы результата." },
  { field: "successCriteria", question: "Как проверите успех: какая метрика, целевое значение и тестовая выборка?", reason: "Нужны измеримые критерии приёмки." },
  { field: "dataAndMaterials", question: "Какие данные и примеры доступны, в каком формате и как команда получит к ним доступ?", reason: "Данные определяют реализуемость задачи." },
  { field: "targetUsers", question: "Кто будет пользоваться результатом и в какой ситуации?", reason: "Нужно определить пользователей и их сценарий." },
  { field: "constraints", question: "Какие есть ограничения по срокам, бюджету, технологиям и обработке данных?", reason: "Ограничения влияют на план и объём работ." },
  { field: "businessContact", question: "Кто со стороны бизнеса отвечает на вопросы и как с ним связаться?", reason: "Команде нужен контакт представителя бизнеса." },
  { field: "interactionFormat", question: "Как часто сможете встречаться и в какой срок давать обратную связь?", reason: "Нужен согласованный формат взаимодействия и обратной связи." },
];

export class MockAiProvider implements AiProvider {
  async analyze(input: AnalyzeDraftRequest) {
    const fields = { ...emptyTaskFields(input.initialDescription), ...input.fields };
    const missing = QUESTIONS.filter((item) => !fields[item.field].trim());
    const selected = [...missing];
    for (const question of QUESTIONS) {
      if (selected.length >= 3) break;
      if (!selected.includes(question)) selected.push(question);
    }
    const context = input.initialDescription.slice(0, 100);
    return {
      questions: selected.map((item, index) => ({
        ...item, id: `question-${index + 1}`,
        question: `Для задачи «${context}»: ${item.question}`,
      })),
      missingFields: missing.map((item) => item.field),
    };
  }

  async buildCard(input: CardInput) {
    const card = {
      ...emptyTaskFields(input.initialDescription),
      title: input.initialDescription.slice(0, 200),
      contextAndNeed: input.initialDescription.slice(0, 5000),
      ...input.fields,
    };
    // A deterministic fallback copies only user-supplied facts; the last answer wins.
    for (const { field, answer } of input.answers) card[field] = answer;
    return card;
  }
}
