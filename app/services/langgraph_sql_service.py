"""
LangGraph-based SQL Service for VTA AI Dashboard
Simplified implementation
"""

import logging
from typing import Dict, Any
from app.rag.langgraph_agent import process_chat_with_langgraph
from app.services.session_memory import get_session_memory

logger = logging.getLogger(__name__)


class LangGraphSQLService:
    """
    LangGraph-based SQL service that provides:
    - AI agentic behavior
    - Conversation memory
    - SQL generation with database metadata
    - Welcome message handling
    - SELECT-only query validation
    """

    def __init__(self):
        self.session_memory = get_session_memory()
        logger.info("LangGraph SQL Service initialized")

    def process_query(self, user_query: str, session_id: str = None) -> Dict[str, Any]:
        """
        Process a natural language query.
        
        Args:
            user_query: Natural language query from user
            session_id: Optional session ID for conversation memory
            
        Returns:
            Dict containing SQL query, results, and formatted response
        """
        try:
            logger.info(f"Processing query: {user_query} (Session: {session_id})")
            
            # Create session if not provided
            if not session_id:
                session_id = self.session_memory.create_session()
            
            # Process with simple LangGraph implementation
            result = process_chat_with_langgraph(user_query, session_id)
            
            logger.info("Query processed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error processing query: {str(e)}")
            return {
                "sql_query": "",
                "query_result": "",
                "response": f"Sorry, I encountered an error processing your query: {str(e)}"
            }

    def close(self):
        """Close the service and cleanup"""
        logger.info("LangGraph SQL Service closed")


# Global instance
langgraph_service = None


def get_langgraph_sql_service():
    """Get or create the LangGraph SQL service instance"""
    global langgraph_service
    if langgraph_service is None:
        langgraph_service = LangGraphSQLService()
    return langgraph_service

