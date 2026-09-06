import { useEffect } from 'react';

type PublicTour = {
  id: number;
  slug: string;
  name: string;
  destination: string;
  shortDescription: string | null;
  duration: string | null;
  adultPrice: number;
  childPrice: number | null;
  currency: string;
  capacity: number | null;
  mainImageUrl: string | null;
  publishedAt: string | null;
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=900&q=85';

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-CR', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'CRC' ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function safeImage(value: string | null) {
  if (!value) return FALLBACK_IMAGE;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string | null, text: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function buildTourCard(tour: PublicTour) {
  const article = document.createElement('article');
  article.className = 'tour-card';
  article.dataset.publicTourId = String(tour.id);
  article.dataset.publicTourSlug = tour.slug;

  const image = document.createElement('div');
  image.className = 'tour-image';
  image.style.backgroundImage = `url("${safeImage(tour.mainImageUrl).replaceAll('"', '%22')}")`;
  image.appendChild(textElement('span', 'badge', 'Disponible'));

  const favorite = document.createElement('button');
  favorite.type = 'button';
  favorite.setAttribute('aria-label', `Agregar ${tour.name} a favoritos`);
  favorite.textContent = '♡';
  image.appendChild(favorite);

  const body = document.createElement('div');
  body.className = 'tour-body';
  body.appendChild(textElement('h3', null, tour.name));
  body.appendChild(textElement('p', 'place', `📍 ${tour.destination}`));
  body.appendChild(textElement('p', null, tour.shortDescription || 'Descubre esta experiencia de Capoy Costa Rica.'));

  const meta = document.createElement('div');
  meta.className = 'tour-meta';
  meta.appendChild(textElement('span', null, `◷ ${tour.duration || 'Duración por confirmar'}`));
  const price = document.createElement('div');
  price.appendChild(textElement('small', null, 'Desde'));
  price.appendChild(textElement('strong', null, formatPrice(tour.adultPrice, tour.currency)));
  price.appendChild(textElement('small', null, 'por persona'));
  meta.appendChild(price);
  body.appendChild(meta);

  const details = textElement('a', 'card-btn', 'Ver detalles');
  details.href = `#contacto`;
  details.dataset.tourSlug = tour.slug;
  body.appendChild(details);

  article.appendChild(image);
  article.appendChild(body);
  return article;
}

export function PublicToursBridge() {
  useEffect(() => {
    let cancelled = false;

    fetch('/api/public/tours', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('public_tours_unavailable');
        return response.json();
      })
      .then((data) => {
        if (cancelled || !Array.isArray(data?.tours)) return;
        const grid = document.querySelector<HTMLElement>('#tours .tour-grid');
        if (!grid) return;

        grid.replaceChildren();
        const tours = data.tours as PublicTour[];
        if (!tours.length) {
          const empty = textElement('p', 'public-tours-empty', 'Pronto publicaremos nuevas experiencias.');
          grid.appendChild(empty);
          return;
        }
        const fragment = document.createDocumentFragment();
        tours.forEach((tour) => fragment.appendChild(buildTourCard(tour)));
        grid.appendChild(fragment);
      })
      .catch(() => {
        const grid = document.querySelector<HTMLElement>('#tours .tour-grid');
        if (grid) grid.dataset.publicToursStatus = 'fallback';
      });

    return () => { cancelled = true; };
  }, []);

  return null;
}
