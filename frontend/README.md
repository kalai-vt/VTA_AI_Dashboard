# VTA AI Assistant Frontend

A modern React chatbot interface for the VTA AI Assistant, designed to interact with HR recruitment data through natural language queries.

## 🚀 Features

- **Modern Chat Interface**: Clean, ChatGPT-like UI with message bubbles and typing indicators
- **Real-time Communication**: Seamless integration with the VTA backend API
- **Session Management**: Persistent conversation history and session tracking
- **SQL Query Visibility**: Optional display of generated SQL queries and results
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS
- **Error Handling**: Graceful error states and user feedback
- **Auto-scroll**: Automatic scrolling to latest messages
- **Message Persistence**: Local storage for conversation history

## 🛠️ Tech Stack

- **React 19** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls

## 📦 Installation

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and configure:
   ```env
   VITE_BACKEND_URL=http://localhost:8000
   VITE_APP_TITLE=VTA AI Assistant
   ```

## 🚀 Development

### Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for production:
```bash
npm run build
```

### Preview production build:
```bash
npm run preview
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Backend API base URL | `http://localhost:8000` |
| `VITE_APP_TITLE` | Application title | `VTA AI Assistant` |

### Backend Integration

The frontend communicates with the VTA backend through these endpoints:

- `POST /api/session/create` - Create new chat session
- `POST /api/chat` - Send message and receive response
- `POST /api/session/{session_id}/reset` - Reset session

## 🎨 UI Components

### Core Components

- **`ChatWindow`** - Main chat container with header and message list
- **`MessageBubble`** - Individual message display with user/assistant styling
- **`ChatInput`** - Text input with send button and auto-resize
- **`TypingIndicator`** - Animated typing indicator for assistant responses

### Features

- **Message Types**: User messages (right-aligned, blue), Assistant messages (left-aligned, white)
- **SQL Details**: Expandable sections showing generated SQL queries and results
- **Error States**: Clear error messaging with retry options
- **Loading States**: Spinner animations during API calls
- **Responsive Design**: Mobile-optimized layout

## 🔄 State Management

The application uses React hooks for state management:

- **Messages**: Array of chat messages with timestamps and metadata
- **Session**: Session ID for conversation continuity
- **Loading**: Loading states for API calls
- **Error**: Error handling and user feedback

## 📱 Responsive Design

The interface is fully responsive and works on:

- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Netlify

1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify
3. Configure environment variables

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /path/to/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔒 Security Considerations

- **CORS**: Backend must be configured to allow frontend domain
- **HTTPS**: Use HTTPS in production for secure communication
- **Environment Variables**: Never commit sensitive data to version control
- **Input Validation**: Frontend validates input length and format

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend allows frontend domain
2. **API Connection**: Verify `VITE_BACKEND_URL` is correct
3. **Build Errors**: Check Node.js version compatibility
4. **Styling Issues**: Ensure Tailwind CSS is properly configured

### Development Tips

- Use browser dev tools to inspect API calls
- Check console for error messages
- Verify environment variables are loaded
- Test with different screen sizes

## 📝 API Integration

The frontend expects the backend to return responses in this format:

```typescript
interface ChatResponse {
  success: boolean;
  user_query: string;
  sql_query: string;
  query_result: string;
  response: string;
  error?: string;
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of the VTA AI Instance Dashboard system.