import { lazy, Suspense } from 'react';
import { games } from './games/index.ts';
import Games from './pages/Games.tsx';
import Home from './pages/Home.tsx';
import NotFound from './pages/NotFound.tsx';
import Layout from './shared/Layout.tsx';
import { usePath } from './shared/router.tsx';

// a game chunk that fails to download (network blip, or a stale tab after a redeploy) shows this
// instead of crashing the whole app
function LoadFailed() {
  return (
    <Layout title="Couldn't load · Lin He">
      <div className="hero">
        <h1>Couldn't load the game</h1>
        <p>Check your connection and <a href={location.href}>try again</a>.</p>
      </div>
    </Layout>
  );
}

const gamePages = new Map(games.map(g => [`/games/${g.slug}/`, lazy(() => g.load().catch(err => {
  console.error(`couldn't load ${g.slug}`, err);
  return { default: LoadFailed };
}))]));

export default function App() {
  const path = usePath();
  if (path === '/') return <Home />;
  if (path === '/games/') return <Games />;
  const Game = gamePages.get(path);
  if (Game) return <Suspense fallback={null}><Game /></Suspense>;
  return <NotFound />;
}
