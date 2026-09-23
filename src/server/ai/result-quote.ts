// This is a conservative recovery path, not a second text generator. It copies a
// whole source sentence only when a concrete deliverable is explicitly requested.
// Ambiguous, conditional, negated and competing requests stay with human review.
const word = (pattern: string) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`, "iu");
const request = word("нужен|нужна|нужно|нужны|требуется|требуются|(?:хочу|хочет|хотим|хотят)\\s+(?:видеть|получить|создать|сделать|разработать|внедрить|запустить)");
const deliverable = word("(?:доск|панел|каталог|страниц|сервис|прототип|отч[её]т|дашборд|приложени|сайт|бот|таблиц)(?:а|у|е|и|ы|ой|ом|ам|ами|ах|ов|ей|ям|ями|ях|ь|ью|я|ю|ем|й)?");
const uncertain = word("не|нет|без|если|ли|или|либо|возможно|вероятно|может|пока|раньше|ранее|когда-то|планировали|предлагали|думали|отказ[\\p{L}]*|отмен[\\p{L}]*|передум[\\p{L}]*");
const discussion = word("существующ[\\p{L}]*|имеющ[\\p{L}]*|консультаци[\\p{L}]*|обсуждени[\\p{L}]*|обсудить|понять|узнать|выбрать|определить");
const retracted = word("отказ[\\p{L}]*|отмен[\\p{L}]*|передум[\\p{L}]*|не\\s+(?:нуж[\\p{L}]*|хот[\\p{L}]*|планируем)");

export function explicitResultQuote(description: string): string | undefined {
  const sentences = description.match(/[^.!?…\r\n]+[.!?…]*/gu)?.map((sentence) => sentence.trim()) ?? [];
  // A later cancellation must not resurrect an earlier requested deliverable.
  if (sentences.some((sentence) => retracted.test(sentence))) return undefined;
  const candidates = sentences.filter((sentence) => {
    if (sentence.length > 5000 || sentence.includes("?") || uncertain.test(sentence) || discussion.test(sentence)) return false;
    const intent = request.exec(sentence);
    // An existing artifact mentioned before the request is not the requested result.
    return intent !== null && deliverable.test(sentence.slice(intent.index + intent[0].length));
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}
