"""
LangGraph Agent Implementation for VTA AI Dashboard
Simplified implementation using LLM-based intent classification
"""

from typing import Dict, Any
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.tools.sql_tool import SQLTool
from app.services.session_memory import get_session_memory
from app.services.metadata_service import get_metadata_service
from app.config.settings import settings
from app.rag.intent_classifier_prompt import INTENT_CLASSIFIER_SYSTEM_PROMPT
from app.utils.security import SecurityValidator, validate_and_sanitize_query
import json
import re

logger = logging.getLogger(__name__)


def classify_intent(user_query: str, schema_context: str, conversation_context: str) -> Dict[str, Any]:
    """
    Use LLM to classify user intent and generate appropriate response
    Returns: {"intent": "SQL_GENERATE"|"GREETING"|"OUT_OF_FOCUS", "response": str}
    """
    try:
        llm = ChatOpenAI(
            api_key=settings.OPENAI_API_KEY,
            model="gpt-4",
            temperature=0
        )
        
        # Prepare the prompt with context
        full_prompt = f"""{INTENT_CLASSIFIER_SYSTEM_PROMPT}

=== DATABASE SCHEMA ===
{schema_context}

=== CONVERSATION CONTEXT ===
{conversation_context}

=== USER QUERY ===
{user_query}

Now classify this query and respond with JSON only."""

        response = llm.invoke([
            SystemMessage(content=INTENT_CLASSIFIER_SYSTEM_PROMPT),
            HumanMessage(content=f"Schema context: {schema_context}\n\nConversation context: {conversation_context}\n\nUser query: {user_query}\n\nNow classify this query and respond with JSON only.")
        ])
        
        # Parse JSON from response
        content = response.content.strip()
        
        # Extract JSON if it's wrapped in markdown
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            json_str = content
        
        result = json.loads(json_str)
        logger.info(f"Intent classified as: {result.get('intent')}")
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response was: {content}")
        # Fallback to SQL_GENERATE if JSON parsing fails
        return {
            "intent": "SQL_GENERATE",
            "response": "SELECT * FROM Candidate_Profile WHERE isDelete = 0 LIMIT 1"
        }
    except Exception as e:
        logger.error(f"Error in intent classification: {str(e)}")
        raise


def process_query_with_intent(user_query: str, session_id: str = None) -> Dict[str, Any]:
    """
    Process user query using LLM-based intent classification
    """
    try:
        logger.info(f"Processing query: {user_query} (Session: {session_id})")
        
        # SECURITY: Validate user input first to prevent SQL injection
        is_valid_input, validation_error = SecurityValidator.validate_user_input(user_query)
        if not is_valid_input:
            logger.warning(f"Invalid user input detected: {validation_error}")
            return {
                "sql_query": "",
                "query_result": "",
                "response": f"Security: {validation_error}. Please rephrase your query in natural language."
            }
        
        session_memory = get_session_memory()
        metadata_service = get_metadata_service()
        
        # Get conversation context if session exists
        conversation_context = ""
        if session_id:
            conversation_context = session_memory.get_conversation_context(session_id)
            logger.info(f"Conversation context retrieved for session: {session_id}")
        
        # Get database schema
        schema_context = metadata_service.get_schema_context()
        
        # Classify intent using LLM
        intent_result = classify_intent(user_query, schema_context, conversation_context)
        
        intent = intent_result.get("intent", "SQL_GENERATE")
        response_content = intent_result.get("response", "")
        
        # Handle based on intent
        if intent == "GREETING":
            # Return greeting response directly
            response_text = response_content
            
            # Add to conversation history
            if session_id:
                session_memory.add_to_conversation(
                    session_id,
                    user_query,
                    "",
                    "",
                    response_text
                )
            
            return {
                "sql_query": "",
                "query_result": "",
                "response": response_text
            }
        
        elif intent == "OUT_OF_FOCUS":
            # Return out-of-focus response directly
            response_text = response_content
            
            # Add to conversation history
            if session_id:
                session_memory.add_to_conversation(
                    session_id,
                    user_query,
                    "",
                    "",
                    response_text
                )
            
            return {
                "sql_query": "",
                "query_result": "",
                "response": response_text
            }
        
        elif intent == "SQL_GENERATE":
            # Extract and clean SQL query
            sql_query = response_content.strip()
            
            # Remove markdown if present
            if "```sql" in sql_query:
                sql_query = sql_query.split("```sql")[1].split("```")[0].strip()
            elif "```" in sql_query:
                sql_query = sql_query.split("```")[1].split("```")[0].strip()
            
            # Remove "SQL:" prefix if present
            if sql_query.upper().startswith("SQL:"):
                sql_query = sql_query.split(":", 1)[1].strip()
            
            # Remove quotes
            sql_query = sql_query.strip('\'"')
            
            logger.info(f"Generated SQL: {sql_query}")
            
            # SECURITY: Sanitize and validate generated SQL before execution
            is_valid_sql, sql_error = SecurityValidator.sanitize_generated_sql(sql_query)
            if not is_valid_sql:
                logger.error(f"Generated SQL failed security validation: {sql_error}")
                return {
                    "sql_query": sql_query,
                    "query_result": "",
                    "response": f"Security Error: The generated query contains potentially unsafe operations. {sql_error}"
                }
            
            # Execute SQL query
            try:
                sql_tool = SQLTool()
                results = sql_tool.run_query(sql_query)
                sql_tool.close()
                
                # Format response for user using natural language formatter
                from app.utils.response_formatter import format_natural_language_response
                
                if isinstance(results, dict) and "error" in results:
                    error_msg = results.get("error", "")
                    if "Only SELECT queries are allowed" in error_msg:
                        response_text = "Sorry, I can only process safe SELECT queries for insights — modifying data isn't allowed."
                    else:
                        response_text = "I couldn't find any matching records for your request."
                    query_result_str = ""
                elif isinstance(results, list):
                    # Use natural language formatter
                    query_result_str = json.dumps(results, indent=2, default=str) if results else "No results found."
                    response_text = format_natural_language_response(user_query, results, sql_query)
                else:
                    # No results found
                    query_result_str = "No results found."
                    response_text = format_natural_language_response(user_query, [], sql_query)
                
                # Add to conversation history
                if session_id:
                    session_memory.add_to_conversation(
                        session_id,
                        user_query,
                        sql_query,
                        query_result_str,
                        response_text
                    )
                
                return {
                    "sql_query": sql_query,
                    "query_result": query_result_str,
                    "response": response_text
                }
                
            except Exception as sql_error:
                logger.error(f"Error executing SQL: {str(sql_error)}")
                return {
                    "sql_query": sql_query,
                    "query_result": "",
                    "response": f"Sorry, I encountered an error executing the query: {str(sql_error)}"
                }
        
        else:
            # Unknown intent, default to SQL_GENERATE
            logger.warning(f"Unknown intent: {intent}, defaulting to SQL processing")
            return {
                "sql_query": "",
                "query_result": "",
                "response": "I didn't quite understand that. Could you please rephrase your question about recruitment or HR data?"
            }
            
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        return {
            "sql_query": "",
            "query_result": "",
            "response": f"Sorry, I encountered an error processing your query: {str(e)}"
        }


def process_chat_with_langgraph(user_query: str, session_id: str = None) -> dict:
    """
    Process a chat query - main entry point
    """
    return process_query_with_intent(user_query, session_id)
