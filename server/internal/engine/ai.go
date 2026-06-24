package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

func AnalyzeLog(logLine string, service string, mistralAPIKey string, mistralModel string) CachedDiagnosis {
	if mistralAPIKey != "" {
		diag, err := callMistral(mistralAPIKey, mistralModel, logLine, service)
		if err == nil {
			return diag
		}
		log.Printf("[AI] Mistral fallback to heuristics: %v", err)
	}

	return analyzeHeuristic(logLine, service)
}

func callMistral(apiKey string, model string, logLine string, service string) (CachedDiagnosis, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if model == "" {
		model = "mistral-small-latest"
	}

	type message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	type request struct {
		Model          string    `json:"model"`
		Messages       []message `json:"messages"`
		ResponseFormat *struct {
			Type string `json:"type"`
		} `json:"response_format,omitempty"`
		Temperature float64 `json:"temperature"`
		MaxTokens   int     `json:"max_tokens"`
	}

	prompt := `Eres un experto SRE y arquitecto de sistemas de nivel Staff. Analiza el siguiente log de error de infraestructura y proporciona un diagnóstico profesional y los pasos de solución.
Debes responder estrictamente en formato JSON con la siguiente estructura:
{
  "title": "Título corto y descriptivo del incidente (máximo 60 caracteres, en inglés)",
  "cause": "Breve explicación en español de la causa raíz (2-3 oraciones máximo)",
  "steps": [
    "Paso 1: Qué hacer para verificar o solucionar",
    "Paso 2: Comando o acción correctora",
    "Paso 3: Siguiente paso de validación"
  ]
}

NO incluyas texto fuera del JSON. Solo el JSON.

Log de error:
"` + logLine + `"

Servicio relacionado: ` + service

	reqBody := request{
		Model: model,
		Messages: []message{
			{Role: "user", Content: prompt},
		},
		Temperature: 0.3,
		MaxTokens:   512,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return CachedDiagnosis{}, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.mistral.ai/v1/chat/completions", bytes.NewBuffer(jsonData))
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

	if resp.StatusCode != 200 {
		return CachedDiagnosis{}, io.ErrUnexpectedEOF
	}

	type llmResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	var llmResp llmResponse
	if err := json.Unmarshal(body, &llmResp); err != nil {
		return CachedDiagnosis{}, err
	}

	if len(llmResp.Choices) == 0 {
		return CachedDiagnosis{}, io.ErrUnexpectedEOF
	}

	content := llmResp.Choices[0].Message.Content
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var diag CachedDiagnosis
	err = json.Unmarshal([]byte(content), &diag)
	if err != nil {
		return CachedDiagnosis{}, err
	}

	return diag, nil
}

func analyzeHeuristic(logLine string, service string) CachedDiagnosis {
	normalized := strings.ToLower(logLine)

	if service == "postgresql" || strings.Contains(normalized, "postgres") || strings.Contains(normalized, "pq:") {
		if strings.Contains(normalized, "lock timeout") || strings.Contains(normalized, "deadlock") {
			return CachedDiagnosis{
				Title: "PostgreSQL Lock Timeout",
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
				Title: "PostgreSQL Connection Refused",
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
				Title: "PostgreSQL Connection Limit Exceeded",
				Cause: "Se excedió la cantidad máxima de conexiones simultáneas configuradas en PostgreSQL (max_connections).",
				Steps: []string{
					"Aumentar el límite de conexiones en postgresql.conf, o bien implementar un pooler de conexiones como PgBouncer.",
					"Verificar que las aplicaciones clientes estén cerrando correctamente sus conexiones tras finalizar consultas.",
					"Revisar conexiones inactivas usando 'SELECT count(*), state FROM pg_stat_activity GROUP BY state;'.",
				},
			}
		}
	}

	if service == "nginx" || strings.Contains(normalized, "nginx") {
		if strings.Contains(normalized, "502 bad gateway") || strings.Contains(normalized, "connect() failed") {
			return CachedDiagnosis{
				Title: "Nginx 502 Bad Gateway",
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
				Title: "Nginx Request Entity Too Large",
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
				Title: "Nginx Permission Denied",
				Cause: "Nginx no tiene permisos de lectura o ejecución sobre los archivos estáticos solicitados, o bien no puede acceder al socket upstream.",
				Steps: []string{
					"Verificar que el usuario 'www-data' o 'nginx' tenga permisos sobre la carpeta del proyecto: 'sudo chmod -R 755 /var/www'.",
					"Asegurar que las carpetas superiores del directorio tengan permisos de ejecución (+x).",
					"Si usas SELinux, habilitar la conexión de red de Nginx: 'setsebool -P httpd_can_network_connect 1'.",
				},
			}
		}
	}

	if strings.Contains(normalized, "out of memory") || strings.Contains(normalized, "oom-killer") || strings.Contains(normalized, "killed process") {
		return CachedDiagnosis{
			Title: "Out of Memory (OOM Kill)",
			Cause: "El sistema operativo agotó su memoria física (RAM) disponible y activó el proceso OOM-Killer para forzar el cierre de procesos de alto consumo.",
			Steps: []string{
				"Consultar el registro dmesg del sistema para identificar el proceso exacto sacrificado: 'dmesg -T | grep -i -E \"oom|kill\"'.",
				"Identificar fugas de memoria o procesos que consuman RAM de forma excesiva usando htop o pidstat.",
				"Configurar memoria de intercambio (Swap) en el servidor o actualizar a un plan de hardware con mayor capacidad de RAM.",
			},
		}
	}

	if service == "redis" || strings.Contains(normalized, "redis") {
		if strings.Contains(normalized, "out of memory") || strings.Contains(normalized, "maxmemory limit reached") {
			return CachedDiagnosis{
				Title: "Redis Max Memory Reached",
				Cause: "El servidor de caché Redis alcanzó el límite de memoria máximo (maxmemory) establecido en su configuración.",
				Steps: []string{
					"Verificar el consumo de memoria con el comando 'redis-cli info memory'.",
					"Ajustar la política de desalojo en redis.conf (ej. maxmemory-policy allkeys-lru) para descartar llaves viejas automáticamente.",
					"Incrementar el límite 'maxmemory' en el archivo redis.conf si el servidor físico cuenta con RAM disponible.",
				},
			}
		}
	}

	return CachedDiagnosis{
		Title: "Infrastructure Warning Detected",
		Cause: "Se ha detectado una advertencia o error en los logs de la infraestructura. La firma del evento no coincide con patrones conocidos del sistema.",
		Steps: []string{
			"Revisar el estado general de salud del servidor y del servicio relacionado.",
			"Confirmar que no se hayan introducido cambios recientes de configuración o despliegues de código.",
			"Consultar la documentación oficial de la aplicación que emitió el log para interpretar el mensaje.",
		},
	}
}
