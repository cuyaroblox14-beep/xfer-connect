import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const STORE_PATH = path.join(DATA_DIR, 'store.json');

const defaultStore = {
  users: [],
  messages: [],
  transfers: [],
};

const readStore = () => {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    if (!raw.trim()) return structuredClone(defaultStore);
    return JSON.parse(raw);
  } catch (error) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultStore, null, 2));
    return structuredClone(defaultStore);
  }
};

const writeStore = (store) => {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
};

let store = readStore();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

const findUserById = (userId) => store.users.find((user) => user.id === userId);
const findUserByUsername = (username) => store.users.find((user) => user.username.toLowerCase() === username.toLowerCase());

const buildLANDeviceList = () => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(networkInterfaces).forEach((entries = []) => {
    entries.forEach((entry) => {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    });
  });

  if (addresses.length === 0) {
    return [{
      id: 'local-host',
      name: 'Local Host',
      type: 'desktop',
      ip: '127.0.0.1',
      status: 'ready',
    }];
  }

  const baseAddresses = [...new Set(addresses)];
  const networkDevs = baseAddresses.map((ip, index) => {
    const parts = ip.split('.');
    const networkBase = `${parts.slice(0, 3).join('.')}.`;

    return {
      id: `lan-device-${index + 1}`,
      name: `Nearby Device ${index + 1}`,
      type: index % 2 === 0 ? 'desktop' : 'phone',
      ip,
      networkBase,
      status: 'ready',
    };
  });

  const demoCandidates = Array.from({ length: 5 }, (_, index) => ({
    id: `demo-${index + 1}`,
    name: `Laptop ${index + 1}`,
    type: index % 2 === 0 ? 'desktop' : 'phone',
    ip: `${networkDevs[0]?.networkBase || '192.168.1.'}${index + 2}`,
    status: 'discoverable',
  }));

  return [...networkDevs, ...demoCandidates].slice(0, 8);
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Xfer Connect backend running' });
});

app.get('/api/users', (_req, res) => {
  res.json({ users: store.users });
});

app.post('/api/users/register', (req, res) => {
  const { username, displayName, deviceName } = req.body || {};

  if (!username || !String(username).trim()) {
    return res.status(400).json({ error: 'username is required' });
  }

  const normalizedUsername = String(username).trim();
  const existingUser = findUserByUsername(normalizedUsername);
  if (existingUser) {
    return res.status(200).json({ user: existingUser, message: 'User already exists' });
  }

  const newUser = {
    id: `user_${uuidv4().slice(0, 8)}`,
    username: normalizedUsername,
    displayName: displayName || normalizedUsername,
    deviceName: deviceName || 'Unknown Device',
    createdAt: new Date().toISOString(),
  };

  store.users.push(newUser);
  writeStore(store);
  res.status(201).json({ user: newUser });
});

app.get('/api/messages/:userA/:userB', (req, res) => {
  const { userA, userB } = req.params;
  const roomMessages = store.messages.filter((message) => {
    const senderMatches = message.fromUserId === userA && message.toUserId === userB;
    const recipientMatches = message.fromUserId === userB && message.toUserId === userA;
    return senderMatches || recipientMatches;
  });

  res.json({ messages: roomMessages });
});

app.post('/api/messages', (req, res) => {
  const { fromUserId, toUserId, text } = req.body || {};

  if (!fromUserId || !toUserId || !String(text || '').trim()) {
    return res.status(400).json({ error: 'fromUserId, toUserId, and text are required' });
  }

  const senderUser = findUserById(fromUserId);
  const recipientUser = findUserById(toUserId);

  if (!senderUser || !recipientUser) {
    return res.status(404).json({ error: 'user not found' });
  }

  const message = {
    id: `msg_${uuidv4().slice(0, 8)}`,
    fromUserId,
    toUserId,
    text: String(text).trim(),
    status: 'delivered',
    createdAt: new Date().toISOString(),
  };

  store.messages.push(message);
  writeStore(store);

  io.to(`user:${toUserId}`).emit('message:received', message);
  io.to(`user:${fromUserId}`).emit('message:sent', message);

  res.status(201).json({ message });
});

app.get('/api/devices/scan', (_req, res) => {
  const devices = buildLANDeviceList();
  res.json({ devices, discoveredAt: new Date().toISOString() });
});

app.get('/api/transfer/:id', (req, res) => {
  const transfer = store.transfers.find((item) => item.id === req.params.id);

  if (!transfer) {
    return res.status(404).json({ error: 'transfer not found' });
  }

  res.json({ transfer });
});

app.post('/api/transfer/upload', upload.single('file'), (req, res) => {
  const { senderUserId, targetUserId } = req.body || {};

  if (!req.file) {
    return res.status(400).json({ error: 'file required' });
  }

  if (!senderUserId || !targetUserId) {
    return res.status(400).json({ error: 'senderUserId and targetUserId are required' });
  }

  const transfer = {
    id: `transfer_${uuidv4().slice(0, 8)}`,
    senderUserId,
    targetUserId,
    fileName: req.file.originalname,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`,
    createdAt: new Date().toISOString(),
    status: 'uploaded',
  };

  store.transfers.push(transfer);
  writeStore(store);

  io.to(`user:${targetUserId}`).emit('transfer:received', transfer);
  res.status(201).json({ transfer });
});

io.on('connection', (socket) => {
  socket.on('register', ({ userId }) => {
    if (userId) {
      socket.join(`user:${userId}`);
      socket.data.userId = userId;
    }
  });

  socket.on('send-message', (payload) => {
    const { fromUserId, toUserId, text } = payload || {};

    if (!fromUserId || !toUserId || !String(text || '').trim()) {
      return;
    }

    const message = {
      id: `msg_${uuidv4().slice(0, 8)}`,
      fromUserId,
      toUserId,
      text: String(text).trim(),
      status: 'delivered',
      createdAt: new Date().toISOString(),
    };

    store.messages.push(message);
    writeStore(store);

    io.to(`user:${toUserId}`).emit('message:received', message);
    io.to(`user:${fromUserId}`).emit('message:sent', message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Xfer Connect backend is running on http://localhost:${PORT}`);
});
