# Validación de v0.1

## Ejecutado

- `npm test`: **12 pruebas aprobadas**. Dinero en céntimos, asignaciones, efectivo como traspaso, devoluciones, movimientos sin clasificar, desgloses, referencias, cuotas finitas, fechas y reimportación CSV.
- API sobre PostgreSQL WASM (PGlite): registro, cookies, sesión, aislamiento de dos usuarios, lectura con propietario manipulado, escritura concurrente rechazada, origen no autorizado, logout, borrado de usuario y recuperación de contraseña de un solo uso.
- `npm run build`: compilación del frontend Vue y del servidor TypeScript completada.

## Preparado, pendiente de ejecutar con navegador disponible

- Playwright en escritorio y móvil: registro, cuenta, partidas, reserva, gasto, objetivo, traspaso a efectivo, importación CSV, simulación descartada, persistencia tras recarga y ancho de pantalla sin desbordamiento.
- Se intentó instalar Chromium, pero la descarga devolvió un archivo inválido. La ejecución local de Playwright no pudo iniciar el navegador; no constituye una prueba funcional fallida de la aplicación. No se ha inspeccionado visualmente la interfaz renderizada en este entorno.
- CI incluye instalación de Chromium y ambas pruebas; sus resultados deben comprobarse en GitHub Actions.

## No verificado aquí

- Arranque real mediante Docker Compose y PostgreSQL 17 externo: Docker no está disponible en el entorno de desarrollo.
- Entrega SMTP real, proxy HTTPS, certificados y recuperación de backups de una instalación.
- Carga alta, pentest, auditoría completa de accesibilidad y operación de un servicio público.

El frontend compilado no demuestra por sí solo corrección visual. La v0.1 se entrega con estos límites explícitos.
