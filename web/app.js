const API_BASE_URL = window.XFER_API_URL || 'http://localhost:4000';
const demoDevices = [
  { id: 'macbook-pro', name: 'MacBook Pro', type: 'Desktop', ip: '192.168.1.12' },
  { id: 'iphone-15', name: 'iPhone 15', type: 'Phone', ip: '192.168.1.18' },
  { id: 'pixel-8', name: 'Pixel 8', type: 'Phone', ip: '192.168.1.23' },
];
let devices = [...demoDevices];
let selectedDevice = null;
let user = { id: 'demo-alex', username: 'alex' };

const $ = (selector) => document.querySelector(selector);
const deviceList = $('#device-list');
const messages = $('#messages');
const status = $('#connection-status');

function renderDevices() {
  deviceList.innerHTML = devices.map((device, index) => `
    <button class="device-item ${selectedDevice?.id === device.id ? 'selected' : ''}" data-device-id="${device.id}">
      <span class="device-dot"></span><span><strong class="device-name">${device.name}</strong><small class="device-type">${device.type} · ${device.ip || 'Nearby'}</small></span>
    </button>`).join('');
  document.querySelectorAll('.device-item').forEach((item) => item.addEventListener('click', () => selectDevice(item.dataset.deviceId)));
}

function selectDevice(id) {
  selectedDevice = devices.find((device) => device.id === id);
  renderDevices();
  $('#chat-title').textContent = selectedDevice.name;
  $('#chat-subtitle').textContent = `${selectedDevice.type} · connected nearby`;
  messages.innerHTML = `<div class="empty-chat"><div>✦</div><h3>Start a private conversation</h3><p>Messages to ${selectedDevice.name} stay on your local network.</p></div>`;
}

function addMessage(text, own = true) {
  if ($('.empty-chat')) messages.innerHTML = '';
  const message = document.createElement('div');
  message.className = `message ${own ? 'me' : 'them'}`;
  message.innerHTML = `${escapeHtml(text)}<small>${own ? 'Sent just now' : 'Received just now'}</small>`;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

async function scanDevices() {
  const button = $('#scan-button');
  button.textContent = '⌁ Scanning...';
  try {
    const response = await fetch(`${API_BASE_URL}/api/devices/scan`);
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();
    if (Array.isArray(data.devices) && data.devices.length) {
      devices = data.devices;
      status.innerHTML = '<i></i> Connected to local network';
    }
  } catch (error) {
    devices = [...demoDevices];
    status.innerHTML = '<i></i> Demo mode';
  } finally {
    button.textContent = '⌁ Scan for devices';
    renderDevices();
  }
}

async function registerUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, displayName: 'Alex', deviceName: 'Web Browser' }) });
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();
    if (data.user) { user = data.user; $('#display-id').textContent = `@${user.username}`; status.innerHTML = '<i></i> Connected to local network'; }
  } catch (error) { /* The website remains usable in demo mode. */ }
}

async function sendMessage() {
  const input = $('#message-input');
  const text = input.value.trim();
  if (!text || !selectedDevice) { if (!selectedDevice) $('#chat-subtitle').textContent = 'Select a device first'; return; }
  addMessage(text, true);
  input.value = '';
  try {
    await fetch(`${API_BASE_URL}/api/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fromUserId: user.id, toUserId: selectedDevice.id, text }) });
  } catch (error) { /* Keep the local demo interaction available. */ }
}

async function uploadFile(file) {
  if (!selectedDevice) { $('#chat-subtitle').textContent = 'Select a device before attaching a file'; return; }
  $('#transfer-status').textContent = `Preparing ${file.name}...`;
  const form = new FormData(); form.append('file', file); form.append('senderUserId', user.id); form.append('targetUserId', selectedDevice.id);
  try {
    const response = await fetch(`${API_BASE_URL}/api/transfer/upload`, { method: 'POST', body: form });
    if (!response.ok) throw new Error('Upload unavailable');
    $('#transfer-status').textContent = `${file.name} sent to ${selectedDevice.name}`;
  } catch (error) {
    $('#transfer-status').textContent = `${file.name} is ready to send to ${selectedDevice.name} (demo mode)`;
  }
}

$('#send-button').addEventListener('click', sendMessage);
$('#message-input').addEventListener('keydown', (event) => { if (event.key === 'Enter') sendMessage(); });
$('#scan-button').addEventListener('click', scanDevices);
$('#refresh-button').addEventListener('click', scanDevices);
$('#file-input').addEventListener('change', (event) => { if (event.target.files[0]) uploadFile(event.target.files[0]); event.target.value = ''; });
$('#edit-id').addEventListener('click', () => { const next = window.prompt('Choose your display ID', user.username); if (next?.trim()) { user.username = next.trim().replace(/^@/, ''); $('#display-id').textContent = `@${user.username}`; } });

renderDevices();
registerUser();
scanDevices();
