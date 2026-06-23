package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                   string
	AdminEmail             string
	AdminPassword          string
	AuthToken              string
	EnableRegister         bool
	DefaultRole            string
	JWTSecret              string
	SessionTimeoutMin      int
	SeedData               bool
	ReoccurrenceWindowMin  int
}

func Load() *Config {
	loadEnvFile()

	return &Config{
		Port:                  getEnv("OZY_PORT", "8080"),
		AdminEmail:            getEnv("OZY_ADMIN_EMAIL", ""),
		AdminPassword:         getEnv("OZY_ADMIN_PASSWORD", ""),
		AuthToken:             getEnv("OZY_AUTH_TOKEN", ""),
		EnableRegister:        getEnv("OZY_ENABLE_REGISTRATION", "true") == "true",
		DefaultRole:           getEnv("OZY_DEFAULT_ROLE", "member"),
		JWTSecret:             getEnv("OZY_JWT_SECRET", ""),
		SessionTimeoutMin:     60,
		SeedData:              getEnv("OZY_SEED_DATA", "false") == "true",
		ReoccurrenceWindowMin: getEnvInt("OZY_REOCCURRENCE_WINDOW_MIN", 1),
	}
}

func (c *Config) Validate() []string {
	var errs []string
	if c.AdminEmail == "" {
		errs = append(errs, "OZY_ADMIN_EMAIL is required")
	}
	if c.AdminPassword == "" {
		errs = append(errs, "OZY_ADMIN_PASSWORD is required")
	}
	if c.AuthToken == "" {
		errs = append(errs, "OZY_AUTH_TOKEN is required")
	}
	if c.JWTSecret == "" {
		errs = append(errs, "OZY_JWT_SECRET is required")
	}
	return errs
}

func loadEnvFile() {
	f, err := os.Open(".env")
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, "\"'")
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}
