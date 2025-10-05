Ansible playbook for PocketBase + Caddy + Cloudflared
=====================================================

Prerequisites
-------------
- A target host (Ubuntu/Debian recommended) reachable via SSH
- Ansible installed on the control machine
- Cloudflare account with a tunnel created; download the credentials JSON

Quick start
-----------
1. Copy example vars:
   cp ansible/vars.example.yml ansible/vars.yml
2. Edit `ansible/vars.yml` and set `caddy_domain`, `caddy_email`, and cloudflared tunnel name
3. Place your cloudflared credentials JSON into the target server at `/etc/cloudflared/credentials.json` (or use Ansible to copy it)
4. Run the playbook:
   ansible-playbook -i inventory.ini ansible/site.yml

Notes
-----
- The role will create `/opt/pocketbase` and place `docker-compose.yml` and `Caddyfile` there.
- Hooks will be pulled from the repository path `pocketbase/hooks` and copied into `/opt/pocketbase/hooks`.
- The playbook installs Docker and the docker compose plugin.

Security
--------
- Cloudflared will provide TLS termination; Caddy is configured to run behind it and does not request certificates.
- Adjust file ownership and permissions in `roles/pocketbase/defaults/main.yml` if desired.
