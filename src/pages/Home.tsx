import { games } from '../games/index.ts';
import Layout from '../shared/Layout.tsx';
import { Link } from '../shared/router.tsx';
import { gameRoute, Route } from '../shared/routes.ts';

export default function Home() {
  return (
    <Layout title="Lin He" current={Route.Home}>
      <div className="hero">
        <h1>Show Ground</h1>
        <p>Welcome! A few small games you can play right in your browser.</p>
      </div>
      <section id="games">
        <h2>Games</h2>
        <div className="cards">
          {games.map(g => (
            <Link key={g.slug} className="card" href={gameRoute(g.slug)}>
              <div className="art kart" aria-hidden="true">{g.art}</div>
              <div className="body"><h3>{g.name}</h3><p>{g.summary}</p><span className="tag">{g.homeTag}</span></div>
            </Link>
          ))}
        </div>
        <p><Link href={Route.Games}>All games →</Link></p>
      </section>
    </Layout>
  );
}
