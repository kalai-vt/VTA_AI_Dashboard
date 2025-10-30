import { useState } from 'react';
import axios from 'axios';
import { ChatRequest, ChatResponse, SessionResponse } from '../types/message';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const useChatAPI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (): Promise<string> => {
    try {
      const response = await axios.post<SessionResponse>(`${API_BASE_URL}/api/session/create`);
      return response.data.session_id;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw new Error('Failed to create session');
    }
  };

  const sendMessage = async (request: ChatRequest): Promise<ChatResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post<ChatResponse>(`${API_BASE_URL}/api/chat`, request);
      return response.data;
    } catch (error) {
      const errorMessage = axios.isAxiosError(error) 
        ? error.response?.data?.detail || error.message
        : 'An unexpected error occurred';
      
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetSession = async (sessionId: string): Promise<void> => {
    try {
      await axios.post(`${API_BASE_URL}/api/session/${sessionId}/reset`);
    } catch (error) {
      console.error('Failed to reset session:', error);
      throw new Error('Failed to reset session');
    }
  };

  return {
    isLoading,
    error,
    createSession,
    sendMessage,
    resetSession,
  };
};

