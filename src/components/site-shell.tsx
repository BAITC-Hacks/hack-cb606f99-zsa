"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";
import { ThemeControls } from "./theme-controls";

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
  const isEditingTask =
    path === "/business/new" ||
    /^\/business\/tasks\/[^/]+\/edit$/.test(path);
  return (
    <header className="site-header">
      <div className="nav-inner">
        <Link className="brand" href="/" aria-label="Task Hub — главная">
          <TaskHubLogo />
        </Link>
        <nav className="main-nav" aria-label="Главная навигация">
          <Link className={path === "/catalog" ? "active" : ""} aria-current={path === "/catalog" ? "page" : undefined} href="/catalog">
            Каталог задач
          </Link>
          <Link
            className={
              path.startsWith("/business") && path !== "/business/new"
                ? "active"
                : ""
            }
            href="/business"
            aria-current={path === "/business" ? "page" : undefined}
          >
            Мои задачи
          </Link>
          <Link
            className={path === "/how-it-works" ? "active" : ""}
            aria-current={path === "/how-it-works" ? "page" : undefined}
            href="/how-it-works"
          >
            Как это работает
          </Link>
        </nav>
        <div className="nav-actions">
          <ThemeControls />
          {path !== "/" && !isEditingTask && (
            <Link className="btn btn-white btn-small" href="/business/new">
              Создать задачу <Icon name="plus" size={16} />
            </Link>
          )}
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
      <span>Задачи бизнеса и предложения команд</span>
      <div>
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
