"use client";

import { useState } from "react";
import { Icon, Badge, ScoreRing, BrandMark } from "./ui";
import { Reveal } from "./reveal";
import styles from "./landing-preview.module.css";

export function HowItWorks() {
  const [preview, setPreview] = useState<"before" | "after">("after");
  const score = preview === "after" ? 100 : 20;

  return (
    <main id="main-content" className="how-it-works-page">
      <section className="hero container">
        <div className="hero-eyebrow">БИЗНЕС И КОМАНДЫ</div>
        <h1>
          Задачи бизнеса
          <br />
          <span>для вашей команды</span>
        </h1>
        <div className="hero-bottom">
          <p>
            Опубликуйте задачу и выберите команду
          </p>
        </div>
        <Reveal className="product-stage">
          <div className="stage-top">
            <span>Пример задачи</span>
            <span className="stage-live">Task Hub</span>
          </div>
          <div className="workspace-preview">
            <aside className="preview-nav">
              <BrandMark />
              <div className="preview-nav-item selected">
                <Icon name="file" />
                Моя задача
              </div>
              <div className="preview-nav-item">
                <Icon name="file" />
                Уточнения
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
            <div className="preview-main content-enter" key={preview}>
              <div className="preview-breadcrumb">
                Мои задачи <Icon name="chevron" size={12} /> Предзаказ в кофейне
              </div>
              <div className={`coffee-visual ${styles.coffeeVisual}`}>
                <div className="coffee-orbit" />
                <div className="coffee-cup">
                  <span />
                  <i />
                </div>
                <span className="coffee-copy">
                  Заказывайте
                  <br />
                  <strong>без очереди</strong>
                </span>
              </div>
              <div className="preview-title">
                <div>
                  <span className="overline">РИТЕЙЛ / ВЕБ-ПРИЛОЖЕНИЕ</span>
                  <h2>Кофе без очереди</h2>
                </div>
                <Badge score={score} />
              </div>
              <p className="preview-description">
                {preview === "after"
                  ? "Предзаказ для гостей и экран заказов для бариста"
                  : "По утрам гости долго ждут заказ"}
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
            <aside className={`preview-assistant ${styles.assistant}`}>
              <h3 className={styles.title}>Заполнение карточки</h3>
              <div className={styles.score}>
                <ScoreRing score={score} showMaximum={false} />
                <span>из 100 баллов</span>
              </div>
              <div className={styles.progress} aria-hidden="true">
                <i style={{ width: `${score}%` }} />
              </div>
              <div className={styles.status}>
                <Icon name={preview === "after" ? "check" : "file"} />
                <span>
                  {preview === "after"
                    ? "Все сведения подтверждены"
                    : "Добавьте данные и требования"}
                </span>
              </div>
              <div
                className={styles.toggle}
                role="group"
                aria-label="Пример изменения рейтинга"
              >
                <button
                  aria-pressed={preview === "before"}
                  type="button"
                  onClick={() => setPreview("before")}
                >
                  До уточнения
                </button>
                <button
                  aria-pressed={preview === "after"}
                  type="button"
                  onClick={() => setPreview("after")}
                >
                  После
                </button>
              </div>
            </aside>
          </div>
        </Reveal>
      </section>
      <section className="container section" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">КАК ЭТО РАБОТАЕТ</span>
            <h2>
              Опишите задачу
              <br />
              <span>и получите отклики</span>
            </h2>
          </div>
        </div>
        <Reveal className="how-grid">
          <article>
            <span className="step-number">01</span>
            <div className="how-visual question-visual">
              <span>«В кофейне очередь по утрам»</span>
              <div>
                Для кого создаём решение?
              </div>
              <div>
                Как измерим результат?
              </div>
            </div>
            <h3>Опишите проблему</h3>
            <p>
              Что не работает и что хотите изменить
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
            <h3>Заполните карточку</h3>
            <p>
              Укажите данные и результат, проверьте сведения
            </p>
          </article>
          <article>
            <span className="step-number">03</span>
            <div className="how-visual teams-visual">
              <div className="mini-team">
                <span className="avatar blue">Z</span>
                <span>
                  ZSA<small>React / TypeScript</small>
                </span>
                <Icon name="check" />
              </div>
              <div className="mini-team">
                <span className="avatar violet">O</span>
                <span>
                  Orbit<small>Python / SQL</small>
                </span>
                <span className="dim">→</span>
              </div>
            </div>
            <h3>Выберите команду</h3>
            <p>
              Сравните планы, сроки и опыт
            </p>
          </article>
        </Reveal>
      </section>
    </main>
  );
}
