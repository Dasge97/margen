# Validación de v0.1

## Ejecutado

- `npm test`: **12 pruebas aprobadas**. Dinero en céntimos, asignaciones, efectivo como traspaso, devoluciones, movimientos sin clasificar, desgloses, referencias, cuotas finitas, fechas y reimportación CSV.
- API sobre PostgreSQL WASM (PGlite): registro, cookies, sesión, aislamiento de dos usuarios, lectura con propietario manipulado, escritura concurrente rechazada, origen no autorizado, logout, borrado de usuario y recuperación de contraseña de un solo uso.
- `npm run build`: compilación del frontend Vue y del servidor TypeScript completada.

## Navegador y revisión visual

- **2 recorridos Playwright aprobados**, Chromium en escritorio y emulación móvil: registro, cuenta, partidas, reserva, gasto, objetivo, traspaso a efectivo, importación CSV, simulación descartada, persistencia tras recarga y ancho de pantalla sin desbordamiento.
- GitHub Actions aprobó las 12 pruebas de dominio/API, la compilación y ambos recorridos de navegador sobre el commit `77d96e9f9a0371bf50f069bc2d662ed61327b49c`.
- [Ejecución comprobada](https://github.com/Dasge97/margen/actions/runs/38418511822).
- Capturas del mapa revisadas en escritorio y móvil: composición, legibilidad, tarjetas, panel de partida y navegación. CI conserva capturas como artefactos.
- La descarga local de Chromium falló; las pruebas de navegador se ejecutaron correctamente en GitHub Actions.

## No verificado aquí

- Arranque real mediante Docker Compose y PostgreSQL 17 externo: Docker no está disponible en el entorno de desarrollo.
- Entrega SMTP real, proxy HTTPS, certificados y recuperación de backups de una instalación.
- Carga alta, pentest, auditoría completa de accesibilidad y operación de un servicio público.

La v0.1 se entrega con estos límites explícitos.
