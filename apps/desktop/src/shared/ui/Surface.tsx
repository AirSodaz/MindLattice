import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from './classNames';

export type SurfaceTone = 'default' | 'preview' | 'setup' | 'start' | 'memory' | 'settings';

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  as?: 'article' | 'section';
  children: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
  tone?: SurfaceTone;
};

export function Surface({
  actions,
  as: Element = 'section',
  children,
  className,
  eyebrow,
  title,
  tone = 'default',
  ...props
}: SurfaceProps) {
  return (
    <Element className={classNames('ml-surface', `ml-surface-${tone}`, className)} {...props}>
      {eyebrow || title || actions ? (
        <div className="ml-surface-header">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions ? <div className="ml-surface-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Element>
  );
}
