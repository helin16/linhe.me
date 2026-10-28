import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react';

// Tiny history router: the site has a handful of flat routes (see specs/.../contracts/routes.md).
const NAV = 'navigate';

/** Old file URLs lose a trailing `index.html` (it loads its folder's page), and every path ends in a slash. */
export function normalise(path: string): string {
  path = path.replace(/\/index\.html$/, '/');
  return path.endsWith('/') ? path : path + '/';
}

const fixed = normalise(location.pathname);
if (fixed !== location.pathname) history.replaceState(history.state, '', fixed + location.search + location.hash);

function subscribe(onChange: () => void) {
  addEventListener('popstate', onChange);
  addEventListener(NAV, onChange);
  return () => {
    removeEventListener('popstate', onChange);
    removeEventListener(NAV, onChange);
  };
}

export const usePath = () => useSyncExternalStore(subscribe, () => normalise(location.pathname));

export function navigate(href: string) {
  const url = new URL(href, location.href);
  const next = normalise(url.pathname) + url.search + url.hash;
  if (next === location.pathname + location.search + location.hash) history.replaceState(history.state, '', next);
  else history.pushState(null, '', next);
  dispatchEvent(new Event(NAV));
  scrollTo(0, 0);
}

/** An `<a>` that changes page without a reload for plain left-clicks on site paths. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      {...rest}
      onClick={e => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (rest.target || !href.startsWith('/') || href.startsWith('//')) return;
        const file = new URL(href, location.href).pathname;
        if (/\.\w+$/.test(file) && !file.endsWith('/index.html')) return; // a real file such as /cv.pdf
        e.preventDefault();
        navigate(href);
      }}
    />
  );
}
