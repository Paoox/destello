-- ════════════════════════════════════════════════════════════════════════════
-- Destello — 005: el nombre del certificado, como la persona lo quiere
-- ════════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA:
-- Hoy el nombre del alumno se guarda mal y no hay forma de que se guarde bien.
-- El bot pide nombre y apellido por separado (correcto), pero manda el nombre
-- COMPLETO CONCATENADO a `lista_espera.nombre`. Después, al confirmar el pago,
-- ese nombre completo se copia de vuelta a `usuarios.nombre` si estaba vacío.
-- Resultado:  nombre = "Ana Ruiz García",  apellido = NULL.
--
-- Y eso importa porque **ese nombre es el que va impreso en el certificado**.
--
-- POR QUÉ NO BASTA CON ARREGLAR EL BUG:
-- Aunque se arregle la concatenación, partir nombres en dos campos es una
-- pelea que no se gana: hay quien tiene dos apellidos, quien usa uno solo,
-- nombres compuestos, "de la", acentos que el bot pierde. Adivinar cómo
-- partirlo siempre va a fallar para alguien.
--
-- LA SOLUCIÓN:
-- Que lo diga la persona. `nombre` y `apellido` se quedan para uso del sistema
-- (saludarla, buscarla). Se agrega `nombre_certificado`: el texto EXACTO que se
-- imprime, tal como ella lo escribió.
--
-- En el onboarding se le pregunta una sola vez:
--     "¿Cómo quieres que aparezca tu nombre en el certificado?"
-- precargado con lo que ya se tenga, y ella lo corrige si hace falta. Es una
-- pregunta que la gente SÍ quiere contestar, porque le importa el resultado —
-- muy distinto a pedirle "apellido" a secas.
--
-- Aditiva e idempotente. Correr en: Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════════════


ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS nombre_certificado     TEXT,
    ADD COLUMN IF NOT EXISTS nombre_certificado_at  TIMESTAMPTZ;

COMMENT ON COLUMN usuarios.nombre_certificado IS
    'Texto EXACTO que va impreso en el certificado, escrito por la persona.
     NULL = todavía no se le ha preguntado. Nunca se calcula ni se parte:
     es la única fuente de verdad para el documento.';

COMMENT ON COLUMN usuarios.nombre_certificado_at IS
    'Cuándo lo confirmó. NULL con la cuenta activa = falta preguntárselo.';


-- ── Semilla: lo que ya se tiene, como propuesta inicial ─────────────────────
-- No es la respuesta final — es solo el valor que se le va a mostrar
-- precargado. Por eso `nombre_certificado_at` se deja en NULL: mientras esté
-- vacío, la plataforma sabe que la persona todavía no lo ha confirmado.

UPDATE usuarios
SET nombre_certificado = TRIM(
        COALESCE(nombre, '') ||
        CASE WHEN COALESCE(apellido, '') <> '' THEN ' ' || apellido ELSE '' END
    )
WHERE nombre_certificado IS NULL
  AND COALESCE(nombre, '') <> '';


-- ── A quién hay que preguntarle ─────────────────────────────────────────────
-- Esta vista alimenta el aviso del perfil. Se muestra solo a quien ya está
-- adentro: preguntarle el nombre del certificado a alguien que todavía no
-- entra no tiene ningún sentido.

CREATE OR REPLACE VIEW v_falta_nombre_certificado AS
SELECT id, email, nombre, apellido, nombre_certificado AS propuesta, activado_at
FROM usuarios
WHERE estado = 'activo'
  AND nombre_certificado_at IS NULL;

ALTER VIEW v_falta_nombre_certificado SET (security_invoker = on);
REVOKE ALL ON v_falta_nombre_certificado FROM anon, authenticated;


-- ── Verificar ───────────────────────────────────────────────────────────────
SELECT COUNT(*) FILTER (WHERE nombre_certificado IS NOT NULL)    AS con_propuesta,
       COUNT(*) FILTER (WHERE nombre_certificado_at IS NOT NULL) AS ya_confirmado,
       COUNT(*)                                                  AS total
FROM usuarios;

SELECT * FROM v_falta_nombre_certificado;
