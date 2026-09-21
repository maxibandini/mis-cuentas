# Mis cuentas, contexto del proyecto

Este archivo es el traspaso de una conversación en claude.ai a Claude Code. Leelo completo antes de tocar nada.

## Sobre el usuario

- Se llama Marco, habla español rioplatense. Respondele en ese idioma.
- **Preferencia fija.** No usar los caracteres punto y coma ni dos puntos al redactar texto para él (en código obviamente se usan).
- Sabe programar (hizo pasantías como developer), pero prefiere pasos claros y concretos cuando hay que configurar cosas en Google o GitHub.
- Usa iPhone y PC con Windows. Su navegador principal es Arc.

## Qué es

Una app propia para registrar gastos e ingresos, pensada para reemplazar a la app Quanto. Lo que le faltaba a Quanto era ver el saldo total (ingresos menos gastos) y más información. Requisitos que él pidió

1. Que funcione en iPhone y en PC con la misma interfaz, aprovechando todo el ancho en PC.
2. Que el doble toque en la parte de atrás del iPhone (Toque posterior de iOS) permita cargar un gasto o ingreso rápido. **Esto es muy importante para él.**
3. Que los datos queden en Google Sheets, sin pagar dominio, hosting ni base de datos.
4. Muchas funciones, gráficos y animaciones lindas.
5. Que no aparezca el cartel "Un usuario de Google Apps Script creó esta aplicación". Por eso la interfaz se movió a GitHub Pages.

## Arquitectura

```
iPhone / PC (PWA en GitHub Pages)  ──fetch POST──▶  Apps Script (API, doPost)  ──▶  Google Sheet
Atajo de iOS (toque posterior)     ──fetch POST──▶  mismo endpoint, modo "atajo"
```

- **Frontend** es un solo `index.html` (HTML, CSS y JS sin frameworks ni build) más `manifest.json`, `sw.js` y tres íconos. Publicado en `https://maxibandini.github.io/mis-cuentas/` desde la rama `main`, carpeta raíz.
- **Backend** es un proyecto de Apps Script vinculado a la planilla (creado desde Extensiones → Apps Script, por eso `getActiveSpreadsheet()` funciona). Implementado como App web, ejecutar como el dueño, acceso "Cualquier usuario". La seguridad la da una clave guardada en Script Properties (`CLAVE`).
- La copia del código de Apps Script vive en `apps-script/Codigo.gs` de este repo, pero **lo que corre de verdad es lo que está pegado en el editor de Apps Script**. Si cambiás ese archivo, el usuario tiene que pegarlo allá (o usar clasp, ver más abajo) y crear una nueva versión de la implementación.

## Estructura del repo

```
index.html          App completa (UI, lógica, gráficos SVG propios)
manifest.json       PWA, íconos y accesos directos "Nuevo gasto" / "Nuevo ingreso"
sw.js               Service worker, cachea la app (stale-while-revalidate) y las fuentes
icon-192.png, icon-512.png, apple-touch-icon.png
_config.yml         Excluye CLAUDE.md y apps-script/ de la publicación
apps-script/Codigo.gs   Copia del backend
CLAUDE.md           Este archivo
```

## Planilla de Google

Hoja **Movimientos** con columnas `ID | Fecha | Tipo | Categoría | Monto | Nota`
- Monto con signo, negativo para gastos y positivo para ingresos.
- Tipo es `Gasto` o `Ingreso`.
- Si hay filas sin ID (cargadas a mano), `cargar_()` les asigna un UUID.

Hoja **Categorias** con columnas `Tipo | Nombre | Emoji | Presupuesto`
- Presupuesto es el límite mensual opcional (solo tiene sentido en gastos).
- Categorías iniciales, gastos Vivienda, Comida, Supermercado, Servicios, Transporte, Compras, Ropa, Salir, Entretenimiento, Suscripciones, Extras. Ingresos Salario, Inversiones. Salieron de su configuración en Quanto.

## Contrato de la API

Todo va por `POST` a la URL `/exec` con `Content-Type: text/plain;charset=utf-8` (a propósito, para que sea una "simple request" y no haya preflight de CORS). Apps Script responde con un 302 a googleusercontent, `fetch` lo sigue solo.

**Modo app.** Body `{ clave, accion, datos }`, respuesta `{ ok: true, data }` o `{ ok: false, error }`. Si la clave es incorrecta el error es exactamente `"CLAVE"` y el frontend muestra el login.

| accion | datos | devuelve |
|---|---|---|
| `cargar` | nada | `{ movs, cats, url }` |
| `agregar` | `{ tipo, monto, categoria, nota, fecha?, id? }` | el movimiento guardado, con monto con signo |
| `editar` | `{ id, tipo, monto, categoria, nota, fecha }` | el movimiento actualizado |
| `borrar` | `{ id }` | `{ ok: true }` |
| `guardarCategoria` | `{ tipo, nombre, emoji, presupuesto, original? }` | la categoría. Si `original` cambia de nombre, renombra también los movimientos |
| `borrarCategoria` | `{ tipo, nombre }` | `{ ok: true }`. Los movimientos conservan el nombre |

`monto` siempre se manda positivo, el servidor le pone el signo según el tipo. `agregar` acepta `id` para poder "deshacer" un borrado con el mismo ID.

**Modo atajo.** Body `{ clave, atajo: true, ... }`, responde texto plano pensado para mostrar en una notificación de iOS.
- `{ accion: "categorias", tipo }` devuelve una categoría por línea con formato `emoji nombre`.
- `{ tipo, categoria, monto, nota? }` guarda y devuelve un texto con lo guardado, lo que queda del presupuesto de esa categoría y el saldo total. Acepta la categoría con o sin el emoji adelante.

`doGet` solo devuelve un texto para comprobar que la API anda.

## Frontend, detalles importantes

- `API_URL` está hardcodeada al principio del script en `index.html`. Tiene que ser `https://script.google.com/macros/s/<deploymentId>/exec` (se copia de Implementar → Administrar implementaciones). **No** usar la `script.googleusercontent.com/macros/echo?user_content_key=...` que queda en la barra del navegador al abrir la `/exec`, esa es una respuesta cacheada de un solo GET y el POST falla. `iniciar()` valida el formato y muestra "Falta un paso" si no coincide. La clave **nunca** va en el código (el repo es público). Se pide una vez por dispositivo y se guarda en `localStorage` (`mc_clave`).
- Otras claves de `localStorage` son `mc_datos2` (cache de movs, cats y url para abrir al instante) y `mc_oculto` (ocultar montos).
- Las operaciones son optimistas. Se actualiza la UI, se llama a la API y si falla se revierte con un aviso.
- Al volver a la app (`visibilitychange`) recarga datos en silencio.
- `?nuevo=1` abre directo el editor de nuevo movimiento, `&tipo=ingreso` lo abre en ingreso. Después se limpia la URL con `history.replaceState`.
- Vistas Inicio, Movimientos, Gráficos y Ajustes. Barra inferior en celular, menú lateral a partir de 960px (`ESCRITORIO` en el JS, varias reglas en `@media (min-width:960px)`).
- Gráficos hechos a mano en SVG (dona, barras de 6 meses, gasto diario con promedio, evolución del saldo, gasto por día de la semana). Tooltips con `data-tip`. Animaciones por CSS (`.barra`, `.seg`, `.traza` con `pathLength="1"`) y números con `contar()`. Se respeta `prefers-reduced-motion`.
- El selector de fecha es un **calendario propio** (`renderCal`). El `input type=date` nativo no abría dentro del iframe de Apps Script y se reemplazó. Conviene mantener el calendario propio.
- Diseño oscuro. Tokens en `:root`, fondo `#12141B`, gasto coral `#FF8A73`, ingreso menta `#7DDBA9`, aviso `#F4C470`. Tipografías Bricolage Grotesque (números) y Figtree (interfaz).
- Montos en pesos argentinos con formato `es-AR`.

## Cómo publicar cambios

**Frontend.** Commit y push a `main`. Siempre que cambie algún archivo de la app, subir el número de `VERSION` en `sw.js`, si no los dispositivos siguen viendo la versión cacheada. La app nueva aparece la segunda vez que se abre.

**Backend.** Pegar `apps-script/Codigo.gs` en el editor de Apps Script, guardar, y después Implementar → Administrar implementaciones → lápiz → Versión "Nueva versión" → Implementar. Así la URL `/exec` no cambia. Crear una implementación nueva cambiaría la URL y habría que actualizar `API_URL` y el atajo.

**Opcional, clasp.** Para que Claude Code pueda subir el backend directamente, se puede usar `npm i -g @google/clasp`, `clasp login` y `clasp clone <scriptId>` dentro de `apps-script/` (el scriptId está en Configuración del proyecto de Apps Script). Hay que activar la API de Apps Script en `script.google.com/home/usersettings`. Después `clasp push` y `clasp deploy -i <deploymentId>` para actualizar la misma implementación. Todavía no está configurado, preguntale al usuario antes.

## Estado

Hecho
- Backend pegado en Apps Script. Implementación activa `git` (versión 4), acceso "Cualquier usuario", deploymentId `AKfycbyyg7JIAPBbAPMdNBnaGJDPUFLpXp2mIC4l0wXKlBe001JEvd02pJMPAN0GvA7sfkvo`. Probado con curl el 2026-09-21, GET responde, POST con clave mala devuelve `CLAVE`, CORS ok.
- Repo `maxibandini/mis-cuentas` con GitHub Pages desde `main` en la raíz. La carpeta local de OneDrive es el clon de trabajo.
- `API_URL` corregida a la `/exec` real (antes tenía la URL echo de googleusercontent y el login no podía funcionar).

Pendiente (en este orden)
1. Entrar con la clave y probar cargar, editar y borrar un movimiento, y que aparezca en la planilla. Confirmar que se ejecutó `configurar` (sin clave guardada la API responde `CLAVE` igual que con clave incorrecta).
2. Instalarla en el iPhone desde Safari (compartir → Agregar a inicio) y en la PC desde Chrome o Edge (Arc no instala PWAs). Borrar el acceso viejo de Apps Script en el iPhone.
3. Configurar el doble toque (ver abajo).
4. Opcional, clasp (el usuario todavía no respondió si lo quiere).

## Doble toque en iPhone

Limitación de iOS, un atajo que abre una URL la abre en Safari y no en la PWA instalada (y Safari tiene su propio `localStorage`, así que pide la clave una vez más).

**Opción A.** Atajo con "Abrir URL" a `https://maxibandini.github.io/mis-cuentas/?nuevo=1`.

**Opción B, recomendada, sin abrir la app.**
1. Elegir de la lista con Gasto e Ingreso.
2. Obtener contenido de URL, POST, cuerpo JSON con `clave`, `atajo` (booleano Sí), `accion` = `categorias` y `tipo` = elemento elegido.
3. Dividir texto por nuevas líneas.
4. Elegir de la lista.
5. Pedir entrada de tipo número.
6. Obtener contenido de URL, POST, JSON con `clave`, `atajo` Sí, `tipo`, `categoria` y `monto`.
7. Mostrar notificación con el resultado.

Después Ajustes → Accesibilidad → Tocar → Toque posterior → Doble toque → ese atajo.

## Historial de decisiones

1. Primero se hizo todo dentro de Apps Script (HtmlService) con clave. Después se sacó la clave usando acceso "Solo yo". Finalmente se movió la UI a GitHub Pages para quitar el cartel de Google, y volvió la clave porque la API tiene que ser pública.
2. Se agregaron presupuestos, edición, filtros, búsqueda, deshacer, ocultar montos, gráficos y diseño de escritorio a pedido del usuario.
3. El problema del botón "Otro día" se resolvió con el calendario propio.
