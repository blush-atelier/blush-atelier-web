# Dirección visual — Blush Atelier

Brief vinculante de la usuaria: «boutique digital de belleza contemporánea»; primera superficie: controles, galería de categorías y catálogo móvil. No es una landing ni un dashboard.

## Composición

Productos protagonistas, fondos marfil/nude y divisores discretos. Hero fotográfico y tipográfico; categorías con fotos proporcionadas, títulos legibles y navegación explícita. En móvil el carrusel es intencional y sus tarjetas se leen completas; tablet/escritorio usan una galería adaptativa. No añadir tarjetas decorativas ni afirmar calidad por ausencia de overflow.

## Componentes

Selects propios de la aplicación con AtelierSelect (Radix headless), portal, opciones estilizadas, check de selección y foco visible. No depender del menú nativo: la usuaria lo rechazó por inconsistencia visual. Inputs, selects y botones comparten tokens, borde y estados. Los futuros campos alojados del proveedor de pagos seguirán su integración oficial. Disabled/error no dependen únicamente del color.

## Tipografía y color

Montserrat para lectura/controles; Bodoni Moda local para títulos editoriales y marca. Marfil, blanco cálido, rosa empolvado, nude y espresso; sin gradientes decorativos ni sombras exageradas. Tokens en foundation.css; estilos por responsabilidad.

## Interacción

Navegación inferior integrada en móvil, safe areas y espacio inferior reservado. Animaciones breves y con función; reducir movimiento. Teclado, retorno de foco, opciones largas, límites del viewport y menús abiertos forman parte de la revisión.

## CSS y evidencia

CSS nativo con Grid/Flex; no overrides repetidos, reglas obsoletas ni !important para corregir layouts. Antes de dar por terminado: mirar catálogo 320/375/768/1440, selector abierto 375, checkout 320/escritorio y recorrer los nueve tamaños del brief. Las pruebas verdes no acreditan calidad visual. Separar estados simulados de integración real con API/Wompi.

<!-- 2026-11-13: reglas extraídas del brief correctivo explícito; no se añaden preferencias inferidas. -->
