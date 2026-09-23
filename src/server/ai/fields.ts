import { z } from "zod";
import type { TaskField } from "../../shared/contracts";

export const FIELD_LABELS: Record<TaskField, string> = {
  title: "Название", initialDescription: "Исходное описание", industry: "Отрасль", topic: "Тема",
  contextAndNeed: "Контекст и потребность", dataAndMaterials: "Данные и материалы",
  expectedResult: "Ожидаемый результат", successCriteria: "Критерии успеха",
  constraints: "Ограничения", targetUsers: "Пользователи", businessContact: "Контакт бизнеса",
  interactionFormat: "Взаимодействие с бизнесом",
};

const quote = (description: string) => z.string().describe(`${description} Точная цитата из входных данных, без пересказа. Если сведений нет — пустая строка.`);
// Descriptions travel with the JSON schema, next to each extraction target.
export const ExtractedFieldsSchema = z.object({
  title: quote("Короткая фраза о задаче, до 200 символов."),
  industry: quote("Явно указанная отрасль, до 200 символов. Не классифицируй самостоятельно."),
  topic: quote("Явно указанная тема, до 200 символов. Не классифицируй самостоятельно."),
  contextAndNeed: quote("Проблема и текущий процесс бизнеса. Извлеки из initialDescription; не пропускай описанную проблему."),
  dataAndMaterials: quote("Доступные данные, их формат и доступ. Явное отсутствие данных тоже сохраняй, вместе с отрицанием."),
  expectedResult: quote("Продукт работы команды: сервис, страница, доска, каталог, прототип, отчёт. Фразы «нужен/хотим» часто содержат результат."),
  successCriteria: quote("Метрика и способ приёмки результата. Не придумывай значения из общей цели улучшения."),
  constraints: quote("Согласованные сроки, бюджет, технические ограничения. Не превращай неизвестный бюджет в нулевой."),
  targetUsers: quote("Кто использует результат. Извлеки название роли как есть, без добавления пояснений или смены падежа."),
  businessContact: quote("Контакт представителя бизнеса, до 200 символов. Не добавляй вымышленные адреса."),
  interactionFormat: quote("Встречи студенческой команды с бизнесом и сроки обратной связи. Не канал уведомлений пользователей продукта."),
});
