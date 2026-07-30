import type { ReactNode } from 'react';

type Props = {
  text: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
};

/** Hover / focus tooltip for rules explanations. */
export function Tip({ text, children, wide, className }: Props) {
  return (
    <span className={`tip-wrap${className ? ` ${className}` : ''}`}>
      {children}
      <span className={`tip-bubble${wide ? ' tip-wide' : ''}`} role="tooltip">
        {text}
      </span>
    </span>
  );
}
