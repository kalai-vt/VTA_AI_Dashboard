import { Message } from '../types/message';

const STORAGE_KEY = 'vta-chat-messages';
const SESSION_KEY = 'vta-session-id';

export const saveMessages = (messages: Message[]): void => {
  try {
    const serializedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializedMessages));
  } catch (error) {
    console.error('Failed to save messages:', error);
  }
};

export const loadMessages = (): Message[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsedMessages = JSON.parse(stored);
    return parsedMessages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Failed to load messages:', error);
    return [];
  }
};

export const clearMessages = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear messages:', error);
  }
};

export const saveSessionId = (sessionId: string): void => {
  try {
    localStorage.setItem(SESSION_KEY, sessionId);
  } catch (error) {
    console.error('Failed to save session ID:', error);
  }
};

export const loadSessionId = (): string | null => {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch (error) {
    console.error('Failed to load session ID:', error);
    return null;
  }
};

export const clearSessionId = (): void => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear session ID:', error);
  }
};

