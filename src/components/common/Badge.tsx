import React from 'react';
import { PackageStatus, QuotationStatus } from '../../types';

interface BadgeProps {
  status: PackageStatus | QuotationStatus | string;
}

export const StatusBadge: React.FC<BadgeProps> = ({ status }) => {
  let styleClass = 'badge-neutral';
  let label = status;

  switch (status) {
    case 'draft':
      styleClass = 'badge-neutral';
      label = 'Rascunho';
      break;
    case 'active':
      styleClass = 'badge-success';
      label = 'Ativo';
      break;
    case 'archived':
      styleClass = 'badge-muted';
      label = 'Arquivado';
      break;
    case 'sent':
      styleClass = 'badge-info';
      label = 'Enviada';
      break;
    case 'accepted':
      styleClass = 'badge-success';
      label = 'Aprovada';
      break;
    case 'rejected':
      styleClass = 'badge-danger';
      label = 'Rejeitada';
      break;
    default:
      label = status;
  }

  return <span className={`badge ${styleClass}`}>{label}</span>;
};
