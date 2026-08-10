import { useState } from 'react';
import {
  Map,
  Briefcase,
  FileText,
  Settings,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

const NAV_LINKS = [
  { label: 'Map', Icon: Map },
  { label: 'Portfolio', Icon: Briefcase },
  { label: 'Reports', Icon: FileText },
];

export default function NavigationRail() {
  const [expanded, setExpanded] = useState(false);
  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen;

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
        <ToggleIcon className="nav-link-icon" aria-hidden="true" />
        {expanded && <span className="nav-link-label">Collapse</span>}
      </button>

      <div className="nav-links">
        {NAV_LINKS.map(({ label, Icon }) => (
          <button
            key={label}
            type="button"
            className="nav-link"
            aria-label={label}
            title={label}
          >
            <Icon className="nav-link-icon" aria-hidden="true" />
            {expanded && <span className="nav-link-label">{label}</span>}
          </button>
        ))}
      </div>

      <div className="nav-footer">
        <button
          type="button"
          className="nav-link"
          aria-label="Profile"
          title="Profile"
        >
          <User className="nav-link-icon" aria-hidden="true" />
          {expanded && <span className="nav-link-label">Profile</span>}
        </button>
        <button
          type="button"
          className="nav-link"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="nav-link-icon" aria-hidden="true" />
          {expanded && <span className="nav-link-label">Settings</span>}
        </button>
      </div>
    </nav>
  );
}
