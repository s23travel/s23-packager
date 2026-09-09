import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FavoriteService, FavoriteServiceType } from '../../types';
import { favoriteServicesService } from '../../services/favoriteServicesService';
import { Link } from 'react-router-dom';

interface ServiceAutocompleteProps {
  /** Valor atual do input (controlado externamente) */
  value: string;
  /** Callback chamado a cada keystroke no input */
  onChange: (value: string) => void;
  /** Callback chamado quando o utilizador seleciona uma sugestão */
  onSelect: (service: FavoriteService) => void;
  /** Callback opcional chamado ao clicar em cadastrar novo serviço */
  onAddNewService?: (currentQuery: string) => void;
  /** Filtra sugestões por tipo (padrão: somente hotéis) */
  serviceType?: FavoriteServiceType;
  placeholder?: string;
  id?: string;
  className?: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const ServiceAutocomplete: React.FC<ServiceAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  onAddNewService,
  serviceType = 'hotel',
  placeholder = 'Ex: Four Seasons Safari Lodge',
  id,
  className = 'form-input',
}) => {
  const [suggestions, setSuggestions] = useState<FavoriteService[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebounce(value, 200);

  // Busca sugestões quando o valor debounced muda
  useEffect(() => {
    if (debouncedValue.trim().length < 2) {
      setSuggestions([]);
      setNoResults(false);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    favoriteServicesService
      .searchServices(debouncedValue, serviceType)
      .then((results) => {
        if (cancelled) return;
        setSuggestions(results);
        setNoResults(results.length === 0);
        setShowDropdown(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestions([]);
        setNoResults(false);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedValue, serviceType]);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }, []);

  const handleSelect = useCallback(
    (service: FavoriteService) => {
      onSelect(service);
      setShowDropdown(false);
      setSuggestions([]);
      setNoResults(false);
    },
    [onSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        id={id}
        type="text"
        className={className}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />

      {searching && (
        <div
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
            fontSize: '11px',
          }}
        >
          ...
        </div>
      )}

      {showDropdown && (suggestions.length > 0 || noResults) && (
        <div className="autocomplete-dropdown" role="listbox" aria-label="Sugestões de serviços">
          {suggestions.map((service) => (
            <button
              key={service.id}
              type="button"
              className="autocomplete-item"
              role="option"
              onMouseDown={(e) => {
                e.preventDefault(); // evita blur antes do click
                handleSelect(service);
              }}
            >
              <div className="autocomplete-item-title">{service.name}</div>
              <div className="autocomplete-item-subtitle">
                {service.city ? `${service.city}, ${service.country}` : service.country}
              </div>
            </button>
          ))}

          {noResults && (
            <div className="autocomplete-no-results">
              <div className="autocomplete-no-results-text">
                Nenhum serviço encontrado.
              </div>
              {onAddNewService ? (
                <button
                  type="button"
                  className="autocomplete-add-link"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAddNewService(debouncedValue);
                  }}
                >
                  + Cadastrar novo serviço
                </button>
              ) : (
                <Link
                  to="/servicos/novo"
                  state={{
                    returnTo: typeof window !== 'undefined' ? window.location.pathname : '/pacotes/novo',
                    serviceType,
                    initialName: debouncedValue,
                  }}
                  className="autocomplete-add-link"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  + Cadastrar novo serviço
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
