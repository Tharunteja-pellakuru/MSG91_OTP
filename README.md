# OTP Authentication System (React + Node.js + MSG91)

A complete, production-ready OTP login system using MSG91's Widget API.

---

## Folder Structure

```
OTP/
├── client/                  ← React + Vite frontend
│   ├── src/
│   │   ├── App.jsx          ← All UI logic (3-step flow)
│   │   ├── index.css        ← Premium dark glassmorphism design
│   │   └── main.jsx         ← React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── server/                  ← Node.js + Express backend
    ├── server.js            ← API routes: /send-otp, /verify-otp
    ├── .env                 ← ⚠️ Add your MSG91 credentials here
    ├── .env.example         ← Template for .env
    └── package.json
```

---

## Quick Start

### 1. Add Your MSG91 Credentials

Open `server/.env` and fill in:

```env
MSG91_AUTH_KEY=your_real_auth_key        # From: control.msg91.com → API → Auth Key
MSG91_WIDGET_ID=your_real_widget_id      # From: control.msg91.com → OTP Widget → Widget ID
PORT=5000
```

### 2. Install & Run the Backend

```bash
cd server
npm install
npm run dev        # uses nodemon for hot-reload
# Server starts at http://localhost:5000
```

### 3. Install & Run the Frontend

Open a **new terminal tab**:

```bash
cd client
npm install
npm run dev        # Vite dev server
# App opens at http://localhost:5173
```

---

## Authentication Flow

```
User enters mobile  →  POST /send-otp  →  MSG91 sends SMS
                                        ↓
User enters OTP     →  POST /verify-otp →  Success / Error
                                        ↓
                        Session saved to localStorage
```

---

## API Reference

| Route | Method | Body | Response |
|-------|--------|------|----------|
| `/send-otp` | POST | `{ mobile: "9876543210" }` | `{ success, reqId, message }` |
| `/verify-otp` | POST | `{ reqId, otp }` | `{ success, message }` |
| `/health` | GET | — | `{ status: "ok" }` |

---

## Where to Get MSG91 Credentials

1. Sign up at [control.msg91.com](https://control.msg91.com)
2. **Auth Key** → Go to **API** section in the sidebar
3. **Widget ID** → Go to **OTP Widget** → Create a new widget → Copy the Widget ID

---

## Features

- ✅ Indian mobile number validation (10-digit, starts 6-9)
- ✅ OTP send via MSG91 Widget API
- ✅ OTP verification with reqId
- ✅ 30-second resend cooldown
- ✅ Session persistence (localStorage)
- ✅ Logout functionality
- ✅ Full error handling (expired OTP, invalid OTP, rate limits, network errors)
- ✅ Loading states on all async operations
- ✅ Accessible HTML (aria labels, roles)
- ✅ Mobile-responsive design
