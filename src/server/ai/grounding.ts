import type { TaskField } from "../../shared/contracts";
import { hasConcreteDeliverable } from "./result-quote";

type Passage = { text: string; start: number; end: number; source: number };
const word = (pattern: string, flags = "iu") => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`, flags);
const NEGATION = "не|нет|без|никогда|ни|отсутств[\\p{L}]*|not|no|never|without|missing|cannot|can't|don't|doesn't|isn't|aren't";
const UNCERTAINTY = "если|ли|возможно|вероятно|неизвест[\\p{L}]*|неопредел[\\p{L}]*|if|unless|maybe|perhaps|unknown|undecided";
const CANCELLATION = "отказ[\\p{L}]*|отмен[\\p{L}]*|передум[\\p{L}]*|cancel[\\p{L}]*|reject[\\p{L}]*|withdraw[\\p{L}]*";
const negative = word(NEGATION);
// An unrelated problem predicate ("не могут найти кружки") does not deny the
// existence of a later table of clubs merely because the noun is repeated.
const factualDenial = word("нет|отсутств[\\p{L}]*|недоступ[\\p{L}]*|не\\s+(?:есть|име[\\p{L}]*|буд[\\p{L}]*|доступ[\\p{L}]*|предостав[\\p{L}]*|соглас[\\p{L}]*)|no|unavailable|missing|(?:not|never|don't|doesn't|do\\s+not)\\s+(?:have|available|exist|provided)");
const uncertain = word(UNCERTAINTY);
const cancelled = word(CANCELLATION);
const qualifier = word(`${NEGATION}|${UNCERTAINTY}|${CANCELLATION}|раньше|ранее|previously|formerly`, "giu");
const excludedResult = word("не\\s+(?:нуж[\\p{L}]*|хот[\\p{L}]*|планиру[\\p{L}]*|требу[\\p{L}]*|выбран[\\p{L}]*)|(?:not|no)\\s+(?:needed|wanted|planned)|(?:don't|do\\s+not)\\s+(?:need|want|plan)");
const excludedRole = word("не\\s+(?:буд[\\p{L}]*\\s+)?(?:польз[\\p{L}]*|использ[\\p{L}]*)|(?:not|never|don't|doesn't)\\s+(?:use|users)|(?:will\\s+not|won't)\\s+use");
const generalGoal = word("сокра[тщ][\\p{L}]*|уменьш[\\p{L}]*|увелич[\\p{L}]*|повыс[\\p{L}]*|улучш[\\p{L}]*|ускор[\\p{L}]*|оптимиз[\\p{L}]*|сниз[\\p{L}]*|reduce[\\p{L}]*|increase[\\p{L}]*|improv[\\p{L}]*|optimi[sz][\\p{L}]*");
const dataResource = word("данн[\\p{L}]*|баз[\\p{L}]*|csv|excel|датасет[\\p{L}]*|data|database|dataset");
const absentResource = word("нет|отсутств[\\p{L}]*|no|(?:not|don't|doesn't|do\\s+not)\\s+have");
const projectConstraintLabel = "(?:срок(?:\\s+(?:разработки|реализации|выполнения|проекта))?|бюджет(?:\\s+(?:проекта|разработки))?|ограничения(?:\\s+проекта)?|(?:project\\s+)?(?:deadline|budget|constraints))";
const labelledConstraint = new RegExp(`^${projectConstraintLabel}\\s*[:—–-]\\s*\\S`, "iu");
const numericConstraint = new RegExp(`^${projectConstraintLabel}\\s+(?:до\\s+)?\\d`, "iu");
const interactionTime = word("обратн[\\p{L}]*|ответ[\\p{L}]*|встреч[\\p{L}]*|feedback|response|meeting");
const alternatives = word("или|либо|or|either");
const STOP_WORDS = new Set("для как что это эта этот уже будет будут должен должна нужно нужен нужна нужны хотим хочет есть нет без если или при ещё еще был была были and the this that with from have has need needs want wants not no for are was were will would should".split(" "));

function passages(source: string, sourceIndex: number): Passage[] {
  const result: Passage[] = [];
  let start = 0;
  // A period inside an email address/decimal is not a sentence boundary.
  for (const boundary of source.matchAll(/[.!?…]+(?=\s|$)|[\r\n]+/gu)) {
    const end = boundary.index + boundary[0].length;
    result.push({ text: source.slice(start, end), start, end, source: sourceIndex });
    start = end;
  }
  if (start < source.length) result.push({ text: source.slice(start), start, end: source.length, source: sourceIndex });
  return result;
}

function anchors(text: string): Set<string> {
  const tokens = text.toLocaleLowerCase("ru").replaceAll("ё", "е").match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(tokens.filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .map((token) => /^[а-я]+$/u.test(token) && token.length > 5 ? token.slice(0, 5) : token));
}

function related(a: string, b: string): boolean {
  const left = anchors(a);
  return [...anchors(b)].some((token) => left.has(token));
}

function conflictingNumbers(a: string, b: string): boolean {
  const left = a.match(/\d+(?:[.,]\d+)?/gu) ?? [];
  const right = b.match(/\d+(?:[.,]\d+)?/gu) ?? [];
  return left.length > 0 && right.length > 0 && left.join("|") !== right.join("|");
}

function safeOccurrence(quote: string, start: number, sourceIndex: number, all: Passage[], field?: TaskField): boolean {
  const end = start + quote.length;
  const containing = all.filter((passage) => passage.source === sourceIndex && passage.start < end && passage.end > start);
  if (!containing.length) return false;
  const isContext = field === "contextAndNeed";
  for (const passage of containing) {
    // Context may retain the original question/problem; factual fields may not
    // turn questions or conditional scenarios into established facts.
    if (!isContext && (passage.text.includes("?") || uncertain.test(passage.text))) return false;
    if (field === "expectedResult" && (cancelled.test(passage.text) || excludedResult.test(passage.text))) return false;
    if (field === "constraints" && alternatives.test(passage.text)) return false;
    if (field === "targetUsers" && excludedRole.test(passage.text)) return false;
    for (const marker of passage.text.matchAll(qualifier)) {
      const markerStart = passage.start + marker.index;
      const included = markerStart >= start && markerStart + marker[0].length <= end;
      // A role before a predicate like "Родители не могут найти кружок" is
      // still stated. This exception does not permit explicitly excluded users.
      const namedRole = field === "targetUsers" && !excludedRole.test(passage.text) &&
        passage.text.trimStart().startsWith(quote) && end <= markerStart;
      if (!included && !namedRole) return false;
    }
    if (isContext) continue;
    for (const other of all) {
      if (other === passage) continue;
      const after = other.source > sourceIndex || (other.source === sourceIndex && other.start >= end);
      // A later cancellation can refer to "that idea" rather than repeat its name.
      if (after && cancelled.test(other.text) && (field === "expectedResult" || field === "constraints" || related(quote, other.text))) return false;
      if (!related(quote, other.text)) continue;
      const polarityConflict = field === "expectedResult" ? excludedResult.test(other.text)
        : field === "targetUsers" ? excludedRole.test(other.text)
        : negative.test(passage.text) !== negative.test(other.text) &&
          (factualDenial.test(passage.text) || factualDenial.test(other.text));
      if (polarityConflict ||
          cancelled.test(other.text) || uncertain.test(other.text) || other.text.includes("?") ||
          conflictingNumbers(passage.text, other.text)) return false;
    }
  }
  return true;
}

// Recover original spelling/spacing, but also keep the surrounding qualifiers.
// This is a conservative lexical/context guard, not a proof of semantic truth.
// Explicit user edits/answers bypass it in AiService; model suggestions do not.
export function sourceQuote(value: string, sources: string[], field?: TaskField): string | undefined {
  const phrase = value.replace(/[.!…]+$/u, "").trim();
  if (!phrase || phrase.includes("?")) return undefined;
  // A stated business objective is not yet the artifact a team should deliver.
  if (field === "expectedResult" && generalGoal.test(phrase) && !hasConcreteDeliverable(phrase)) return undefined;
  const pattern = phrase.split(/\s+/u).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const expression = new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, "giu");
  const all = sources.flatMap(passages);
  let recovered: string | undefined;
  for (const [sourceIndex, source] of sources.entries()) {
    for (const match of source.matchAll(expression)) {
      if (!safeOccurrence(match[0], match.index, sourceIndex, all, field)) return undefined;
      // Preserve exact supplied punctuation when it really occurs in the source.
      recovered ??= source.slice(match.index, match.index + value.length) === value ? value : match[0];
    }
  }
  return recovered;
}

// Recover a complete explicit absence statement if the model omitted or
// shortened it. The same context/conflict guard still decides whether it is safe.
export function explicitDataAbsenceQuote(description: string): string | undefined {
  const candidates = passages(description, 0).map((passage) => passage.text.trim())
    .filter((text) => text.length <= 5000 && dataResource.test(text) && absentResource.test(text))
    .map((text) => sourceQuote(text, [description], "dataAndMaterials"))
    .filter((text): text is string => text !== undefined);
  return candidates.length === 1 ? candidates[0] : undefined;
}

// A single labelled project constraint can be copied without interpreting a
// schedule buried in prose. Communication/feedback deadlines are not project deadlines.
export function explicitConstraintQuote(description: string): string | undefined {
  const candidates = passages(description, 0).map((passage) => passage.text.trim())
    .filter((text) => text.length <= 5000 && (labelledConstraint.test(text) || numericConstraint.test(text)) && !interactionTime.test(text))
    .map((text) => sourceQuote(text, [description], "constraints"))
    .filter((text): text is string => text !== undefined);
  return candidates.length === 1 ? candidates[0] : undefined;
}
