import { Link } from 'react-router-dom';

export function OpAmpBreadcrumbs({ current }: { current?: string }) {
  return (
    <nav className="topic-breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/">All topics</Link>
        </li>
        <li>
          {current ? (
            <Link to="/operational-amplifier">Operational Amplifier</Link>
          ) : (
            <span aria-current="page">Operational Amplifier</span>
          )}
        </li>
        {current && (
          <li>
            <span aria-current="page">{current}</span>
          </li>
        )}
      </ol>
    </nav>
  );
}
