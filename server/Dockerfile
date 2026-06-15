# ==============================================================================
# Stage 1: Build the Go application binary
# ==============================================================================
FROM golang:1.22-alpine AS builder

# Set runtime working directory
WORKDIR /build

# Copy mod files first for dependency caching
COPY go.mod ./
# If go.sum exists, copy it (ignore errors if it doesn't)
COPY go.sum* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY internal/ ./internal/

# Build static, optimized executable
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w" \
    -o ozyserver cmd/ozyserver/main.go

# ==============================================================================
# Stage 2: Final minimal execution environment
# ==============================================================================
FROM alpine:3.19

# Set system timezone and certificates for HTTPS outgoing requests (OpenAI call support)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy compiled binary from builder
COPY --from=builder /build/ozyserver /app/ozyserver

# Copy the install.sh script so the server can serve it dynamically to agents
COPY install.sh /app/install.sh

# Expose port
EXPOSE 8080

# Run the server binary
CMD ["/app/ozyserver"]