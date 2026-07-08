import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { PublicRestaurantListItem } from '@/lib/api-types';
import { RestaurantCard } from './RestaurantCard';

const base: PublicRestaurantListItem = {
  id: 'r1',
  name: 'El Fogón Andino',
  slug: 'el-fogon-andino',
  description: 'Cocina casera de la casa, menú del día y pensiones mensuales.',
  address: 'Av. Los Álamos 742, Lima',
  logoUrl: null,
  coverImageUrl: null,
  monthlyPensionPrice: 742,
};

const renderCard = (restaurant: PublicRestaurantListItem) =>
  render(
    <MemoryRouter>
      <RestaurantCard restaurant={restaurant} />
    </MemoryRouter>,
  );

describe('RestaurantCard', () => {
  it('links to the restaurant detail by slug', () => {
    renderCard(base);
    const link = screen.getByRole('link', { name: /ver el fogón andino/i });
    expect(link).toHaveAttribute('href', '/restaurantes/el-fogon-andino');
  });

  it('shows the monthly price and address', () => {
    renderCard(base);
    expect(screen.getByText(/742\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Av\. Los Álamos 742/)).toBeInTheDocument();
  });

  it('renders a monogram fallback when there is no cover image', () => {
    renderCard(base);
    expect(screen.getByText('EF')).toBeInTheDocument();
  });

  it('renders the cover image when a URL is provided', () => {
    // The cover is decorative (alt=""), so it has no "img" role — assert on
    // the element directly rather than by role.
    const { container } = renderCard({
      ...base,
      coverImageUrl: 'https://example.test/cover.jpg',
    });
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'https://example.test/cover.jpg');
    expect(screen.queryByText('EF')).not.toBeInTheDocument();
  });
});
