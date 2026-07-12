import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle';

describe('useDocumentTitle', () => {
  it('sets a suffixed title when given one', () => {
    renderHook(() => useDocumentTitle('Mi pensión'));
    expect(document.title).toBe('Mi pensión · Pensiones');
  });

  it('falls back to the brand tagline when no title is given', () => {
    renderHook(() => useDocumentTitle());
    expect(document.title).toBe('Pensiones — tu plan de comidas mensual');
  });
});
