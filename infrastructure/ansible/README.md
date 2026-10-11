# Ansible Infrastructure Automation for Larekmart

This directory contains production-grade Ansible automation for server configuration, security hardening, container runtime provisioning, and database backups across Larekmart's fleet.

## Directory Structure

```
infrastructure/ansible/
├── ansible.cfg                    # Strict SSH, pipelining, callback configuration
├── inventories/
│   ├── production/hosts.ini       # Production host mapping
│   ├── staging/hosts.ini          # Staging host mapping
│   └── group_vars/
│       ├── all.yml                # Fleet-wide sysctl, base packages, NTP
│       └── k8s_nodes.yml          # Containerd, CNI, kernel bridge parameters
├── roles/
│   ├── common/                    # Base OS configuration, NTP, ulimits
│   ├── security/                  # SSH hardening, UFW, fail2ban, auto-updates
│   ├── container_runtime/         # Containerd with SystemdCgroup, kernel modules
│   └── db_backup/                 # S3 automated database backup jobs
└── playbooks/
    ├── site.yml                   # Master full-stack orchestrator
    ├── k8s-node-setup.yml         # Dedicated Kubernetes worker preparation
    ├── security-hardening.yml     # Standalone security compliance run
    └── backup.yml                 # On-demand database backup execution
```

---

## Prerequisites

- [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) `>= 2.15.0`
- Python 3.10+
- SSH access with `sudo` privileges to target hosts

Install Ansible requirements (if using Galaxy collections):

```bash
ansible-galaxy collection install ansible.posix community.general
```

---

## Usage

### 1. Test Fleet Connectivity

```bash
cd infrastructure/ansible

# Ping all staging servers
ansible -i inventories/staging/hosts.ini all_servers -m ping

# Ping all production servers
ansible -i inventories/production/hosts.ini all_servers -m ping
```

### 2. Run the Full Site Playbook

```bash
# Dry-run check
ansible-playbook -i inventories/production/hosts.ini playbooks/site.yml --check

# Apply across fleet
ansible-playbook -i inventories/production/hosts.ini playbooks/site.yml
```

### 3. Provision Kubernetes Nodes Only

```bash
ansible-playbook -i inventories/production/hosts.ini playbooks/k8s-node-setup.yml
```

### 4. Trigger Immediate Database Backup

```bash
ansible-playbook -i inventories/production/hosts.ini playbooks/backup.yml
```
