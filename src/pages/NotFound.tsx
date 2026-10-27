import Layout from '../shared/Layout.tsx';
import { Link } from '../shared/router.tsx';

export default function NotFound() {
  return (
    <Layout title="Not found · Lin He">
      <div className="hero">
        <h1>Page not found</h1>
        <p><Link href="/">Go to the home page</Link></p>
      </div>
    </Layout>
  );
}
