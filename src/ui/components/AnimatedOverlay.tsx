import { useEffect, useState, type ReactNode } from 'react';

/** Keep the content mounted until the scrim's exit animation finishes. */
export function AnimatedOverlay({
  open,
  modal = false,
  onExited,
  children,
}: {
  open: boolean;
  modal?: boolean;
  onExited?: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  if (!open && !mounted) return null;

  return (
    <div
      className={`overlay${modal ? ' overlay--modal' : ''}${open ? '' : ' overlay--closing'}`}
      inert={!open}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || open) return;
        setMounted(false);
        onExited?.();
      }}
    >
      {children}
    </div>
  );
}
