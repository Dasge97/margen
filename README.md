# Margen

**Organiza tu dinero. Haz sitio a tus planes.**

Margen es una aplicación web de finanzas personales centrada en un mapa visual de partidas. Separa dinero real, reservas y previsiones para que puedas empezar hoy, sin reconstruir toda tu vida financiera.

## Primera versión

- Registro e inicio de sesión. Datos independientes por usuario y sesiones revocables.
- Recuperación de contraseña por correo cuando el administrador configura SMTP.
- Cuentas bancarias y efectivo con saldo inicial y fecha de comienzo.
- Ingresos, gastos, devoluciones y traspasos entre cuentas. Desglose por partidas.
- Mapa con ilustraciones propias, categorías personalizables y posición arrastrable en escritorio. Tarjetas accesibles en móvil.
- Reservas acumuladas, liberación de dinero y avisos de partidas sobregastadas.
- Objetivos de ahorro y simulación del reparto mensual sin modificar saldos reales.
- Pagos mensuales, anuales, puntuales y cuotas finitas. Registro manual del vencimiento o vinculación con un gasto existente.
- CSV con mapeo de columnas, previsualización, validación y detección de reimportaciones.
- Copia JSON, restauración validada y eliminación de cuenta.

No se incluyen datos bancarios personales ni cuentas precargadas. Las ilustraciones son SVG incluidos en el código; no dependen de servicios de imágenes ni fuentes externas.

## Arrancar con Docker (Windows, macOS o Linux)

Requisitos: Git y Docker con Compose (Docker Desktop en Windows).

```sh
git clone https://github.com/Dasge97/margen.git
cd margen
cp .env.example .env
```

En PowerShell, usa `Copy-Item .env.example .env` en lugar de `cp` si lo prefieres.

Edita `.env`:

```dotenv
POSTGRES_PASSWORD=una-clave-larga-aleatoria-sin-caracteres-reservados-URL
APP_ORIGIN=http://localhost:3000
NODE_ENV=development
```

```sh
docker compose up -d --build
```

Abre **http://localhost:3000** y crea tu usuario. El esquema se inicializa al arrancar. El puerto de PostgreSQL no se publica y sus datos permanecen en un volumen. `docker compose down` conserva los datos; añadir `-v` los elimina.

`development` permite cookies sobre HTTP local. Para exponerlo por Internet utiliza HTTPS, `NODE_ENV=production`, `APP_ORIGIN=https://tu-dominio` y un proxy inverso. Consulta [instalación](docs/INSTALL.md).

## Empezar a utilizarlo

1. Crea una cuenta e introduce el saldo que tienes hoy. Si vas a importar historial, utiliza el saldo **anterior** al primer movimiento importado y una fecha compatible.
2. Crea partidas vacías con el asistente o define las tuyas.
3. Asigna tu saldo entre obligaciones, vida diaria, imprevistos y objetivos. Reservar no mueve dinero entre bancos.
4. Registra movimientos o importa el CSV. Clasifica ingresos generales, devoluciones y traspasos correctamente.
5. Añade próximos pagos en Compromisos. No se descuentan hasta registrar o vincular el pago.
6. En Mi futuro, define tu ingreso esperado y presupuestos. Las simulaciones son independientes del saldo real.

Formato de ejemplo: [movimientos ficticios](examples/movimientos-demo.csv). Los gastos llevan signo negativo y los ingresos positivo. No incluye credenciales ni datos reales.

## Desarrollo

Node.js >=22.12, npm y PostgreSQL 17.

```sh
npm ci
cp .env.example .env
# Configura DATABASE_URL y APP_ORIGIN=http://localhost:5173
npm run dev
```

El frontend se sirve en 5173 y redirige `/api` a 3000. `npm run dev` lee `.env` para el servidor. Para una base local expuesta solo durante desarrollo puedes ejecutar PostgreSQL aparte con Docker; consulta INSTALL.md.

```sh
npm test             # Dominio y API con SQL PostgreSQL mediante PGlite
npm run check       # TypeScript en cliente y servidor
npm run build       # Frontend y servidor
npm run test:e2e     # Navegador (instala antes Chromium de Playwright)
```

## Arquitectura

Vue 3 + TypeScript + Vite, Node.js + Express, PostgreSQL y Docker Compose. Los importes se guardan en céntimos enteros. El servidor elige el usuario a partir de la sesión; nunca acepta un propietario enviado por el cliente. Guardado con versión para evitar sobrescribir cambios de otra pestaña.

Documentación:

- [Producto, alcance y próximos pasos](docs/PLAN.md)
- [Arquitectura e invariantes financieros](docs/ARCHITECTURE.md)
- [Instalación, correo y copias](docs/INSTALL.md)
- [Diseño y comportamiento](docs/DESIGN.md)
- [Pruebas y limitaciones](docs/VALIDATION.md)

## Límites de esta versión

Es una primera versión funcional, no un servicio bancario. No conecta bancos, mueve dinero, ofrece asesoramiento ni incorpora IA. Moneda EUR, un plan por usuario. Las importaciones parcialmente solapadas con compras idénticas requieren revisión humana. Los presupuestos mensuales incluyen los compromisos, no se suman automáticamente. Las fechas objetivo son orientativas y la previsión asume aportaciones constantes, sin intereses ni retiradas. La edición de un compromiso se hace desactivándolo y creando el reemplazo.

Antes de operar como servicio público conviene completar el endurecimiento y la operación descritos en PLAN.md: correo verificado, límites distribuidos, monitorización, copias y restauración comprobadas, auditoría externa y textos de privacidad adecuados al despliegue.
