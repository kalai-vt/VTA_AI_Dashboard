import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="vta-message assistant">
      <div className="vta-typing-indicator">
        <span className="vta-text-sm" style={{ color: 'var(--vta-gray-600)' }}>VTA Assistant is typing</span>
        <div className="vta-typing-dots">
          <div className="vta-typing-dot" style={{ animationDelay: '0s' }}></div>
          <div className="vta-typing-dot" style={{ animationDelay: '0.2s' }}></div>
          <div className="vta-typing-dot" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
