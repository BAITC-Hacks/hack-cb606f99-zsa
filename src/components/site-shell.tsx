"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";
import { IS_DEMO, getServerStatus } from "@/lib/client/service";
import { useResource } from "@/lib/client/use-resource";

export function TaskHubLogo() {
  return (
    <span className="taskhub-logo">
      <Image
        src="/logo.png"
        alt="Task Hub"
        width={1254}
        height={1254}
        sizes="200px"
        className="taskhub-logo-image"
      />
    </span>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const { data: server, error } = useResource(getServerStatus);
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link className="brand" href="/" aria-label="Task Hub — главная">
          <TaskHubLogo />
        </Link>
        <nav className="main-nav" aria-label="Главная навигация">
          <Link className={path === "/catalog" ? "active" : ""} href="/catalog">
            Каталог задач
          </Link>
          <Link
            className={
              path.startsWith("/business") && path !== "/business/new"
                ? "active"
                : ""
            }
            href="/business"
          >
            Мои задачи
          </Link>
          <Link href="/#how-it-works">Как это работает</Link>
        </nav>
        <div className="nav-actions">
          {(IS_DEMO || server || error) && (
            <span
              className="demo-badge"
              title={
                IS_DEMO
                  ? "Автономный режим: данные сохраняются только в браузере."
                  : error
                    ? error
                    : server?.aiProvider === "mock"
                      ? "Задачи сохраняются на сервере. AI пока работает по шаблону."
                      : "Задачи сохраняются на сервере. Подключён OpenAI."
              }
            >
              <span className="dot" />
              {IS_DEMO
                ? "Локальное демо"
                : error
                  ? "Нет связи"
                  : server?.aiProvider === "mock"
                    ? "AI: демо"
                    : "AI подключён"}
            </span>
          )}
          <Link className="btn btn-white btn-small" href="/business/new">
            Создать задачу <Icon name="plus" size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="brand" href="/" aria-label="Task Hub — главная">
        <TaskHubLogo />
      </Link>
      <span>Реальные задачи. Новые возможности.</span>
      <div>
        <Link href="/catalog">
          Для команд <Icon name="arrow" size={14} />
        </Link>
        <Link href="/business">
          Для бизнеса <Icon name="arrow" size={14} />
        </Link>
        <span className="hackalem-credit">
          <span>СОЗДАНО НА ХАКАТОНЕ</span>
          <span className="hackalem-logo">
            <Image
              src="/hackalem-ai.png"
              alt="HackAlem AI"
              width={1181}
              height={415}
              sizes="210px"
            />
          </span>
        </span>
      </div>
    </footer>
  );
}
