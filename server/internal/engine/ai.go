package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

// AnalyzeLog acts as our LLM processor.
// In development/MVP mode, it uses expert heuristic rule matching to produce highly accurate structural diagnostics.
// If OPENAI_API_KEY environment variable is set, it performs a real LLM analysis.
func AnalyzeLog(logLine string, service string) CachedDiagnosis {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey != "" {
		diag, err := callOpenAI(apiKey, logLine, service)
		if err == nil {
			return diag
		}
		log.Printf("[Warning] OpenAI diagnosis failed: %v. Falling back to local heuristics.", err)
	}

	return analyzeHeuristic(logLine, service)
}

func callOpenAI(apiKey string, logLine string, service string) (CachedDiagnosis, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	url := "https://api.openai.com/v1/chat/completions"

	type message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	type request struct {
		Model          string    `json:"model"`
		Messages       []message `json:"messages"`
		ResponseFormat struct {
			Type string `json:"type"`
		} `json:"response_format"`
	}

	prompt := `Eres un experto SRE y arquitecto de sistemas. Analiza el siguiente log de error de infraestructura y proporciona un diagnóstico y los pasos de solución.
Debes responder estrictamente en formato JSON con la siguiente estructura:
{
  "cause": "Breve explicación en español de la causa raíz",
  "steps": [
    "Paso 1: Qué hacer para verificar o solucionar",
    "Paso 2: Comando o acción correctora",
    "Paso 3: Siguiente paso de validación"
  ]
}

Log de error:
"` + logLine + `"
Servicio relacionado: ` + service

	reqBody := request{
		Model: "gpt-4o-mini",
		Messages: []message{
			{Role: "user", Content: prompt},
		},
	}
	reqBody.ResponseFormat.Type = "json_object"

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return CachedDiagnosis{}, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return CachedDiagnosis{}, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return CachedDiagnosis{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return CachedDiagnosis{}, err
	}

	type openAIResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	var oaiResp openAIResponse
	if err := json.Unmarshal(body, &oaiResp); err != nil {
		return CachedDiagnosis{}, err
	}

	if len(oaiResp.Choices) == 0 {
		return CachedDiagnosis{}, io.ErrUnexpectedEOF
	}

	var diag CachedDiagnosis
	err = json.Unmarshal([]byte(oaiResp.Choices[0].Message.Content), &diag)
	if err != nil {
		return CachedDiagnosis{}, err
	}

	return diag, nil
}

func analyzeHeuristic(logLine string, service string) CachedDiagnosis {
	normalized := strings.ToLower(logLine)

	// 1. PostgreSQL Diagnostics
	if service == "postgresql" || strings.Contains(normalized, "postgres") || strings.Contains(normalized, "pq:") {
		if strings.Contains(normalized, "lock timeout") || strings.Contains(normalized, "deadlock") {
			return CachedDiagnosis{
				Cause: "Un proceso o query de base de datos ha bloqueado recursos por encima del límite de tiempo configurado, generando un interbloqueo (deadlock).",
				Steps: []string{
					"Identificar las transacciones bloqueadoras consultando pg_stat_activity y pg_locks.",
					"Terminar la consulta causante del bloqueo con: SELECT pg_cancel_backend(PID) o SELECT pg_terminate_backend(PID).",
					"Optimizar los índices de las consultas involucradas para reducir la retención de bloqueos.",
				},
			}
		}
		if strings.Contains(normalized, "connection refused") || strings.Contains(normalized, "is not responding") {
			return CachedDiagnosis{
				Cause: "La aplicación no pudo establecer conexión con PostgreSQL. El servicio podría estar detenido o rechazando tráfico.",
				Steps: []string{
					"Verificar el estado de PostgreSQL: ejecuta 'sudo systemctl status postgresql'.",
					"Comprobar el puerto 5432 y que las reglas de pg_hba.conf permitan la conexión de tu nodo.",
					"Revisar el archivo de configuración postgresql.conf para habilitar listen_addresses = '*'.",
				},
			}
		}
		if strings.Contains(normalized, "too many connections") || strings.Contains(normalized, "connection limit exceeded") {
			return CachedDiagnosis{
				Cause: "Se excedió la cantidad máxima de conexiones simultáneas configuradas en PostgreSQL (max_connections).",
				Steps: []string{
					"Aumentar el límite de conexiones en postgresql.conf, o bien implementar un pooler de conexiones como PgBouncer.",
					"Verificar que las aplicaciones clientes estén cerrando correctamente sus conexiones tras finalizar consultas.",
					"Revisar conexiones inactivas usando 'SELECT count(*), state FROM pg_stat_activity GROUP BY state;'.",
				},
			}
		}
	}

	// 2. Nginx Diagnostics
	if service == "nginx" || strings.Contains(normalized, "nginx") {
		if strings.Contains(normalized, "502 bad gateway") || strings.Contains(normalized, "connect() failed") {
			return CachedDiagnosis{
				Cause: "Nginx no pudo comunicarse con el servidor de aplicación upstream (Node.js, PHP-FPM, Python, etc.) porque este se encuentra apagado o no escucha en el socket.",
				Steps: []string{
					"Revisar el estado del servicio de backend upstream (ej. systemctl status node-app).",
					"Verificar la ruta del socket unix o la dirección IP/puerto configurada en la sección 'upstream' de Nginx.",
					"Inspeccionar los logs de error del backend upstream para determinar por qué no responde.",
				},
			}
		}
		if strings.Contains(normalized, "413 request entity too large") {
			return CachedDiagnosis{
				Cause: "El cliente intentó subir un archivo o payload que supera el límite de tamaño de petición configurado en Nginx.",
				Steps: []string{
					"Abrir el archivo de configuración nginx.conf o de tu host virtual.",
					"Agregar o modificar la directiva 'client_max_body_size' (ej. client_max_body_size 50M;) dentro del bloque http o server.",
					"Recargar Nginx sin tiempo de inactividad ejecutando 'sudo nginx -s reload'.",
				},
			}
		}
		if strings.Contains(normalized, "permission denied") {
			return CachedDiagnosis{
				Cause: "Nginx no tiene permisos de lectura o ejecución sobre los archivos estáticos solicitados, o bien no puede acceder al socket upstream.",
				Steps: []string{
					"Verificar que el usuario 'www-data' o 'nginx' tenga permisos sobre la carpeta del proyecto: 'sudo chmod -R 755 /var/www'.",
					"Asegurar que las carpetas superiores del directorio tengan permisos de ejecución (+x).",
					"Si usas SELinux, habilitar la conexión de red de Nginx: 'setsebool -P httpd_can_network_connect 1'.",
				},
			}
		}
	}

	// 3. Out of Memory (OOM) Diagnostics
	if strings.Contains(normalized, "out of memory") || strings.Contains(normalized, "oom-killer") || strings.Contains(normalized, "killed process") {
		return CachedDiagnosis{
			Cause: "El sistema operativo agotó su memoria física (RAM) disponible y activó el proceso OOM-Killer para forzar el cierre de procesos de alto consumo y evitar un pánico general.",
			Steps: []string{
				"Consultar el registro dmesg del sistema para identificar el proceso exacto sacrificado: 'dmesg -T | grep -i -E \"oom|kill\"'.",
				"Identificar fugas de memoria o procesos que consuman RAM de forma excesiva usando htop o pidstat.",
				"Configurar memoria de intercambio (Swap) en el servidor o actualizar a un plan de hardware con mayor capacidad de RAM.",
			},
		}
	}

	// 4. Redis Diagnostics
	if service == "redis" || strings.Contains(normalized, "redis") {
		if strings.Contains(normalized, "out of memory") || strings.Contains(normalized, "maxmemory limit reached") {
			return CachedDiagnosis{
				Cause: "El servidor de caché Redis alcanzó el límite de memoria máximo (maxmemory) establecido en su configuración.",
				Steps: []string{
					"Verificar el consumo de memoria con el comando 'redis-cli info memory'.",
					"Ajustar la política de desalojo en redis.conf (ej. maxmemory-policy allkeys-lru) para descartar llaves viejas automáticamente.",
					"Incrementar el límite 'maxmemory' en el archivo redis.conf si el servidor físico cuenta con RAM disponible.",
				},
			}
		}
	}

	// 5. Fallback Heuristics
	return CachedDiagnosis{
		Cause: "Se ha detectado una advertencia o error en los logs de la infraestructura. La firma del evento no coincide con patrones conocidos del sistema.",
		Steps: []string{
			"Revisar el estado general de salud del servidor y del servicio relacionado.",
			"Confirmar que no se hayan introducido cambios recientes de configuración o despliegues de código.",
			"Consultar la documentación oficial de la aplicación que emitió el log para interpretar el mensaje.",
		},
	}
}