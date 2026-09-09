import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { TOPICS } from '@/lib/catalog';
import { TopicArt } from './TopicArt';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';

export function TopicCatalog() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase();
  const topics = TOPICS.filter((topic) =>
    `${topic.title} ${topic.description}`
      .toLocaleLowerCase()
      .includes(normalized),
  );
  return (
    <main id="main-content" tabIndex={-1} className="lab-shell catalog-page">
      <TopicBreadcrumbs />
      <div className="intro catalog-intro">
        <span className="eyebrow">EXPLORE THE LAB</span>
        <h1>Learning topics</h1>
        <p>
          Choose a circuit. Explore the concepts, then build and measure it
          yourself.
        </p>
      </div>
      <div className="catalog-toolbar">
        <div className="topic-search">
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="topic-search">
            Search topics
          </label>
          <input
            id="topic-search"
            type="search"
            placeholder="Search topics…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                document.getElementById('topic-search')?.focus();
              }}
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        <p role="status" className="catalog-count">
          {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
          {normalized ? ' found' : ' to explore'}
        </p>
      </div>
      {topics.length ? (
        <div className="topic-grid">
          {topics.map((topic) => (
            <article className="panel topic-card" key={topic.id}>
              <div className="topic-art">
                <span className="eyebrow">LEARN, BUILD &amp; MEASURE</span>
                <TopicArt divider={topic.art === 'divider'} rc={topic.art === 'rc'} />
              </div>
              <div className="topic-card-body">
                <span className="small-muted">
                  {topic.tools.map((tool) => tool.label).join(' · ')}
                </span>
                <h2>{topic.title}</h2>
                <p>{topic.description}</p>
                <Link
                  className="open-lab"
                  to={topic.path}
                  aria-label={`Open ${topic.title} topic`}
                >
                  Explore topic<span aria-hidden="true">↗</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="catalog-empty">
          <h2>No topics found</h2>
          <p>
            Try another topic name or a word such as “resistors” or “signals”.
          </p>
          <button className="secondary-link" onClick={() => setQuery('')}>
            Show all topics
          </button>
        </div>
      )}
    </main>
  );
}
