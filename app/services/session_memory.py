import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import uuid

logger = logging.getLogger(__name__)

class SessionMemory:
    """
    Session memory service to maintain conversation context across requests.
    This allows the LLM to remember previous queries and provide contextual responses.
    """

    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.session_timeout = timedelta(hours=24)  # Session expires after 24 hours

    def create_session(self, session_id: Optional[str] = None) -> str:
        """Create a new session or return existing session ID"""
        if session_id is None:
            session_id = str(uuid.uuid4())
        
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "created_at": datetime.now(),
                "last_accessed": datetime.now(),
                "conversation_history": [],
                "context": {
                    "current_candidate": None,
                    "current_job": None,
                    "current_requisition": None,
                    "last_query_type": None,
                    "last_query_result": None
                }
            }
            logger.info(f"Created new session: {session_id}")
        else:
            self.sessions[session_id]["last_accessed"] = datetime.now()
            logger.info(f"Accessed existing session: {session_id}")
        
        return session_id

    def add_to_conversation(self, session_id: str, user_query: str, sql_query: str, 
                          query_result: str, response: str) -> None:
        """Add a conversation turn to the session memory"""
        if session_id not in self.sessions:
            self.create_session(session_id)
        
        conversation_turn = {
            "timestamp": datetime.now().isoformat(),
            "user_query": user_query,
            "sql_query": sql_query,
            "query_result": query_result,
            "response": response
        }
        
        self.sessions[session_id]["conversation_history"].append(conversation_turn)
        self.sessions[session_id]["last_accessed"] = datetime.now()
        
        # Update context based on the query
        self._update_context(session_id, user_query, sql_query, query_result)
        
        # Keep only last 20 conversation turns to prevent memory bloat
        if len(self.sessions[session_id]["conversation_history"]) > 20:
            self.sessions[session_id]["conversation_history"] = \
                self.sessions[session_id]["conversation_history"][-20:]
        
        logger.info(f"Added conversation turn to session {session_id}")

    def get_conversation_context(self, session_id: str) -> str:
        """Get formatted conversation context for the LLM"""
        if session_id not in self.sessions:
            return ""
        
        session = self.sessions[session_id]
        context = "CONVERSATION HISTORY:\n"
        
        # Add recent conversation history
        recent_turns = session["conversation_history"][-3:]  # Last 3 turns
        for i, turn in enumerate(recent_turns):
            context += f"Turn {i+1}:\n"
            context += f"User: {turn['user_query']}\n"
            context += f"SQL: {turn['sql_query']}\n"
            
            # Extract candidate info from previous results (handle JSON format)
            if "candidate_id" in turn['query_result']:
                try:
                    import json
                    # Try to parse as JSON
                    if turn['query_result'].startswith('[') or turn['query_result'].startswith('{'):
                        result_data = json.loads(turn['query_result'])
                        if isinstance(result_data, list) and len(result_data) > 0:
                            first_candidate = result_data[0]
                            if 'candidate_id' in first_candidate:
                                context += f"Available candidate_id: {first_candidate['candidate_id']}\n"
                                context += f"First candidate: {first_candidate.get('first_name', '')} {first_candidate.get('last_name', '')}\n"
                    else:
                        # Handle text format
                        lines = turn['query_result'].split('\n')
                        for line in lines:
                            if "candidate_id:" in line:
                                candidate_id = line.split("candidate_id:")[1].split(",")[0].strip()
                                context += f"Available candidate_id: {candidate_id}\n"
                                break
                except Exception as e:
                    # Fallback to text parsing
                    if "candidate_id:" in turn['query_result']:
                        lines = turn['query_result'].split('\n')
                        for line in lines:
                            if "candidate_id:" in line:
                                candidate_id = line.split("candidate_id:")[1].split(",")[0].strip()
                                context += f"Available candidate_id: {candidate_id}\n"
                                break
            context += "\n"
        
        # Add current context
        context += "CURRENT CONTEXT:\n"
        if session["context"]["current_candidate"]:
            context += f"Current candidate: {session['context']['current_candidate']}\n"
        if session["context"]["current_job"]:
            context += f"Current job: {session['context']['current_job']}\n"
        if session["context"]["last_query_type"]:
            context += f"Last query type: {session['context']['last_query_type']}\n"
        
        # Add specific instructions for follow-up questions
        if recent_turns:
            context += "\nIMPORTANT INSTRUCTIONS:\n"
            context += "1. If the user asks about 'this candidate' or 'the candidate', use the candidate_id from the previous query results above.\n"
            context += "2. Look for 'Available candidate_id: X' in the conversation history to get the specific ID.\n"
            context += "3. Generate SQL like: SELECT phone FROM Candidate_Profile WHERE candidate_id = X AND isDelete = 0\n"
            context += "4. NEVER ask for more information - always use the context provided above.\n"
        
        return context

    def _update_context(self, session_id: str, user_query: str, sql_query: str, query_result: str) -> None:
        """Update session context based on the current query"""
        session = self.sessions[session_id]
        context = session["context"]
        
        # Detect query type
        query_lower = user_query.lower()
        if "candidate" in query_lower:
            context["last_query_type"] = "candidate"
        elif "job" in query_lower or "posting" in query_lower:
            context["last_query_type"] = "job"
        elif "interview" in query_lower:
            context["last_query_type"] = "interview"
        elif "offer" in query_lower:
            context["last_query_type"] = "offer"
        
        # Extract candidate information if present
        if "candidate" in query_lower and query_result and "first_name" in query_result:
            try:
                # Try to extract candidate name from query result
                if "candidate_id" in query_result and "first_name" in query_result:
                    # Parse the result to extract candidate info
                    lines = query_result.split('\n')
                    for line in lines:
                        if "first_name:" in line and "last_name:" in line:
                            # Extract name from line like "first_name: John, last_name: Smith"
                            parts = line.split(',')
                            first_name = None
                            last_name = None
                            for part in parts:
                                if "first_name:" in part:
                                    first_name = part.split(":")[1].strip()
                                elif "last_name:" in part:
                                    last_name = part.split(":")[1].strip()
                            if first_name and last_name:
                                context["current_candidate"] = f"{first_name} {last_name}"
                                break
            except Exception as e:
                logger.warning(f"Could not extract candidate info: {e}")
        
        # Store last query result for reference
        context["last_query_result"] = query_result[:500]  # Store first 500 chars

    def clear_session(self, session_id: str) -> None:
        """Clear a specific session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Cleared session: {session_id}")

    def clear_expired_sessions(self) -> None:
        """Clear expired sessions"""
        current_time = datetime.now()
        expired_sessions = []
        
        for session_id, session_data in self.sessions.items():
            if current_time - session_data["last_accessed"] > self.session_timeout:
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            del self.sessions[session_id]
            logger.info(f"Cleared expired session: {session_id}")

    def get_session_stats(self) -> Dict[str, Any]:
        """Get statistics about active sessions"""
        return {
            "total_sessions": len(self.sessions),
            "active_sessions": len([s for s in self.sessions.values() 
                                 if datetime.now() - s["last_accessed"] < timedelta(hours=1)]),
            "total_conversations": sum(len(s["conversation_history"]) for s in self.sessions.values())
        }


# Global memory instance
session_memory = SessionMemory()

def get_session_memory():
    """Get the global session memory instance"""
    return session_memory
