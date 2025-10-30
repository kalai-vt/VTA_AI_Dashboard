from app.services.langgraph_sql_service import get_langgraph_sql_service
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

def process_sql_query(user_query: str, session_id: str = None) -> Dict[str, Any]:
    """
    Process a natural language query using LangGraph framework to generate and execute SQL with session memory.
    
    Args:
        user_query (str): Natural language query from user
        session_id (str): Optional session ID for conversation memory
        
    Returns:
        Dict[str, Any]: Response containing SQL query, results, and formatted response
    """
    try:
        logger.info(f"Processing SQL query with LangGraph: {user_query} (Session: {session_id})")
        service = get_langgraph_sql_service()
        result = service.process_query(user_query, session_id)
        logger.info("Successfully processed SQL query with LangGraph")
        return result
    except Exception as e:
        logger.error(f"Error processing SQL query: {str(e)}")
        return {
            "sql_query": "",
            "query_result": "",
            "response": f"Sorry, I encountered an error processing your query: {str(e)}"
        }

def process_analytics_query(user_query: str, session_id: str = None) -> Dict[str, Any]:
    """
    Process a natural language query and return structured analytics data with chart information.
    Uses the intelligent visualization service to determine the best visual representation.
    
    Args:
        user_query (str): Natural language query from user
        session_id (str): Optional session ID for conversation memory
        
    Returns:
        Dict[str, Any]: Enhanced response with chart data, filters, and insights
    """
    try:
        logger.info(f"Processing analytics query: {user_query} (Session: {session_id})")
        
        # Import visualization service
        from app.services.visualization_service import recommend_visualization, format_visualization_response
        
        # First get the basic SQL processing result
        basic_result = process_sql_query(user_query, session_id)
        
        if not basic_result.get("sql_query"):
            # Handle non-SQL queries (greetings, etc.) - still return visualization structure
            response_text = basic_result.get("response", "")
            return {
                "success": True,
                "sql_query_generated": "",
                "output_result": [],
                "chart_type": "Table",
                "notes": response_text,
                "possible_filters": [],
                "data_summary": response_text,
                "recommended_visual_type": "text_block",
                "visual_config": None,
                "visual_recommendation": {
                    "visual_type": "text_block",
                    "x_axis": None,
                    "y_axis": None,
                    "group_by": None,
                    "chart_config": {
                        "title": "Response",
                        "description": response_text,
                        "color_scheme": "auto"
                    }
                },
                "insights_summary": response_text
            }
        
        # Extract and parse the query results
        sql_query = basic_result.get("sql_query", "")
        query_result_str = basic_result.get("query_result", "")
        
        # Parse JSON results if available
        output_result = []
        try:
            if query_result_str and query_result_str != "No results found.":
                import json
                # Handle both string and already parsed JSON
                if isinstance(query_result_str, str):
                    output_result = json.loads(query_result_str)
                else:
                    output_result = query_result_str
        except (json.JSONDecodeError, TypeError):
            # If not JSON, try to parse as string
            output_result = []
        
        # Use intelligent visualization service to get recommendations
        viz_response = recommend_visualization(
            user_query=user_query,
            sql_query=sql_query,
            query_result=output_result
        )
        
        # Format response for API compatibility (backward compatible with old format)
        formatted_response = format_visualization_response(viz_response)
        
        # Ensure visual_recommendation is always included
        if "visual_recommendation" not in formatted_response or not formatted_response["visual_recommendation"]:
            formatted_response["visual_recommendation"] = viz_response.get("visual_recommendation", {
                "visual_type": "table",
                "x_axis": None,
                "y_axis": None,
                "group_by": None,
                "chart_config": {
                    "title": "Data Table",
                    "description": "Data visualization",
                    "color_scheme": "auto"
                }
            })
        
        # Ensure all required fields are present
        formatted_response["user_prompt"] = user_query
        formatted_response["sql_query_generated"] = sql_query
        formatted_response["output_result"] = output_result
        
        # Ensure success is True if we got this far (we have a query and processed it)
        formatted_response["success"] = True
        
        logger.info(f"Analytics processing completed. Visual type: {formatted_response.get('recommended_visual_type')}")
        
        return formatted_response
        
    except Exception as e:
        logger.error(f"Error processing analytics query: {str(e)}")
        return {
            "success": False,
            "sql_query_generated": "",
            "output_result": [],
            "chart_type": "Table",
            "notes": f"Sorry, I encountered an error processing your query: {str(e)}",
            "possible_filters": [],
            "data_summary": f"Error: {str(e)}",
            "recommended_visual_type": "table_view",
            "visual_config": None,
            "visual_recommendation": {
                "visual_type": "table",
                "x_axis": None,
                "y_axis": None,
                "group_by": None,
                "chart_config": {
                    "title": "Error",
                    "description": f"Error processing query: {str(e)}",
                    "color_scheme": "auto"
                }
            },
            "insights_summary": f"Error: {str(e)}",
            "error": str(e)
        }

def get_sql_service_instance():
    """
    Get the SQL service instance.
    
    Returns:
        LangGraphSQLService: The initialized LangGraph SQL service
    """
    return get_langgraph_sql_service()

def close_sql_service():
    """Close the SQL service and its connections"""
    try:
        service = get_langgraph_sql_service()
        service.close()
        logger.info("LangGraph SQL service closed successfully")
    except Exception as e:
        logger.error(f"Error closing SQL service: {str(e)}")

def determine_chart_type(user_query: str, data: list) -> str:
    """
    Determine the best chart type based on user query and data structure.
    
    Args:
        user_query: The original user query
        data: The query results as a list of dictionaries
        
    Returns:
        str: Chart type (Bar, Line, Pie, Table, Scatter)
    """
    if not data:
        return "Table"
    
    query_lower = user_query.lower()
    
    # Check for specific chart type requests
    if "pie" in query_lower or "percentage" in query_lower or "proportion" in query_lower:
        return "Pie"
    elif "line" in query_lower or "trend" in query_lower or "over time" in query_lower:
        return "Line"
    elif "scatter" in query_lower or "correlation" in query_lower:
        return "Scatter"
    elif "bar" in query_lower or "chart" in query_lower:
        return "Bar"
    
    # Analyze data structure to determine best chart type
    if len(data) == 0:
        return "Table"
    
    # Get column names
    columns = list(data[0].keys()) if data else []
    
    # Check for time-based data
    time_columns = [col for col in columns if any(time_word in col.lower() for time_word in 
                   ['date', 'time', 'month', 'year', 'day', 'created', 'updated'])]
    
    if time_columns and len(data) > 1:
        return "Line"
    
    # Check for categorical data with counts
    numeric_columns = []
    categorical_columns = []
    
    for col in columns:
        if data and isinstance(data[0].get(col), (int, float)):
            numeric_columns.append(col)
        else:
            categorical_columns.append(col)
    
    # If we have one categorical and one numeric column, use Bar chart
    if len(categorical_columns) == 1 and len(numeric_columns) == 1:
        return "Bar"
    
    # If we have multiple numeric columns, use Scatter
    if len(numeric_columns) >= 2:
        return "Scatter"
    
    # If we have categorical data with counts, use Pie for small datasets
    if len(data) <= 10 and len(categorical_columns) >= 1:
        return "Pie"
    
    # Default to Table for complex data
    return "Table"

def generate_insights(user_query: str, data: list, sql_query: str) -> str:
    """
    Generate insights and notes based on the query results.
    
    Args:
        user_query: The original user query
        data: The query results as a list of dictionaries
        sql_query: The generated SQL query
        
    Returns:
        str: Formatted insights and notes
    """
    if not data:
        return f"No data found for your query: '{user_query}'. The generated SQL was: {sql_query}"
    
    insights = []
    
    # Basic data summary
    total_records = len(data)
    insights.append(f"Found {total_records} record{'s' if total_records != 1 else ''}.")
    
    # Analyze the data structure
    if data:
        columns = list(data[0].keys())
        
        # Look for numeric columns to provide statistics
        numeric_columns = []
        for col in columns:
            if isinstance(data[0].get(col), (int, float)):
                numeric_columns.append(col)
        
        # Provide insights for numeric data
        for col in numeric_columns:
            values = [row.get(col) for row in data if row.get(col) is not None]
            if values:
                try:
                    min_val = min(values)
                    max_val = max(values)
                    avg_val = sum(values) / len(values)
                    insights.append(f"{col}: Min={min_val}, Max={max_val}, Avg={avg_val:.2f}")
                except:
                    pass
        
        # Look for categorical patterns
        categorical_columns = [col for col in columns if col not in numeric_columns]
        for col in categorical_columns[:2]:  # Limit to first 2 categorical columns
            values = [row.get(col) for row in data if row.get(col) is not None]
            if values:
                from collections import Counter
                most_common = Counter(values).most_common(3)
                if most_common:
                    top_values = ", ".join([f"{val} ({count})" for val, count in most_common])
                    insights.append(f"Top {col} values: {top_values}")
    
    # Add query context
    insights.append(f"Query: {user_query}")
    
    return " | ".join(insights)

def identify_filters(data: list) -> list:
    """
    Identify possible filter columns based on the query results.
    
    Args:
        data: The query results as a list of dictionaries
        
    Returns:
        list: List of column names that could be used as filters
    """
    if not data:
        return []
    
    columns = list(data[0].keys())
    possible_filters = []
    
    for col in columns:
        # Check if column has multiple distinct values
        values = [row.get(col) for row in data if row.get(col) is not None]
        unique_values = set(values)
        
        # If column has multiple values and reasonable number of unique values, it's filterable
        if len(unique_values) > 1 and len(unique_values) <= 50:
            possible_filters.append(col)
    
    return possible_filters

################ USAGE EXAMPLE #######################
"""
from app.rag.graph_chain import process_sql_query

# Process a natural language query
result = process_sql_query("Show me the top 5 customers by revenue")
print(f"SQL Query: {result['sql_query']}")
print(f"Results: {result['query_result']}")
print(f"Response: {result['response']}")
"""