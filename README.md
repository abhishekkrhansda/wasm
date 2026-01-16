# Workflow Automation & Case Management System (WACMS)

Enterprise-grade workflow automation system for managing cases through a structured lifecycle with RBAC, audit logging, and operational dashboards.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migrate
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | wacms |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiry | 24h |

## API Overview

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register new user |
| `/api/auth/login` | POST | Login & get token |
| `/api/auth/me` | GET | Current user profile |

### Cases
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cases` | GET | List cases |
| `/api/cases` | POST | Create case |
| `/api/cases/:id` | GET | Case details |
| `/api/cases/:id` | PUT | Update case |
| `/api/cases/:id/status` | PUT | Transition status |
| `/api/cases/:id/assign` | PUT | Assign case |
| `/api/cases/:id/comments` | GET/POST | Comments |
| `/api/cases/:id/audit` | GET | Audit trail |

### Dashboard
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/dashboard/summary` | GET | Case statistics |
| `/api/dashboard/sla-breaches` | GET | SLA violations |
| `/api/dashboard/resolution-times` | GET | Avg resolution |
| `/api/dashboard/analyst-workload` | GET | Workload distribution |

## Workflow States

```
Created → Assigned → In Progress → Under Review → Closed
                          ↑_______________|
                          (Return for rework)
```

### Transition Permissions
| From | To | Allowed Roles |
|------|-----|---------------|
| Created | Assigned | Manager, Admin |
| Assigned | In Progress | Analyst |
| In Progress | Under Review | Analyst |
| Under Review | Closed | Manager, Admin |
| Under Review | In Progress | Manager, Admin |

## User Roles

| Role | Permissions |
|------|-------------|
| Requester | Create cases, view own cases |
| Analyst | Work on assigned cases |
| Manager | Assign, review, close cases |
| Admin | Full system access |
