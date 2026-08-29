<?php
declare(strict_types=1);

$tours = [
    ['badge'=>'Más popular','title'=>'Aventura en La Fortuna','place'=>'La Fortuna, Alajuela','copy'=>'Volcán Arenal, senderos, puentes colgantes y aguas termales.','hours'=>'8 horas','price'=>'$129','image'=>'https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=900&q=85'],
    ['badge'=>'Ideal para familias','title'=>'Cataratas & Naturaleza','place'=>'Pérez Zeledón','copy'=>'Cascadas espectaculares y vida silvestre en su hábitat natural.','hours'=>'6 horas','price'=>'$95','image'=>'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=900&q=85'],
    ['badge'=>'Romántico','title'=>'Catamarán al Atardecer','place'=>'Golfo de Papagayo','copy'=>'Navega, disfruta del atardecer y snorkel en aguas cristalinas.','hours'=>'4 horas','price'=>'$89','image'=>'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85'],
    ['badge'=>'Relajante','title'=>'Volcán y Termales','place'=>'Arenal, Alajuela','copy'=>'Visita al volcán Arenal y relájate en termas naturales.','hours'=>'7 horas','price'=>'$119','image'=>'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=900&q=85'],
];
$gallery = [
 'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=600&q=85',
 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=600&q=85',
 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=600&q=85',
 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&q=85',
 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=600&q=85',
 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=600&q=85',
];
$destinations = [
 ['Manuel Antonio','Playas y vida silvestre','https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=700&q=85'],
 ['Arenal','Aventura y relajación','https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=700&q=85'],
 ['Monteverde','Bosques nubosos','https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=85'],
 ['Guanacaste','Playas y sol todo el año','https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=85'],
 ['Tortuguero','Canales y biodiversidad','https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=700&q=85'],
];
$testimonials = [
 ['La experiencia en La Fortuna fue increíble. Los guías súper profesionales y muy amables. 100% recomendado.','María Fernanda','México'],
 ['Todo salió perfecto, desde la reserva hasta el último detalle del tour. Capoy hizo nuestro viaje inolvidable.','Carlos Alberto','Colombia'],
 ['El catamarán al atardecer fue mágico. Paisajes hermosos, excelente servicio y mucha diversión.','Laura y Andrés','Argentina'],
];
$faqs = ['¿Cómo puedo hacer una reserva?','¿Qué métodos de pago aceptan?','¿Puedo cancelar o cambiar mi reserva?','¿Incluye transporte desde mi hotel?','¿Qué debo llevar a los tours?','¿Los tours son aptos para niños y adultos mayores?'];
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Capoy Costa Rica | Tours y experiencias</title>
  <meta name="description" content="Tours locales y experiencias auténticas en Costa Rica. Reserva aventuras, naturaleza, playas y volcanes con Capoy Costa Rica.">
  <meta name="theme-color" content="#06452b">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="/assets/styles.css">
  <script defer src="/assets/app.js"></script>
</head>
<body>
<div class="site-shell">
<section class="hero" id="inicio"><div class="hero-overlay"></div>
<header class="topbar container">
<a class="brand" href="#inicio" aria-label="Capoy Costa Rica"><div class="brand-mark">◒</div><div><strong>Capoy</strong><span>Costa Rica</span></div></a>
<nav class="nav" aria-label="Navegación principal"><a href="#inicio">Inicio</a><a href="#tours">Tours</a><a href="#destinos">Destinos</a><a href="#galeria">Galería</a><a href="#faq">FAQ</a><a href="#contacto">Contacto</a></nav>
<div class="nav-actions"><a class="phone" href="tel:+50688801234">☎ +506 8880-1234</a><a class="reserve-btn" href="#tours">▣ Reservar ahora</a></div>
</header>
<div class="container hero-content"><div class="hero-copy"><p class="script">Explora</p><h1>Costa Rica<br>como nunca<br>antes</h1><p class="lead">Reservas fáciles, guías locales y experiencias inigualables en los lugares más increíbles del país.</p><div class="hero-buttons"><a class="primary-ghost" href="#tours">Ver tours →</a><a class="secondary-btn" href="#como-funciona">Planear mi viaje ✈</a></div></div>
<div class="hero-stats"><div class="stat"><span class="icon">♟</span><div><strong>15,000+</strong><span>Viajeros felices</span><em>★★★★★</em></div></div><div class="stat"><span class="icon">★</span><div><strong>4.9/5</strong><span>Calificación promedio</span><em>★★★★★</em></div></div><div class="stat"><span class="icon">⌖</span><div><strong>50+</strong><span>Destinos increíbles</span></div></div></div></div></section>
<section class="trust-strip"><div class="container trust-grid"><div><span class="icon">✓</span><span><b>Operador 100% local</b>y certificado</span></div><div><span class="icon">♧</span><span><b>Turismo sostenible</b>y responsable</span></div><div><span class="icon">☎</span><span><b>Soporte 24/7</b>antes y durante tu viaje</span></div><div><span class="icon">▣</span><span><b>Reservas seguras</b>y confirmación inmediata</span></div></div></section>
<main>
<section class="section container" id="tours"><div class="section-heading"><div><p class="eyebrow">🍃 TOURS DESTACADOS</p><h2>Vive experiencias inolvidables</h2></div><a href="#tours">Ver todos los tours →</a></div><div class="tour-grid">
<?php foreach ($tours as $i=>$tour): ?><article class="tour-card"><div class="tour-image" style="background-image:url('<?= htmlspecialchars($tour['image']) ?>')"><span class="badge"><?= htmlspecialchars($tour['badge']) ?></span><button class="favorite" type="button" aria-label="Agregar a favoritos">♡</button></div><div class="tour-body"><h3><?= htmlspecialchars($tour['title']) ?></h3><p class="place">⌖ <?= htmlspecialchars($tour['place']) ?></p><p><?= htmlspecialchars($tour['copy']) ?></p><div class="tour-meta"><span>◷ <?= htmlspecialchars($tour['hours']) ?></span><div><small>Desde</small><strong><?= htmlspecialchars($tour['price']) ?></strong><small>por persona</small></div></div><a href="#contacto" class="card-btn">Ver detalles</a></div></article><?php endforeach; ?>
</div></section>
<section class="why container"><p class="eyebrow center">🍃 ¿POR QUÉ ELEGIR CAPOY COSTA RICA?</p><h2>Tu aventura, nuestra pasión</h2><div class="why-grid"><div><span class="icon">▣</span><b>Reservas fáciles</b><span>Reserva en minutos y recibe confirmación inmediata.</span></div><div><span class="icon">♟</span><b>Guías locales</b><span>Expertos apasionados que conocen cada rincón.</span></div><div><span class="icon">☎</span><b>Atención personalizada</b><span>Te acompañamos antes, durante y después.</span></div><div><span class="icon">▰</span><b>Transporte confiable</b><span>Unidades cómodas y seguras con aire acondicionado.</span></div><div><span class="icon">♧</span><b>Experiencias auténticas</b><span>Conexión real con la cultura, naturaleza y comunidad.</span></div></div></section>
<section class="section container" id="galeria"><p class="eyebrow">🍃 GALERÍA DE COSTA RICA</p><h2>Inspírate con nuestra tierra</h2><div class="gallery-grid"><?php foreach($gallery as $i=>$src): ?><img loading="lazy" src="<?= htmlspecialchars($src) ?>" alt="Costa Rica <?= $i+1 ?>"><?php endforeach; ?></div><div class="center-action"><a class="outline-btn" href="#galeria">Ver más fotos en la galería ◉</a></div></section>
<section class="section container" id="destinos"><div class="section-heading"><div><p class="eyebrow">🍃 DESTINOS POPULARES</p><h2>Descubre lo mejor de Costa Rica</h2></div><a href="#destinos">Ver todos los destinos →</a></div><div class="destination-grid"><?php foreach($destinations as [$name,$sub,$img]): ?><article style="background-image:linear-gradient(0deg,rgba(0,0,0,.68),transparent 65%),url('<?= htmlspecialchars($img) ?>')"><div><h3><?= htmlspecialchars($name) ?></h3><p><?= htmlspecialchars($sub) ?></p></div></article><?php endforeach; ?></div></section>
<section class="section container how" id="como-funciona"><p class="eyebrow center">🍃 ¿CÓMO FUNCIONA?</p><h2>Reservar tu aventura es fácil</h2><div class="steps"><div><span class="icon">⌖</span><i>1</i><b>Elige tu tour</b><span>Explora nuestras experiencias y selecciona tu favorita.</span></div><span class="arrow">→</span><div><span class="icon">▣</span><i>2</i><b>Reserva</b><span>Completa tus datos, realiza el pago y recibe confirmación.</span></div><span class="arrow">→</span><div><span class="icon">◉</span><i>3</i><b>Disfruta</b><span>Vive una experiencia increíble y crea recuerdos inolvidables.</span></div></div></section>
<section class="section container testimonials"><p class="eyebrow center">🍃 LO QUE DICEN NUESTROS VIAJEROS</p><h2>Historias reales, experiencias increíbles</h2><div class="testimonial-grid"><?php foreach($testimonials as [$quote,$name,$country]): ?><blockquote><span class="quote">“</span><p><?= htmlspecialchars($quote) ?></p><div class="stars">★★★★★</div><b><?= htmlspecialchars($name) ?></b><small><?= htmlspecialchars($country) ?></small></blockquote><?php endforeach; ?></div></section>
<section class="section container faq" id="faq"><p class="eyebrow center">PREGUNTAS FRECUENTES</p><h2>Resolvemos tus dudas</h2><div class="faq-grid"><?php foreach($faqs as $q): ?><details><summary><?= htmlspecialchars($q) ?><span>⌄</span></summary><p>Nuestro equipo te acompaña en cada paso. Contáctanos para recibir información específica de tu experiencia.</p></details><?php endforeach; ?></div></section>
<section class="cta container" id="contacto"><div class="cta-copy"><div class="cta-logo">◒</div><div><h2>¿Listo para tu próxima aventura?</h2><p>Reserva hoy y vive Costa Rica como nunca antes.<br>Tu mejor historia comienza aquí.</p></div></div><div class="cta-actions"><a class="reserve-btn" href="#tours">▣ Reservar ahora</a><span>🟢 o escríbenos por WhatsApp</span></div></section>
</main>
<footer class="footer"><div class="container footer-grid"><div><a class="brand footer-brand" href="#inicio"><div class="brand-mark">◒</div><div><strong>Capoy</strong><span>Costa Rica</span></div></a><p>Tours locales, experiencias auténticas y recuerdos que duran para siempre.</p><div class="socials">● ● ● ● ●</div></div><div><b>Enlaces rápidos</b><a href="#inicio">Inicio</a><a href="#tours">Tours</a><a href="#destinos">Destinos</a><a href="#galeria">Galería</a></div><div><b>Información</b><a href="#faq">Sobre nosotros</a><a href="#faq">FAQ</a><a href="#faq">Términos y condiciones</a><a href="#faq">Política de privacidad</a></div><div><b>Contacto</b><span>+506 8880-1234</span><span>info@capoycostarica.com</span><span>La Fortuna, Alajuela, Costa Rica</span></div><div><b>Suscríbete a nuestras aventuras</b><p>Recibe ofertas exclusivas y novedades en tu correo.</p><form id="newsletter"><input type="email" placeholder="Tu correo electrónico" aria-label="Tu correo electrónico" required><button>Suscribirme</button></form><small id="newsletter-status" aria-live="polite"></small></div></div><div class="container copyright">© 2026 Capoy Costa Rica. Todos los derechos reservados.<span>Diseñado con ❤ en Costa Rica</span></div></footer>
</div>
</body></html>
