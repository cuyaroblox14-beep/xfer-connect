# Xfer Connect

A starter cross-platform app for local Wi‑Fi file transfer and instant messaging. This project includes a Node.js backend with Socket.IO messaging and an Expo React Native mobile app for Android/iOS device scanning, chat, and local file sending.

## Features

- Unique user registration with custom username
- Local Wi‑Fi device discovery from LAN scan
- File transfer over local network using HTTP upload
- Real-time text chat with Socket.IO
- Message history and transfer record storage
- Mobile dashboard and quick actions for sending media to nearby devices

## Tech Stack

- Frontend: React Native + Expo
- Backend: Node.js + Express + Socket.IO
- Local transfer: HTTP multipart upload over local Wi‑Fi
- Data: JSON-based store for quick local prototype

## Project Structure

- `backend/` — REST API + WebSocket server
- `app/` — Expo app UI
- `data/` — local JSON persistence for users/messages/transfers

## Quick Start

1. Install dependencies:

```bash
npm install --prefix backend
npm install --prefix app
```

2. Start the backend:

```bash
npm --prefix backend run dev
```

3. Start the app:

```bash
npm --prefix app start
```

4. Update the app's API URL inside `app/App.js`:

```js
const API_BASE_URL = 'http://192.168.1.5:4000';
```

Use the LAN IP of the machine running the backend server.

## Backend endpoints

- `POST /api/users/register`
- `GET /api/users`
- `POST /api/messages`
- `GET /api/messages/:userA/:userB`
- `GET /api/devices/scan`
- `POST /api/transfer/upload`
- `GET /api/transfer/:id`

## Notes

This is a working starter implementation designed for rapid prototyping and local network demos. It is intentionally simple, with JSON persistence instead of a production database, so it can run quickly without external dependencies.

## Next upgrades

- Replace JSON storage with PostgreSQL or SQLite
- Add end-to-end encryption for chat
- Add robust LAN discovery with UDP broadcast or mDNS
- Add desktop receiver app for Windows/macOS
- Add drag-and-drop transfer UI and progress indicators
