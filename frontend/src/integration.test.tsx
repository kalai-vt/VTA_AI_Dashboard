/**
 * VTA AI Assistant Frontend Integration Test
 * 
 * This script tests the complete frontend functionality
 * and verifies all components work together correctly.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import ChatWindow from './ChatWindow';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VTA AI Assistant Frontend - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete User Flow Tests', () => {
    test('Full conversation flow with SQL generation', async () => {
      // Mock session creation
      const sessionResponse = {
        data: {
          session_id: 'test-session-123',
          message: 'Session created successfully',
          success: true
        }
      };

      // Mock chat response with SQL
      const chatResponse = {
        data: {
          success: true,
          user_query: 'Show me top 5 candidates by experience',
          sql_query: 'SELECT candidate_id, first_name, last_name, experience_years FROM Candidate_Profile WHERE isDelete = 0 ORDER BY experience_years DESC LIMIT 5',
          query_result: 'Found 5 candidates with experience data',
          response: 'Here are the top 5 candidates by experience:\n\n1. John Smith - 8 years\n2. Jane Doe - 7 years\n3. Bob Johnson - 6 years\n4. Alice Brown - 5 years\n5. Charlie Wilson - 4 years'
        }
      };

      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockResolvedValueOnce(chatResponse);

      render(<ChatWindow />);

      // Verify welcome message
      expect(screen.getByText(/Hello! I'm your VTA AI Assistant/)).toBeInTheDocument();

      // Send a message
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      fireEvent.change(input, { target: { value: 'Show me top 5 candidates by experience' } });
      fireEvent.click(sendButton);

      // Verify user message appears
      await waitFor(() => {
        expect(screen.getByText('Show me top 5 candidates by experience')).toBeInTheDocument();
      });

      // Verify assistant response appears
      await waitFor(() => {
        expect(screen.getByText(/Here are the top 5 candidates by experience/)).toBeInTheDocument();
      });

      // Verify SQL details are available
      const showDetailsButton = screen.getByText('Show SQL Details');
      expect(showDetailsButton).toBeInTheDocument();

      // Click to show SQL details
      fireEvent.click(showDetailsButton);

      // Verify SQL query is displayed
      await waitFor(() => {
        expect(screen.getByText('SQL Query:')).toBeInTheDocument();
        expect(screen.getByText(/SELECT candidate_id, first_name, last_name, experience_years/)).toBeInTheDocument();
      });
    });

    test('Error handling flow', async () => {
      // Mock session creation success
      const sessionResponse = {
        data: {
          session_id: 'test-session-123',
          message: 'Session created successfully',
          success: true
        }
      };

      // Mock API error
      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockRejectedValueOnce(new Error('Network Error'));

      render(<ChatWindow />);

      // Send a message that will cause an error
      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.click(sendButton);

      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error/)).toBeInTheDocument();
      });
    });

    test('Greeting message flow', async () => {
      const sessionResponse = {
        data: {
          session_id: 'test-session-123',
          message: 'Session created successfully',
          success: true
        }
      };

      const greetingResponse = {
        data: {
          success: true,
          user_query: 'Hello',
          sql_query: '',
          query_result: '',
          response: 'Hi there! I\'m your VTA Assistant — how can I help you today?'
        }
      };

      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockResolvedValueOnce(greetingResponse);

      render(<ChatWindow />);

      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText(/Hi there! I'm your VTA Assistant/)).toBeInTheDocument();
      });
    });

    test('Clear chat functionality', async () => {
      render(<ChatWindow />);

      // Verify initial welcome message
      expect(screen.getByText(/Hello! I'm your VTA AI Assistant/)).toBeInTheDocument();

      // Click clear chat button
      const clearButton = screen.getByText('Clear Chat');
      fireEvent.click(clearButton);

      // Verify welcome message is still there (cleared and re-added)
      await waitFor(() => {
        expect(screen.getByText(/Hello! I'm your VTA AI Assistant/)).toBeInTheDocument();
      });
    });

    test('Input validation and character limit', async () => {
      render(<ChatWindow />);

      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      // Test empty message
      fireEvent.click(sendButton);
      expect(sendButton).toBeDisabled();

      // Test message with spaces only
      fireEvent.change(input, { target: { value: '   ' } });
      expect(sendButton).toBeDisabled();

      // Test valid message
      fireEvent.change(input, { target: { value: 'Valid message' } });
      expect(sendButton).not.toBeDisabled();

      // Test character counter
      expect(screen.getByText('13/1000')).toBeInTheDocument();
    });

    test('Keyboard navigation', async () => {
      render(<ChatWindow />);

      const input = screen.getByPlaceholderText(/Ask me about candidates/);

      // Test Enter key submission
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      // Message should be sent (we can't easily test the full flow without mocking)
      expect(input).toHaveValue('');
    });
  });

  describe('Component Integration Tests', () => {
    test('MessageBubble integration with different message types', async () => {
      const sessionResponse = {
        data: { session_id: 'test-session', message: 'Success', success: true }
      };

      const responseWithSQL = {
        data: {
          success: true,
          user_query: 'test',
          sql_query: 'SELECT * FROM test',
          query_result: 'test result',
          response: 'Test response'
        }
      };

      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockResolvedValueOnce(responseWithSQL);

      render(<ChatWindow />);

      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('test')).toBeInTheDocument();
        expect(screen.getByText('Test response')).toBeInTheDocument();
      });

      // Test SQL details toggle
      const showDetailsButton = screen.getByText('Show SQL Details');
      fireEvent.click(showDetailsButton);

      await waitFor(() => {
        expect(screen.getByText('Hide Details')).toBeInTheDocument();
        expect(screen.getByText('SELECT * FROM test')).toBeInTheDocument();
      });
    });

    test('TypingIndicator integration', async () => {
      // Mock a delayed response
      const sessionResponse = {
        data: { session_id: 'test-session', message: 'Success', success: true }
      };

      const delayedResponse = new Promise(resolve => {
        setTimeout(() => {
          resolve({
            data: {
              success: true,
              user_query: 'test',
              sql_query: '',
              query_result: '',
              response: 'Delayed response'
            }
          });
        }, 100);
      });

      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockReturnValueOnce(delayedResponse);

      render(<ChatWindow />);

      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(sendButton);

      // Should show typing indicator
      await waitFor(() => {
        expect(screen.getByText(/VTA Assistant is typing/)).toBeInTheDocument();
      });

      // Wait for response
      await waitFor(() => {
        expect(screen.getByText('Delayed response')).toBeInTheDocument();
      }, { timeout: 200 });
    });
  });

  describe('API Integration Tests', () => {
    test('Session management flow', async () => {
      const sessionResponse = {
        data: {
          session_id: 'new-session-456',
          message: 'Session created successfully',
          success: true
        }
      };

      const chatResponse = {
        data: {
          success: true,
          user_query: 'test',
          sql_query: '',
          query_result: '',
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
            session_id: 'new-session-456'
          })
        );
      });
    });

    test('Multiple messages in same session', async () => {
      const sessionResponse = {
        data: {
          session_id: 'persistent-session-789',
          message: 'Session created successfully',
          success: true
        }
      };

      const firstResponse = {
        data: {
          success: true,
          user_query: 'first message',
          sql_query: '',
          query_result: '',
          response: 'First response'
        }
      };

      const secondResponse = {
        data: {
          success: true,
          user_query: 'second message',
          sql_query: '',
          query_result: '',
          response: 'Second response'
        }
      };

      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      render(<ChatWindow />);

      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      // Send first message
      fireEvent.change(input, { target: { value: 'first message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('First response')).toBeInTheDocument();
      });

      // Send second message
      fireEvent.change(input, { target: { value: 'second message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Second response')).toBeInTheDocument();
      });

      // Verify both messages are in the conversation
      expect(screen.getByText('first message')).toBeInTheDocument();
      expect(screen.getByText('second message')).toBeInTheDocument();
      expect(screen.getByText('First response')).toBeInTheDocument();
      expect(screen.getByText('Second response')).toBeInTheDocument();
    });
  });

  describe('Error Recovery Tests', () => {
    test('Recovery from network error', async () => {
      const sessionResponse = {
        data: {
          session_id: 'error-session-123',
          message: 'Session created successfully',
          success: true
        }
      };

      // First call fails, second succeeds
      mockedAxios.post
        .mockResolvedValueOnce(sessionResponse)
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({
          data: {
            success: true,
            user_query: 'retry message',
            sql_query: '',
            query_result: '',
            response: 'Success after retry'
          }
        });

      render(<ChatWindow />);

      const input = screen.getByPlaceholderText(/Ask me about candidates/);
      const sendButton = screen.getByText('Send');

      // Send message that will fail
      fireEvent.change(input, { target: { value: 'test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/Sorry, I encountered an error/)).toBeInTheDocument();
      });

      // Send another message that should succeed
      fireEvent.change(input, { target: { value: 'retry message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Success after retry')).toBeInTheDocument();
      });
    });
  });
});

