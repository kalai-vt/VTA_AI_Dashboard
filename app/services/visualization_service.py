"""
Intelligent Visualization Service for VTA Analytics Dashboard
Automatically determines the best visualization type and configuration based on query results.
"""

import logging
from typing import Dict, List, Any, Optional, Union, Tuple
from collections import Counter
import re

logger = logging.getLogger(__name__)

# Keywords for detecting funnel patterns
FUNNEL_STAGE_KEYWORDS = [
    'stage', 'step', 'phase', 'level', 'status', 'state', 'funnel',
    'pipeline', 'process', 'workflow', 'journey'
]


def is_numeric(value: Any) -> bool:
    """Check if a value is numeric (int, float, or numeric string)"""
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False
    return False


def analyze_data_structure(query_result: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze the structure of query results to identify column types.
    
    Returns:
        Dict with 'numeric_columns', 'categorical_columns', 'date_columns', 'geo_columns'
    """
    if not query_result or len(query_result) == 0:
        return {
            'numeric_columns': [],
            'categorical_columns': [],
            'date_columns': [],
            'geo_columns': []
        }
    
    columns = list(query_result[0].keys())
    numeric_cols = []
    categorical_cols = []
    date_cols = []
    geo_cols = []
    
    for col in columns:
        # Check first few rows to determine column type
        sample_values = [row.get(col) for row in query_result[:10] if row.get(col) is not None]
        
        if not sample_values:
            categorical_cols.append(col)
            continue
        
        # Check for numeric columns
        numeric_count = sum(1 for val in sample_values if is_numeric(val))
        if numeric_count >= len(sample_values) * 0.8:  # 80% numeric
            numeric_cols.append(col)
            continue
        
        # Check for date columns
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in ['date', 'time', 'created', 'updated', 'timestamp']):
            date_cols.append(col)
            continue
        
        # Check for geographic columns
        if any(keyword in col_lower for keyword in ['location', 'city', 'country', 'state', 'region', 'geo', 'address', 'place']):
            geo_cols.append(col)
            categorical_cols.append(col)
            continue
        
        # Default to categorical
        categorical_cols.append(col)
    
    return {
        'numeric_columns': numeric_cols,
        'categorical_columns': categorical_cols,
        'date_columns': date_cols,
        'geo_columns': geo_cols
    }


def detect_aggregation_columns(query_result: List[Dict[str, Any]], sql_query: str = "") -> Tuple[str, str]:
    """
    Detect which column is the dimension (x-axis) and which is the measure (y-axis).
    
    For queries like "count of candidates by location":
    - Location should be x-axis (dimension)
    - Count should be y-axis (measure)
    
    Returns:
        Tuple of (x_axis_column, y_axis_column)
    """
    if not query_result or len(query_result) == 0:
        return None, None
    
    columns = list(query_result[0].keys())
    structure = analyze_data_structure(query_result)
    
    # Common patterns for measure columns
    measure_keywords = [
        'count', 'sum', 'avg', 'average', 'mean', 'total', 'amount', 'value',
        'aggregate', 'aggregated', 'measure', 'metric', 'score', 'number'
    ]
    
    # Common patterns for dimension columns
    dimension_keywords = [
        'location', 'city', 'country', 'state', 'region', 'name', 'category',
        'type', 'status', 'group', 'class', 'department', 'team', 'category',
        'date', 'time', 'month', 'year', 'day', 'week'
    ]
    
    # Strategy 1: Check column names for keywords
    measure_col = None
    dimension_col = None
    
    for col in columns:
        col_lower = col.lower()
        # Check for measure patterns
        if any(keyword in col_lower for keyword in measure_keywords):
            if col in structure['numeric_columns']:
                measure_col = col
                break
    
    for col in columns:
        col_lower = col.lower()
        # Check for dimension patterns
        if any(keyword in col_lower for keyword in dimension_keywords):
            if col in structure['categorical_columns']:
                dimension_col = col
                break
    
    # Strategy 2: If not found, use structure-based detection
    if not measure_col and structure['numeric_columns']:
        # The numeric column is likely the measure
        measure_col = structure['numeric_columns'][0]
    
    if not dimension_col and structure['categorical_columns']:
        # The categorical column is likely the dimension
        dimension_col = structure['categorical_columns'][0]
    
    # Strategy 3: Fallback - use first categorical and first numeric
    if not measure_col and structure['numeric_columns']:
        measure_col = structure['numeric_columns'][0]
    
    if not dimension_col and structure['categorical_columns']:
        dimension_col = structure['categorical_columns'][0]
    
    # Strategy 4: If we have COUNT in SQL, find the dimension column
    if sql_query and 'COUNT' in sql_query.upper():
        # Find the column that's not COUNT
        for col in columns:
            if col not in structure['numeric_columns'] or col != measure_col:
                if col in structure['categorical_columns']:
                    dimension_col = col
                    break
    
    return dimension_col, measure_col


def detect_funnel_pattern(query_result: List[Dict[str, Any]]) -> bool:
    """Detect if the data represents a funnel pattern"""
    if not query_result or len(query_result) == 0:
        return False
    
    columns = list(query_result[0].keys())
    
    # Check column names for funnel keywords
    for col in columns:
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in FUNNEL_STAGE_KEYWORDS):
            return True
    
    # Check if values are decreasing (funnel pattern)
    structure = analyze_data_structure(query_result)
    if structure['numeric_columns']:
        numeric_col = structure['numeric_columns'][0]
        values = [row.get(numeric_col) for row in query_result if is_numeric(row.get(numeric_col))]
        if len(values) >= 3:
            # Check if values are generally decreasing
            decreasing_count = sum(1 for i in range(len(values) - 1) if values[i] >= values[i + 1])
            if decreasing_count >= len(values) * 0.7:
                return True
    
    return False


def detect_timeline_pattern(user_query: str, query_result: List[Dict[str, Any]]) -> bool:
    """Detect if the query relates to timeline/tenure/employment history."""
    query_lower = user_query.lower()
    timeline_keywords = [
        'timeline', 'tenure', 'employment', 'history', 'period', 'duration',
        'start date', 'end date', 'from', 'to', 'between', 'span',
        'joined', 'left', 'worked', 'experience', 'career'
    ]
    
    if any(keyword in query_lower for keyword in timeline_keywords):
        return True
    
    # Check for date range columns
    structure = analyze_data_structure(query_result)
    date_cols = structure['date_columns']
    
    # Check for start/end date patterns
    date_start_patterns = ['start', 'begin', 'from', 'joined', 'created']
    date_end_patterns = ['end', 'finish', 'to', 'until', 'left', 'expired']
    
    has_start = any(any(pattern in col.lower() for pattern in date_start_patterns) for col in date_cols)
    has_end = any(any(pattern in col.lower() for pattern in date_end_patterns) for col in date_cols)
    
    if has_start and has_end:
        return True
    
    return False


def detect_correlation_pattern(query_result: List[Dict[str, Any]]) -> bool:
    """Detect if data shows correlation between two numeric variables."""
    if not query_result or len(query_result) < 3:
        return False
    
    structure = analyze_data_structure(query_result)
    numeric_cols = structure['numeric_columns']
    
    # Need at least 2 numeric columns for scatter plot
    if len(numeric_cols) >= 2:
        return True
    
    return False


def detect_matrix_pattern(query_result: List[Dict[str, Any]]) -> bool:
    """Detect if data forms a matrix suitable for heatmap."""
    if not query_result or len(query_result) < 3:
        return False
    
    structure = analyze_data_structure(query_result)
    
    # Heatmap needs: 2 categorical dimensions + 1 numeric measure
    categorical_cols = structure['categorical_columns']
    numeric_cols = structure['numeric_columns']
    
    if len(categorical_cols) >= 2 and len(numeric_cols) >= 1:
        # Check if we have reasonable number of unique values for each dimension
        col1 = categorical_cols[0]
        col2 = categorical_cols[1]
        
        unique_col1 = len(set(row.get(col1) for row in query_result if row.get(col1) is not None))
        unique_col2 = len(set(row.get(col2) for row in query_result if row.get(col2) is not None))
        
        # Reasonable matrix size (not too large, not too small)
        if 2 <= unique_col1 <= 20 and 2 <= unique_col2 <= 20:
            return True
    
    return False


def detect_entity_lookup_query(user_query: str) -> bool:
    """Detect if the query is an entity lookup query."""
    query_lower = user_query.lower()
    lookup_patterns = [
        r'is there (any|a)',
        r'does.*exist',
        r'find.*named',
        r'search.*for',
        r'who is',
        r'what is',
        r'look.*for',
        r'check.*if',
        r'named',
        r'called'
    ]
    
    for pattern in lookup_patterns:
        if re.search(pattern, query_lower):
            return True
    return False


def determine_visual_type_and_config(
    user_query: str,
    query_result: List[Dict[str, Any]],
    sql_query: str = ""
) -> Dict[str, Any]:
    """
    Determine the best visualization type and configuration based on query and data.
    Enhanced with comprehensive rules for automatic visualization selection.
    
    Returns:
        Dict with 'visual_type', 'x_axis', 'y_axis', 'group_field', 'chart_config'
    """
    if not query_result or len(query_result) == 0:
        return {
            'visual_type': 'table',
            'x_axis': None,
            'y_axis': None,
            'group_by': None,
            'chart_config': {
                'title': 'No Data',
                'description': 'No data available for visualization',
                'color_scheme': 'auto'
            }
        }
    
    query_lower = user_query.lower()
    structure = analyze_data_structure(query_result)
    
    # Detect x and y axes
    x_axis, y_axis = detect_aggregation_columns(query_result, sql_query)
    
    # RULE 1: Single numeric value → KPI
    if len(query_result) == 1:
        record = query_result[0]
        columns = list(record.keys())
        if len(columns) == 1:
            key = columns[0]
            value = record[key]
            if is_numeric(value):
                visual_type = 'kpi_card'
                description = generate_concise_description(user_query, query_result)
                return {
                    'visual_type': visual_type,
                    'x_axis': None,
                    'y_axis': None,
                    'group_by': None,
                    'chart_config': {
                        'title': generate_chart_title(user_query, visual_type, None, None),
                        'description': description,
                        'color_scheme': 'auto'
                    }
                }
    
    # Check for entity lookup queries (single record searches)
    is_entity_lookup = detect_entity_lookup_query(user_query)
    
    # RULE 2: Entity lookup with single record → card/table
    if is_entity_lookup and len(query_result) == 1:
        visual_type = 'card'
        title = "Candidate Details"
        description = generate_concise_description(user_query, query_result)
        return {
            'visual_type': visual_type,
            'x_axis': None,
            'y_axis': None,
            'group_by': None,
            'chart_config': {
                'title': title,
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 3: Timeline/tenure queries → timeline
    if detect_timeline_pattern(user_query, query_result):
        visual_type = 'timeline'
        # Find start and end date columns
        date_cols = structure['date_columns']
        start_col = None
        end_col = None
        
        for col in date_cols:
            col_lower = col.lower()
            if any(pattern in col_lower for pattern in ['start', 'begin', 'from', 'joined', 'created']):
                start_col = col
            elif any(pattern in col_lower for pattern in ['end', 'finish', 'to', 'until', 'left', 'expired']):
                end_col = col
        
        # Use first date column if specific start/end not found
        if not start_col and date_cols:
            start_col = date_cols[0]
        if not end_col and len(date_cols) > 1:
            end_col = date_cols[1]
        
        # Find y-axis (company/role)
        y_field = None
        if structure['categorical_columns']:
            y_field = structure['categorical_columns'][0]
        
        description = f"Displays employment timeline showing tenure periods across each company."
        return {
            'visual_type': visual_type,
            'x_axis': start_col,
            'y_axis': y_field,
            'group_by': end_col,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, start_col, y_field),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 4: Geographic data → map
    if structure['geo_columns'] or 'geo' in query_lower or 'map' in query_lower or 'distribution' in query_lower and 'location' in query_lower:
        visual_type = 'geo_map'
        geo_col = structure['geo_columns'][0] if structure['geo_columns'] else None
        if not geo_col and structure['categorical_columns']:
            geo_col = structure['categorical_columns'][0]
        
        description = "Displays candidate count by city on a map."
        return {
            'visual_type': visual_type,
            'x_axis': geo_col,
            'y_axis': y_axis,
            'group_by': None,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, geo_col, y_axis),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 5: Correlation between two numeric variables → scatter
    if detect_correlation_pattern(query_result) or ('correlation' in query_lower or 'scatter' in query_lower):
        visual_type = 'scatter'
        numeric_cols = structure['numeric_columns']
        x_field = numeric_cols[0] if len(numeric_cols) > 0 else None
        y_field = numeric_cols[1] if len(numeric_cols) > 1 else numeric_cols[0]
        
        description = f"Shows correlation between {x_field} and {y_field}."
        return {
            'visual_type': visual_type,
            'x_axis': x_field,
            'y_axis': y_field,
            'group_by': None,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, x_field, y_field),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 6: Matrix pattern → heatmap
    if detect_matrix_pattern(query_result) or 'heatmap' in query_lower:
        visual_type = 'heatmap'
        categorical_cols = structure['categorical_columns']
        numeric_cols = structure['numeric_columns']
        
        x_field = categorical_cols[0] if len(categorical_cols) > 0 else None
        group_field = categorical_cols[1] if len(categorical_cols) > 1 else None
        y_field = numeric_cols[0] if len(numeric_cols) > 0 else None
        
        description = f"Displays heatmap showing {y_field} across {x_field} and {group_field}."
        return {
            'visual_type': visual_type,
            'x_axis': x_field,
            'y_axis': y_field,
            'group_by': group_field,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, x_field, y_field),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 7: Date/time progression → line or area
    if structure['date_columns'] and len(query_result) > 1:
        if 'area' in query_lower:
            visual_type = 'area'
        else:
            visual_type = 'line'
        date_col = structure['date_columns'][0]
        
        description = generate_chart_description(user_query, visual_type, date_col, y_axis, len(query_result))
        return {
            'visual_type': visual_type,
            'x_axis': date_col if not x_axis else x_axis,
            'y_axis': y_axis,
            'group_by': None,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, date_col, y_axis),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 8: Categories and proportions → pie or donut
    if len(structure['categorical_columns']) >= 1 and len(structure['numeric_columns']) >= 1:
        if len(query_result) <= 10:
            if 'donut' in query_lower:
                visual_type = 'donut'
            else:
                visual_type = 'pie'
            
            description = f"Shows distribution of {y_axis or 'values'} across {x_axis or 'categories'}."
            return {
                'visual_type': visual_type,
                'x_axis': x_axis,
                'y_axis': y_axis,
                'group_by': None,
                'chart_config': {
                    'title': generate_chart_title(user_query, visual_type, x_axis, y_axis),
                    'description': description,
                    'color_scheme': 'auto'
                }
            }
    
    # RULE 9: GROUP BY or aggregation → bar or line
    if ('count' in query_lower or 'group' in query_lower or 'by' in query_lower) and x_axis and y_axis:
        if 'line' in query_lower or 'trend' in query_lower:
            visual_type = 'line'
        else:
            visual_type = 'bar'
        
        description = f"Comparison of {y_axis.replace('_', ' ')} across different {x_axis.replace('_', ' ')}."
        return {
            'visual_type': visual_type,
            'x_axis': x_axis,
            'y_axis': y_axis,
            'group_by': None,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, x_axis, y_axis),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 10: Funnel pattern
    if detect_funnel_pattern(query_result) or 'funnel' in query_lower:
        visual_type = 'funnel'
        description = f"Displays funnel visualization showing progression through stages."
        return {
            'visual_type': visual_type,
            'x_axis': x_axis,
            'y_axis': y_axis,
            'group_by': None,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, x_axis, y_axis),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # RULE 11: Multiple rows with dimensions → table
    if len(query_result) > 1:
        visual_type = 'table'
        description = generate_concise_description(user_query, query_result)
        return {
            'visual_type': visual_type,
            'x_axis': None,
            'y_axis': None,
            'group_by': None,
            'chart_config': {
                'title': generate_chart_title(user_query, visual_type, None, None),
                'description': description,
                'color_scheme': 'auto'
            }
        }
    
    # Default fallback
    visual_type = 'table'
    description = generate_concise_description(user_query, query_result)
    return {
        'visual_type': visual_type,
        'x_axis': x_axis,
        'y_axis': y_axis,
        'group_by': None,
        'chart_config': {
            'title': generate_chart_title(user_query, visual_type, x_axis, y_axis),
            'description': description,
            'color_scheme': 'auto'
        }
    }


def generate_chart_title(user_query: str, visual_type: str, x_axis: Optional[str], y_axis: Optional[str]) -> str:
    """Generate a descriptive title for the chart"""
    # Extract key terms from query
    query_words = user_query.split()
    
    # Try to create a meaningful title
    if 'count' in user_query.lower() and 'location' in user_query.lower():
        if x_axis:
            return f"Count by {x_axis.replace('_', ' ').title()}"
        return "Count by Location"
    
    if x_axis and y_axis:
        return f"{y_axis.replace('_', ' ').title()} by {x_axis.replace('_', ' ').title()}"
    
    if visual_type == 'line':
        return 'Trend Analysis'
    elif visual_type == 'bar':
        return 'Bar Chart'
    elif visual_type == 'pie':
        return 'Distribution'
    elif visual_type == 'kpi_card':
        return 'Key Metric'
    
    return 'Data Visualization'


def generate_chart_description(user_query: str, visual_type: str, x_axis: Optional[str], y_axis: Optional[str], record_count: int) -> str:
    """Generate a description for the chart"""
    if x_axis and y_axis:
        return f"Showing {y_axis.replace('_', ' ')} for each {x_axis.replace('_', ' ')} across {record_count} records."
    return f"Visualization based on query: {user_query}"


def generate_concise_description(user_query: str, query_result: List[Dict[str, Any]]) -> str:
    """
    Generate a concise, one-line description based on user prompt and query results.
    
    Rules:
    1. If output_result is a single numeric value, treat it as KPI-type metric
    2. Be grammatically correct and human-like
    3. Clearly state the result value
    4. Neutral, professional tone
    5. Avoid restating exact question - rephrase naturally
    6. No SQL, technical, or JSON-like text
    7. Concise (1 sentence, max 20 words)
    
    Args:
        user_query: The original user query
        query_result: Query results as list of dictionaries
        
    Returns:
        Concise one-line description
    """
    if not query_result or len(query_result) == 0:
        return "No matching records found."
    
    query_lower = user_query.lower()
    
    # Case 1: Single numeric value (KPI-type metric)
    if len(query_result) == 1:
        record = query_result[0]
        columns = list(record.keys())
        
        # Check if it's a single numeric value
        if len(columns) == 1:
            key = columns[0]
            value = record[key]
            if is_numeric(value):
                # Extract key terms from query
                if 'count' in query_lower or 'how many' in query_lower:
                    # Extract entity and location/condition
                    entity = 'items'
                    if 'candidate' in query_lower:
                        entity = 'candidates'
                    elif 'job' in query_lower or 'position' in query_lower:
                        entity = 'jobs'
                    elif 'interview' in query_lower:
                        entity = 'interviews'
                    
                    location = None
                    if 'location' in query_lower or 'from' in query_lower:
                        # Try to extract location
                        import re
                        # Match patterns like "from chennai", "in chennai", "at chennai", "location chennai"
                        location_patterns = [
                            r'(?:from|in|at|location|based in)\s+([a-zA-Z\s]+?)(?:\s|$|location|wise|\.|\?)',
                            r'([A-Z][a-zA-Z\s]+?)\s+location',
                        ]
                        for pattern in location_patterns:
                            location_match = re.search(pattern, query_lower)
                            if location_match:
                                location = location_match.group(1).strip()
                                # Clean up location (remove question marks, etc.)
                                location = location.split('?')[0].split('.')[0].split('location')[0].strip()
                                if location and len(location) > 2:  # Ensure we have a valid location name
                                    break
                    
                    if location:
                        return f"A total of {value} {entity} {'are' if value != 1 else 'is'} currently based in {location}."
                    else:
                        return f"A total of {value} {entity} {'were' if value != 1 else 'was'} found."
        
        # Single record with multiple fields - extract key info
        numeric_cols = [col for col in columns if is_numeric(record.get(col))]
        
        if numeric_cols:
            # Get the numeric value
            value = record.get(numeric_cols[0])
            col_name = numeric_cols[0].replace('_', ' ').replace('count', '').strip()
            
            if 'count' in query_lower or 'how many' in query_lower:
                entity = 'records'
                if 'candidate' in query_lower:
                    entity = 'candidates'
                return f"Found {value} {entity} matching the criteria."
            else:
                return f"The {col_name} is {value}."
    
    # Case 2: Multiple records - check for location-wise or grouped queries
    total_count = len(query_result)
    
    # Check for location-wise count queries
    if ('location' in query_lower or 'location wise' in query_lower) and 'count' in query_lower:
        entity = 'candidates'
        if 'candidate' in query_lower:
            entity = 'candidates'
        
        # Check if we have location column and count column
        if query_result and len(query_result) > 0:
            first_record = query_result[0]
            structure = analyze_data_structure(query_result)
            
            # Find location column
            location_col = None
            for col in structure['categorical_columns']:
                if 'location' in col.lower():
                    location_col = col
                    break
            
            # Find count column
            count_col = None
            for col in structure['numeric_columns']:
                if 'count' in col.lower():
                    count_col = col
                    break
            
            if location_col and count_col:
                total = sum(float(row.get(count_col, 0)) for row in query_result if is_numeric(row.get(count_col)))
                return f"Showing {entity} distribution across {total_count} locations with a total of {int(total)} {entity}."
            else:
                return f"Showing {entity} distribution across {total_count} locations."
    
    # Extract key terms from query
    if 'count' in query_lower or 'how many' in query_lower:
        entity = 'records'
        if 'candidate' in query_lower:
            entity = 'candidates'
        
        return f"Found {total_count} {entity} matching the criteria."
    
    # Check for aggregation queries
    if any(word in query_lower for word in ['total', 'sum', 'average', 'avg']):
        # Get first numeric column value
        if query_result and len(query_result) > 0:
            first_record = query_result[0]
            numeric_cols = [col for col in first_record.keys() if is_numeric(first_record.get(col))]
            if numeric_cols:
                value = first_record.get(numeric_cols[0])
                col_name = numeric_cols[0].replace('_', ' ').replace('count', '').strip()
                return f"The {col_name} is {value}."
    
    # Default: summarize record count
    if total_count == 1:
        return "Found 1 matching record."
    else:
        return f"Showing {total_count} records matching your query."


def generate_insights_with_trends(query_result: List[Dict[str, Any]], x_axis: Optional[str], y_axis: Optional[str]) -> str:
    """Generate insights including trends and patterns"""
    if not query_result or len(query_result) == 0:
        return "No data available for analysis."
    
    insights = []
    
    # Basic summary
    total_records = len(query_result)
    insights.append(f"Total records: {total_records}")
    
    if x_axis and y_axis:
        # Calculate statistics
        values = []
        for row in query_result:
            val = row.get(y_axis)
            if is_numeric(val):
                values.append(float(val))
        
        if values:
            max_val = max(values)
            min_val = min(values)
            avg_val = sum(values) / len(values)
            
            # Find top values
            sorted_data = sorted(query_result, key=lambda x: float(x.get(y_axis, 0)) if is_numeric(x.get(y_axis)) else 0, reverse=True)
            top_items = sorted_data[:3]
            
            insights.append(f"Maximum {y_axis.replace('_', ' ')}: {max_val:,.0f}")
            insights.append(f"Average {y_axis.replace('_', ' ')}: {avg_val:,.2f}")
            
            if top_items:
                top_list = ", ".join([f"{row.get(x_axis)} ({row.get(y_axis)})" for row in top_items])
                insights.append(f"Top 3: {top_list}")
            
            # Detect trend
            if len(values) >= 2:
                first_half = sum(values[:len(values)//2]) / (len(values)//2)
                second_half = sum(values[len(values)//2:]) / (len(values) - len(values)//2)
                if second_half > first_half * 1.1:
                    insights.append("Trend: Increasing")
                elif second_half < first_half * 0.9:
                    insights.append("Trend: Decreasing")
                else:
                    insights.append("Trend: Stable")
    
    return " | ".join(insights)


def recommend_visualization(
    user_query: str,
    sql_query: str = "",
    query_result: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Main function to recommend visualization based on query and results.
    
    Args:
        user_query: The original user query
        sql_query: Generated SQL query
        query_result: Query results as list of dictionaries
    
    Returns:
        Dict with visualization recommendation and insights
    """
    try:
        # Ensure query_result is a list
        if query_result is None:
            query_result = []
        if not isinstance(query_result, list):
            query_result = list(query_result) if query_result else []
        
        # Determine visualization type and config
        visual_config = determine_visual_type_and_config(user_query, query_result, sql_query)
        
        # Generate concise one-line description (for pinned visual summary)
        concise_description = generate_concise_description(user_query, query_result)
        
        # Generate detailed insights (for non-pinned visuals)
        detailed_insights = generate_insights_with_trends(
            query_result,
            visual_config.get('x_axis'),
            visual_config.get('y_axis')
        )
        
        # Use concise description as primary summary (for pinned visuals)
        insights_summary = concise_description
        
        # Identify possible filters
        possible_filters = []
        if query_result:
            structure = analyze_data_structure(query_result)
            # Add categorical columns as filters
            for col in structure['categorical_columns']:
                unique_values = set(row.get(col) for row in query_result if row.get(col) is not None)
                if 1 < len(unique_values) <= 50:
                    possible_filters.append(col)
        
        return {
            'visual_recommendation': {
                'visual_type': visual_config['visual_type'],
                'x_axis': visual_config['x_axis'],  # Maps to x_field
                'y_axis': visual_config['y_axis'],  # Maps to y_field
                'group_by': visual_config.get('group_by'),  # Maps to group_field
                'chart_config': visual_config['chart_config']
            },
            'insights_summary': insights_summary,
            'possible_filters': possible_filters,
            'data_summary': f"Found {len(query_result)} records",
            'description': insights_summary  # Add description field for compatibility
        }
    
    except Exception as e:
        logger.error(f"Error in recommend_visualization: {str(e)}")
        return {
            'visual_recommendation': {
                'visual_type': 'table',
                'x_axis': None,
                'y_axis': None,
                'group_by': None,
                'chart_config': {
                    'title': 'Error',
                    'description': f'Error generating visualization: {str(e)}',
                    'color_scheme': 'auto'
                }
            },
            'insights_summary': f"Error: {str(e)}",
            'possible_filters': [],
            'data_summary': "Error occurred"
        }


def format_visualization_response(viz_response: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format visualization response for API compatibility.
    Maintains backward compatibility with old format while adding new fields.
    """
    visual_recommendation = viz_response.get('visual_recommendation', {})
    visual_type = visual_recommendation.get('visual_type', 'table')
    
    # Map visual types to chart types (for backward compatibility)
    chart_type_map = {
        'bar': 'Bar',
        'line': 'Line',
        'pie': 'Pie',
        'donut': 'Pie',
        'scatter': 'Scatter',
        'area': 'Area',
        'funnel': 'Funnel',
        'table': 'Table',
        'kpi_card': 'KPI',
        'heatmap': 'Heatmap',
        'geo_map': 'Geo Map'
    }
    
    chart_type = chart_type_map.get(visual_type, 'Table')
    
    return {
        'success': True,
        'chart_type': chart_type,
        'recommended_visual_type': visual_type,
        'visual_recommendation': visual_recommendation,
        'insights_summary': viz_response.get('insights_summary', ''),
        'possible_filters': viz_response.get('possible_filters', []),
        'data_summary': viz_response.get('data_summary', ''),
        'notes': viz_response.get('insights_summary', '')
    }
