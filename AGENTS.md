# Trabajar en Margen

- Lee README y docs/ARCHITECTURE.md antes de modificar lógica financiera.
- Conserva TypeScript estricto y céntimos enteros. No uses coma flotante para almacenar dinero.
- Nunca añadas extractos, nombres de terceros, IBAN, números de tarjeta, credenciales ni backups reales al repositorio.
- El usuario proviene siempre de la sesión del servidor. Prueba aislamiento ante cambios de datos o rutas.
- Reservas, movimientos y previsiones son conceptos diferentes. No dupliques traspasos ni pagos importados.
- Mantén un flujo útil en móvil y con teclado; respeta docs/DESIGN.md.
- Ejecuta npm test y npm run build. Si cambia la interfaz, ejecuta las pruebas de navegador y revisa capturas.
- Actualiza docs/VALIDATION.md con resultados reales y límites; no declares pruebas no ejecutadas.
- No despliegues infraestructura ni configures proveedores bancarios o IA sin una petición explícita.
