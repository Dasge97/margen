# Instalación y operación

## Docker local

Sigue README. APP_ORIGIN debe coincidir exactamente con la dirección desde la que abres la web: esquema, host y puerto, sin barra final. Para Docker local usa `http://localhost:3000`. No expongas el modo HTTP local directamente a Internet.

La contraseña POSTGRES_PASSWORD se interpola en una URL: utiliza un valor largo aleatorio URL-safe. Si la cambias después de crear el volumen, PostgreSQL no modifica automáticamente el usuario ya existente.

## Desarrollo sin Docker para la app

Puedes usar una base propia o iniciar solo PostgreSQL:

```sh
docker run --name margen-dev-db -e POSTGRES_USER=margen -e POSTGRES_DB=margen -e POSTGRES_PASSWORD=development-only-password -p 127.0.0.1:5432:5432 -v margen_dev_data:/var/lib/postgresql/data -d postgres:17-alpine
```

Configura DATABASE_URL en `.env` con esa contraseña, instala `npm ci` y ejecuta `npm run dev`. Solo para desarrollo local.

## Servidor con HTTPS

1. Instala Docker y configura un proxy HTTPS (Plesk, Caddy, nginx, etc.).
2. Mantén la app ligada a 127.0.0.1:3000 como en compose.yaml.
3. Configura `APP_ORIGIN=https://tu-dominio`, `NODE_ENV=production`.
4. Si existe exactamente un proxy de confianza delante, usa `TRUST_PROXY=1`; configura ese proxy para sobrescribir X-Forwarded-For. No lo habilites con la app accesible directamente desde clientes.
5. El proxy debe enviar Host, X-Forwarded-Proto y la IP real. Mantén límites de cuerpo compatibles con 8 MB.
6. Arranca con `docker compose up -d --build` y revisa `docker compose logs app`.

Ejemplo de Caddy en el host:

```caddyfile
tu-dominio.example {
  reverse_proxy 127.0.0.1:3000
}
```

La API comprueba APP_ORIGIN en cada mutación y usa cookies Secure en producción. No se requiere CORS al servir frontend y API juntos.

## Correo

Configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y MAIL_FROM. Para TLS directo en 465, SMTP_SECURE=true; para STARTTLS en 587, false. Sin SMTP no aparece el enlace de recuperación y la API informa de la falta de configuración. Nunca se imprime el enlace secreto en logs.

No se ha enviado correo real durante las pruebas. Verifica entrega, SPF/DKIM y remitente en tu instalación antes de ofrecer registro público.

## Copias

La exportación JSON de Ajustes contiene el plan de un usuario, no su contraseña. Para respaldar toda la instancia usa PostgreSQL:

```sh
mkdir -p backups
docker compose exec -T db pg_dump -U margen -d margen -Fc > backups/margen.dump
```

Guarda una copia cifrada fuera del servidor. No subas backups a Git.

Restaurar reemplaza registros de la instancia destino. Hazlo primero en un entorno de prueba y detén la app mientras restauras:

```sh
docker compose stop app
docker compose exec -T db pg_restore -U margen -d margen --clean --if-exists < backups/margen.dump
docker compose start app
```

En PowerShell utiliza una herramienta que preserve salida binaria o ejecuta los comandos desde WSL/Bash. No se ha ejecutado un simulacro de backup/restauración Docker en el entorno de desarrollo de este repositorio.

## Actualizaciones

Haz copia, trae el nuevo commit y ejecuta `docker compose up -d --build`. v0.1 crea las tablas si faltan; futuras alteraciones requieren migraciones versionadas, no editar el esquema en producción a mano.
