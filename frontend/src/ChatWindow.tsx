import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import MessageBubble from './components/MessageBubble';
import ChatInput from './components/ChatInput';
import TypingIndicator from './components/TypingIndicator';
import { Message, PinnedVisual, AnalyticsData } from './types/message';
import './vta-dashboard.css';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

interface ChatWindowProps {
  onPinVisual?: (visual: PinnedVisual) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ onPinVisual }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      text: 'Hello! I\'m your VTA AI Assistant. I can help you explore recruitment data, analyze candidates, and answer questions about your HR system. How can I assist you today?',
      sender: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, []);

  // Create session on first interaction
  const createSession = async (): Promise<string> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/session/create`);
      return response.data.session_id;
    } catch (error) {
      console.error('Failed to create session:', error);
      return 'default-session';
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Create session if not exists
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = await createSession();
        setSessionId(currentSessionId);
      }

      // Try analytics endpoint first for data queries
      let analyticsData: AnalyticsData | undefined;
      let responseText = '';
      let sqlQuery = '';
      let queryResult = '';

      try {
        const analyticsResponse = await axios.post(`${API_BASE_URL}/api/analytics`, {
          query: text.trim(),
          session_id: currentSessionId,
        });

        if (analyticsResponse.data.success) {
          analyticsData = {
            user_prompt: analyticsResponse.data.user_prompt,
            sql_query_generated: analyticsResponse.data.sql_query_generated,
            output_result: analyticsResponse.data.output_result,
            chart_type: analyticsResponse.data.chart_type,
            notes: analyticsResponse.data.notes || analyticsResponse.data.insights_summary || '',
            possible_filters: analyticsResponse.data.possible_filters,
            visual_recommendation: analyticsResponse.data.visual_recommendation,
            insights_summary: analyticsResponse.data.insights_summary,
          };
          responseText = analyticsResponse.data.insights_summary || analyticsResponse.data.notes || '';
          sqlQuery = analyticsResponse.data.sql_query_generated;
          queryResult = JSON.stringify(analyticsResponse.data.output_result, null, 2);
        } else {
          // Even if success is false, try to use what we have if there's data
          if (analyticsResponse.data.output_result && analyticsResponse.data.output_result.length > 0) {
            analyticsData = {
              user_prompt: analyticsResponse.data.user_prompt,
              sql_query_generated: analyticsResponse.data.sql_query_generated,
              output_result: analyticsResponse.data.output_result,
              chart_type: analyticsResponse.data.chart_type || "Table",
              notes: analyticsResponse.data.notes || analyticsResponse.data.insights_summary || '',
              possible_filters: analyticsResponse.data.possible_filters || [],
              visual_recommendation: analyticsResponse.data.visual_recommendation,
              insights_summary: analyticsResponse.data.insights_summary,
            };
            responseText = analyticsResponse.data.insights_summary || analyticsResponse.data.notes || 'Query executed successfully.';
            sqlQuery = analyticsResponse.data.sql_query_generated;
            queryResult = JSON.stringify(analyticsResponse.data.output_result, null, 2);
          } else {
            // Only fall back if there's truly no data
            throw new Error('Analytics endpoint returned no data');
          }
        }
      } catch (analyticsError) {
        console.log('Analytics endpoint failed, falling back to chat endpoint:', analyticsError);
        
        // Fallback to regular chat endpoint
        const response = await axios.post(`${API_BASE_URL}/api/chat`, {
          query: text.trim(),
          session_id: currentSessionId,
        });

        responseText = response.data.response || 'Sorry, I couldn\'t process your request.';
        sqlQuery = response.data.sql_query;
        queryResult = response.data.query_result;
        
        // Try to create analytics data from chat response if it has data
        if (response.data.query_result && response.data.query_result !== "No results found.") {
          try {
            const parsedResult = JSON.parse(response.data.query_result);
            analyticsData = {
              user_prompt: response.data.user_query,
              sql_query_generated: response.data.sql_query,
              output_result: parsedResult,
              chart_type: determineChartTypeFromData(parsedResult),
              notes: response.data.response,
              possible_filters: identifyFiltersFromData(parsedResult),
            };
          } catch (parseError) {
            console.log('Could not parse chat response as analytics data:', parseError);
          }
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: 'assistant',
        timestamp: new Date(),
        sqlQuery: sqlQuery,
        queryResult: queryResult,
        analyticsData: analyticsData,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error processing your request. Please try again.',
        sender: 'assistant',
        timestamp: new Date(),
        isError: true,
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions for chart type determination and filter identification
  const determineChartTypeFromData = (data: any[]): string => {
    if (!data || data.length === 0) return 'Table';
    
    const columns = Object.keys(data[0] || {});
    
    // Check for time-based data
    const timeColumns = columns.filter(col => 
      col.toLowerCase().includes('date') || col.toLowerCase().includes('time') || 
      col.toLowerCase().includes('month') || col.toLowerCase().includes('year')
    );
    
    if (timeColumns.length > 0 && data.length > 1) return 'Line';
    
    // Check for numeric columns
    const numericColumns = columns.filter(col => 
      typeof data[0][col] === 'number' || !isNaN(Number(data[0][col]))
    );
    
    // If we have one categorical and one numeric column, use Bar chart
    if (columns.length === 2 && numericColumns.length === 1) return 'Bar';
    
    // If we have multiple numeric columns, use Scatter
    if (numericColumns.length >= 2) return 'Scatter';
    
    // If we have categorical data with counts, use Pie for small datasets
    if (data.length <= 10 && columns.length >= 1) return 'Pie';
    
    return 'Table';
  };

  const identifyFiltersFromData = (data: any[]): string[] => {
    if (!data || data.length === 0) return [];
    
    const columns = Object.keys(data[0] || {});
    const possibleFilters: string[] = [];
    
    for (const col of columns) {
      const values = data.map(row => row[col]).filter(val => val != null);
      const uniqueValues = new Set(values);
      
      // If column has multiple values and reasonable number of unique values, it's filterable
      if (uniqueValues.size > 1 && uniqueValues.size <= 50) {
        possibleFilters.push(col);
      }
    }
    
    return possibleFilters;
  };

  const handlePinToDashboard = (analyticsData: AnalyticsData) => {
    if (onPinVisual) {
      const pinnedVisual: PinnedVisual = {
        id: Date.now().toString(),
        title: analyticsData.user_prompt || analyticsData.visual_recommendation?.chart_config?.title || 'Visual',
        chartType: analyticsData.chart_type,
        data: analyticsData.output_result,
        notes: analyticsData.insights_summary || analyticsData.notes,
        possibleFilters: analyticsData.possible_filters,
        timestamp: new Date(),
        visual_recommendation: analyticsData.visual_recommendation
      };
      onPinVisual(pinnedVisual);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    // Re-add welcome message
    const welcomeMessage: Message = {
      id: 'welcome',
      text: 'Hello! I\'m your VTA AI Assistant. I can help you explore recruitment data, analyze candidates, and answer questions about your HR system. How can I assist you today?',
      sender: 'assistant',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  return (
    <div className="vta-chatbot">
      {/* Header */}
      <div className="vta-chatbot-header">
        <div className="vta-flex vta-items-center vta-justify-between">
          <div className="vta-flex vta-items-center vta-gap-3">
            <div className="vta-logo-icon">
              <span className="vta-font-bold">V</span>
            </div>
            <div>
              <h1 className="vta-chatbot-title">
                VTA AI Assistant
              </h1>
              <p className="vta-chatbot-subtitle">
                Your HR Recruitment Data Assistant
              </p>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="vta-theme-toggle"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="vta-chatbot-messages">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onPinToDashboard={handlePinToDashboard} />
        ))}
        
        {isLoading && <TypingIndicator />}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="vta-input-bar">
        <ChatInput onSendMessage={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default ChatWindow;
