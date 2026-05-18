import type { HTMLAttributes, ReactNode } from 'react';

import { classNames } from './classNames';

export type NoticeTone = 'info' | 'ok' | 'warning' | 'error' | 'draft' | 'safety';

export type NoticeProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  children?: ReactNode;
  title?: ReactNode;
  tone?: NoticeTone;
};

export function Notice({ children, className, title, tone = 'info', ...props }: NoticeProps) {
  return (
    <div className={classNames('ml-notice', `ml-notice-${tone}`, className)} {...props}>
      <span className="ml-notice-dot" aria-hidden="true" />
      <div className="ml-notice-body">
        {title ? <strong>{title}</strong> : null}
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}
