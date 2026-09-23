"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, ErrorNotice } from "./ui";
import { DRAFT_EXAMPLES } from "@/lib/client/seeds";
import { RotatingIdeaInput } from "./rotating-idea-input";
import styles from "./landing.module.css";

export function Landing() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [inputError, setInputError] = useState("");

  function start() {
    try {
      if (description.trim())
        sessionStorage.setItem("sana-start-description", description.trim());
    } catch {
      setInputError("Не удалось перенести текст. Скопируйте его и попробуйте ещё раз.");
      return;
    }
    router.push("/business/new");
  }

  return (
    <main id="main-content" className={`container ${styles.home}`}>
      <section className={styles.start} aria-labelledby="start-title">
        <h1 id="start-title" className={styles.title}>Что нужно сделать?</h1>
        {inputError && <ErrorNotice message={inputError} />}
        <form
          className={`idea-composer ${styles.composer}`}
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <RotatingIdeaInput value={description} onChange={setDescription} />
          <div className="idea-composer-footer">
            <span>Проверьте черновик перед публикацией</span>
            <button className="btn btn-blue icon-button" aria-label="Начать создание задачи">
              <Icon name="arrowUp" />
            </button>
          </div>
        </form>
        <div className={`suggestion-chips ${styles.examples}`}>
          {DRAFT_EXAMPLES.slice(0, 3).map((example) => (
            <button key={example.label} onClick={() => setDescription(example.text)}>
              {example.label} <Icon name="plus" size={13} />
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
