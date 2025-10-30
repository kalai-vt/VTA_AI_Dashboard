import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatWindow from '../ChatWindow';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';
import { Message } from '../types/message';

// Mock axios
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VTA AI Assistant Frontend Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ChatWindow Component', () => {
    test('renders welcome message on load', () => {
      render(<ChatWindow />);
      
      expect(screen.getByText(/Hello! I'm your VTA AI Assistant/)).toBeInTheDocument();
      expect(screen.getByText(/VTA AI Assistant/)).toBeInTheDocument();
    });

    test('displays header with title and clear button', () => {
      render(<ChatWindow />);
      
      expect(screen.getByText('VTA AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Your HR Recruitment Data Assistant')).toBeInTheDocument();
      expect(screen.getByText('Clear Chat')).toBeInTheDocument();
    });

    test('handles API success response', async () => {
      const mockResponse = {
        data: {
          success: true,
          user_query: 'test query',
          sql_query: 'SELECT * FROM test',
          query_result: 'test result',
          response: 'Test response from assistant'
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      render(<ChatWindow />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');
      
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('test query')).toBeInTheDocument();
        expect(screen.getByText('Test response from assistant')).toBeInTheDocument();
      });
    });

    test('handles API error response', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      render(<ChatWindow />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');
      
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error/)).toBeInTheDocument();
      });
    });
  });

  describe('MessageBubble Component', () => {
    const userMessage: Message = {
      id: '1',
      text: 'Hello',
      sender: 'user',
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: '2',
      text: 'Hi there!',
      sender: 'assistant',
      timestamp: new Date(),
    };

    const messageWithSQL: Message = {
      id: '3',
      text: 'Here are the results',
      sender: 'assistant',
      timestamp: new Date(),
      sqlQuery: 'SELECT * FROM candidates',
      queryResult: 'Query executed successfully',
    };

    test('renders user message correctly', () => {
      render(<MessageBubble message={userMessage} />);
      
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hello').closest('div')).toHaveClass('message-user');
    });

    test('renders assistant message correctly', () => {
      render(<MessageBubble message={assistantMessage} />);
      
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
      expect(screen.getByText('Hi there!').closest('div')).toHaveClass('message-assistant');
    });

    test('shows SQL details when available', () => {
      render(<MessageBubble message={messageWithSQL} />);
      
      expect(screen.getByText('Show SQL Details')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Show SQL Details'));
      
      expect(screen.getByText('SQL Query:')).toBeInTheDocument();
      expect(screen.getByText('SELECT * FROM candidates')).toBeInTheDocument();
      expect(screen.getByText('Query Result:')).toBeInTheDocument();
      expect(screen.getByText('Query executed successfully')).toBeInTheDocument();
    });

    test('toggles SQL details visibility', () => {
      render(<MessageBubble message={messageWithSQL} />);
      
      const toggleButton = screen.getByText('Show SQL Details');
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('Hide Details')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Hide Details'));
      
      expect(screen.getByText('Show SQL Details')).toBeInTheDocument();
    });
  });

  describe('ChatInput Component', () => {
    const mockOnSendMessage = jest.fn();

    beforeEach(() => {
      mockOnSendMessage.mockClear();
    });

    test('renders input and send button', () => {
      render(<ChatInput onSendMessage={mockOnSendMessage} />);
      
      expect(screen.getByPlaceholderText(/Ask me about candidates/)).toBeInTheDocument();
      expect(screen.getByText('Send')).toBeInTheDocument();
    });

    test('calls onSendMessage when form is submitted', () => {
      render(<ChatInput onSendMessage={mockOnSendMessage} />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');
      
      fireEvent.change(input, { target: { value: 'test message' } });
      fireEvent.click(sendButton);
      
      expect(mockOnSendMessage).toHaveBeenCalledWith('test message');
    });

    test('calls onSendMessage when Enter is pressed', () => {
      render(<ChatInput onSendMessage={mockOnSendMessage} />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      
      fireEvent.change(input, { target: { value: 'test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      
      expect(mockOnSendMessage).toHaveBeenCalledWith('test message');
    });

    test('does not send empty messages', () => {
      render(<ChatInput onSendMessage={mockOnSendMessage} />);
      
      const sendButton = screen.getByText('Send');
      
      fireEvent.click(sendButton);
      
      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    test('shows loading state when disabled', () => {
      render(<ChatInput onSendMessage={mockOnSendMessage} disabled={true} />);
      
      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Ask me about candidates/)).toBeDisabled();
    });

    test('shows character count', () => {
      render(<ChatInput onSendMessage={mockOnSendMessage} />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      
      fireEvent.change(input, { target: { value: 'test' } });
      
      expect(screen.getByText('4/1000')).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    test('creates session on first message', async () => {
      const sessionResponse = {
        data: {
          session_id: 'test-session-123',
          message: 'Session created',
          success: true
        }
      };

      const chatResponse = {
        data: {
          success: true,
          user_query: 'test',
          sql_query: 'SELECT 1',
          query_result: 'success',
          response: 'Test response'
        }
      };

      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockResolvedValueOnce(chatResponse);

      render(<ChatWindow />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');
      
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/session/create'),
          expect.any(Object)
        );
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/chat'),
          expect.objectContaining({
            query: 'test',
            session_id: 'test-session-123'
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error message on API failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));

      render(<ChatWindow />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');
      
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error/)).toBeInTheDocument();
      });
    });

    test('handles malformed API response', async () => {
      const malformedResponse = {
        data: {
          // Missing required fields
          success: true
        }
      };

      mockedAxios.post.mockResolvedValueOnce(malformedResponse);

      render(<ChatWindow />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');
      
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Sorry, I couldn't process your request/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    test('input has proper accessibility attributes', () => {
      render(<ChatInput onSendMessage={jest.fn()} />);
      
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      expect(input).toHaveAttribute('placeholder');
    });

    test('buttons are keyboard accessible', () => {
      render(<ChatInput onSendMessage={jest.fn()} />);
      
      const sendButton = screen.getByText('Send');
      expect(sendButton).toBeInTheDocument();
      
      sendButton.focus();
      expect(document.activeElement).toBe(sendButton);
    });
  });
});

