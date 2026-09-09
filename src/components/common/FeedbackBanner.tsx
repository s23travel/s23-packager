import React from 'react';

interface FeedbackBannerProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onDismiss?: () => void;
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({
  type,
  message,
  onDismiss,
}) => {
  if (!message) return null;

  const bgClass =
    type === 'success'
      ? 'banner-success'
      : type === 'error'
      ? 'banner-error'
      : 'banner-info';

  return (
    <div className={`feedback-banner ${bgClass}`}>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="btn-dismiss"
          aria-label="Fechar"
        >
          &times;
        </button>
      )}
    </div>
  );
};
