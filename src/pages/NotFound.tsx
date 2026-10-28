import Layout from '../shared/Layout.tsx';
import { Link } from '../shared/router.tsx';
import { Route } from '../shared/routes.ts';

export default function NotFound() {
  return (
    <Layout title="Not found · Lin He">
      <div className="hero">
        <h1>Page not found</h1>
        <p><Link href={Route.Home}>Go to the home page</Link></p>
      </div>
    </Layout>
  );
}
