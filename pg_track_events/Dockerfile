FROM --platform=linux/amd64 ghcr.io/tight-eng/pg_track_events/agent:latest

COPY pg_track_events.config.yaml .

# Debug: List contents of /app directory
RUN ls -la /app