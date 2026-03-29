import type { HTMLAttributes, ReactNode } from 'react';
import './Card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional title displayed in the card header */
  title?: string;
  /** Card contents */
  children: ReactNode;
}

export function Card({
  title,
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <div className={`jads-card ${className}`.trim()} {...props}>
      {title && (
        <div className="jads-card__header">
          <h3 className="jads-card__title">{title}</h3>
        </div>
      )}
      <div className="jads-card__body">
        {children}
      </div>
    </div>
  );
}
