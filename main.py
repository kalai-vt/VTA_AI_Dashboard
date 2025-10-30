from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Union, List, Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VTA SQL Generation API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    query: str = Field(..., description="Natural language query to convert to SQL", min_length=1, max_length=1000)
    session_id: Optional[str] = Field(None, description="Optional session ID for conversation memory")
    
    class Config:
        json_schema_extra = {
            "example": {
                "query": "Show me the top 5 candidates by revenue",
                "session_id": "optional-session-id"
            }
        }

class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    success: bool = Field(..., description="Whether the request was successful")
    user_query: str = Field(..., description="The original user query")
    sql_query: str = Field(..., description="Generated SQL query")
    query_result: str = Field(..., description="Results from SQL execution")
    response: str = Field(..., description="Formatted response for the user")
    error: Optional[str] = Field(None, description="Error message if any")

class ChartConfig(BaseModel):
    """Chart configuration model"""
    title: str = Field(..., description="Auto-generated chart title")
    description: str = Field(..., description="Short insight description")
    color_scheme: str = Field(default="auto", description="Color scheme (auto or user-preferred)")

class VisualRecommendation(BaseModel):
    """Visual recommendation model"""
    visual_type: str = Field(..., description="Visualization type (table, bar, line, combo, pie, donut, geo_map, kpi_card, scatter, heatmap, funnel)")
    x_axis: Optional[str] = Field(None, description="Dimension or category column")
    y_axis: Optional[Union[str, List[str]]] = Field(None, description="Measure or aggregated column")
    group_by: Optional[List[str]] = Field(default=None, description="Optional grouping column")
    chart_config: ChartConfig = Field(..., description="Chart configuration")

class VisualConfig(BaseModel):
    """Visualization configuration model (legacy support)"""
    x_axis: Optional[str] = Field(None, description="X-axis column name")
    y_axis: Optional[Union[str, List[str]]] = Field(None, description="Y-axis column name or list of measures")
    aggregation: Optional[Union[str, List[str]]] = Field(None, description="Aggregation type (sum, avg, count, none)")
    group_by: Optional[List[str]] = Field(default_factory=list, description="Group by column names")
    additional_options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional visualization options")

class AnalyticsResponse(BaseModel):
    """Enhanced response model for analytics endpoint with chart data"""
    success: bool = Field(..., description="Whether the request was successful")
    user_prompt: str = Field(..., description="The original user query")
    sql_query_generated: str = Field(..., description="Generated SQL query")
    output_result: list = Field(..., description="Query results as structured data")
    chart_type: str = Field(..., description="Suggested chart type (Bar, Line, Pie, Table)")
    notes: str = Field(..., description="Summary and insights about the data")
    possible_filters: list = Field(..., description="Available filter columns")
    # Legacy fields for backward compatibility
    data_summary: Optional[str] = Field(None, description="Natural language summary of the data")
    recommended_visual_type: Optional[str] = Field(None, description="Recommended visualization type (kpi_card, bar_chart, etc.)")
    visual_config: Optional[VisualConfig] = Field(None, description="Visualization configuration (legacy)")
    # New format fields
    visual_recommendation: Optional[VisualRecommendation] = Field(None, description="Visual recommendation with chart config")
    insights_summary: Optional[str] = Field(None, description="Short textual summary about trends, growth, or anomalies")
    error: Optional[str] = Field(None, description="Error message if any")

class SessionResponse(BaseModel):
    """Response model for session endpoints"""
    session_id: str = Field(..., description="Session ID")
    message: str = Field(..., description="Status message")
    success: bool = Field(..., description="Whether the operation was successful")

class ResetResponse(BaseModel):
    """Response model for reset endpoint"""
    message: str = Field(..., description="Status message")
    success: bool = Field(..., description="Whether the reset was successful")

@app.post("/api/session/create", response_model=SessionResponse)
def create_session():
    """
    Create a new session for conversation memory.
    """
    try:
        # Lazy import to avoid startup issues
        from app.services.session_memory import get_session_memory
        
        session_memory = get_session_memory()
        session_id = session_memory.create_session()
        
        logger.info(f"Created new session: {session_id}")
        return SessionResponse(
            session_id=session_id,
            message="Session created successfully",
            success=True
        )
        
    except Exception as e:
        logger.error(f"Error creating session: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create session: {str(e)}"
        )

@app.post("/api/session/{session_id}/clear", response_model=ResetResponse)
def clear_session(session_id: str):
    """
    Clear a specific session's memory.
    """
    try:
        # Lazy import to avoid startup issues
        from app.services.session_memory import get_session_memory
        
        session_memory = get_session_memory()
        session_memory.clear_session(session_id)
        
        logger.info(f"Cleared session: {session_id}")
        return ResetResponse(
            message=f"Session {session_id} cleared successfully",
            success=True
        )
        
    except Exception as e:
        logger.error(f"Error clearing session: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear session: {str(e)}"
        )

@app.get("/")
def root():
    return {"message": "VTA SQL Generation API is running", "version": "1.0.0"}

@app.get("/api/debug/session/{session_id}")
def debug_session(session_id: str):
    """
    Debug endpoint to check session memory content.
    """
    try:
        from app.services.session_memory import get_session_memory
        
        session_memory = get_session_memory()
        if session_id in session_memory.sessions:
            session_data = session_memory.sessions[session_id]
            context = session_memory.get_conversation_context(session_id)
            return {
                "session_id": session_id,
                "session_exists": True,
                "conversation_history": session_data["conversation_history"],
                "context": context,
                "session_context": session_data["context"]
            }
        else:
            return {
                "session_id": session_id,
                "session_exists": False,
                "message": "Session not found"
            }
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "sql-generation-api",
        "version": "1.0.0"
    }

@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """
    Process a natural language query using LangChain to generate and execute SQL with session memory.
    """
    try:
        logger.info(f"Processing chat request: {request.query} (Session: {request.session_id})")
        
        # Lazy import to avoid startup issues
        from app.rag.graph_chain import process_sql_query
        
        # Process the query with session memory
        result = process_sql_query(request.query, request.session_id)
        
        # Extract SQL and results from result
        sql_query = result.get("sql_query", "")
        query_result = result.get("query_result", "")
        response_text = result.get("response", "")
        
        return ChatResponse(
            success=True,
            user_query=request.query,
            sql_query=sql_query,
            query_result=query_result,
            response=response_text,
            error=None
        )
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return ChatResponse(
            success=False,
            user_query=request.query,
            sql_query="",
            query_result="",
            response=f"Sorry, I encountered an error processing your query: {str(e)}",
            error=str(e)
        )

@app.post("/api/analytics", response_model=AnalyticsResponse)
def analytics_endpoint(request: ChatRequest):
    """
    Process a natural language query and return structured analytics data with chart information.
    """
    try:
        logger.info(f"Processing analytics request: {request.query} (Session: {request.session_id})")
        
        # Lazy import to avoid startup issues
        from app.rag.graph_chain import process_analytics_query
        
        # Process the query with enhanced analytics response
        result = process_analytics_query(request.query, request.session_id)
        
        # Convert visual_config dict to VisualConfig model if present (legacy)
        visual_config = result.get("visual_config")
        if visual_config and isinstance(visual_config, dict):
            try:
                visual_config = VisualConfig(**visual_config)
            except Exception:
                visual_config = None
        elif visual_config is None:
            visual_config = None
        
        # Convert visual_recommendation dict to VisualRecommendation model if present (new format)
        visual_recommendation = result.get("visual_recommendation")
        if visual_recommendation and isinstance(visual_recommendation, dict):
            try:
                chart_config_dict = visual_recommendation.get("chart_config", {})
                if chart_config_dict:
                    visual_recommendation["chart_config"] = ChartConfig(**chart_config_dict)
                visual_recommendation = VisualRecommendation(**visual_recommendation)
            except Exception as e:
                logger.warning(f"Could not convert visual_recommendation: {e}")
                visual_recommendation = None
        else:
            visual_recommendation = None
        
        return AnalyticsResponse(
            success=result.get("success", True),
            user_prompt=request.query,
            sql_query_generated=result.get("sql_query_generated", ""),
            output_result=result.get("output_result", []),
            chart_type=result.get("chart_type", "Table"),
            notes=result.get("notes", ""),
            possible_filters=result.get("possible_filters", []),
            data_summary=result.get("data_summary"),
            recommended_visual_type=result.get("recommended_visual_type"),
            visual_config=visual_config,
            visual_recommendation=visual_recommendation,
            insights_summary=result.get("insights_summary"),
            error=result.get("error")
        )
        
    except Exception as e:
        logger.error(f"Error in analytics endpoint: {str(e)}")
        return AnalyticsResponse(
            success=False,
            user_prompt=request.query,
            sql_query_generated="",
            output_result=[],
            chart_type="Table",
            notes=f"Sorry, I encountered an error processing your query: {str(e)}",
            possible_filters=[],
            data_summary=None,
            recommended_visual_type="table_view",
            visual_config=None,
            visual_recommendation=None,
            insights_summary=None,
            error=str(e)
        )

@app.post("/api/reset", response_model=ResetResponse)
def reset_memory():
    """
    Reset the SQL service state.
    """
    try:
        # Lazy import to avoid startup issues
        from app.rag.graph_chain import close_sql_service
        
        # Reset the service
        close_sql_service()
        
        logger.info("Service reset successfully")
        return ResetResponse(
            message="SQL service has been reset successfully",
            success=True
        )
        
    except Exception as e:
        logger.error(f"Error resetting service: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset service: {str(e)}"
        )
