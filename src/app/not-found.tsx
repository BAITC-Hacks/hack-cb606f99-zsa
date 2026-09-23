import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="container empty-state">
      <span className="eyebrow">404</span>
      <h1>Здесь пока ничего нет.</h1>
      <p>Вернёмся туда, где начинаются возможности.</p>
      <Link className="btn btn-white" href="/catalog">
        Открыть каталог
      </Link>
    </main>
  );
}
