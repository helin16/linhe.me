import { useEffect, type ReactNode } from 'react';
import { Link } from './router.tsx';
import { Route } from './routes.ts';

/** Site header and footer around a page; `current` marks the active nav link. */
export default function Layout({ title, current, children }: { title: string; current?: Route; children: ReactNode }) {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <>
      <header><div className="wrap">
        <Link className="logo" href={Route.Home}>linhe<span>.me</span></Link>
        <nav>
          <Link href={Route.Home} aria-current={current === Route.Home ? 'page' : undefined}>Home</Link>
          <Link href={Route.Games} aria-current={current === Route.Games ? 'page' : undefined}>Games</Link>
        </nav>
      </div></header>
      <main className="wrap">{children}</main>
      <footer><div className="wrap">© {new Date().getFullYear()} Lin He · <a href="https://github.com/helin16">GitHub</a></div></footer>
    </>
  );
}
