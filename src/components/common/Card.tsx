import React from 'react';

interface CardProps {
  title?: string;
  badge?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  badge,
  description,
  children,
  className = '',
}) => {
  return (
    <div className={`card ${className}`.trim()}>
      {title && (
        <div className="card-title">
          <span>{title}</span>
          {badge && <span className="badge badge-neutral">{badge}</span>}
        </div>
      )}
      {description && <p className="card-description">{description}</p>}
      {children}
    </div>
  );
};
