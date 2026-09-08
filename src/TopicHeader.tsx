import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
export function TopicHeader({
  home = false,
  children,
}: {
  home?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="masthead">
      <div className="brand">
        <span
          className="brand-logo"
          role="img"
          aria-label="Chulalongkorn University"
        />
        <span className="brand-divider" />
        <strong>Electronics Lab For Aerospace Engineering</strong>
      </div>
      <div className="header-actions">
        {!home && (
          <Link className="topic-link" to="/">
            ← All topics
          </Link>
        )}
        {children}
      </div>
    </header>
  );
}
