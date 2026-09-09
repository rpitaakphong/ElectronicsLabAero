import type { ComponentType } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { TOPICS, SITE_PAGES, type TopicId } from '@/lib/catalog';
import OpAmpLab from './OpAmpLab';
import DividerLab from './DividerLab';
import RcLab from './RcLab';
import { RcTopic } from './RcTopic';
import { DividerTopic } from './DividerTopic';
import { OpAmpTopic } from './OpAmpTopic';
import { SimulatorWorkspace } from './SimulatorWorkspace';
import { TopicBreadcrumbs } from './TopicBreadcrumbs';
import { AppLayout } from './AppLayout';
import { Welcome } from './Welcome';
import { TopicCatalog } from './TopicCatalog';
import { Resources } from './Resources';

// Register topic views here; navigation and metadata come from the catalog.
const topicViews: Record<
  TopicId,
  { overview: ComponentType; learn: ComponentType }
> = {
  'voltage-divider': { overview: DividerTopic, learn: DividerLab },
  'rc-filter': { overview: RcTopic, learn: RcLab },
  opamp: { overview: OpAmpTopic, learn: OpAmpLab },
};
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={SITE_PAGES.home.path} element={<Welcome />} />
        <Route path={SITE_PAGES.topics.path} element={<TopicCatalog />} />
        <Route path={SITE_PAGES.resources.path} element={<Resources />} />
        {TOPICS.map((topic) => {
          const Overview = topicViews[topic.id].overview,
            Learning = topicViews[topic.id].learn;
          return (
            <Route key={topic.id}>
              <Route path={topic.path} element={<Overview />} />
              {topic.tools.map((tool) => (
                <Route
                  key={tool.id}
                  path={tool.path}
                  element={
                    tool.id === 'learn' ? (
                      <Learning />
                    ) : (
                      <SimulatorWorkspace key={topic.id} lab={topic.id} />
                    )
                  }
                />
              ))}
            </Route>
          );
        })}
        <Route
          path="*"
          element={
            <main id="main-content" tabIndex={-1} className="lab-shell">
              <TopicBreadcrumbs />
              <div className="intro">
                <h1>Page not found</h1>
                <p>Choose a learning topic to continue.</p>
                <Link className="topic-link" to={SITE_PAGES.topics.path}>
                  Go to all topics →
                </Link>
              </div>
            </main>
          }
        />
      </Route>
    </Routes>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
