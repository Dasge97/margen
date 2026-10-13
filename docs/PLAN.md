# Plan de producto y continuidad

## Propósito

Aplicación generalista de finanzas personales para empezar desde el presente. Usuario con ingresos regulares o irregulares, sin conocimientos contables. El valor principal es distinguir qué dinero está comprometido, qué está reservado para objetivos y qué se puede gastar.

No incorporar al repositorio datos ni decisiones financieras personales del fundador. Los ejemplos deben ser ficticios. Cualquier persona crea sus propias cuentas, partidas y objetivos.

## Entregado en v0.1

1. Identidad, sesiones y recuperación opcional con SMTP.
2. Cuentas, efectivo, movimientos desglosados, devoluciones y traspasos.
3. Importación CSV revisable y exportación/restauración del plan.
4. Mapa visual, reservas acumuladas y categorías editables.
5. Compromisos periódicos y finitos. Vinculación con movimientos existentes.
6. Objetivos y simulación de presupuestos con aportaciones constantes.
7. Pruebas de dominio, aislamiento de usuarios y flujo de navegador; Docker y documentación.

## Criterios de aceptación esenciales

- Dos usuarios no ven ni modifican los datos del otro.
- Ningún traspaso aumenta o reduce el patrimonio total.
- Reservar no gasta dinero; una previsión no crea saldo.
- Los desgloses cuadran en céntimos y las importaciones repetidas se detectan.
- Una cuota finita se desactiva al completar el último pago.
- La misma operación importada y prevista puede vincularse sin duplicación.
- Los cambios de otro dispositivo no se sobrescriben silenciosamente.
- La interfaz funciona con teclado y en móvil; no depende exclusivamente de arrastrar.

## Siguiente iteración

- Reconciliación guiada del saldo con el banco y edición segura del saldo inicial.
- Reglas de clasificación por comercio, edición masiva y emparejado de traspasos.
- Historial de asignaciones editable y ayuda para cubrir partidas negativas.
- Editar compromisos directamente; recordatorios sin registrar gastos automáticamente.
- Previsión de caja por fecha, ingresos variables y escenarios con fin de cuotas.
- Objetivos con fecha: aportación necesaria, alerta de inviabilidad y competencia entre objetivos.
- Mejorar mapa para muchas partidas, zoom y deshacer.

## Antes de ofrecerlo como servicio público

- Verificación de email, protección anti-abuso del registro y límites distribuidos.
- Pruebas de carga, auditoría de seguridad y revisión de accesibilidad.
- PostgreSQL externo con copias automáticas, simulacro de recuperación y migraciones versionadas.
- Métricas, alertas y política de retención. Documentación de privacidad y condiciones acorde al operador y jurisdicción.
- Cambio de contraseña desde Ajustes, cierre de todas las sesiones y tratamiento de solicitudes de datos.

## Evolución posterior

- Integración bancaria a través de proveedor autorizado, validando coste y cobertura. El CSV seguirá disponible.
- IA opcional para sugerir categorías y explicar escenarios. Los cálculos serán deterministas y la aplicación pedirá confirmación antes de modificar el plan.
- Presupuestos compartidos y roles familiares, sin mezclar cuentas privadas por defecto.
- Internacionalización y monedas por plan. No mezclar importes de monedas distintas sin un modelo explícito de conversión.

No hay que implementar todo lo anterior para empezar a utilizar v0.1 en una instalación personal. El estado y las limitaciones se explican en README.
