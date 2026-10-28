import { games } from '../games/index.ts';
import Layout from '../shared/Layout.tsx';
import { Link } from '../shared/router.tsx';
import { gameRoute, Route } from '../shared/routes.ts';

export default function Games() {
  return (
    <Layout title="Games · Lin He" current={Route.Games}>
      <div className="hero">
        <h1>Games</h1>
        <p>Small games that run in your browser. No downloads or sign-ups needed.</p>
      </div>
      <section>
        {/* add a new game: a folder in src/games/<slug>/ plus one entry in src/games/index.ts */}
        <div className="cards">
          {games.map(g => (
            <Link key={g.slug} className="card" href={gameRoute(g.slug)}>
              <div className="art kart" aria-hidden="true">{g.art}</div>
              <div className="body"><h3>{g.name}</h3><p>{g.description}</p><span className="tag">{g.tag}</span></div>
            </Link>
          ))}
          <div className="card" aria-hidden="true">
            <div className="art soon">More coming soon</div>
            <div className="body"><h3>Next game</h3><p>In the works.</p></div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
