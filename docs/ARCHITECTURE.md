# Arquitectura e invariantes

## Dominio

`shared/model.ts` es la fuente de verdad de validación, dinero y calendarios. El frontend y la API usan el mismo contrato Zod; el servidor lo valida de nuevo. Todos los valores monetarios son enteros en céntimos. EUR es la única moneda de la v0.1.

- **Cuenta**: saldo inicial, tipo banco/efectivo y fecha. Nunca se acepta un movimiento anterior al inicio de la cuenta.
- **Movimiento**: importe positivo, tipo ingreso/gasto/traspaso, cuenta, fecha, concepto y desglose opcional. Un desglose debe sumar exactamente el importe.
- **Traspaso**: una sola operación con cuenta origen y destino distintas. No tiene partida. La retirada en cajero es un traspaso a efectivo.
- **Partida**: propósito del dinero. Color, ilustración, posición, previsión mensual y objetivo opcional.
- **Asignación**: reserva o liberación de dinero. No altera ninguna cuenta.
- **Compromiso**: pago previsto con fecha, frecuencia y cuotas restantes. No altera saldos hasta registrarlo. Su clave de vencimiento previene duplicarlo.

Identidades:

```
saldo_cuenta = saldo_inicial + ingresos - gastos + traspasos_entrantes - traspasos_salientes
disponible_partida = asignaciones + devoluciones_asignadas - gastos_asignados
sin_asignar = suma_saldos - suma_disponibles_partidas
```

Un gasto sin clasificar reduce el dinero sin asignar. Clasificarlo después traslada su impacto a la partida, sin cambiar el saldo. Una nómina normalmente entra sin partida; una devolución puede reponer la partida original. Se permiten saldos negativos para representar la realidad y se muestran como déficit, sin ocultarlos con ceros.

Ejemplo genérico de compensación: entregas 100 € en efectivo y te transfieren 70 € al banco por una factura compartida de 30 €. Registra un traspaso efectivo→banco de 70 € y un gasto de efectivo de 30 €. No registres los 70 € como salario ni gastes dos veces los 100 €. Si la entrada ya se importó, conviértela en ese traspaso.

El saldo inicial es anterior a TODOS los movimientos incluidos, también a los de la misma fecha. Quien empieza hoy con el saldo actual no debe importar después gastos ya incorporados a ese saldo.

## Persistencia y aislamiento

PostgreSQL guarda `users`, `sessions`, `password_resets` y `budgets`. Cada usuario tiene un documento JSONB validado. El documento entero se actualiza atómicamente con `WHERE user_id = session.user_id AND version = expected_version`. Un conflicto devuelve 409 y mantiene la copia remota intacta.

Se eligió JSONB para entregar un núcleo pequeño con exportación y restauración completas. Límites: 30 cuentas, 30 partidas, 20.000 movimientos, 20.000 asignaciones y 200 compromisos. El cuerpo HTTP tiene un máximo de 8 MB. Para grandes volúmenes, migrar movimientos a tablas indexadas y operaciones específicas sin cambiar las reglas del dominio.

No hay parámetros para consultar presupuestos de otro usuario. Las claves de importación se comparan solo dentro del plan propio. Borrar el usuario elimina por cascada sus registros.

## Acceso

- Contraseñas de 12–128 caracteres con scrypt asíncrono y sal aleatoria.
- Sesiones opacas aleatorias. La base guarda su SHA-256, no la cookie.
- Cookie HttpOnly, SameSite=Strict, Secure en producción. Caduca a los siete días.
- Las mutaciones exigen Origin exacto a APP_ORIGIN y JSON. Sin CORS abierto.
- Helmet y CSP. Sin scripts ni fuentes remotos.
- Límite de intentos de autenticación por IP en memoria. Para varios procesos, sustituir por almacén distribuido.
- Restablecimiento: token aleatorio, hash, caducidad de 30 minutos, un solo uso y revocación de sesiones. Respuesta genérica para correo existente o inexistente.
- No se registran contraseñas, tokens, conceptos bancarios ni cuerpos de petición.

El control de aislamiento está en la aplicación y se verifica mediante pruebas SQL. No se ha configurado PostgreSQL RLS; el rol de la base es de confianza del servidor.

## CSV

PapaParse se ejecuta en el cliente con cabeceras y delimitador detectado. Se aceptan ISO y fechas día/mes/año, importes con coma o punto decimal y hasta dos decimales. No hay OCR ni detección semántica de comercios. La huella SHA-256 usa cuenta, fecha, concepto normalizado, importe e índice de ocurrencia.

Importar el mismo fichero de nuevo es idempotente. Dos compras iguales dentro de un fichero se conservan. Con extractos parcialmente solapados de compras idénticas no existe identificador bancario inequívoco: se requiere revisión. No se unen traspasos automáticamente. El usuario debe convertir las dos caras importadas en una sola operación de traspaso y eliminar la redundante.

## Planificación

La previsión mensual es un plan completo, incluidos los recibos. Los compromisos son el calendario de pagos y no se suman otra vez al plan. Las simulaciones alteran solo los importes previstos en memoria; aplicar una simulación no reserva dinero ni crea movimientos.

Para un objetivo: meses estimados = techo((objetivo − reserva actual) / aportación mensual). Si no hay aportación, no hay fecha estimada. Las cuotas terminadas quedan inactivas; redirigir el importe liberado al ahorro requiere decisión del usuario. No se prometen rendimientos ni se estiman impuestos de vivienda.
