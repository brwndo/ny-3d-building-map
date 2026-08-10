import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const GAP = 8;
const VIEWPORT_PAD = 8;

function positionTooltip(triggerEl, tipEl) {
  if (!triggerEl || !tipEl) return { top: 0, left: 0 };

  const trigger = triggerEl.getBoundingClientRect();
  const tip = tipEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = trigger.bottom + GAP;
  if (top + tip.height > vh - VIEWPORT_PAD) {
    top = trigger.top - tip.height - GAP;
  }
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - tip.height - VIEWPORT_PAD));

  let left = trigger.left + trigger.width / 2 - tip.width / 2;
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - tip.width - VIEWPORT_PAD));

  return { top, left };
}

/**
 * Accessible hover/focus tooltip. Renders into document.body so it is not
 * clipped by overflow:hidden ancestors (e.g. the stats panel).
 *
 * Expects a single focusable child (typically a button).
 */
export default function Tooltip({ content, label, children }) {
  const tipId = useId();
  const triggerRef = useRef(null);
  const tipRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const update = () => {
      setCoords(positionTooltip(triggerRef.current, tipRef.current));
    };
    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, content]);

  const child = Children.only(children);
  if (!isValidElement(child)) return null;

  const trigger = cloneElement(child, {
    ref: (node) => {
      triggerRef.current = node;
      const { ref } = child;
      if (typeof ref === 'function') ref(node);
      else if (ref && typeof ref === 'object') ref.current = node;
    },
    'aria-describedby': open ? tipId : undefined,
    onMouseEnter: (e) => {
      child.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave: (e) => {
      child.props.onMouseLeave?.(e);
      hide();
    },
    onFocus: (e) => {
      child.props.onFocus?.(e);
      show();
    },
    onBlur: (e) => {
      child.props.onBlur?.(e);
      hide();
    },
  });

  return (
    <>
      {trigger}
      {open && content != null && content !== ''
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              className="tooltip"
              style={{ top: coords.top, left: coords.left }}
              aria-label={label}
            >
              {typeof content === 'string' ? <p>{content}</p> : content}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
