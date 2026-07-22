# Flujo de acceso — Bot Faro (opción 3 y reporte de pago)

> Especificación acordada con Paola el 21 jul 2026.
> **Leer antes de tocar `apps/bot/src/flujo.js`.**

---

## Principios

1. **Al usuario NUNCA se le manda un código.** Ni `RESP-XXXX` ni `DEST-XXXX`.
   Resplandores y chispas son registros internos que solo relacionan usuario ↔
   taller en la BD. Lo único que se le envía es **la liga de login** por WhatsApp
   o **el QR** por correo.

2. **El taller se activa solo.** No hay canje. Al crear la chispa, el taller
   aparece en `/home` automáticamente. El usuario nunca reclama ni elige taller,
   así que no puede equivocarse.

3. **`usuarios.estado` = permiso, no "cuenta creada".**
   - `activo` → Paola le dio acceso. `phoneAuthController` lo exige para el login
     por número.
   - `espera` → está en lista, todavía sin permiso.

4. **Para asignarle cualquier cosa (taller, demo, artilugio) debe tener cuenta
   como todos:** nombre, apellido, correo y WhatsApp.

5. **El bot nunca libera nada por su cuenta.** Resuelve con lo que la BD ya
   autoriza; si falta la decisión de Paola, levanta reporte y avisa por WhatsApp.

---

## Cómo entra la gente (desde el 20 jul 2026)

`/login` ofrece dos caminos, ninguno con código:

- **Google** — requiere que el correo exista en `usuarios`.
- **Número + OTP** — el bot Faro manda 6 dígitos. Requiere `estado = 'activo'`
  **y** que `usuarios.whatsapp` esté lleno.

⚠️ `/acceso` (validar código de resplandor) quedó huérfana en el router, sin
enlazar. No usarla ni mencionarla al usuario.

---

## Árbol de decisión — opción 3 "No me llegó mi acceso"

Se le pide el correo (si no lo dio antes en la conversación) y se consulta
`GET /bot/diagnostico/:email`.

### A. El correo no existe en `usuarios`
→ No está registrado. Invitarlo a la opción 1 del menú para inscribirse.

### B. `estado = 'activo'` → ya tiene permiso de entrar

1. **Si le falta el WhatsApp en la BD**, el bot lo guarda automáticamente (ya lo
   tiene del chat). Sin ese dato no podría entrar por número. **Esto arregla el
   problema en silencio, sin molestar a nadie.**
2. Le manda la liga de login y le recuerda que puede entrar con Google o con su
   número.
3. Si tiene talleres asignados, se los lista con su fecha de inicio y aclara que
   **el material se abre después de la clase**.
4. Ofrece el menú de escalamiento por si aun así no puede.

### C. `estado = 'espera'` → todavía sin permiso

- **Con `cupo_confirmado` en alguna lista** → tiene lugar, falta el pago.
  Mensaje de que no aparece registrado su pago + medios de pago + la opción de
  reportarlo.
- **Solo `pendiente`** → "Todavía no confirmamos tu lugar, te avisamos en cuanto
  haya cupo." **No se le mandan datos bancarios**: no queremos que pague sin
  lugar asegurado.

### Menú de escalamiento
Aparece **solo después** de haberle resuelto lo que la BD permitía (caso B). Si
insiste, es un caso real:

```
1. Sigo sin ver mi taller      → reporte (posible bug de plataforma)
2. No puedo entrar a mi cuenta → reporte (posible problema de login)
3. Todo bien, volver al menú
```

---

## Flujo nuevo — "Ya pagué / reportar mi pago"

Opción propia del menú principal. Pide correo (si no lo tiene) y deja elegir:

```
1. Enviar foto de mi comprobante
2. Escribir los datos de mi pago
```

**Foto** — el bot espera un `imageMessage`, acusa recibo y se la reenvía a Paola
por WhatsApp junto con el reporte.

**Datos** — se piden en pasos separados (uno por mensaje, más fiable que pedirlos
todos juntos): banco · monto · titular · fecha y hora · folio.

**Cierre en ambos casos:**
> "Ya lo recibimos. Lo revisamos y te notificamos en cuanto quede reflejado tu
> pago."

**Después:** Paola coteja contra el banco.
- Si el pago cayó → activa a la persona y le asigna el taller.
- Si no cayó → se le avisa que aún no se refleja.

El bot **no** activa nada por un reporte de pago.

⚠️ **Requisito técnico:** hoy `apps/bot/index.js` solo lee `conversation` y
`extendedTextMessage`. **Las imágenes se ignoran por completo.** Hay que agregar
lectura de `imageMessage` antes de que este flujo sirva.

---

## Opción 2 — Ver talleres

Si la persona ya está registrada y sus datos están en la conversación, se usan
esos mismos datos y se la mete directo a la lista de espera del taller que elija,
sin volver a pedirle correo ni nombre.

---

## Casos límite conocidos

| Caso | Decisión |
|---|---|
| Activo pero sin WhatsApp en BD | El bot lo guarda solo; así habilita el login por número |
| Activo sin talleres | Puede entrar, aún sin taller asignado. Se le dice tal cual |
| Reporta pago sin estar en ninguna lista | Se acepta el reporte igual; Paola decide |
| Insiste después de que ya se le resolvió | Reporte, es problema de plataforma |
| API caída | Mensaje de disculpa, nunca silencio |

---

## Cambios pendientes de implementar

### Base de datos
- [ ] Tabla `reportes_acceso` (ver `reportes_acceso.sql`)
- [ ] Columnas de pago: `datos_pago JSONB`, `comprobante_recibido BOOLEAN`

### API
- [ ] `diagnosticoService` — señal = `usuarios.estado`, no resplandores
- [ ] `POST /bot/completar-whatsapp` — guarda el número de quien está activo sin él
- [ ] `POST /bot/reporte-pago` — guarda datos o marca comprobante recibido
- [ ] Quitar `POST /bot/reenviar-invitacion` y `POST /bot/liberar-taller`
      (se escribieron el 21 jul con el modelo viejo de códigos)

### Bot
- [ ] Quitar TODA mención de códigos y de `/acceso` en los textos
- [ ] Árbol de decisión de arriba
- [ ] Lectura de `imageMessage` en `index.js` + reenvío a Paola
- [ ] Flujo de captura de datos de pago
- [ ] Opción 2: inscribir con los datos ya conocidos

### Documentación
- [ ] `CLAUDE.md` — los pasos 9 y 10 del flujo todavía dicen "Usuario usa Chispa
      → desbloquea taller". Ya no aplica.
