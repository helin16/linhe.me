import { useEffect, type ReactNode } from 'react';
import { Link } from './router.tsx';

/** Site header and footer around a page; `current` marks the active nav link. */
export default function Layout({ title, current, children }: { title: string; current?: 'home' | 'games'; children: ReactNode }) {
  useEffect(() => { document.title = title; }, [title]);
  return (
    <>
      <header><div className="wrap">
        <Link className="logo" href="/">linhe<span>.me</span></Link>
        <nav>
          <Link href="/" aria-current={current === 'home' ? 'page' : undefined}>Home</Link>
          <Link href="/games/" aria-current={current === 'games' ? 'page' : undefined}>Games</Link>
        </nav>
      </div></header>
      <main className="wrap">{children}</main>
      <footer><div className="wrap">© {new Date().getFullYear()} Lin He · <a href="https://github.com/helin16">GitHub</a></div></footer>
    </>
  );
}
