# Octopus Game – Native Integration Guide

The Octopus Gold spot price direction guessing game is integrated natively within the application.

---

## 1. Routing

The Octopus screen is available at the route:
- `/signals/octopus`

---

## 2. API Endpoints

All APIs are prefixed by `/api`.

### 2.1 Vote (Up or Down)

Saves the logged-in user’s prediction for today. One prediction per user per day is allowed.

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/api/octopus/vote` | Required |

**Body:**
```json
{
  "direction": "up"
}
```
or
```json
{
  "direction": "down"
}
```

**Errors:**
- `400` – Market is closed (predictions only allowed during global trading hours).
- `400` – Cutoff time exceeded (cannot place/edit prediction after 14:00 Iran time).

---

### 2.2 Get User Vote Status

Check if the current user has voted today and get details.

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/me/vote` | Required |

**Response (voted, not yet settled):**
```json
{
  "voted": true,
  "direction": "up",
  "votePrice": 2650.42,
  "voteDate": "2026-06-03T00:00:00.000Z",
  "settled": false,
  "canChange": true
}
```

---

### 2.3 Get User Scores

Returns the current user’s weekly, monthly, and total star scores.

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/me/scores` | Required |

**Response:**
```json
{
  "weekly": 5,
  "monthly": 18,
  "total": 23
}
```

---

### 2.4 Sentiment Statistics

Returns today’s aggregated votes.

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/sentiment` | Not required |

**Response:**
```json
{
  "up": 42,
  "down": 18,
  "total": 60,
  "upPercent": 70,
  "downPercent": 30
}
```

---

### 2.5 Leaderboards

#### Weekly Leaderboard
| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/leaderboard/weekly` | Not required |

#### Total (All-time) Leaderboard
| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/leaderboard/total` | Not required |
