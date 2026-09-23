export const SCORING_DIMENSIONS = [
  { key: "contextAndNeed", label: "Контекст и потребность", weight: 20 },
  { key: "dataAndMaterials", label: "Данные и материалы", weight: 20 },
  { key: "expectedResult", label: "Ожидаемый результат", weight: 15 },
  { key: "successCriteria", label: "Критерии успеха", weight: 15 },
  { key: "constraints", label: "Ограничения", weight: 10 },
  { key: "targetUsers", label: "Пользователи", weight: 10 },
  { key: "businessContact", label: "Связь с бизнесом", weight: 10 },
] as const;

export const READINESS_LEVELS = [
  { key: "draft", label: "Черновик", min: 0, max: 39 },
  { key: "workable", label: "Рабочая", min: 40, max: 69 },
  { key: "ready", label: "Готовая", min: 70, max: 89 },
  { key: "priority", label: "Приоритетная", min: 90, max: 100 },
] as const;

export type ScoringDimensionKey =
  (typeof SCORING_DIMENSIONS)[number]["key"];

export const MAX_TASK_SCORE = SCORING_DIMENSIONS.reduce(
  (sum, dimension) => sum + dimension.weight,
  0,
);
