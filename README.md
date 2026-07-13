# 🎬 Watch Party

Watch Party is a secure, highly responsive, real-time video streaming and localized community platform. It allows groups of friends to synchronize video playback effortlessly while communicating via integrated WebRTC video calls, text chat, and screen sharing. 

The platform features a custom-built gesture-supported mobile player, multi-tier subscription plans with automated payment gateways, and a hardened security architecture.

---

## ✨ Features

### 📺 Real-Time Watch Party & Media Controls
*   **Synchronized Playback:** Real-time synchronized video controls (play, pause, seek) for group sessions powered by WebSockets/WebRTC.
*   **Integrated Communication:** Live peer-to-peer video calls, real-time text chat, screen sharing, and dynamic participant list tracking.
*   **Dynamic Custom Player:** Fully tailored video player featuring 10-second skip capabilities, fluid buffer states, full-screen toggles, and a **Direct URL Input Field** to stream any video on demand instantly.
*   **Mobile Gestures:** Native touch support handling double-tap right to fast-forward and double-tap left to rewind.

### 💳 Tiered Downloads & Monetization
*   **Subscription Levels:** Four distinct access tiers: Free, Bronze, Silver, and Gold.
*   **Strict Daily Guardrails:** Free users are rigidly restricted to 1 video download per day, managed and tracked at the API layer.
*   **Razorpay Integration:** Seamless test payment gateway flows that automatically update user DB records and trigger professional confirmation invoices via email upon successful webhooks.

### 🌐 Context-Aware UX & Community Mod
*   **Time-Based Themes:** Automatically switches between Light Theme (10:00 AM – 12:00 PM IST) and Dark Theme (default) based on system time, allowing manual user overrides.
*   **Multilingual Comments:** Post comments in any language with a one-click inline translation utility.
*   **Automated Moderation:** Built-in regex filters that instantly flag and intercept profanity, spamming, or special character flooding.
*   **Privacy Guard:** Strict masking of exact public locations for commenters.

---

## 🔒 Hardened Security Layers

1.  **Advanced Rate Limiting:** Configurable rate-limiting schemas prioritizing extreme restriction on sensitive authentication checkpoints (login, signup) using exponential backoff instead of total client lockouts.
2.  **Strict Input Schema Validation:** API endpoints validate primitives, type constraints, and strict length formats. Faulty data payloads are outright rejected rather than sanitized.
3.  **Zero-Leakage Error Boundaries:** Production error handlers completely isolate stack traces, internal paths, and database execution exceptions, returning generic user-safe feedback messages.
4.  **Isolated Storage & File Pipelines:** Validates files at the binary buffer layer (magic numbers) instead of trusting extensions. Assets are stored outside the public web root with zero execution configurations (`noexec`).

---

## 🛠️ Tech Stack

*   **Frontend:** Vite + React / Next.js, Tailwind CSS (Mobile-first, fully responsive layout)
*   **Backend:** Node.js + Express (or FastAPI / Python)
*   **Real-time Infrastructure:** WebSockets / WebRTC 
*   **Database:** MongoDB / PostgreSQL (Schema tracking downloads, subscriptions, and flagged moderation metrics)
*   **Payment Processing:** Razorpay API (Test Environment)

---

## 🚀 Local Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/watch-party.git](https://github.com/your-username/watch-party.git)
    cd watch-party
    ```

2.  **Configure Environment Variables (`.env`):**
    Create a `.env` file in your server directory and supply your respective keys:
    ```env
    PORT=5000
    DATABASE_URL=your_database_url
    RAZORPAY_KEY_ID=your_razorpay_key
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your_email@gmail.com
    SMTP_PASS=your_16_digit_google_app_password
    NODE_ENV=development
    ```

3.  **Install Dependencies:**
    ```bash
    # For backend
    cd server && npm install
    
    # For frontend
    cd ../client && npm install
    ```

4.  **Run the Application:**
    ```bash
    # Start Backend
    cd server && npm run dev
    
    # Start Frontend
    cd client && npm run dev
    ```
