FROM alpine:latest

# Install ca-certificates for SSL support
RUN apk add --no-cache ca-certificates curl unzip

# Create a non-root user
RUN adduser -D -s /bin/sh pocketbase

# Set the working directory
WORKDIR /app

# Download and install PocketBase
RUN curl -L -o pocketbase.zip "https://github.com/pocketbase/pocketbase/releases/latest/download/pocketbase_linux_amd64.zip" \
    && unzip pocketbase.zip \
    && rm pocketbase.zip \
    && chmod +x pocketbase

# Create data directory and copy hooks
RUN mkdir -p /app/pb_data && chown -R pocketbase:pocketbase /app

# Copy the JavaScript hooks file
COPY main.js /app/main.js

# Switch to non-root user
USER pocketbase

# Expose the port PocketBase runs on
EXPOSE 8090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8090/api/health || exit 1

# Run PocketBase with hooks
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/app/pb_data", "--hooksDir=/app"]
