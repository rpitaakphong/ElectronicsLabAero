import { useEffect } from 'react';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import OpAmpLab from './OpAmpLab';
import DividerLab from './DividerLab';
import { TopicHeader } from './TopicHeader';
import { TopicArt } from './TopicArt';
import { OpAmpTopic } from './OpAmpTopic';
import { OpAmpSimulator } from './OpAmpSimulator';
function Home() {
  return (
    <main className="lab-shell">
      <TopicHeader home />
      <div className="intro topics-intro">
        <span className="eyebrow">THE INTERACTIVE LEARNING LAB</span>
        <h1>Explore a circuit. Build your intuition.</h1>
        <p>
          Choose a topic, change the settings, and see the electronics come to
          life.
        </p>
      </div>
      <div className="topic-grid">
        {[
          {
            path: '/voltage-divider',
            name: 'Voltage Divider',
            detail:
              'Discover how resistors share voltage—and what changes when you add a load, move a wiper, or connect a sensor.',
            meta: '4 configurations · DC circuits',
            divider: true,
          },
          {
            path: '/operational-amplifier',
            name: 'Operational Amplifier',
            detail:
              'Explore op-amp concepts with interactive lessons, then build and measure circuits in the breadboard simulator.',
            meta: '2 tools · Learn, build & measure',
            divider: false,
          },
        ].map((topic, i) => (
          <article className="panel topic-card" key={topic.path}>
            <div className="topic-art">
              <span className="eyebrow">TOPIC 0{i + 1}</span>
              <TopicArt divider={topic.divider} />
            </div>
            <div className="topic-card-body">
              <span className="small-muted">{topic.meta}</span>
              <h2>{topic.name}</h2>
              <p>{topic.detail}</p>
              <Link
                className="open-lab"
                to={topic.path}
                aria-label={`Open ${topic.name} ${topic.divider ? 'lab' : 'topic'}`}
              >
                {topic.divider ? 'Open lab' : 'Explore topic'}{' '}
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="home-note">
        Learn by experimenting. Each lab connects the circuit, the math, and the
        results.
      </p>
    </main>
  );
}
function PageEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${pathname === '/' ? 'Learning Topics' : pathname === '/voltage-divider' ? 'Voltage Divider' : pathname === '/operational-amplifier' ? 'Operational Amplifier' : pathname === '/operational-amplifier/learn' ? 'Op-Amp Interactive Learning' : pathname === '/operational-amplifier/simulator' ? 'Op-Amp Lab Simulator' : 'Page Not Found'} | Electronics Lab`;
    window.scrollTo?.(0, 0);
  }, [pathname]);
  return null;
}
export function AppRoutes() {
  return (
    <>
      <PageEffects />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/voltage-divider" element={<DividerLab />} />
        <Route path="/operational-amplifier" element={<OpAmpTopic />} />
        <Route path="/operational-amplifier/learn" element={<OpAmpLab />} />
        <Route
          path="/operational-amplifier/simulator"
          element={<OpAmpSimulator />}
        />
        <Route
          path="*"
          element={
            <main className="lab-shell">
              <TopicHeader />
              <div className="intro">
                <h1>Page not found</h1>
                <p>Choose a learning topic to continue.</p>
                <Link className="topic-link" to="/">
                  Go to all topics →
                </Link>
              </div>
            </main>
          }
        />
      </Routes>
    </>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
