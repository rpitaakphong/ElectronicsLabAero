import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ArrowUpRight, Menu } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { TOPICS, SITE_PAGES, pageMetadata } from '@/lib/catalog';

function TopicLinks({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="nav-topic-list">
      {TOPICS.map((topic) => (
        <div className="nav-topic-group" key={topic.id}>
          <NavLink
            to={topic.path}
            end
            className="nav-topic-overview"
            onClick={onNavigate}
          >
            {topic.title}
            <ArrowUpRight size={15} aria-hidden="true" />
          </NavLink>
          <div className="nav-tool-links">
            {topic.tools.map((tool) => (
              <NavLink key={tool.id} to={tool.path} end onClick={onNavigate}>
                {tool.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopicHeader() {
  const { pathname, key } = useLocation();
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const returnFocus = useRef(true);
  const topicSection = pageMetadata(pathname)?.section === 'topics';
  const closeForNavigation = () => {
    returnFocus.current = false;
    setTopicsOpen(false);
    setMobileOpen(false);
  };
  const finalFocus = () =>
    returnFocus.current ? true : document.getElementById('main-content');
  useEffect(() => {
    setTopicsOpen(false);
    setMobileOpen(false);
  }, [key]);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const measure = () => {
      const height = element.getBoundingClientRect().height;
      if (height > 0)
        document.documentElement.style.setProperty(
          '--app-header-height',
          `${height}px`,
        );
      window.dispatchEvent(new Event('app-header-resize'));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    const media = window.matchMedia('(max-width: 899px)');
    const changeLayout = () => {
      returnFocus.current = false;
      setTopicsOpen(false);
      setMobileOpen(false);
      measure();
    };
    media.addEventListener('change', changeLayout);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', changeLayout);
      document.documentElement.style.removeProperty('--app-header-height');
    };
  }, []);

  return (
    <header className="site-header" ref={header}>
      <div className="site-header-inner">
        <Link
          className="site-brand"
          to={SITE_PAGES.home.path}
          aria-label="Electronics Lab home"
          onClick={closeForNavigation}
        >
          <span
            className="site-brand-logo"
            role="img"
            aria-label="Chulalongkorn University"
          />
          <span className="site-brand-copy">
            <strong>Electronics Lab</strong>
            <span>For Aerospace Engineering</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <NavLink
            to={SITE_PAGES.home.path}
            end
            className="nav-link"
            onClick={closeForNavigation}
          >
            Home
          </NavLink>
          <Popover
            open={topicsOpen}
            onOpenChange={(open) => {
              if (open) returnFocus.current = true;
              setTopicsOpen(open);
            }}
          >
            <PopoverTrigger
              className={`nav-link topics-trigger${topicSection ? ' active' : ''}`}
            >
              Topics
              <ChevronDown size={15} aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={12}
              className="topics-popover"
              finalFocus={finalFocus}
            >
              <PopoverTitle className="sr-only">Explore topics</PopoverTitle>
              <nav aria-label="Topic shortcuts">
                <NavLink
                  className="browse-all-link"
                  to={SITE_PAGES.topics.path}
                  end
                  onClick={closeForNavigation}
                >
                  Browse all topics
                  <ArrowUpRight size={16} aria-hidden="true" />
                </NavLink>
                <TopicLinks onNavigate={closeForNavigation} />
              </nav>
            </PopoverContent>
          </Popover>
          <NavLink
            to={SITE_PAGES.resources.path}
            className="nav-link"
            onClick={closeForNavigation}
          >
            Resources
          </NavLink>
        </nav>
        <Sheet
          open={mobileOpen}
          onOpenChange={(open) => {
            if (open) returnFocus.current = true;
            setMobileOpen(open);
          }}
        >
          <SheetTrigger
            className="mobile-nav-trigger"
            aria-label="Open navigation menu"
          >
            <Menu size={22} aria-hidden="true" />
            <span>Menu</span>
          </SheetTrigger>
          <SheetContent className="mobile-navigation" finalFocus={finalFocus}>
            <SheetHeader>
              <SheetTitle>Explore the lab</SheetTitle>
              <SheetDescription>
                Lessons, simulators, and resources.
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label="Mobile navigation"
              className="mobile-navigation-links"
            >
              <NavLink
                to={SITE_PAGES.home.path}
                end
                className="nav-link"
                onClick={closeForNavigation}
              >
                Home
              </NavLink>
              <NavLink
                to={SITE_PAGES.topics.path}
                end
                className={`nav-link${topicSection ? ' section-active' : ''}`}
                onClick={closeForNavigation}
              >
                Browse all topics
              </NavLink>
              <TopicLinks onNavigate={closeForNavigation} />
              <NavLink
                to={SITE_PAGES.resources.path}
                className="nav-link"
                onClick={closeForNavigation}
              >
                Resources
              </NavLink>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
