import { games } from '../games/index.ts';
import Layout from '../shared/Layout.tsx';
import { Link } from '../shared/router.tsx';

export default function Home() {
  return (
    <Layout title="Lin He" current="home">
      <div className="hero">
        <h1>Lin He</h1>
        <p>Welcome to Lin's show ground: a few small games you can play right in your browser.</p>
      </div>
      <section id="games">
        <h2>Games</h2>
        <div className="cards">
          {games.map(g => (
            <Link key={g.slug} className="card" href={`/games/${g.slug}/`}>
              <div className="art kart" aria-hidden="true">{g.art}</div>
              <div className="body"><h3>{g.name}</h3><p>{g.summary}</p><span className="tag">{g.homeTag}</span></div>
            </Link>
          ))}
        </div>
        <p><Link href="/games/">All games →</Link></p>
      </section>
    </Layout>
  );
}
