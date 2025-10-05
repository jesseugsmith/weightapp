PocketBase Ansible role
=======================

This role will:

- Install Docker and docker-compose plugin
- Create a system user for PocketBase
- Clone the hooks from the repository and copy them into the PocketBase hooks directory
- Generate `docker-compose.yml` and `Caddyfile` templates
- Create Cloudflared configuration and place it under `/etc/cloudflared`
- Start the Docker Compose stack (PocketBase, Caddy, cloudflared)

Usage
-----

1. Create an inventory with a host group `pocketbase_servers`.
2. Copy `ansible/vars.example.yml` to `ansible/vars.yml` and edit variables.
3. Provide Cloudflare tunnel credentials JSON under `{{ cloudflared_credentials_path }}` before running the playbook.

Notes on Cloudflare Tunnel
--------------------------

- You must create a Cloudflare tunnel and download the credentials JSON (named in `cloudflared_credentials_file`) and place it in `{{ cloudflared_credentials_path }}` or let Ansible transfer it.
- The role writes a simple `config.yml` for the tunnel that maps the specified domain to local services.
- cloudflared provides TLS termination when configured as a tunnel, so Caddy does not need to request certificates.

Security
--------
- The role creates directories with conservative permissions. Adjust as needed.
- The `pocketbase_user` is added to the `docker` group so it can manage containers. This is equivalent to root for Docker operations.
