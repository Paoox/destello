-- ============================================================
--  Destello — Semilla de talleres (Supabase)
--  Pegar en: Supabase → SQL Editor → Run.
--  Idempotente: agrega la columna hora_inicio si falta y no
--  duplica talleres (ON CONFLICT por id).
-- ============================================================

-- Columnas para validar acceso a clase con hora local CDMX (UTC−6).
ALTER TABLE talleres ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE talleres ADD COLUMN IF NOT EXISTS hora_fin    TIME;

INSERT INTO talleres (id, nombre, categoria, descripcion, precio, fecha_inicio, fecha_fin, cupo_maximo, estado)
VALUES
(
  'taller-auriculoterapia-inicial',
  'Auriculoterapia inicial',
  'Horizonte Zen',
  $d$Este taller de Nivel Inicial está diseñado especialmente para ti, sin importar si no tienes conocimientos previos en salud o terapias alternativas. Es la puerta de entrada a un viaje de tres niveles (Inicial, Intermedio y Avanzado) donde transformarás tu manera de entender el cuerpo humano.$d$,
  1200, '2026-08-10', '2026-08-10', 20, 'proximamente'
),
(
  'taller-masaje-con-piedras-calientes',
  'Masaje con piedras calientes',
  'Horizonte Zen',
  $d$Aprende una técnica milenaria para liberar el estrés, aliviar dolores y equilibrar la energía de cuerpo y mente.
¿Te gustaría aprender a dar un masaje que no solo relaje los músculos, sino que reconforte el alma? El calor de las piedras volcánicas penetra profundamente en el cuerpo, logrando en minutos lo que a las manos les toma horas liberar.
Este es un taller práctico y definitivo. No necesitas conocimientos previos ni tomar más niveles: aquí te enseñamos todo el proceso para que puedas dar un masaje terapéutico y relajante desde el primer día.$d$,
  1200, '2026-08-11', '2026-08-11', 20, 'proximamente'
),
(
  'taller-masaje-relajante-descontracturante-electroestimulacion',
  'Masaje Relajante y Descontracturante con Electroestimulación',
  'Horizonte Zen',
  $d$Domina la combinación perfecta: el poder de tus manos y la precisión científica de las corrientes electricas para aliviar el dolor y liberar tensiones.
El masaje manual es maravilloso, pero cuando se combina con la tecnología adecuada, los resultados se multiplican. En este taller único y 100% práctico, aprenderás a integrar de manera profesional los electroestimuladores en tus sesiones de masaje para ofrecer un alivio inmediato, profundo y sin desgastar tus manos.$d$,
  1200, '2026-08-12', '2026-08-12', 20, 'proximamente'
),
(
  'taller-reflexologia-podal',
  'Reflexología podal',
  'Horizonte Zen',
  $d$Nuestros pies cargan con todo el peso del día, pero también guardan el secreto para restaurar la armonía de todo nuestro organismo. La reflexología podal es una terapia milenaria basada en la estimulación de puntos reflejos en los pies que corresponden a cada órgano y parte del cuerpo.
En este taller de sesión única, aprenderás paso a paso cómo activar los mecanismos de autocuración de tu cuerpo y regalar una experiencia de relajación absoluta.$d$,
  1200, '2026-08-13', '2026-08-13', 20, 'proximamente'
),
(
  'taller-como-hablar-con-la-ia',
  'Cómo hablar con la IA: El secreto para que te entienda a la primera',
  'IngenIA',
  $d$Aprenderás a comunicarte con ChatGPT y otras herramientas de Inteligencia Artificial usando palabras sencillas para obtener respuestas perfectas desde el primer intento. Descubrirás la fórmula exacta para pedirle que redacte correos difíciles, resuma textos o te dé ideas creativas, perdiéndole el miedo a la tecnología de una vez por todas.$d$,
  1200, '2026-08-17', '2026-08-17', 20, 'proximamente'
),
(
  'taller-ia-para-perezosos-inteligentes',
  'IA para Perezosos Inteligentes: Crea tu asistente virtual y trabaja la mitad',
  'IngenIA',
  $d$Aprenderás a configurar y entrenar a tu propio ayudante digital para que haga el trabajo repetitivo por ti en tu día a día. Descubrirás cómo usar comandos rápidos en tu celular o computadora para planificar tu semana, responder mensajes frecuentes de WhatsApp y resolver pendientes cotidianos en segundos.$d$,
  1200, '2026-08-18', '2026-08-18', 20, 'proximamente'
),
(
  'taller-diseno-facil-con-canva-e-ia',
  'Diseño Fácil con Canva e IA: Crea tus Redes Sociales en Minutos',
  'IngenIA',
  $d$Aprenderás a usar Canva y sus herramientas mágicas con inteligencia artificial para diseñar imágenes, logos y publicaciones espectaculares sin saber nada de diseño. Saldrás de la sesión con tu marca definida y el contenido de todo tu mes listo para tus redes sociales, de forma rápida, visual y muy sencilla.$d$,
  1200, '2026-08-19', '2026-08-19', 20, 'proximamente'
),
(
  'taller-recupera-tu-tiempo-con-ia',
  'Recupera tu Tiempo con IA: Automatiza tus tareas aburridas del día a día',
  'IngenIA',
  $d$Aprenderás a identificar cuáles son las tareas rutinarias que te quitan energía (como organizar archivos, responder correos repetitivos o hacer reportes) y cómo dejar que la IA las resuelva por ti. Descubrirás cómo crear un sistema digital que organice tu agenda y trabaje en piloto automático mientras tú te enfocas en lo importante.$d$,
  1200, '2026-08-20', '2026-08-20', 20, 'proximamente'
)
ON CONFLICT (id) DO NOTHING;

-- Horarios: todos los talleres a las 12:00 PM CDMX, 4 horas (12:00–16:00).
UPDATE talleres
SET horario     = '12:00 PM (CDMX)',
    hora_inicio = '12:00:00',
    hora_fin    = '16:00:00';
