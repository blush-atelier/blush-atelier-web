# Decisiones y punto de retoma

## Qué queda funcionando

Primer ciclo frontend: catálogo real → detalle/cantidad → contacto y entrega → cotización de API → reserva PENDING → consulta y recuperación. No hay cobros, formulario de tarjeta, SDK de Wompi, webhook ni simulador de pago aprobado. Los estados APPROVED/DECLINED/ERROR solo se muestran si llegan de API; sus pruebas de UI usan mocks, no prueban pagos.

Rama local: `feature/checkout-ui`. Los cambios se agrupan en commits locales para revisión; el push queda a cargo de Ana. No se modificó infraestructura AWS ni código backend durante este ciclo. Los comandos del README fuerzan desarrollo y SSL deshabilitado solo para PostgreSQL Docker local; no cambian `.env` ni la configuración AWS. La API/BD local se reiniciaron para probar la integración; no se borraron datos ni volúmenes.

## Qué se instaló y para qué

| Herramienta                             | Uso                                                           |
| --------------------------------------- | ------------------------------------------------------------- |
| React + TypeScript + Vite               | SPA, contratos tipados y servidor/build local.                |
| Redux Toolkit + React Redux             | Estado de catálogo, pasos y referencias seguras del checkout. |
| React Router                            | `/`, `/producto/:id`, `/pedido`; navegación sin recargar.     |
| Jest + ts-jest + jsdom                  | Pruebas TypeScript y simulación del DOM; no se usa Vitest.    |
| Testing Library + user-event + jest-dom | Probar lo que el usuario ve, escribe y pulsa.                 |
| ESLint + typescript-eslint + Prettier   | Revisar código y mantener formato consistente.                |

No hay framework CSS, librería de formularios, cliente de pagos ni credenciales frontend. Playwright se utilizó temporalmente fuera del repositorio para revisar Chrome instalado; no es dependencia de la app.

## Archivos y flujo

- `domain/contracts.ts`: puertos `CheckoutApi`, `ProgressPort`, `RuntimePort`, contratos y `Result`. No conoce React, Redux, HTTP ni almacenamiento.
- `domain/presentation.ts`: formato exacto de importes, búsqueda/categorías y validación del formulario. La validación del navegador ayuda al usuario; no reemplaza al backend.
- `application/operations.ts`: consulta productos; prepara cliente/entrega/cotización; reserva; recupera. Cada operación revisa `result.ok` y devuelve una salida controlada. Las reglas monetarias, la sesión y el stock siguen en el backend.
- `application/state.ts` y `store.ts`: reducer y creación del store con dependencias inyectadas. Los thunks reciben puertos, no importan adaptadores. Redux guarda únicamente catálogo, importes públicos, referencias, estado y códigos de error conocidos.
- `infrastructure/http-api.ts`: implementa el puerto con fetch, timeout de 15 segundos, cookies, validación de respuestas y proyección de campos permitidos. No conserva cuerpos de error arbitrarios. Envía `X-Checkout-Request: 1` y `Idempotency-Key` donde corresponde.
- `infrastructure/progress.ts`: guarda solo un esquema cerrado de referencias en localStorage; descarta snapshots corruptos o con campos desconocidos. Las claves se generan con Web Crypto, sin Math.random. Si el navegador bloquea almacenamiento, se avisa y se debe conservar la pestaña abierta.
- `presentation`: páginas pequeñas para catálogo, detalle y pedido; componentes reutilizables para imagen, resumen, errores y modal. Los formularios mantienen contacto/dirección solo en memoria y los limpian al cerrar.
- `main.tsx`: conecta puertos concretos, Redux, Router y React. Es el punto de composición.
- `vite.config.ts`: proxy local `/api` a puerto 3000; permite usar cookie del backend desde el mismo origen del navegador.
- `.github/workflows/ci.yml`: controles de calidad; no despliega ni accede a AWS.

## Dinero, stock y reintentos

`8990000` centavos se presenta como `$ 89.900 COP`. La API envía strings; `BigInt` divide por 100 y conserva fracción sin pasar por Number. Nunca se suman tarifas en componentes: el resumen muestra el desglose recibido del backend.

Antes del POST de reserva se guardan clave de idempotencia, producto, cantidad, entrega y total esperado. Si se pierde la respuesta, se repite **la misma** clave y payload. El backend decide si crear o devolver la transacción existente. Un error incierto no permite editar la solicitud ni abrir otra selección. El frontend bloquea doble clic; la garantía de concurrencia e inventario pertenece a PostgreSQL/backend.

El resumen por sí solo no reserva. Confirmar crea PENDING y reserva durante 15 minutos. Al volver al catálogo y al consultar pedido se actualiza disponibilidad. La liberación de reservas vencidas del backend actual se ejecuta al cotizar, reservar o consultar una transacción; no hay tarea programada todavía.

## Datos personales y pago

Contacto/dirección se envían por HTTP local únicamente para desarrollo, con cookies `credentials: include`; en AWS debe usarse HTTPS. No se ponen en Redux, acciones, localStorage, URL ni logs. Se usan thunks explícitos para evitar que `createAsyncThunk` incluya el formulario en `meta.arg`. Redux DevTools está desactivado. La cookie de sesión HttpOnly la administra el navegador: JavaScript no obtiene su valor. HttpOnly reduce exposición a scripts, pero no reemplaza HTTPS, controles de origen ni prevención de XSS.

Esta UI **no recibe PAN/CVV**, no tiene inputs de tarjeta ni transmite esos datos. No existe todavía tokenización: no afirmar que el pago ya es seguro/completo. El siguiente ciclo debe confirmar la documentación actual de Wompi Sandbox y priorizar captura alojada/tokenizada por el proveedor; nuestro backend recibirá solo referencias/token permitidos. Ninguna clave privada, secreto de integridad/eventos o secreto AWS puede ir en `VITE_*`. El estado final debe verificarse en backend con proveedor y webhook autenticado/idempotente; un redirect no prueba un pago.

Para AWS hay que validar CORS con origen exacto y credenciales, cookies Secure/SameSite, HTTPS y comportamiento del navegador entre dominios. Preferir origen compartido/proxy `/api` o dominios del mismo sitio para evitar depender de cookies de terceros. No está verificado en AWS todavía.

## Diseño y accesibilidad

Inspiración: `docs/design-reference.png`. Paleta beige/rosa/cocoa, tipografía editorial del sistema, CSS Grid/Flexbox, navegación compacta móvil y escritorio. Breakpoints 600/900 px; también se comprueban anchos intermedios. Modal nativo con foco, Escape y bloqueo mientras se envía; etiquetas, errores vinculados al campo, estados de carga y reduced-motion. Imágenes con srcset, tamaños explícitos y lazy loading fuera del hero; falla remota → foto local → alternativa accesible.

## Evidencia local

- Jest: 82 pruebas / 7 suites; cubre validación, dinero grande, HTTP, almacenamiento, estados y componentes, reintento, stock insuficiente, sesión vencida y refresh. El reporte final medido está en README.
- Chrome: Tab no permite enfocar controles de la página detrás del modal; se verificaron foco inicial, primer campo inválido, Escape y restauración del foco al botón de apertura.
- Chrome automatizado: catálogo, detalle, formulario, resumen y pedido revisados a 320, 375, 768, 1024, 1440 y 1920 px. Sin desbordamiento horizontal ni errores JS en la corrida final. Es emulación de viewport, no certificación de todos los dispositivos/navegadores.
- Integración contra Nest/PostgreSQL local: cliente y entrega ficticios, cotización real, PENDING real, pérdida de respuesta POST después de que el backend la procesó, refresh y recuperación de la misma transacción/clave. El stock bajó una sola unidad; cookie HttpOnly y progreso sin datos de contacto comprobados.
- Se crearon dos reservas ficticias durante las corridas de integración, sin pagos. Pueden afectar temporalmente al stock hasta vencer y ejecutarse la liberación del backend. No se ejecutaron DELETE/TRUNCATE ni se eliminó el volumen.
- `npm ci` reprodujo la instalación: 514 paquetes. Auditoría total: 7 avisos bajos y 10 moderados; `npm audit --omit=dev` encontró 0 vulnerabilidades de producción; revisar las dependencias de herramientas antes de entrega, sin aplicar actualizaciones incompatibles a ciegas.
- CI se validó mediante los mismos comandos localmente; falta un run remoto en GitHub. AWS, Firefox, Safari y dispositivos físicos no se han validado.

## Para retomar mañana

1. Revisar visualmente el flujo siguiendo README; revisar los commits locales y decidir el push antes de abrir PR.
2. Completar la siguiente rebanada: contrato de pago + integración Wompi Sandbox verificada en documentación oficial, adaptador backend, seguridad e idempotencia. Después habilitar la captura de tarjeta mediante el flujo elegido del proveedor.
3. Añadir verificación de resultado y webhook; probar aprobado, rechazado, error, duplicados, timeout y stock sin inconsistencias. Medir de nuevo Jest en ambos repositorios.
4. Con la infraestructura que está preparando Ana, conectar URL pública, TLS/CORS/cookies y fallback de rutas SPA. Validar refresh y checkout Sandbox extremo a extremo antes de marcar entrega.
5. Promover mediante PR development → staging → production, CI obligatorio y OIDC restringido cuando se habilite CD. No crear tres infraestructuras completas sin revisar costos.

Preguntas de entrevista: ¿por qué Result para errores esperados? ¿Cómo impides reservar dos veces tras un timeout? ¿Por qué el stock y total los decide el servidor? ¿Qué persiste tras F5 y qué no? ¿Por qué no guardas formulario en Redux? ¿Qué hace HttpOnly y qué no protege? ¿Qué falta para confiar en un pago aprobado?

## Imágenes generadas

Modo: herramienta integrada de generación de imágenes (imagegen); ilustraciones originales de productos ficticios, sin marcas externas. No son fotografías del inventario real. Los PNG originales permanecen en la biblioteca local de Codex; se exportaron JPEG optimizados (calidad 85) a `public/images/`: `atelier-720.jpg` (43.376 B), `atelier-1440.jpg` (150.438 B), `rose-720.jpg` (71.261 B), `rose-1440.jpg` (249.413 B), `cocoa-720.jpg` (50.696 B), `cocoa-1440.jpg` (170.134 B). Solo estas variantes usadas por la UI se incluyen en el repositorio.

Prompts de generación: se añaden debajo como procedencia de los tres recursos.

1. Use case: product-mockup. Asset type: original editorial product photography for Blush Atelier, a premium cosmetics storefront. Generate one landscape photograph, 1536x1024 composition, of two elegant unbranded cosmetic products together: on the left, an open circular warm rose-gold compact containing dusty rose blush powder, its matching matte beige lid leaning nearby; on the right, an uncapped cocoa rose lipstick in a slim ivory and brushed rose-gold tube, with its cap standing beside it. They sit on a warm blush-beige plaster display plinth against a pale rose studio wall. Subtle powder pigment texture on the surface, beautiful natural morning side light, realistic delicate long shadows, tactile materials, luxury restrained art direction, no harsh gradients. The two products are separated clearly so the left and right sides can also be cropped for individual catalog cards. Generous breathing room, no hands, no people, no flowers, no other products, no third-party branding, no text, no letters, no watermarks. Photorealistic, sophisticated, calm, suitable for responsive web imagery.

2. Use case: product-mockup. Create a square individual product photograph for the Blush Atelier catalog, matching the supplied reference photograph's materials, premium quiet editorial art direction and morning side lighting. Show ONLY the reference's open dusty rose powder blush compact, round brushed rose-gold rim, with its matte warm ivory lid leaning beside it. Remove the lipstick and its cap completely. Warm pale blush plaster pedestal and background, subtle natural shadows, tactile realistic powder. Compact centered with generous space on every side, entire product and lid visible, suitable for both a square catalog crop and a portrait detail crop. Photorealistic. No text, no logos, no brand marks, no people, no watermark.

3. Use case: product-mockup. Create a square individual product photograph for the Blush Atelier catalog, matching the supplied reference photograph's materials, premium quiet editorial art direction and morning side lighting. Show ONLY the reference's uncapped cocoa rose lipstick, its slim ivory lower tube and brushed rose-gold upper tube, and the matte ivory cap standing beside it. Remove the blush compact and powder completely. Warm pale beige plaster pedestal and background, subtle natural shadows, tactile realistic cosmetic texture. Lipstick centered with generous space on every side, entire lipstick and cap visible, suitable for both a square catalog crop and a portrait detail crop. Photorealistic. No text, no logos, no brand marks, no people, no watermark.

## Mejora visual y catálogo real — 13/11/2026

Se mantuvo la identidad editorial beige/rosa, mejorando botones y enlaces: tipografía sans explícita, alturas táctiles de al menos 44 px, bordes y radios consistentes y estados hover/active/focus. Las tarjetas muestran “Ver producto”; el menú identifica la sección actual y el detalle vuelve a Colección con una flecha de regreso. Se añadió filtro por marca combinable con categoría, texto y precio. No se añadieron dependencias de animación ni paquetes de UI.

CSS está separado en `styles/`: foundation (tokens/reset/controles), shell, catalogue, product, feedback, checkout, order, checkout-responsive y motion. `styles.css` solo define el orden de capas e importa módulos. Las capas y tokens evitan remiendos con overrides repetidos. Grid cambia de 2 columnas en móvil a 3 en tablet y 4 desde 1200 px.

`useReveal` observa tarjetas con IntersectionObserver, las revela una vez al entrar en pantalla y desconecta el observer al cambiar filtros/desmontar. Sin soporte el contenido queda visible. La preferencia de movimiento reducido desactiva animaciones y desplazamiento suave. También hay transiciones de botones, zoom de imágenes en dispositivos con hover, entrada del hero y apertura del modal. Pregunta de entrevista: ¿por qué usar CSS/IntersectionObserver? Porque bastan para estas interacciones y evitan otra dependencia; el fallback nunca oculta el catálogo.

`brandOf` interpreta la convención SKU del seed (`LIP-MAC-*`, `LIP-TOOFACED-*`, `BLUSH-BLOOMSHELL-*`, `*-ATENEA-*`); es metadato de presentación, no una decisión de precios. Los SKU anteriores se identifican como Atelier. `product-imagery.ts` asocia esos SKU a recursos optimizados. API sigue suministrando nombres, precios y stock. No fue necesario cambiar el contrato ni el ERD.

Las fotos reales provienen de las fichas de producto referenciadas en las notas del backend: [Blush-Bar MAC](https://www.blush-bar.com/labial-macximal-silky-matte-lipstick/p), [Blush-Bar Too Faced](https://www.blush-bar.com/brillo-de-labios-lip-injection-lip-gloss/p), [Atenea](https://ateneaprofesional.com/products/click-lipstick-sublime), [Bloomshell](https://tienda.bloomshell.co/product/bloom-touch-love/) y [CocoPink](https://cocopinkstore.com/products/bloom-blushy-bloomshell) para la variante Sol de Tarde. La ficha de Bloomshell mostraba una foto rotulada Susurro; se usó la foto de variante Sol de Tarde de CocoPink para evitar confundir tonos. Se conservaron en `public/images/catalog/` JPEG de 480/960 px, con srcset, lazy loading y fallback local → foto original remota → alternativa accesible. Las fotos y marcas son de sus titulares; la app es una demostración sin afiliación. El hero anterior continúa siendo una imagen ilustrativa generada y no representa un producto de esas marcas.

Verificado en Chrome mediante viewports 320, 375, 430, 600, 768, 900, 1024, 1440 y 1920 px: catálogo, detalle, formulario, resumen y pedido sin overflow, errores JS o imágenes fallidas. Se comprobaron filtros, entrada al hacer scroll, movimiento reducido, Tab/Escape y reserva PENDING real de MAC, descuento de disponibilidad de una unidad y recuperación tras F5. Esa reserva de prueba vence mediante la política normal de 15 minutos; no hubo pagos. No se certifican otros navegadores/dispositivos físicos.

Los cambios se agrupan en commits locales; AWS no se modificó. El próximo ciclo sigue siendo integrar Wompi Sandbox y verificar despliegue, HTTPS, CORS y cookies con las URLs públicas. Este cambio deja 70 pruebas Jest, 6 suites y los resultados medidos actualizados en README.

## Nuevas categorías, paginación y detalles — 13/11/2026

El catálogo pasa a 22 productos: 20 con referencia real y 2 ficticios heredados. Se añadieron 3 bases, 3 correctores, 3 sombras y 3 accesorios, sin cambiar esquema ni precios/stock de productos existentes. Las categorías de presentación se interpretan por prefijo SKU: BASE, CONCEALER, EYE, ACC, BLUSH y LIP. No son reglas de compra ni de stock.

`paginateProducts` es una función pura: recibe productos ya filtrados/ordenados, limita páginas inválidas y devuelve ocho filas con rango y total. El adaptador HTTP actual consulta el listado completo: para 22 productos resulta suficiente. Si el catálogo crece, mover filtrado/orden/paginación al backend mediante un contrato explícito, sin paginar primero y filtrar después.

`CataloguePage` usa React Router useSearchParams para `q`, `category`, `brand`, `sort` y `page`. Cambiar filtro/orden reinicia página; buscar reemplaza la entrada de historial para no añadir un paso por tecla. Se corrigen páginas fuera de rango después de cargar datos. La navegación de producto pasa la búsqueda del catálogo en el estado de Router; el breadcrumb reconstruye solo la ruta interna de colección con parámetros, sin aceptar una URL externa. Así F5 y volver desde detalle conservan la navegación; no se guardan contacto ni datos de pago en estas URLs.

`Pagination` muestra rango, página actual, botones numerados y anterior/siguiente con límites deshabilitados, etiquetas accesibles y foco/desplazamiento al encabezado de colección. La ventana de números se acota a cinco para soportar más páginas. `CategoryDiscovery` presenta cuatro accesos con fotografías reales y copys breves; elegir uno limpia marca/búsqueda anteriores. En móvil las tarjetas tienen scroll horizontal contenido y las categorías del catálogo se distribuyen en filas para que ninguna quede escondida. Se añadieron chips para retirar cada filtro y “Limpiar filtros”, además de orden por mayor precio con BigInt.

CSS nuevo: discovery.css y pagination.css; conserva tokens, focos visibles, controles de 44 px y movimiento reducido. No se añadieron dependencias. Las fotos nuevas usan el mismo pipeline JPEG 480/960 px; las 40 variantes del catálogo real ocupan aproximadamente 1,4 MB en total y cada página renderiza solo ocho tarjetas.

Fuentes nuevas: catálogo público de [Blush-Bar](https://www.blush-bar.com/maquillaje/maquillaje-para-cara/correctores) para MAC/Too Faced y [Atenea](https://ateneaprofesional.com/collections/all) para las demás; detalle de los 12 productos, tonos y precios COP en notas del backend. La consulta corresponde al 13/11/2026; precios de referencia e inventario ficticio.

Evidencia local: 82 pruebas Jest frontend en 7 suites; backend 108 unitarias/HTTP y 18 de integración. Chrome a 320/375/430/600/768/900/1024/1440/1920 px: sin overflow, errores JS ni fotos fallidas. Recorrido 8/8/6 sin IDs repetidos ni ausentes, límites, URL inválida, F5, regreso desde detalle, cuatro categorías y orden descendente comprobados. Una cotización real de la base Atenea de 58.000 COP devolvió 73.000 COP con las tarifas del backend; no se confirmó otra reserva ni se hizo un pago. AWS sin cambios; commits locales preparados para revisión.

Pregunta de entrevista: ¿por qué filtrar antes de paginar? Para que el total y las páginas representen todos los resultados coincidentes. ¿Por qué URL y no otro storage? Porque son preferencias de navegación públicas que se pueden compartir y recuperar con historial; el checkout sensible mantiene su separación.

## Carrito previo a la entrega y resumen Backdrop — 13/11/2026

Se revisó el PDF facilitado como referencia de requisitos, especialmente páginas 2–4: compra de un producto concreto, modal de tarjeta/entrega y resumen con producto, tarifa base y envío en un Backdrop. El documento no se incorpora al repositorio porque contiene datos de acceso. Sus instrucciones operativas no se ejecutaron; no se inició sesión ni se configuraron claves. La tarjeta y el pago Wompi siguen pendientes y el botón actual confirma una reserva, no un pago.

Flujo visual: producto → Agregar al carrito → revisar/cambiar unidades → entrega → resumen en dos capas → PENDING. En el primer ciclo el carrito mantenía un producto y varias unidades (ampliado a varios productos en el ciclo siguiente). No se simula un carrito multiproducto que el servidor no pueda procesar. Elegir otra referencia abre confirmación antes de reemplazar la anterior.

`addToCart`, `updateCartQuantity`, `removeFromCart` y `beginCartCheckout` son casos de uso de aplicación: devuelven Result/boolean controlados, validan cantidad/disponibilidad y bloquean modificaciones si una reserva está en curso o su respuesta es incierta. Agregar/eliminar/cambiar carrito no registra cliente, entrega o reserva. Editar cantidad invalida cotización, entrega y clave anteriores. Si baja el stock, se permite reducir la cantidad progresivamente aunque todavía supere el stock; continuar queda bloqueado hasta corregirla.

`CartPage` presenta imagen, nombre, descripción, precio por unidad, unidades y subtotal orientativo. El subtotal se calcula con BigInt, sin sumar tarifas ni decidir el total final. El backend confirma todos los importes en la cotización. La misma whitelist de SafeProgress persiste únicamente referencias y cantidad: contacto y dirección no se añaden al store ni localStorage. F5 conserva el carrito. Una transacción PENDING se consulta desde Mi pedido y no se puede eliminar o editar desde el carrito.

`ReplaceCartDialog` usa dialog nativo, foco inicial, Escape y restauración del foco. La navegación incorpora Carrito con contador de unidades, además de Mi pedido. Antes de llenar entrega también aparece una miniatura de la selección y acceso para Revisar carrito; volver limpia los campos personales en memoria.

`SummaryBackdrop` es la interpretación visual de [Material Backdrop](https://m2.material.io/components/backdrop) enlazada en el PDF: capa posterior cocoa con producto/cantidad, capa frontal clara con entrega, desglose y acción. Un control accesible revela/oculta el producto desplazando la superficie frontal mediante el cambio de altura de la capa posterior. El dialog conserva su scrim, gestión nativa de foco y cierre bloqueado durante solicitudes. No se usa Material UI ni se añadieron dependencias de la app. El requisito de botón de pago quedará completo al conectar Wompi; no se marca como terminado por este cambio visual.

CSS: cart.css y summary-backdrop.css, tokens existentes, controles táctiles, Grid y reduced-motion. Se retiraron los estilos de la anterior cuadrícula de resumen que ya no se usa.

Verificación local: 91 pruebas Jest, 8 suites; métricas en README. Chrome en 320/375/430/600/768/900/1024/1440/1920 px: carrito vacío/con contenido, subtotal, formulario, backdrop desplegado/plegado sin overflow; confirmación/reemplazo, eliminar, F5, privacidad y bloqueo de cambios comprobados. Una prueba real agregó 2 unidades del labial Atenea: agregar no alteró disponibilidad; confirmar creó una reserva PENDING de exactamente 2 unidades, sin pagos. La reserva temporal sigue la política normal de vencimiento. Backend y AWS no se modificaron.

Preguntas: ¿por qué un carrito local no reserva stock? Para no bloquear unidades por explorar. ¿Qué ocurre con una respuesta incierta? Se conserva la identidad de la solicitud y se consulta/reintenta, sin modificarla. ¿Por qué subtotal y cotización son distintos? El primero orienta usando catálogo; la cotización del servidor añade tarifas y verifica precio/stock. ¿Por qué un producto? Es el flujo del PDF y el contrato implementado; múltiples líneas requerirían ampliar el modelo y la reserva atómica de todos los productos.

## Carrito e-commerce, Montserrat y móvil

El carrito conserva un array de referencias/cantidades. Agregar el mismo producto
acumula unidades; otro producto agrega una línea. Cambiar o quitar una línea invalida
la cotización previa. prepareCheckout/reserveCheckout envían el conjunto al backend,
que calcula importes y reserva todo o nada. El resumen/Backdrop y el pedido muestran
cada producto. No se simulan varios pedidos desde el frontend.

Se mantiene el formato seguro anterior añadiendo items solo cuando hay varias líneas;
las compras anteriores siguen rehidratándose. No cambian las claves ni el payload de
una solicitud incierta tras F5. Contacto, dirección y tarjetas no se persisten.

Montserrat variable Latin (37.956 bytes) se sirve desde public/fonts con font-display
swap y preload; fuente Google Fonts, licencia OFL incluida. No se añadieron librerías.
Los contadores se animan al cambiar y las filas entran suavemente. En móvil hay
respuesta al toque y animación de navegación/modal; reducir movimiento desactiva todo.

Verificado en Chrome emulado a 320/375/430/600/768/900/1024/1440/1920 px: catálogo,
detalle, carrito múltiple, entrega, Backdrop y pedido sin desbordamiento horizontal.
Reserva real local de dos productos (1 y 2 unidades), una transacción, F5 y sin datos
personales en localStorage. Esto no prueba todos los navegadores ni el pago Sandbox.

## Revisión responsive y accesible con skills

Se aplicaron Impeccable, Design Taste Frontend y Emil Design Engineering sobre la
identidad existente: Montserrat, beige/blush/cocoa y fotografías del catálogo. No se
cambiaron Redux, contratos HTTP, dinero, reglas de stock ni el flujo de reserva.

Se compactaron hero/cabecera, formularios y controles; los filtros muestran etiquetas
y su opción completa. El detalle usa dos columnas desde tablet; el resumen conserva
los importes legibles y el formulario agrupa las miniaturas en escritorio. Los
botones responden al toque sin rebotes repetitivos. Se retiró el observer de aparición
en scroll y sus tres tests obsoletos: el catálogo siempre está visible. Se añadió un
test de regresión para el scroll del modal al pasar entrega → resumen → entrega.

| Tamaño CSS  | Catálogo/detalle/carrito | Entrega/validación/Backdrop | Reserva PENDING y F5 |
| ----------- | ------------------------ | --------------------------- | -------------------- |
| 320 × 568   | Verificado               | Verificado                  | Verificado           |
| 375 × 667   | Verificado               | Verificado                  | Verificado           |
| 390 × 844   | Verificado               | Verificado                  | Verificado           |
| 430 × 932   | Verificado               | Verificado                  | Verificado           |
| 768 × 1024  | Verificado               | Verificado                  | Verificado           |
| 1024 × 768  | Verificado               | Verificado                  | Verificado           |
| 1280 × 800  | Verificado               | Verificado                  | Verificado           |
| 1440 × 900  | Verificado               | Verificado                  | Verificado           |
| 1920 × 1080 | Verificado               | Verificado                  | Verificado           |

Evidencia: build de Vite servido localmente; Chrome de Windows mediante CDP desde WSL,
viewports emulados, capturas y mediciones DOM. API simulada con datos del seed y los
contratos actuales; no se realizaron reservas reales ni pagos. Se probaron tap
sintético, filtros, validación, cierre con Escape, navegación por Tab y recuperación.
En los nueve tamaños no se detectó overflow horizontal, modales fuera del viewport,
controles de menos de 44 px de alto ni opciones seleccionadas recortadas. Scroll
vertical e imágenes lazy son intencionales; una captura de viewport no muestra todo
el formulario de una vez.

APPROVED, DECLINED, ERROR y EXPIRED se comprobaron con respuestas simuladas a 320×568,
390×844 y 1440×900. No son evidencia de integración Wompi. El pago con tarjeta sigue
pendiente: no se añadieron campos PAN/CVV a una UI sin tokenización.

Axe (WCAG 2 A/AA y 2.1 AA): cero infracciones detectadas en catálogo, detalle, entrega,
resumen y reserva a 320 y 1440 px. No sustituye revisión con lector de pantalla.
No se probaron Safari, Firefox, dispositivos físicos ni teclado virtual de iOS/Android.

Design Taste devolvió `GATE: ERROR`: sus scripts no encontraron Chrome/Edge/Chromium
Linux y no pudieron comprobar copy/consistency/layout. No se reejecutó ni se declaró
PASS. Se usó Chrome de Windows para las comprobaciones independientes anteriores.
No se importó su plantilla de landing ni una paleta aleatoria: prevalecen el e-commerce
existente, la referencia y el alcance indicado por la usuaria.

Calidad local: npm run format:check, lint, typecheck, test:cov y build. Jest: 92 pruebas,
7 suites; 97,81% sentencias, 96,32% ramas, 98,00% funciones, 97,73% líneas. Todas >80%.
No hay dependencias nuevas de la aplicación; Playwright Core/axe se instalaron solo
como herramientas temporales fuera del repositorio.

## Rediseño correctivo: boutique digital

El brief correctivo reemplaza la composición anterior: hero con foto primero en móvil,
Bodoni Moda para títulos/marca y Montserrat para lectura. El catálogo prioriza imágenes,
precios y acciones; a 320 px usa una columna para no comprimir nombres. No se cambiaron
Redux, contratos, ROP, dinero, stock ni recuperación del checkout.

AtelierSelect usa únicamente @radix-ui/react-select: mantiene foco, teclado, typeahead,
semántica y selección; sus estilos son propios. El menú se porta al body para evitar
recortes del grid y usa posicionamiento popper con detección de colisiones. El margen
inferior contempla la barra móvil; el ancho parte del trigger y la altura se limita al
espacio disponible. Una lista con más opciones se desplaza internamente. Estado error
vinculado por aria-describedby; deshabilitado conserva semántica. Los selects ocultos
que genera Radix son auxiliares, no muestran el menú nativo.

La galería muestra una tarjeta completa por pantalla móvil, dos en tablet y cuatro en
escritorio; scroll-snap, flechas de 44 px y límites deshabilitados indican navegación.
La barra inferior usa iconos coherentes, indicador activo y contador real del carrito.
El checkout reutiliza etiquetas, radios y colores del sistema; conserva el Backdrop.

CSS: controles/select.css; galería/discovery.css; navegación/shell.css; catálogo/catalogue.css.
Se movieron reglas de pedido a order.css, miniaturas al checkout y tokens/etiquetas a
foundation.css. Se quitaron reglas obsoletas y overrides de review-amounts, transiciones
duplicadas y todos los !important. Movimiento solo bajo no-preference; foco visible y
estado de selección no dependen de animación.

Radix: [documentación oficial](https://www.radix-ui.com/primitives/docs/components/select).
Bodoni Moda: [fuente y licencia OFL](https://github.com/google/fonts/tree/main/ofl/bodonimoda).
Se añadió únicamente Radix Select, no un kit UI. El componente aplica inert a los elementos fuera del portal mientras está abierto y restaura solo los atributos que cambió; el fondo no recibe foco ni queda bloqueado al cerrar. npm audit --omit=dev:
0 vulnerabilidades reportadas en esta ejecución; las incidencias de desarrollo no se
resolvieron con actualizaciones forzadas fuera de alcance.

PRODUCT.md registra hechos y DESIGN.md conserva las correcciones explícitas de la usuaria
conforme a learn-taste; no se añadieron preferencias inferidas ni una plantilla de landing.
Jest conserva el ciclo completo y añade teclado/ratón/Escape/foco/error/disabled del select
y navegación de galería. Evidencia final y límites de navegador en el checklist.

En móvil, el checkout inicia con un resumen desplegable de productos y acceso a Revisar carrito; los datos de entrega aparecen antes, sin repetir varias fichas completas sobre el formulario.

Verificación correctiva final: nueve viewports del brief, 120 estados con API simulada,
menú abierto/tap/teclado, galería, detalle, carrito múltiple, entrega/validación,
Backdrop, PENDING/F5 y estados finales simulados. Sin errores de página ni overflow.
Axe (WCAG 2 A/AA y 2.1 AA): cero infracciones detectadas en seis pantallas a 320/1440,
incluido el menú abierto. No prueba lectores de pantalla ni hardware físico.
El CTA de entrega permanece visible; se comprobaron primer y último input sin quedar
bajo el footer en los nueve tamaños. Safari/Firefox y teclado virtual siguen sin verificar.
Capturas WebP en visual-review/ (antes/después y las siete vistas mínimas solicitadas).
Jest: 97 pruebas, 9 suites; 97,92% sentencias, 96,40% ramas, 98,10% funciones y 97,83% líneas.

## Retomar selección y preparación visual para pago

El banner recupera su estilo responsive propio tras el rediseño: una columna móvil,
dos columnas cuando hay espacio y enlace táctil de 44 px. Sin transacción abre el carrito
completo; con transacción o solicitud incierta abre /pedido para consultar/reintentar
la misma identidad. No se crea otra compra al navegar.

Continuar con el pago reemplaza Confirmar reserva. Sigue invocando el mismo caso de uso
y POST PENDING; la nota visible aclara que Wompi aún no está conectado y no hay cobros.
No cambia contratos, idempotencia, persistencia ni la autoridad del backend.

Verificado: banner y enlace al carrito en los nueve tamaños del brief con Chrome emulado; CTA → una sola solicitud PENDING con API simulada. Las dos pruebas de navegación nuevas elevan Jest a 99 casos, sin cambios de contratos.

## Cierre de la iteración visual — 13/11/2026

Los cambios funcionales, estilos, fuentes locales con licencia, capturas y pruebas del
rediseño están guardados en `06d9af4`; la corrección responsive del banner y el CTA
Continuar con el pago están en `9f2b3d5`. Se conserva ese historial sin duplicarlo.

Verificación de cierre repetida: `npm run lint`, `npm run typecheck`, `npm run build`
y `npm run test:cov`, todos correctos. Jest: 99 pruebas en 9 suites; cobertura de
sentencias 97,92%, ramas 96,40%, funciones 98,10% y líneas 97,83%.
Además, `npm test -- --runTestsByPath test/select.spec.tsx`: 4 pruebas correctas de
AtelierSelect (selección/indicador, teclado/typeahead/Escape, foco, disabled/error y
bloqueo/restauración del fondo). No se agregaron dependencias ni se cambió el código.

Este cierre no repite la inspección visual en navegador; conserva sus capturas y
límites documentados. Pendientes: Safari/Firefox, dispositivos físicos, lector de
pantalla y teclado virtual; captura/pago Wompi Sandbox y estados reales; validación
AWS, HTTPS y URLs públicas. Las pruebas visuales anteriores usaron API simulada.
No se incluyen instalaciones de skills, `.codex/` ni `skills-lock.json` en el commit.
No se realiza push, merge ni despliegue.

## Header de escritorio de borde a borde

El header sticky heredaba el ancho máximo de 1240 px del contenido, dejando sus
laterales sin fondo al desplazarse. Desde 1000 px ocupa el 100% del ancho disponible;
el padding fluido mantiene los enlaces alineados con el catálogo. No cambia el header móvil.

Verificado con Chrome y API simulada en catálogo, detalle, carrito y pedido a
320, 375, 768, 1024, 1280, 1440 y 1920 px: sin overflow horizontal; el header de
escritorio cubre todo el ancho y permanece arriba al hacer scroll. Inspección de la
captura de catálogo a 1440 px. Formato, lint, typecheck, build y 99 pruebas Jest
correctos; cobertura sin cambios. No acredita pagos ni despliegue.

## Entrega dependiente y vista lateral del carrito — 13/11/2026

El footer del formulario deja de ser sticky: el fondo y el borde de dialog-actions
se superponían a los datos durante el scroll. Ahora es parte del flujo del formulario.

Departamento precede Ciudad / municipio. Los datos se incluyen localmente desde
[DIVIPOLA DANE](https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w),
consultado el 13/11/2026 (corte declarado por la fuente: 30/12/2024): 32 departamentos
y Bogotá D.C., 1122 localidades, incluidos registros de áreas no municipalizadas/isla.
Se guarda solo departamento y nombre de localidad, no coordenadas. Bogotá D.C. se
presenta como destino separado, sin convertirlo en departamento de Cundinamarca.
El JSON es una instantánea, no una promesa de actualización automática o de cobertura
logística. Para actualizarlo, descargar todos los registros del recurso gdxc-w37w,
agrupar dpto/nom_mpio y revisar las diferencias. No se consulta un servicio externo
al comprar. Cambiar departamento limpia la ciudad; sin departamento Ciudad está deshabilitada.
Los mismos strings region/city llegan a la API, sin cambiar su contrato.
AtelierSelect coloca el portal dentro del dialog cuando corresponde: un z-index alto
por sí solo no permite que un menú del body supere la capa de un modal nativo.

Agregar al carrito conserva la ruta y abre CartDrawer. Es estado de presentación
local de React; productos y cantidades siguen en Redux, y agregar no reserva stock.
El panel muestra todas las líneas y un subtotal orientativo, nunca reemplaza la
cotización de servidor. Cierre mediante X, Escape, clic fuera o Seguir comprando;
no hay temporizador que interrumpa la lectura. Revisar carrito es navegación explícita.
El diálogo nativo contiene foco y bloquea interacción de fondo; el cierre restaura
scroll/foco. Si falta información de un producto recuperado, no se inventa su importe.
Animación lateral y pulso del icono solo con no-preference; móvil usa ancho completo.

Jest añade dependencia de ciudades/cambio de departamento y abrir/acumular/cerrar el
panel sin navegación. El test integral de compra dispone de 10 s por sus múltiples
pasos reales de UI; no se retiraron aserciones ni se cambiaron umbrales de cobertura.
101 pruebas correctas; sentencias 98,04%, ramas 95,73%, funciones 98,25%, líneas 97,94%.
Lint, typecheck y build correctos. Wompi no se implementa en esta revisión.

Verificación del último ajuste: Chrome de Windows con API simulada en los nueve
viewports del brief, animaciones activas. Abrir panel sin cambiar ruta, Escape,
carrito/entrega, departamento y ciudades dependientes; menús dentro de límites del
modal/viewport y sin overflow. Inspección de capturas de panel a 320/1440 y formulario
a 320 px. No acredita proveedor ni navegadores distintos. Movimiento reducido
comprobado previamente a 320/375/1440, y excluido de las nuevas animaciones por CSS.
