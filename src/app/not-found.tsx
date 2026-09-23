import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="container empty-state">
      <span className="eyebrow">404</span>
      <h1>Страница не найдена</h1>
      <p>Проверьте адрес или откройте каталог задач</p>
      <Link className="btn btn-white" href="/catalog">
        Открыть каталог
      </Link>
    </main>
  );
}
