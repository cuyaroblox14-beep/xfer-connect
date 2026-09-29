import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

const API_BASE_URL = 'http://192.168.1.5:4000';

export default function App() {
  const [user, setUser] = useState(null);
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Ready');
  const [username, setUsername] = useState('alice');

  useEffect(() => {
    registerUser();
    refreshDevices();
  }, []);

  const currentTarget = useMemo(() => {
    if (!selectedDevice && deviceList.length > 0) return deviceList[0];
    return selectedDevice;
  }, [deviceList, selectedDevice]);

  useEffect(() => {
    if (currentTarget && user) {
      loadMessages(currentTarget.id || currentTarget.name);
    }
  }, [currentTarget, user]);

  const registerUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          displayName: 'Alice',
          deviceName: 'Alice Phone',
        }),
      });

      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        setStatus(`User ready: @${data.user.username}`);
      }
    } catch (error) {
      Alert.alert('Connection error', 'Could not create user. Check the backend server and LAN IP.');
      setStatus('Backend unavailable');
    }
  };

  const refreshDevices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/devices/scan`);
      const data = await response.json();
      const devices = data.devices || [];
      setDeviceList(devices);
      if (devices.length > 0) {
        setSelectedDevice(devices[0]);
      }
    } catch (error) {
      setDeviceList([]);
      setStatus('Device scan unavailable');
    }
  };

  const loadMessages = async (peerId) => {
    if (!user || !peerId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/messages/${user.id}/${peerId}`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      setMessages([]);
    }
  };

  const sendMessage = async () => {
    if (!user || !currentTarget || !draft.trim()) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId: currentTarget.id || currentTarget.name,
          text: draft,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setDraft('');
        setStatus(`Sent to ${currentTarget.name}`);
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (error) {
      Alert.alert('Message error', 'Message could not be sent.');
    }
  };

  const sendMediaToDesktop = async () => {
    if (!user || !currentTarget) {
      Alert.alert('No target selected', 'Choose a nearby device first.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/*'],
      });

      if (result.canceled) {
        return;
      }

      const picked = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: picked.uri,
        name: picked.name,
        type: picked.mimeType || 'application/octet-stream',
      });
      formData.append('senderUserId', user.id);
      formData.append('targetUserId', currentTarget.id || currentTarget.name);

      const response = await fetch(`${API_BASE_URL}/api/transfer/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setStatus(`File sent to ${currentTarget.name}: ${data.transfer.fileName}`);
      }
    } catch (error) {
      Alert.alert('Transfer error', 'Could not send file over the local network.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Xfer Connect</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Current User</Text>
          {user ? (
            <>
              <Text style={styles.userId}>@{user.username}</Text>
              <Text style={styles.userMeta}>{user.deviceName}</Text>
            </>
          ) : (
            <Text>Registering user...</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Local Network Scanner</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={refreshDevices}>
            <Text style={styles.primaryButtonText}>Refresh Devices</Text>
          </TouchableOpacity>

          {deviceList.length === 0 ? (
            <Text style={styles.emptyText}>No devices found yet.</Text>
          ) : (
            <FlatList
              data={deviceList}
              keyExtractor={(item, index) => `${item.id || item.name}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.deviceRow,
                    currentTarget && (currentTarget.id || currentTarget.name) === (item.id || item.name) && styles.deviceRowSelected,
                  ]}
                  onPress={() => setSelectedDevice(item)}
                >
                  <Text style={styles.deviceName}>{item.name}</Text>
                  <Text style={styles.deviceMeta}>{item.type} • {item.ip}</Text>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Chat</Text>
          <Text style={styles.chatHeader}>Messaging {currentTarget ? currentTarget.name : 'No target'}</Text>

          <View style={styles.chatBox}>
            {messages.length === 0 ? (
              <Text style={styles.emptyText}>No messages yet. Start the conversation.</Text>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.fromUserId === user?.id ? styles.messageOutgoing : styles.messageIncoming,
                  ]}
                >
                  <Text style={styles.messageText}>{message.text}</Text>
                </View>
              ))
            )}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Type a message"
            value={draft}
            onChangeText={setDraft}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={sendMessage}>
              <Text style={styles.primaryButtonText}>Send Text</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={sendMediaToDesktop}>
              <Text style={styles.secondaryButtonText}>Send to Desktop</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.status}>{status}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8ff',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1b1d29',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#676d88',
    marginBottom: 8,
  },
  userId: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2f6ef7',
  },
  userMeta: {
    marginTop: 4,
    color: '#5b6176',
  },
  primaryButton: {
    backgroundColor: '#2f6ef7',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#eef3ff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1b2c6a',
    fontWeight: '700',
  },
  deviceRow: {
    borderWidth: 1,
    borderColor: '#e9edf8',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  deviceRowSelected: {
    borderColor: '#2f6ef7',
    backgroundColor: '#eff5ff',
  },
  deviceName: {
    fontWeight: '700',
    color: '#1d2335',
  },
  deviceMeta: {
    color: '#697188',
    marginTop: 4,
  },
  chatHeader: {
    fontWeight: '600',
    color: '#27314d',
    marginBottom: 10,
  },
  chatBox: {
    minHeight: 140,
    backgroundColor: '#f7f9ff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
  },
  messageOutgoing: {
    alignSelf: 'flex-end',
    backgroundColor: '#2f6ef7',
  },
  messageIncoming: {
    alignSelf: 'flex-start',
    backgroundColor: '#e6ecff',
  },
  messageText: {
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dfe6f9',
    backgroundColor: '#f9fafe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  emptyText: {
    color: '#6b7280',
    marginTop: 6,
  },
  status: {
    textAlign: 'center',
    color: '#3a4d7a',
    marginTop: 8,
    fontWeight: '600',
  },
});
