"use client";

import { useEffect, useState } from "react";

const EXAMPLES = [
  "Хочу сократить очередь в кофейне",
  "Нужно собрать заказы в одном месте",
  "Помогите спланировать доставку по городу",
  "Хочу упростить запись на занятия",
];

function RotatingPlaceholder() {
  const [text, setText] = useState("");

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let example = 0;
    let length = 0;
    let deleting = false;

    function tick() {
      if (motion.matches || document.hidden) return;

      const phrase = EXAMPLES[example];
      length += deleting ? -1 : 1;
      setText(phrase.slice(0, length));

      let delay = deleting ? 28 : 65;
      if (!deleting && length === phrase.length) {
        deleting = true;
        delay = 2200;
      } else if (deleting && length === 0) {
        deleting = false;
        example = (example + 1) % EXAMPLES.length;
        delay = 450;
      }
      timer = setTimeout(tick, delay);
    }

    function resume() {
      clearTimeout(timer);
      if (!motion.matches && !document.hidden) timer = setTimeout(tick, 450);
    }

    resume();
    motion.addEventListener("change", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      motion.removeEventListener("change", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  return (
    <span className="idea-placeholder" aria-hidden="true">
      <span className="idea-placeholder-animated">
        {text}<span className="typing-caret" />
      </span>
      <span className="idea-placeholder-static">{EXAMPLES[0]}</span>
    </span>
  );
}

export function RotatingIdeaInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="idea-input">
      <label className="sr-only" htmlFor="landing-idea">
        Опишите задачу
      </label>
      <span className="sr-only" id="landing-idea-hint">
        Например: сократить очередь в кофейне или упростить запись на занятия
      </span>
      <textarea
        id="landing-idea"
        aria-describedby="landing-idea-hint"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={4000}
        placeholder={focused ? "Опишите задачу своими словами" : ""}
      />
      {!focused && value.length === 0 && <RotatingPlaceholder />}
    </div>
  );
}
