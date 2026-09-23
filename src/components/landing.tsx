"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Icon,
  Badge,
  ScoreRing,
  TaskTile,
  BrandMark,
  LoadingState,
  ErrorNotice,
  EmptyState,
} from "./ui";
import { DRAFT_EXAMPLES } from "@/lib/client/seeds";
import { taskService } from "@/lib/client/service";
import { useResource } from "@/lib/client/use-resource";

export function Landing() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<"before" | "after">("after");
  const score = preview === "after" ? 100 : 20;
  const load = useCallback(() => taskService.listTasks(), []);
  const { data, loading, error, retry } = useResource(load);
  const featured = data?.slice(0, 3) ?? [];
  const [inputError, setInputError] = useState("");
  function start() {
    try {
      if (description.trim())
        sessionStorage.setItem("sana-start-description", description.trim());
    } catch {
      setInputError(
        "Браузер не разрешил перенести текст. Скопируйте идею и откройте конструктор кнопкой вверху.",
      );
      return;
    }
    router.push("/business/new");
  }
  return (
    <main id="main-content">
      <section className="hero container">
        <div className="hero-eyebrow">
          <span className="blue-dot" />
          БИЗНЕС × ТАЛАНТЫ × AI
        </div>
        <h1>
          Большие решения
          <br />
          начинаются <span>с задачи.</span>
        </h1>
        <div className="hero-bottom">
          <p>
            Превратите идею в понятную задачу с AI.
            <br />
            Найдите команду, которая воплотит её в жизнь.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-blue" href="/business/new">
              Создать задачу <Icon name="arrow" />
            </Link>
            <Link className="text-link" href="/catalog">
              Найти свой проект <Icon name="arrow" />
            </Link>
          </div>
        </div>
        <div className="product-stage">
          <div className="stage-top">
            <div className="window-dots">
              <i />
              <i />
              <i />
            </div>
            <span>От идеи — к готовой задаче</span>
            <span className="stage-live">
              <span className="dot" />
              Task Hub workspace
            </span>
          </div>
          <div className="workspace-preview">
            <aside className="preview-nav">
              <BrandMark />
              <div className="preview-nav-item selected">
                <Icon name="file" />
                Моя задача
              </div>
              <div className="preview-nav-item">
                <Icon name="spark" />
                AI-помощник
              </div>
              <div className="preview-nav-item">
                <Icon name="grid" />
                Каталог
              </div>
              <div className="preview-nav-foot">
                <span className="avatar">A</span>
                <span>
                  Бизнес
                  <br />
                  <small>Кофейня</small>
                </span>
              </div>
            </aside>
            <div className="preview-main">
              <div className="preview-breadcrumb">
                Мои задачи <Icon name="chevron" size={12} /> Новая возможность
              </div>
              <div className="coffee-visual">
                <div className="coffee-orbit" />
                <div className="coffee-cup">
                  <span />
                  <i />
                </div>
                <span className="coffee-copy">
                  Less waiting.
                  <br />
                  <strong>More coffee.</strong>
                </span>
                <span className="coffee-number">01 / RETAIL</span>
              </div>
              <div className="preview-title">
                <div>
                  <span className="overline">РИТЕЙЛ · ВЕБ-ПРИЛОЖЕНИЕ</span>
                  <h2>Кофе без очереди</h2>
                </div>
                <Badge score={score} />
              </div>
              <p className="preview-description">
                {preview === "after"
                  ? "Веб-прототип предзаказа для кофейни. Меню для гостей и удобный экран очереди для бариста."
                  : "У нас кофейня. По утрам длинные очереди, хотим сократить время ожидания заказа."}
              </p>
              <div className="preview-fields">
                <div>
                  <Icon name={preview === "after" ? "check" : "plus"} />
                  {preview === "after"
                    ? "Данные предоставлены"
                    : "Добавьте данные"}
                </div>
                <div>
                  <Icon name={preview === "after" ? "check" : "plus"} />
                  {preview === "after"
                    ? "Результат определён"
                    : "Уточните результат"}
                </div>
              </div>
            </div>
            <aside className="preview-assistant">
              <div className="assistant-title">
                <span className="spark-box">
                  <Icon name="spark" />
                </span>
                <strong>От идеи к действию</strong>
              </div>
              <p>
                Каждое уточнение приближает вашу задачу к подходящей команде.
              </p>
              <div className="preview-score">
                <ScoreRing score={score} />
                <span>Готовность к работе</span>
              </div>
              <div className="preview-score-bar">
                <i style={{ width: `${score}%` }} />
              </div>
              <div className="preview-success">
                <Icon name={preview === "after" ? "check" : "spark"} />
                <span>
                  {preview === "after"
                    ? "Всё готово. Время найти команду."
                    : "Есть идея. Давайте добавим детали."}
                </span>
              </div>
              <div
                className="preview-toggle"
                aria-label="Пример изменения рейтинга"
              >
                <button
                  aria-pressed={preview === "before"}
                  className={preview === "before" ? "active" : ""}
                  onClick={() => setPreview("before")}
                >
                  До уточнения
                </button>
                <button
                  aria-pressed={preview === "after"}
                  className={preview === "after" ? "active" : ""}
                  onClick={() => setPreview("after")}
                >
                  После
                </button>
              </div>
            </aside>
          </div>
        </div>
        <div className="hero-footnote">
          <span>Идеям нужен первый шаг.</span>
          <div>
            <span>
              <Icon name="check" size={14} />
              Открытый каталог
            </span>
            <span>
              <Icon name="check" size={14} />
              Прозрачный рейтинг
            </span>
            <span>
              <Icon name="check" size={14} />
              Выбор за вами
            </span>
          </div>
        </div>
      </section>
      <section className="container section" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">МЕНЬШЕ НЕОПРЕДЕЛЁННОСТИ</span>
            <h2>
              Вы знаете свой бизнес.
              <br />
              <span>AI поможет с деталями.</span>
            </h2>
          </div>
          <p>
            От первого «а что, если» до предложения
            <br />
            от команды. В одном пространстве.
          </p>
        </div>
        <div className="how-grid">
          <article>
            <span className="step-number">01</span>
            <div className="how-visual question-visual">
              <span>«Хочу улучшить сервис…»</span>
              <div>
                <Icon name="spark" />
                Для кого создаём решение?
              </div>
              <div>
                <Icon name="spark" />
                Как измерим результат?
              </div>
            </div>
            <h3>Начните с идеи</h3>
            <p>
              Расскажите о проблеме своими словами. Уточняющие вопросы помогут
              заполнить пробелы.
            </p>
          </article>
          <article>
            <span className="step-number">02</span>
            <div className="how-visual rating-visual">
              <span>
                20 <Icon name="arrow" size={24} /> <strong>100</strong>
              </span>
              <div className="rating-bars">
                {[20, 35, 50, 65, 80, 100].map((height) => (
                  <i key={height} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
            <h3>Сделайте задачу понятной</h3>
            <p>
              Дополняйте карточку и повышайте её рейтинг. Каждый балл объясним,
              каждое поле под вашим контролем.
            </p>
          </article>
          <article>
            <span className="step-number">03</span>
            <div className="how-visual teams-visual">
              <div className="mini-team">
                <span className="avatar blue">Z</span>
                <span>
                  ZSA<small>React · AI</small>
                </span>
                <Icon name="check" />
              </div>
              <div className="mini-team">
                <span className="avatar violet">O</span>
                <span>
                  Orbit<small>Python · Data</small>
                </span>
                <span className="dim">→</span>
              </div>
            </div>
            <h3>Найдите своих людей</h3>
            <p>
              Команды предлагают решения. Сравнивайте идеи и выбирайте, с кем
              двигаться дальше.
            </p>
          </article>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ОТКРЫТЫЕ ВОЗМОЖНОСТИ</span>
            <h2>
              Задачи с настоящим
              <br />
              <span>смыслом.</span>
            </h2>
          </div>
          <Link className="btn btn-secondary" href="/catalog">
            Весь каталог <Icon name="arrow" />
          </Link>
        </div>
        {loading ? (
          <LoadingState label="Находим задачи…" />
        ) : error ? (
          <ErrorNotice message={error} retry={retry} />
        ) : featured.length === 0 ? (
          <EmptyState
            title="Первая возможность за вами"
            description="Создайте задачу, чтобы команды смогли предложить решение."
          />
        ) : (
          <div className="task-grid">
            {featured.map((task) => (
              <TaskTile key={task.id} task={task} />
            ))}
          </div>
        )}
      </section>
      <section className="container start-section">
        <span className="eyebrow">ВАША СЛЕДУЮЩАЯ ИДЕЯ</span>
        <h2>Всё начинается здесь.</h2>
        {inputError && <ErrorNotice message={inputError} />}
        <form
          className="idea-composer"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <label className="sr-only" htmlFor="landing-idea">
            Опишите вашу идею
          </label>
          <textarea
            id="landing-idea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={4000}
            placeholder="Какую задачу вы давно хотели решить?"
          />
          <div>
            <span>
              <Icon name="spark" size={16} />
              Task Hub · помощник бизнеса
            </span>
            <button
              className="btn btn-blue icon-button"
              aria-label="Начать создание задачи"
            >
              <Icon name="arrowUp" />
            </button>
          </div>
        </form>
        <div className="suggestion-chips">
          {DRAFT_EXAMPLES.slice(0, 3).map((example) => (
            <button
              key={example.label}
              onClick={() => setDescription(example.text)}
            >
              {example.label} <Icon name="plus" size={13} />
            </button>
          ))}
        </div>
        <Link className="text-link muted" href="/catalog">
          Я из команды — хочу найти задачу <Icon name="arrow" size={16} />
        </Link>
      </section>
    </main>
  );
}
