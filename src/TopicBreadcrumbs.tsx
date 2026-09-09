import { Link, useLocation } from 'react-router-dom';
import { pageMetadata } from '@/lib/catalog';

export function TopicBreadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = pageMetadata(pathname)?.breadcrumbs ?? [
    { label: 'Home', path: '/' },
    { label: 'Page not found' },
  ];
  if (!crumbs.length) return null;
  return (
    <nav className="topic-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {crumbs.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`}>
            {crumb.path ? (
              <Link to={crumb.path}>{crumb.label}</Link>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
