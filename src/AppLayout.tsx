import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { pageMetadata } from '@/lib/catalog';
import { TopicHeader } from './TopicHeader';

function PageEffects() {
  const { pathname, hash, key } = useLocation();
  const presentedPage = useRef(false);
  useEffect(() => {
    document.title = `${pageMetadata(pathname)?.title ?? 'Page Not Found'} | Electronics Lab`;
    const scheduled = requestAnimationFrame(() => {
      let anchor = '';
      try {
        anchor = decodeURIComponent(hash.slice(1));
      } catch {
        /* Invalid fragments fall back to the page heading. */
      }
      const target =
        (anchor && document.getElementById(anchor)) ||
        document.getElementById('main-content');
      if (anchor && target?.id === anchor)
        target.scrollIntoView?.({ block: 'start' });
      else window.scrollTo?.(0, 0);
      // Keep initial keyboard entry at the skip link; announce subsequent routes.
      if (presentedPage.current || anchor)
        target?.focus({ preventScroll: true });
      presentedPage.current = true;
    });
    return () => cancelAnimationFrame(scheduled);
  }, [pathname, hash, key]);
  return null;
}

export function AppLayout() {
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={() =>
          document
            .getElementById('main-content')
            ?.focus({ preventScroll: true })
        }
      >
        Skip to content
      </a>
      <TopicHeader />
      <PageEffects />
      <Outlet />
    </>
  );
}
