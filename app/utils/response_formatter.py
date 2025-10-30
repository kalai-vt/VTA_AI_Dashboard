"""
Natural Language Response Formatter for SQL Query Results
Formats database query results into user-friendly natural language responses
"""

import logging
from typing import Dict, Any, List, Optional
import re

logger = logging.getLogger(__name__)


def detect_query_type(user_query: str, result_count: int) -> str:
    """
    Detect the type of query based on user query and result count.
    
    Returns:
        'entity_lookup': Single entity search (e.g., "Is there any candidate named...")
        'list_query': Multiple results query
        'aggregation': Count/sum/avg queries
        'general': General query
    """
    query_lower = user_query.lower()
    
    # Entity lookup patterns
    lookup_patterns = [
        r'is there (any|a)',
        r'does.*exist',
        r'find.*named',
        r'search.*for',
        r'who is',
        r'what is',
        r'look.*for',
        r'check.*if',
        r'exist',
        r'found'
    ]
    
    # Check if it's an entity lookup query
    for pattern in lookup_patterns:
        if re.search(pattern, query_lower):
            return 'entity_lookup'
    
    # Aggregation patterns
    if any(word in query_lower for word in ['count', 'total', 'sum', 'average', 'avg', 'how many']):
        return 'aggregation'
    
    # List query (default for multiple results)
    if result_count > 1:
        return 'list_query'
    
    return 'general'


def format_entity_lookup_response(user_query: str, results: List[Dict[str, Any]], sql_query: str) -> str:
    """
    Format response for entity lookup queries (single record searches).
    
    Args:
        user_query: Original user query
        results: Query results
        sql_query: Generated SQL query
        
    Returns:
        Formatted natural language response
    """
    if not results or len(results) == 0:
        # Extract entity name from query if possible
        entity_match = re.search(r'(?:named|called|with name)\s+([A-Za-z\s]+)', user_query, re.IGNORECASE)
        entity_name = entity_match.group(1).strip() if entity_match else "the requested entity"
        
        return f"❌ No candidate named {entity_name} was found in the database."
    
    # Single record found
    if len(results) == 1:
        record = results[0]
        
        # Extract entity name
        name_fields = ['name', 'first_name', 'full_name', 'candidate_name', 'last_name']
        entity_name = None
        for field in name_fields:
            if field in record and record[field]:
                entity_name = str(record[field])
                break
        
        if not entity_name:
            # Try to find any field that might be a name
            for key, value in record.items():
                if isinstance(value, str) and len(value) < 50:
                    entity_name = value
                    break
        
        entity_name = entity_name or "the candidate"
        
        # Build response
        response_parts = [f"✅ Yes, there is a candidate named {entity_name}"]
        
        # Add key details
        details = []
        detail_fields = {
            'designation': 'Role',
            'role': 'Role',
            'current_designation': 'Role',
            'position': 'Role',
            'experience': 'Experience',
            'years_of_experience': 'Experience',
            'location': 'Location',
            'current_location': 'Location',
            'city': 'Location',
            'status': 'Status',
            'candidate_status': 'Status',
            'email': 'Email',
            'phone': 'Phone',
            'department': 'Department'
        }
        
        for field, label in detail_fields.items():
            if field in record and record[field]:
                details.append(f"{label}: {record[field]}")
        
        if details:
            response_parts.append("\n" + "\n".join(details))
        
        return "".join(response_parts)
    
    # Multiple records found
    else:
        return f"✅ Found {len(results)} candidates matching your query:\n\n" + format_list_response(results[:5], sql_query)


def format_list_response(results: List[Dict[str, Any]], sql_query: str) -> str:
    """
    Format response for list queries (multiple results).
    """
    formatted_results = []
    for i, row in enumerate(results[:10], 1):
        # Format each row nicely
        row_str = ", ".join([f"{k.replace('_', ' ').title()}: {v}" for k, v in row.items() if v is not None])
        formatted_results.append(f"{i}. {row_str}")
    
    if len(results) > 10:
        formatted_results.append(f"\n... and {len(results) - 10} more results")
    
    return "\n".join(formatted_results)


def format_aggregation_response(user_query: str, results: List[Dict[str, Any]], sql_query: str) -> str:
    """
    Format response for aggregation queries (count, sum, avg, etc.).
    """
    if not results or len(results) == 0:
        return "No data found for your query."
    
    # If result is a single row with aggregated values
    if len(results) == 1:
        record = results[0]
        response_parts = ["Here are your results:"]
        
        for key, value in record.items():
            formatted_key = key.replace('_', ' ').replace('COUNT', 'Count').replace('SUM', 'Sum').replace('AVG', 'Average').title()
            response_parts.append(f"{formatted_key}: {value}")
        
        return "\n".join(response_parts)
    
    # Multiple grouped results
    return format_list_response(results, sql_query)


def format_natural_language_response(
    user_query: str,
    results: List[Dict[str, Any]],
    sql_query: str = ""
) -> str:
    """
    Main function to format SQL query results into natural language responses.
    
    Args:
        user_query: Original user query
        results: Query results (list of dicts)
        sql_query: Generated SQL query (optional)
        
    Returns:
        Formatted natural language response
    """
    try:
        result_count = len(results) if results else 0
        query_type = detect_query_type(user_query, result_count)
        
        logger.info(f"Detected query type: {query_type}, Result count: {result_count}")
        
        if query_type == 'entity_lookup':
            response = format_entity_lookup_response(user_query, results, sql_query)
        elif query_type == 'aggregation':
            response = format_aggregation_response(user_query, results, sql_query)
        elif result_count == 0:
            # No results found
            response = "I couldn't find any matching records for your request. It's possible that the data hasn't been added yet or the details you mentioned are slightly different."
        elif result_count == 1:
            # Single result - format nicely
            record = results[0]
            response_parts = ["Found the following record:"]
            for key, value in record.items():
                formatted_key = key.replace('_', ' ').title()
                response_parts.append(f"{formatted_key}: {value}")
            response = "\n".join(response_parts)
        else:
            # Multiple results
            response = f"Found {result_count} records:\n\n" + format_list_response(results, sql_query)
        
        # Optionally append SQL query (for debugging, but usually not needed in production)
        # if sql_query and not response.endswith(sql_query):
        #     response += f"\n\nGenerated SQL: {sql_query}"
        
        return response
        
    except Exception as e:
        logger.error(f"Error formatting response: {str(e)}")
        # Fallback to basic formatting
        if results and len(results) > 0:
            return format_list_response(results, sql_query)
        return "I processed your query, but encountered an issue formatting the response."

