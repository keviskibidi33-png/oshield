package discovery

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// SystemMap represents the structural architecture scan of the client VM.
type SystemMap struct {
	Hostname   string            `json:"hostname"`
	OS         string            `json:"os"`
	Platform   string            `json:"platform"`
	CPUCount   int               `json:"cpu_count"`
	Services   map[string]string `json:"services"` // service name -> status (active, inactive, not_found)
	Timestamp  time.Time         `json:"timestamp"`
}

// Services to scan
var monitoredServices = []string{
	"nginx",
	"postgresql",
	"docker",
	"mysql",
	"redis",
	"apache2",
	"mongodb",
}

// ScanSystem executes a full system discovery scan.
func ScanSystem(ctx context.Context) *SystemMap {
	sysMap := &SystemMap{
		OS:        runtime.GOOS,
		Platform:  runtime.GOARCH,
		CPUCount:  runtime.NumCPU(),
		Services:  make(map[string]string),
		Timestamp: time.Now(),
	}

	hostname, err := os.Hostname()
	if err == nil {
		sysMap.Hostname = hostname
	} else {
		sysMap.Hostname = "unknown"
	}

	// Scan services based on the OS
	for _, svc := range monitoredServices {
		if runtime.GOOS == "windows" {
			sysMap.Services[svc] = checkServiceWindows(ctx, svc)
		} else {
			sysMap.Services[svc] = checkServiceLinux(ctx, svc)
		}
	}

	return sysMap
}

func checkServiceWindows(ctx context.Context, svc string) string {
	// Map common linux names to windows names if needed
	winSvc := svc
	switch svc {
	case "postgresql":
		winSvc = "postgresql-x64-" // partial matching or common service name
	case "redis":
		winSvc = "redis"
	case "mysql":
		winSvc = "mysql"
	case "nginx":
		winSvc = "nginx"
	case "docker":
		winSvc = "docker"
	}

	// Try running: sc query state= all
	// To keep it simple, fast, and secure, we run tasklist or sc query winSvc
	cmdCtx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "sc", "query", winSvc)
	output, err := cmd.Output()
	if err != nil {
		// If service query fails, check if the process is running instead
		return checkProcessWindows(ctx, svc)
	}

	outStr := strings.ToLower(string(output))
	if strings.Contains(outStr, "running") {
		return "active"
	} else if strings.Contains(outStr, "stopped") || strings.Contains(outStr, "paused") {
		return "inactive"
	}

	return "not_found"
}

func checkProcessWindows(ctx context.Context, svc string) string {
	cmdCtx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()

	cmd := exec.CommandContext(cmdCtx, "tasklist")
	output, err := cmd.Output()
	if err != nil {
		return "not_found"
	}

	outStr := strings.ToLower(string(output))
	procName := svc + ".exe"
	if strings.Contains(outStr, procName) || strings.Contains(outStr, svc) {
		return "active"
	}

	return "not_found"
}

func checkServiceLinux(ctx context.Context, svc string) string {
	cmdCtx, cancel := context.WithTimeout(ctx, 1*time.Second)
	defer cancel()

	// 1. Try systemctl is-active
	cmd := exec.CommandContext(cmdCtx, "systemctl", "is-active", svc)
	output, err := cmd.Output()
	if err == nil {
		status := strings.TrimSpace(string(output))
		if status == "active" {
			return "active"
		}
		if status == "inactive" || status == "failed" {
			return "inactive"
		}
	}

	// 2. Try service status
	cmd2 := exec.CommandContext(cmdCtx, "service", svc, "status")
	output2, err2 := cmd2.CombinedOutput()
	if err2 == nil {
		outStr := strings.ToLower(string(output2))
		if strings.Contains(outStr, "running") || strings.Contains(outStr, "is active") {
			return "active"
		}
		return "inactive"
	}

	// 3. Fallback check by reading /proc/ atau pgrep
	cmd3 := exec.CommandContext(cmdCtx, "pgrep", "-x", svc)
	if err3 := cmd3.Run(); err3 == nil {
		return "active"
	}

	return "not_found"
}