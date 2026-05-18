import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from './classNames';

export type BadgeTone = 'draft' | 'saved' | 'status' | 'count' | 'warning';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, className, tone = 'status', ...props }: BadgeProps) {
  return (
    <span className={classNames('ml-badge', `ml-badge-${tone}`, className)} {...props}>
      {children}
    </span>
  );
}
