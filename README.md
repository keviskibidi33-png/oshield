# 🛡️ OzyShield | Monitoreo Inteligente de Infraestructura con IA

**OzyShield** es un sistema de monitoreo autónomo de infraestructura y seguridad de tipo SaaS B2B, diseñado para equipos de desarrollo e infraestructura modernos.

Permite monitorear servidores locales en tiempo real, filtrar de forma confidencial (Zero-Knowledge) todos los datos sensibles y analizarlos centralmente mediante heurísticas avanzadas e Inteligencia Artificial (IA) para diagnosticar errores y proveer guías de remediación instantáneas.

---

## 📂 Estructura del Repositorio

El proyecto se divide de la siguiente manera:

*   **`/agent`**: Agente ligero escrito en Go. Se instala en los servidores de los clientes para monitorear logs, realizar auto-descubrimiento y sanitizar la telemetría antes de enviarla.
*   **`/server`**: API REST en Go 1.22+. Ingiere telemetría, realiza el almacenamiento en caché criptográfico (SHA-256) de diagnósticos, genera reportes de incidentes y coordina el flujo.
*   **`/landing`**: Landing page corporativa construida en **Next.js** (exportada de forma estática para distribución óptima).
*   **`/system`**: Panel de control del cliente (Dashboard) construido en **React** (Vite + Tailwind CSS). Permite ver servidores activos, alertas e interactuar con simuladores de caídas.

---

## 🚀 Cómo poner en marcha el sistema

### Paso 1: Levantar el Servidor API Central

Puedes compilar y ejecutar el servidor en tu máquina local:

```bash
cd server
go run cmd/ozyserver/main.go
```

El servidor API se levantará en `http://localhost:8080`.

*(Opcional: Si deseas que el motor realice diagnósticos reales mediante IA, exporta tu llave antes de iniciar: `export OPENAI_API_KEY="tu-api-key"`).*

### Paso 2: Levantar la Interfaz Web (Landing & Dashboard)

Puedes servir la Landing Page y el Dashboard usando un servidor de archivos estáticos:

```bash
# En la raíz del repositorio
npx http-server -p 8000
```

*   **Landing Page**: `http://localhost:8000/landing/index.html`
*   **Dashboard**: `http://localhost:8000/system/index.html`

### Paso 3: Instalar y Ejecutar el Agente en un Cliente

Una vez que el servidor está corriendo en el puerto `8080`, puedes instalar el agente en cualquier VM con un solo comando:

```bash
curl -sSL "http://localhost:8080/v1/install.sh?token=demo-token-123" | sudo bash
```

Esto instalará el binario, creará el servicio y comenzará a monitorear los archivos `/var/log/syslog` y `/var/log/nginx/error.log` del sistema.

Para pruebas de desarrollo local, también puedes ejecutar el agente directamente:

```bash
cd agent
go run cmd/ozyagent/main.go -token "demo-token-123" -server "http://localhost:8080" -paths "/var/log/syslog"
```

---

## 🔒 Seguridad (Zero-Knowledge)

La privacidad de los datos es el corazón de OzyShield. El agente filtra y redacta de manera local en memoria, utilizando regex optimizadas y el **algoritmo de Luhn** (para tarjetas de crédito), los siguientes datos sensibles antes de enviarlos a la nube:
*   Correos electrónicos (`[REDACTED_EMAIL]`)
*   Tarjetas de crédito válidas (`[REDACTED_CARD]`)
*   Credenciales y contraseñas de configuración (`[REDACTED_SECRET]`)
*   Credenciales integradas en URIs de bases de datos (`[REDACTED_USER]:[REDACTED_PASSWORD]`)
*   Tokens de Autorización Bearer (`Bearer [REDACTED_TOKEN]`)