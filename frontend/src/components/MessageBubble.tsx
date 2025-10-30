import React, { useState } from 'react';
import { Message } from '../types/message';
import ChartComponent from './ChartComponent';

interface MessageBubbleProps {
  message: Message;
  onPinToDashboard?: (data: any) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onPinToDashboard }) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isUser = message.sender === 'user';
  const hasDetails = message.sqlQuery || message.queryResult;
  const hasAnalytics = message.analyticsData && message.analyticsData.output_result.length > 0;

  return (
    <div className={`vta-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="vta-message-bubble">
        {/* Message content */}
        <div className="vta-message-text">
          {message.text}
        </div>

        {/* Analytics Chart */}
        {hasAnalytics && message.analyticsData && (
          <div className="vta-analytics-container">
            <ChartComponent 
              data={message.analyticsData} 
              onPinToDashboard={onPinToDashboard}
            />
          </div>
        )}

        {/* Timestamp */}
        <div className="vta-message-time">
          {formatTime(message.timestamp)}
        </div>

        {/* SQL Details Toggle - Hidden as per requirements */}
        {false && hasDetails && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="vta-toggle-details"
          >
            {showDetails ? 'Hide Details' : 'Show SQL Details'}
          </button>
        )}

        {/* SQL Details - Hidden as per requirements */}
        {false && showDetails && hasDetails && (
          <div className="vta-message-details">
            {message.sqlQuery && (
              <div>
                <div className="vta-sql-label">SQL Query:</div>
                <pre className="vta-sql-code">
                  <code>{message.sqlQuery}</code>
                </pre>
              </div>
            )}

            {message.queryResult && (
              <div>
                <div className="vta-sql-label">Query Result:</div>
                <pre className="vta-sql-code" style={{ maxHeight: '128px' }}>
                  <code>{message.queryResult}</code>
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Error indicator */}
        {message.isError && (
          <div className="vta-flex vta-items-center vta-gap-2" style={{ marginTop: 'var(--vta-space-2)', fontSize: '0.75rem', color: 'var(--vta-error-500)' }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Error occurred
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
