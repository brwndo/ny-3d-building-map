import { useState } from 'react';

const NAV_LINKS = ['Map', 'Portfolio', 'Reports', 'Settings'];

export default function NavigationRail() {
  const [expanded, setExpanded] = useState(false);

  return (
    <nav
      className={`navigation-rail${expanded ? ' navigation-rail--expanded' : ''}`}
      aria-label="Main navigation"
    >
      <button
        type="button"
        className="nav-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
        title={expanded ? 'Collapse' : 'Expand'}
      >
        {expanded ? '«' : '»'}
      </button>
      {NAV_LINKS.map((label) => (
        <button
          key={label}
          type="button"
          className="nav-link"
          aria-label={label}
          title={label}
        >
          <span className="nav-link-icon" aria-hidden="true" />
          {expanded && <span className="nav-link-label">{label}</span>}
        </button>
      ))}
    </nav>
  );
}
