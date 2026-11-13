# Acceptance checklist — tick off with evidence

Frontend local: catálogo → entrega → resumen → reserva PENDING. Evidencia y límites en [README](../README.md) y [notas](decisions-and-interview-notes.md). Los pagos y AWS siguen pendientes. Las pruebas de estados finales usan respuestas simuladas de API; no prueban Wompi.

## 1. Repository and setup

- [ ] Neutral public repository name; does not contain the company name.
- [x] Independent frontend `blush-atelier-web` and backend `blush-atelier-api`; see README.
- [x] `.gitignore` excludes `.env`, build output, node_modules, coverage, local DB files.
- [x] `.env.example` lists variable names only; no real values.
- [ ] README has setup commands that work from a clean clone.
- [ ] Meaningful commits show real progress.

## 2. Product and UI

- [x] Product name, description, price and stock are visible.
- [ ] "Pay with credit card" opens a modal.
- [ ] Card form validates required fields and format.
- [ ] Visa/Mastercard detection is present (bonus).
- [x] Delivery form validates required fields.
- [x] Summary shows product amount + base fee + delivery fee.
- [ ] Payment button is in a backdrop-style summary layer/component.
- [ ] Loading, error, decline, pending and success states are clear.
- [x] Final screen shows transaction reference/status.
- [x] Return to product page refreshes stock.
- [x] Refresh restores safe checkout progress.
- [x] No full PAN/CVV or secret appears in Redux persistence/localStorage.
- [x] Mobile layout works at iPhone SE reference size without horizontal overflow.
- [x] Tablet and desktop layouts are polished.
- [x] Images are optimized, sized, lazy-loaded where appropriate, and have fallbacks.
- [ ] Keyboard navigation, labels, focus, and contrast are acceptable.

## 3. API and business rules

- [x] Product listing/detail endpoint works.
- [x] Customer creation/registration endpoint validates data.
- [x] Delivery creation endpoint validates data.
- [x] Transaction endpoint creates PENDING transaction and returns reference.
- [ ] Payment endpoint initiates Sandbox flow.
- [ ] Transaction status endpoint returns backend-verified status.
- [ ] Webhook endpoint validates authenticity and handles duplicate events idempotently.
- [ ] Stock is reserved/updated safely; insufficient stock is rejected.
- [ ] Duplicate requests do not double-charge or double-decrement stock.
- [ ] Provider decline/failure leaves consistent transaction and stock state.
- [x] Backend calculates price, fees, delivery fee and stock; frontend values are not trusted.
- [ ] API uses correct HTTP status codes and validation errors.

## 4. Wompi Sandbox and security

- [ ] Sandbox base URL and keys are configured through environment variables.
- [ ] Private, event and integrity secrets exist only on backend.
- [ ] Public key is exposed only if the official integration requires it.
- [ ] Card collection/tokenization follows current official Wompi documentation.
- [ ] PAN/CVV are not stored, logged, or sent to our database.
- [ ] Payment success is verified server-side, not trusted from browser redirect.
- [ ] Webhook signature/integrity validation follows provider docs.
- [ ] Secrets are absent from Git history, logs, screenshots and README.
- [ ] CORS allows only expected frontend origin in production.
- [ ] HTTPS enabled for deployed app/API.
- [ ] Security headers enabled.
- [ ] Sensitive endpoints have rate limiting and input validation.
- [ ] Database user has least-privilege permissions.

## 5. Hexagonal Architecture and ROP

- [ ] Domain has no NestJS/TypeORM/Wompi/AWS imports.
- [ ] Application use cases depend on ports, not concrete adapters.
- [ ] Infrastructure adapters implement ports.
- [ ] Nest controllers only validate/translate HTTP and call use cases.
- [ ] DI tokens bind ports to adapters.
- [ ] ORM models are mapped to domain entities.
- [ ] Use cases return typed `Result<T,E>` for expected outcomes.
- [ ] Controllers map Result errors to appropriate HTTP responses.
- [ ] No broad catch-and-ignore patterns.
- [ ] README includes architecture diagram and request/data flow.

## 6. Tests

- [x] Jest configured and runs in frontend.
- [ ] Jest configured and runs in backend.
- [ ] Domain unit tests cover invariants and business policies.
- [ ] Use-case tests cover success and expected failures.
- [ ] API/controller tests cover validation and HTTP mapping.
- [x] Frontend tests cover form validation, Redux state, loading/error/success.
- [ ] Payment adapter tests mock provider; no real payment calls.
- [ ] Duplicate webhook test.
- [ ] Insufficient stock test.
- [ ] Duplicate payment/idempotency test.
- [ ] Stock concurrency/oversell test.
- [x] Refresh/resume test.
- [ ] Both apps exceed 80% coverage (actual reports saved).
- [x] README reports exact coverage and test commands.

## 7. AWS and delivery

- [ ] Frontend deployed to S3 + CloudFront and opens from public URL.
- [ ] Backend deployed to Lambda + API Gateway and responds from public URL.
- [ ] Production frontend calls deployed backend (not localhost).
- [ ] PostgreSQL cloud database reachable securely from backend.
- [ ] Database migrations/seed completed in cloud.
- [ ] No public database port or broad inbound rule.
- [ ] AWS budget alert configured; no unexpected paid resources.
- [ ] Cloud logs checked without exposing secrets/card data.
- [ ] Swagger or Postman collection public and linked in README.
- [ ] README includes AWS architecture, URLs, environment variable names, ERD, setup and test evidence.
- [ ] Full Sandbox checkout tested against deployed application.

## 8. Interview readiness

- [ ] I can explain public vs private Wompi keys.
- [ ] I can explain why secrets stay in backend environment variables.
- [ ] I can explain tokenization and why PAN/CVV are not persisted.
- [ ] I can trace frontend → API → use case → port → adapter → DB/provider.
- [ ] I can explain how PostgreSQL relations and transactions work.
- [ ] I can explain PENDING → final payment state.
- [ ] I can explain webhook verification and idempotency.
- [ ] I can explain stock reservation and prevention of overselling.
- [ ] I can explain Hexagonal Architecture and ROP with one real code example.
- [ ] I can explain deployment and public URLs in AWS.

## CI/CD extra

- [ ] GitHub Actions CI triggers on PR and pushes to development/staging/production (plus feature pushes).
- [x] CI verifies lint, TypeScript, Jest >80% coverage, and build.
- [x] GitHub Actions uses least-privilege permissions.
- [ ] AWS OIDC role is restricted to the correct repository and branch.
- [ ] AWS deployment runs only after green CI and infrastructure setup.
- [ ] No long-lived AWS access keys or payment secrets in repository/workflows.
- [ ] README explains CI/CD and links to public workflow runs.

## Promoción acordada

- [x] Workflow CI definido para development, staging, production y feature/*; falta ejecutarlo en GitHub.
- [ ] Proteger development, staging y production con revisión y CI obligatorio.
- [ ] Promover feature/* → development → staging → production mediante PR.
- [ ] Validar Sandbox y registrar evidencia en staging antes de production.
- [ ] Habilitar CD solo con AWS validado, OIDC limitado y CI aprobado.
- [ ] Validar HTTPS, CORS, cookies y refresh de rutas SPA en las URLs públicas.
- [ ] Registrar URLs y procedimiento de reversión de la versión publicada.

## Evidencia de mejora visual y catálogo

- [x] Ocho productos reales de MAC, Too Faced, Bloomshell y Atenea mediante seed local; precios COP de referencia y fuentes documentadas.
- [x] Filtrado por marca, fotografías reales optimizadas y fallback comprobado.
- [x] CSS por módulos, botones de 44 px mínimo y animaciones con movimiento reducido.
- [x] Catálogo/detalle/formulario/resumen/pedido sin overflow entre 320 y 1920 px en Chrome.
- [x] 70 pruebas Jest frontend; 108 unitarias/HTTP y 17 de integración backend en este ciclo.
- [ ] Validación en Safari, Firefox y dispositivos físicos.

## Evidencia de categorías y paginación

- [x] 22 productos; 3 bases, 3 correctores, 3 sombras y 3 accesorios nuevos con fuentes y fotos.
- [x] Paginación 8/8/6 sin duplicados, límites y normalización de URL inválida.
- [x] Filtros antes de paginar; reinicio de página y conservación al refrescar/volver del detalle.
- [x] Accesos por categoría, chips y controles accesibles sin overflow 320–1920 px en Chrome.
- [x] 82 pruebas Jest frontend; 108 unitarias/HTTP + 18 integración backend.

## Revisión de entrega

La UI cumple el flujo hasta reserva PENDING; los estados finales probados con mocks
no acreditan pagos Wompi. Faltan captura/tokenización Sandbox, inicio/verificación de
pago y webhook en backend, pruebas completas con proveedor y validación AWS/HTTPS,
CORS/cookies y rutas SPA. CI está definido; falta evidencia remota y protección de
ramas. Los commits son locales; publicar y promover se revisará aparte.
