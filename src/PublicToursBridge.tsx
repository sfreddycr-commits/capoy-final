import { useEffect } from 'react';

type PublicTour = {
  id: number;
  slug: string;
  name: string;
  destination: string;
  shortDescription?: string | null;
  description?: string | null;
  duration?: string | null;
  adultPrice: number;
  childPrice?: number | null;
  currency: string;
  capacity?: number | null;
  mainImageUrl?: string | null;
  galleryImages?: string[];
  language?: string;
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=85';
const MAX_CAROUSEL = 5;

const intl = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-CR', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0);
  } catch {
    return `${intl.format(Number(value) || 0)}`;
  }
}

function safeImage(url: string) {
  return /^https?:\/\//i.test(url) ? url : FALLBACK_IMAGE;
}

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string | null, text: string) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}

function buildTourCard(tour: PublicTour) {
  const article = document.createElement('article');
  article.className = 'tour-card';
  article.dataset.publicTourId = String(tour.id);
  article.dataset.publicTourSlug = tour.slug;

  const image = document.createElement('div');
  image.className = 'tour-image';
  image.style.backgroundImage = `url(${safeImage(tour.mainImageUrl || FALLBACK_IMAGE)})`;
  image.setAttribute('aria-label', tour.name);

  const badge = textElement('span', 'badge', tour.duration ? `◷ ${tour.duration}` : 'Capoy');
  image.appendChild(badge);

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

  const details = document.createElement('button');
  details.type = 'button';
  details.className = 'card-btn';
  details.textContent = 'Ver detalles';
  details.dataset.publicTourDetails = String(tour.id);
  body.appendChild(details);

  article.appendChild(image);
  article.appendChild(body);
  return article;
}

function buildModal() {
  const overlay = document.createElement('div');
  overlay.className = 'public-tour-modal-overlay';
  overlay.dataset.publicTourModal = 'closed';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');

  const dialog = document.createElement('section');
  dialog.className = 'public-tour-modal';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'public-tour-modal-close';
  close.setAttribute('aria-label', 'Cerrar');
  close.textContent = '×';

  const carousel = document.createElement('div');
  carousel.className = 'public-tour-modal-carousel';

  const track = document.createElement('div');
  track.className = 'public-tour-modal-track';
  carousel.appendChild(track);

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'public-tour-modal-nav prev';
  prev.setAttribute('aria-label', 'Foto anterior');
  prev.textContent = '‹';

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'public-tour-modal-nav next';
  next.setAttribute('aria-label', 'Siguiente foto');
  next.textContent = '›';

  carousel.appendChild(prev);
  carousel.appendChild(next);

  const dots = document.createElement('div');
  dots.className = 'public-tour-modal-dots';

  const body = document.createElement('div');
  body.className = 'public-tour-modal-body';

  const title = document.createElement('h2');
  body.appendChild(title);

  const place = document.createElement('p');
  place.className = 'public-tour-modal-place';
  body.appendChild(place);

  const desc = document.createElement('p');
  desc.className = 'public-tour-modal-desc';
  body.appendChild(desc);

  const facts = document.createElement('div');
  facts.className = 'public-tour-modal-facts';
  body.appendChild(facts);

  const reserve = document.createElement('a');
  reserve.className = 'public-tour-modal-reserve';
  reserve.href = '#contacto';
  reserve.textContent = 'Reservar este tour';
  body.appendChild(reserve);

  dialog.appendChild(close);
  dialog.appendChild(carousel);
  dialog.appendChild(dots);
  dialog.appendChild(body);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  return overlay;
}

let carouselIndex = 0;

function renderModal(overlay: HTMLElement, tour: PublicTour) {
  const dialog = overlay.querySelector<HTMLElement>('.public-tour-modal')!;
  const track = overlay.querySelector<HTMLElement>('.public-tour-modal-track')!;
  const dots = overlay.querySelector<HTMLElement>('.public-tour-modal-dots')!;
  const title = overlay.querySelector<HTMLElement>('h2')!;
  const place = overlay.querySelector<HTMLElement>('.public-tour-modal-place')!;
  const desc = overlay.querySelector<HTMLElement>('.public-tour-modal-desc')!;
  const facts = overlay.querySelector<HTMLElement>('.public-tour-modal-facts')!;
  const reserve = overlay.querySelector<HTMLAnchorElement>('.public-tour-modal-reserve')!;
  const prev = overlay.querySelector<HTMLButtonElement>('.public-tour-modal-nav.prev')!;
  const next = overlay.querySelector<HTMLButtonElement>('.public-tour-modal-nav.next')!;

  const gallery = (Array.isArray(tour.galleryImages) ? tour.galleryImages : []).slice(0, MAX_CAROUSEL);
  track.replaceChildren();
  dots.replaceChildren();

  if (gallery.length === 0) {
    const fallback = document.createElement('img');
    fallback.src = safeImage(tour.mainImageUrl || FALLBACK_IMAGE);
    fallback.alt = tour.name;
    fallback.className = 'public-tour-modal-slide';
    track.appendChild(fallback);
    prev.hidden = true;
    next.hidden = true;
  } else {
    gallery.forEach((url, idx) => {
      const img = document.createElement('img');
      img.src = safeImage(url);
      img.alt = `${tour.name} — foto ${idx + 1}`;
      img.className = 'public-tour-modal-slide';
      img.loading = idx === 0 ? 'eager' : 'lazy';
      track.appendChild(img);

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'public-tour-modal-dot';
      dot.setAttribute('aria-label', `Ir a foto ${idx + 1}`);
      dot.dataset.dotIndex = String(idx);
      dots.appendChild(dot);
    });
    prev.hidden = gallery.length < 2;
    next.hidden = gallery.length < 2;
  }

  title.textContent = tour.name;
  place.textContent = `📍 ${tour.destination}`;
  desc.textContent = tour.description || tour.shortDescription || 'Pronto más detalles de esta experiencia.';

  facts.replaceChildren();
  const factsList: Array<[string, string]> = [];
  if (tour.duration) factsList.push(['Duración', tour.duration]);
  factsList.push(['Desde', formatPrice(tour.adultPrice, tour.currency)]);
  if (tour.childPrice !== null && tour.childPrice !== undefined) {
    factsList.push(['Niño', formatPrice(tour.childPrice, tour.currency)]);
  }
  if (tour.capacity) factsList.push(['Capacidad', `${tour.capacity} personas`]);
  for (const [label, value] of factsList) {
    const item = document.createElement('div');
    item.className = 'public-tour-modal-fact';
    item.appendChild(textElement('span', 'public-tour-modal-fact-label', label));
    item.appendChild(textElement('strong', 'public-tour-modal-fact-value', value));
    facts.appendChild(item);
  }

  reserve.textContent = `Reservar ${tour.name}`;
  carouselIndex = 0;
  applyCarouselPosition(track, dots, 0, gallery.length);
  prev.onclick = () => stepCarousel(track, dots, gallery.length, -1);
  next.onclick = () => stepCarousel(track, dots, gallery.length, 1);
  dots.querySelectorAll<HTMLButtonElement>('.public-tour-modal-dot').forEach((dot) => {
    dot.onclick = () => {
      const i = Number(dot.dataset.dotIndex || '0');
      applyCarouselPosition(track, dots, i, gallery.length);
    };
  });
}

function stepCarousel(track: HTMLElement, dots: HTMLElement, count: number, delta: number) {
  if (count < 2) return;
  carouselIndex = (carouselIndex + delta + count) % count;
  applyCarouselPosition(track, dots, carouselIndex, count);
}

function applyCarouselPosition(track: HTMLElement, dots: HTMLElement, index: number, count: number) {
  carouselIndex = index;
  track.style.transform = `translateX(-${(index * 100) / Math.max(count, 1)}%)`;
  const slides = track.querySelectorAll<HTMLElement>('.public-tour-modal-slide');
  slides.forEach((s, i) => {
    s.style.flex = count > 0 ? `0 0 ${100 / Math.max(count, 1)}%` : '0 0 100%';
  });
  dots.querySelectorAll<HTMLButtonElement>('.public-tour-modal-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

function openModal(overlay: HTMLElement, tour: PublicTour) {
  renderModal(overlay, tour);
  overlay.dataset.publicTourModal = 'open';
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(overlay: HTMLElement) {
  overlay.dataset.publicTourModal = 'closed';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

export function PublicToursBridge() {
  useEffect(() => {
    let cancelled = false;
    const grid = document.querySelector<HTMLElement>('#tours .tour-grid');
    if (!grid) return;
    const overlay = buildModal();
    const closeBtn = overlay.querySelector<HTMLButtonElement>('.public-tour-modal-close')!;
    closeBtn.onclick = () => closeModal(overlay);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeModal(overlay);
    });
    const onKey = (event: KeyboardEvent) => {
      if (overlay.dataset.publicTourModal !== 'open') return;
      if (event.key === 'Escape') closeModal(overlay);
    };
    document.addEventListener('keydown', onKey);

    const lang = (typeof window !== 'undefined' && (window as any).__CAPOY_LANG__) || 'es';
    fetch(`/api/public/tours?lang=${encodeURIComponent(lang)}&cb=${Date.now()}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('public_tours_unavailable');
        return response.json();
      })
      .then((data) => {
        if (cancelled || !Array.isArray(data?.tours)) return;
        grid.replaceChildren();
        const tours = data.tours as PublicTour[];
        if (!tours.length) {
          const empty = textElement('p', 'public-tours-empty', 'Pronto publicaremos nuevas experiencias.');
          grid.appendChild(empty);
          return;
        }
        const fragment = document.createDocumentFragment();
        tours.forEach((tour) => {
          const card = buildTourCard(tour);
          const btn = card.querySelector<HTMLButtonElement>('[data-public-tour-details]');
          btn?.addEventListener('click', () => openModal(overlay, tour));
          fragment.appendChild(card);
        });
        grid.appendChild(fragment);
      })
      .catch(() => {
        if (grid) grid.dataset.publicToursStatus = 'fallback';
      });

    return () => {
      cancelled = true;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      overlay.remove();
    };
  }, []);

  return null;
}
