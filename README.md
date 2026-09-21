# Mis cuentas

App para anotar gastos e ingresos desde el celular o la compu, con saldo total, presupuestos por categoría y gráficos. Los datos quedan en **tu propia planilla de Google Sheets**. No hay que pagar hosting, dominio ni base de datos.

## Cómo funciona

```
App (GitHub Pages)  ──▶  Apps Script en tu planilla  ──▶  Google Sheets
Atajo del iPhone    ──▶  (misma API)
```

- La app es una página web que se instala en el celular como si fuera una aplicación. Se publica gratis con GitHub Pages.
- La planilla tiene un script (Apps Script) que hace de API. La app le pide los datos y le manda lo que cargás.
- Cada persona tiene su propia copia de la app, su planilla y su clave. Nadie ve los datos de otro.

Armar todo lleva unos 15 minutos. No hace falta instalar nada en la compu, se hace todo desde el navegador.

---

## 1. Copiar la app a tu GitHub

1. Entrá a https://github.com/maxibandini/mis-cuentas con tu cuenta de GitHub.
2. Tocá **Fork** (arriba a la derecha) → **Create fork**. Podés dejarle el nombre `mis-cuentas`.

Con un fork, más adelante vas a poder traer las mejoras de la app con un botón (ver [Actualizaciones](#actualizaciones)).

## 2. Crear tu planilla y la API

1. Entrá a https://sheets.new, se crea una planilla vacía. Ponele de nombre "Mis cuentas".
2. En el menú andá a **Extensiones → Apps Script**. Se abre el editor en otra pestaña.
3. Borrá todo lo que hay en el archivo `Código.gs` y pegá el contenido completo de [`apps-script/Codigo.gs`](apps-script/Codigo.gs) de este repo.
4. En la línea que dice `const CLAVE_INICIAL = 'cambiame'`, cambiá `cambiame` por tu clave. **Usá una clave larga** (por ejemplo tres o cuatro palabras juntas), porque es lo único que protege tus datos. Solo la vas a escribir una vez en cada dispositivo.
5. Guardá con Ctrl+S.
6. Arriba, en el selector de funciones, elegí **`configurar`** y tocá **Ejecutar**.
7. La primera vez Google te pide permiso. Tocá **Revisar permisos**, elegí tu cuenta, y cuando aparezca "Google no verificó esta app" tocá **Configuración avanzada → Ir a (nombre del proyecto) (no seguro) → Permitir**. El aviso sale porque el script lo creaste vos y no pasó por la revisión de Google, es normal.
8. En el registro de abajo tiene que aparecer "Listo. Clave guardada y hojas verificadas." En la planilla vas a ver dos hojas nuevas, **Movimientos** y **Categorias**. La hoja vacía que venía podés borrarla.
9. (Opcional) Volvé a poner `'cambiame'` en esa línea y guardá, así la clave no queda escrita en el código. Queda guardada igual.

### Publicar la API

1. En el editor tocá **Implementar → Nueva implementación**.
2. Tocá el engranaje al lado de "Seleccionar tipo" y elegí **App web**.
3. Completá así
   - **Ejecutar como** → Yo (tu mail)
   - **Quién tiene acceso** → **Cualquier usuario**
4. Tocá **Implementar** y copiá la **URL de la app web**. Empieza con `https://script.google.com/macros/s/` y termina en `/exec`.

> **Ojo.** Usá esa URL tal cual. Si la abrís en el navegador, la barra muestra otra dirección (`script.googleusercontent.com/...`) que **no sirve**.

"Cualquier usuario" es necesario para que la app y el atajo puedan llamar a la API. La clave es la que evita que otros la usen.

## 3. Conectar la app con tu planilla

1. En tu fork en GitHub abrí el archivo **`config.js`** y tocá el lápiz (Edit).
2. Reemplazá la URL que hay entre comillas por la tuya. Tiene que quedar así, con tu URL

   ```js
   const API_URL = 'https://script.google.com/macros/s/TU-ID/exec';
   ```

3. Tocá **Commit changes**.

Es el único archivo que tenés que tocar.

## 4. Publicar la app

1. En tu fork andá a **Settings → Pages**.
2. En "Build and deployment" elegí **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Tocá **Save**.
3. Esperá uno o dos minutos. Tu app queda en `https://TU-USUARIO.github.io/mis-cuentas/`
4. Abrila, escribí tu clave y listo.

## 5. Instalarla

- **iPhone.** Abrí tu URL en **Safari** → botón Compartir → **Agregar a inicio**. Abrila desde el ícono y poné la clave (la app instalada guarda sus datos aparte de Safari, por eso la pide de nuevo).
- **Android.** En Chrome, menú ⋮ → **Instalar app** (o "Agregar a la pantalla principal").
- **PC.** En Chrome o Edge, ícono de instalar en la barra de direcciones. Arc y Firefox no instalan apps web, pero la podés usar igual como página.

Las categorías vienen con una lista inicial. Las podés cambiar, borrar o agregar desde **Ajustes** en la app, y ahí mismo ponerles un presupuesto mensual.

---

## 6. Doble toque en el iPhone (opcional)

Sirve para cargar un gasto o ingreso tocando dos veces la parte de atrás del iPhone, sin abrir la app.

### Copiar tus categorías
En la app andá a **Ajustes → Copiar categorías para el atajo**. Quedan en el portapapeles, una por línea.

### Armar el atajo
Abrí la app **Atajos**, tocá **+**, ponele de nombre "Cargar movimiento" y agregá estas acciones en orden.

1. **Texto**, y pegá las categorías que copiaste.
2. **Dividir texto**, con el Texto del paso anterior, dividir por **Nuevas líneas**.
3. **Elegir de la lista**, con el "Texto dividido" y el mensaje "¿En qué?".
4. **Pedir entrada**, de tipo **Número**, con el mensaje "¿Cuánto?".
5. **Obtener contenido de URL**, con tu URL `/exec`. Tocá la flechita para ver más opciones, poné Método **POST** y Solicitar cuerpo **JSON**, y agregá estos campos

   | Campo | Tipo | Valor |
   |---|---|---|
   | `clave` | Texto | tu clave |
   | `atajo` | Booleano | Verdadero |
   | `categoria` | Texto | variable **Elemento elegido** |
   | `monto` | **Número** | variable **Entrada proporcionada** |

6. **Mostrar notificación**, con la variable "Contenido de la URL".

Las variables se insertan tocando el campo y eligiéndolas en la barra que aparece arriba del teclado. Quedan como una pastilla de color. **No escribas su nombre a mano.** Revisá también que los nombres de los campos estén bien escritos.

Probalo con ▶. La primera vez iOS pide permiso para conectarse a Google, tocá **Permitir siempre**. La notificación muestra lo que se guardó, lo que te queda del presupuesto de esa categoría y tu saldo.

### Asignarlo al doble toque
Configuración (o Ajustes) → **Accesibilidad → Tocar → Toque posterior** (puede decir "Tocar atrás") → **Doble toque** → elegí "Cargar movimiento".

Tené en cuenta que
- El atajo tiene tu clave adentro, no lo compartas.
- Si creás o renombrás una categoría, volvé a copiarlas desde Ajustes y reemplazá el Texto del paso 1.
- Cada pedido a Apps Script tarda uno o dos segundos. La primera vez después de un rato sin usarlo puede tardar bastante más, es cosa de Google.

---

## Actualizaciones

Cuando haya mejoras en el repo original, en tu fork vas a ver un aviso "This branch is X commits behind". Tocá **Sync fork → Update branch**. Como tu URL está en `config.js`, no se pisa con los cambios.

La app nueva aparece la segunda vez que la abrís (la primera baja la actualización en segundo plano).

**Si el cambio toca `apps-script/Codigo.gs`**, además hay que actualizar el script
1. Pegá el archivo nuevo en el editor de Apps Script y guardá. Tu clave no se pierde.
2. **Implementar → Administrar implementaciones →** lápiz → en Versión elegí **Nueva versión** → **Implementar**.

No crees una implementación nueva, porque cambiaría la URL y tendrías que actualizar `config.js` y el atajo.

## Problemas comunes

| Qué pasa | Qué hacer |
|---|---|
| La app dice "Falta un paso" | La URL de `config.js` está mal. Tiene que ser la `/exec` de Implementar. |
| "No se pudo conectar" | Revisá la URL y que el acceso de la implementación sea "Cualquier usuario". Si recién cambiaste algo, recargá con Ctrl+Shift+R, puede ser la versión vieja guardada. |
| "La clave no es correcta" | No se ejecutó `configurar`, o la clave es distinta a la que pusiste en el script. |
| Veo la versión vieja de la app | Cerrala y abrila de nuevo. En la PC, Ctrl+Shift+R. |
| Tu página de GitHub Pages no aparece | En el fork, pestaña **Actions**, habilitá los workflows si lo pide, y hacé cualquier commit. |
| El atajo dice "Clave incorrecta" o "El monto tiene que ser mayor a cero" | Revisá los campos del JSON, que las variables estén insertadas y no escritas. |

## Para quien use Claude Code

El archivo `CLAUDE.md` tiene el contexto técnico del proyecto para Claude Code. Las secciones "Sobre el usuario" y "Estado" son de la instalación original, cambialas por las tuyas.
