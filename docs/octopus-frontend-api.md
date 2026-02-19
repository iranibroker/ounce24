# Octopus Game – Frontend Integration Guide

This document describes how a frontend application should integrate with the Octopus game backend.

---

## 1. Getting the Token from the URL

Users arrive at the Octopus app with a short-lived token in the query string:

```
https://octopus.ounce24.com?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Steps

1. **Read the token on page load**
   ```ts
   const params = new URLSearchParams(window.location.search);
   const token = params.get('token');
   ```

2. **Validate**
   - If `token` is missing or empty → show an error (e.g. "Invalid or missing token") and optionally redirect to the main app.

3. **Remove token from URL** (recommended)
   - Prevents token from staying in browser history or referrer headers.
   ```ts
   if (token) {
     window.history.replaceState({}, '', window.location.pathname);
   }
   ```

4. **Store the token**
   - For API calls: keep in memory or `sessionStorage`.
   - Do not store in `localStorage` if the app is shared (e.g. kiosk).
   - Token expires in **15 minutes**.

5. **Send token on every API request**
   ```
   Authorization: Bearer <token>
   ```

---

## 2. Base URL

All Octopus API endpoints use the main backend base URL:

- **Production:** `https://api.ounce24.com`
- **Local:** `http://localhost:3000` (when running backend locally)

Prefix: `/api`

---

## 3. API Endpoints

### 3.1 Get User Info

Returns the authenticated user.

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/auth/me` | Required (Bearer token) |

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "user-id",
  "name": "User Name",
  "title": "@username",
  "avatar": "https://...",
  "phone": "...",
  "email": "..."
}
```

**Use:** Call on load (after reading token from URL) to display user name, avatar, etc.

---

### 3.2 Get Current Gold Price

Returns the current ounce (XAU) price. For the widget you may use your own source; this is the same price used for votes.

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/ounce-price/current` | Not required |

**Response:**
```json
{
  "price": 2650.42
}
```

---

### 3.3 Vote (Up or Down)

Saves the user’s prediction for today. One vote per user per day.

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/api/octopus/vote` | Required (Bearer token) |

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

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

**Response (success):**
```json
{
  "id": "prediction-id",
  "direction": "up",
  "votePrice": 2650.42,
  "voteDate": "2025-02-19T00:00:00.000Z"
}
```

**Errors:**
- `400` – Already voted today
- `400` – Price not available
- `401` – Invalid or expired token

---

### 3.4 Get Daily Sentiment

Returns today’s aggregated votes (up vs down).

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/sentiment` | Not required |
| `GET` | `/api/octopus/sentiment?date=2025-02-19` | Not required (optional date) |

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

### 3.5 Check User’s Vote Status

Check if the current user has voted today and get details.

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/me/vote` | Required (Bearer token) |
| `GET` | `/api/octopus/me/vote?date=2025-02-19` | Required (optional date) |

**Response (not voted):**
```json
{
  "voted": false
}
```

**Response (voted, not yet settled):**
```json
{
  "voted": true,
  "direction": "up",
  "votePrice": 2650.42,
  "voteDate": "2025-02-19T00:00:00.000Z",
  "settled": false
}
```

**Response (voted and settled):**
```json
{
  "voted": true,
  "direction": "up",
  "votePrice": 2650.42,
  "voteDate": "2025-02-19T00:00:00.000Z",
  "closePrice": 2655.10,
  "points": 1,
  "settled": true
}
```
- `points`: `1` if correct, `0` if incorrect.

---

### 3.6 Get User Scores

Returns the current user’s weekly and monthly scores.

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/me/scores` | Required (Bearer token) |

**Response:**
```json
{
  "weekly": 5,
  "monthly": 18
}
```

---

### 3.7 Top 10 Weekly Leaderboard

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/leaderboard/weekly` | Not required |
| `GET` | `/api/octopus/leaderboard/weekly?limit=10` | Not required (default: 10) |

**Response:**
```json
[
  {
    "userId": "user-id-1",
    "totalPoints": 6,
    "name": "Alice",
    "title": "@alice",
    "avatar": "https://...",
    "rank": 1
  },
  ...
]
```

---

### 3.8 Top 10 Monthly Leaderboard

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/octopus/leaderboard/monthly` | Not required |
| `GET` | `/api/octopus/leaderboard/monthly?limit=10` | Not required (default: 10) |

**Response:** Same shape as weekly leaderboard.

---

## 4. Suggested Flow

1. **Load:** Read `?token=` from URL.
2. **Validate:** If no token → show error, redirect, or prompt to open from main app.
3. **Clean URL:** `history.replaceState` to remove the token from the address bar.
4. **User:** `GET /api/auth/me` with `Authorization: Bearer <token>`.
5. **Vote status:** `GET /api/octopus/me/vote`.
   - If `voted: true` → show result (or hide vote buttons).
   - If `voted: false` → show Up/Down buttons.
6. **Price:** Show current price (widget or `GET /api/ounce-price/current`).
7. **Sentiment:** `GET /api/octopus/sentiment` for up/down percentages.
8. **On vote:** `POST /api/octopus/vote` with `{ direction: "up" | "down" }`.
9. **Leaderboards:** `GET /api/octopus/leaderboard/weekly` and `/monthly`.
10. **Scores:** `GET /api/octopus/me/scores`.

---

## 5. Error Handling

| Status | Meaning |
|--------|---------|
| `401` | Invalid or expired token → redirect to main app or show login/error. |
| `403` | Forbidden → same as 401. |
| `400` | Bad request (e.g. already voted, invalid body). |

---

## 6. How Users Reach the Octopus App

The main ounce24 app obtains a token and redirects/embeds the Octopus app:

```ts
// In main app (ounce24)
const url = await this.appTokenService.getEmbeddedAppUrl('https://octopus.ounce24.com');
// Navigate or set iframe src
window.location.href = url;
```

The resulting URL looks like:  
`https://octopus.ounce24.com?token=<short-lived-jwt>`

---

## 7. Time Zones

- **Vote date:** UTC date (start of day).
- **Market close:** 22:00 UTC, Mon–Fri. Predictions are settled then.
- **Weekly leaderboard:** Monday 00:00 UTC – Sunday 23:59 UTC.
- **Monthly leaderboard:** 1st–last day of month (UTC).
