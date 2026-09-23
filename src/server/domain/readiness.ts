import type { Readiness, TaskCardFields, TaskField, TaskRecord } from "../../shared/contracts";
import { READINESS_LEVELS, SCORING_DIMENSIONS } from "../../shared/scoring";

export function readinessLevel(score: number): Readiness["readinessLevel"] {
  const level = READINESS_LEVELS.find((item) => score >= item.min && score <= item.max);
  if (!level) throw new RangeError("Score must be between 0 and 100");
  return level.key;
}

export function calculateReadiness(fields: TaskCardFields, confirmedFields: TaskField[]): Readiness {
  const confirmed = new Set(confirmedFields);
  const scoreBreakdown = SCORING_DIMENSIONS.map((dimension) => {
    const missingFields = dimension.fields.filter((field) => !fields[field].trim());
    const unconfirmedFields = dimension.fields.filter((field) => fields[field].trim() && !confirmed.has(field));
    const earned = missingFields.length === 0 && unconfirmedFields.length === 0 ? dimension.weight : 0;
    return {
      ...dimension, fields: [...dimension.fields], earned, missingFields, unconfirmedFields,
      explanation: earned
        ? `Заполнено и подтверждено: +${earned} баллов.`
        : `Для ${dimension.weight} баллов заполните и подтвердите: ${[...missingFields, ...unconfirmedFields].join(", ")}.`,
    };
  });
  const score = scoreBreakdown.reduce((sum, item) => sum + item.earned, 0);
  return {
    score, readinessLevel: readinessLevel(score), scoreBreakdown,
    missingFields: scoreBreakdown.flatMap((item) => item.missingFields),
    unconfirmedFields: scoreBreakdown.flatMap((item) => item.unconfirmedFields),
  };
}

export function taskCard(record: TaskRecord) {
  return { ...record, ...calculateReadiness(record, record.confirmedFields) };
}
