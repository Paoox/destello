-- ¿Existe el certificado y a qué correo quedó pegado?
SELECT folio, usuario_email, taller_id, nombre, anulado, created_at
  FROM certificados
 ORDER BY created_at DESC;

-- ¿Ese correo coincide con una cuenta de usuarios? (es lo que consulta la API)
SELECT c.folio,
       c.usuario_email                       AS correo_del_certificado,
       u.email                               AS correo_de_la_cuenta,
       u.id                                  AS usuario_id,
       (u.id IS NOT NULL)                    AS la_cuenta_existe,
       c.anulado
  FROM certificados c
  LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(c.usuario_email)
 ORDER BY c.created_at DESC;

-- Exactamente lo que devuelve GET /users/me/certificados para esa persona.
-- Cambia el correo si entras a Destello con otra cuenta.
SELECT folio, taller_nombre, nombre, fecha_taller
  FROM certificados
 WHERE LOWER(usuario_email) = LOWER('paoox.dev@gmail.com')
   AND anulado = FALSE;
