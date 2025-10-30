"""
SQL Injection Prevention and Input Security
"""

import re
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


class SecurityValidator:
    """
    Security validator to prevent SQL injection and malicious queries
    """
    
    # SQL keywords that indicate raw SQL queries
    SQL_KEYWORDS = [
        'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE',
        'TRUNCATE', 'EXEC', 'EXECUTE', 'UNION', 'WHERE', 'FROM', 'JOIN',
        'INNER', 'LEFT', 'RIGHT', 'ORDER', 'GROUP', 'HAVING', 'LIMIT',
        'OFFSET', 'TOP', 'INTO', 'VALUES', 'SET', 'AND', 'OR', 'NOT',
        'LIKE', 'IN', 'BETWEEN', 'AS', 'ON', 'NULL'
    ]
    
    # Dangerous SQL patterns
    DANGEROUS_PATTERNS = [
        r';\s*--',           # SQL comment injection
        r'/\*.*?\*/',        # Multi-line comment
        r';\s*DROP\s+TABLE', # Table dropping
        r';\s*DELETE\s+FROM', # Deletion
        r';\s*UPDATE\s+\w+\s+SET', # Updates
        r';\s*INSERT\s+INTO', # Inserts
        r';\s*TRUNCATE\s+TABLE', # Truncation
        r'\'\s*(OR|AND)\s*\d+\s*=\s*\d+', # Tautology
        r';\s*SELECT\s+\*', # Universal select
        r';\s*DROP\s+DATABASE', # Database dropping
        r';\s*SHOW\s+', # Information disclosure
        r';\s*DESCRIBE\s+', # Schema disclosure
        r';\s*DESC\s+', # Schema disclosure
    ]
    
    # Regex for detecting if user query is raw SQL
    RAW_SQL_PATTERN = re.compile(
        r'\b(?:select|insert|update|delete|drop|alter|create|truncate|exec|execute)\b',
        re.IGNORECASE
    )
    
    @staticmethod
    def detect_raw_sql_query(user_query: str) -> bool:
        """
        Detect if user query contains SQL keywords (indicating raw SQL)
        
        Args:
            user_query: User's input query
            
        Returns:
            bool: True if raw SQL detected, False otherwise
        """
        try:
            query_upper = user_query.upper().strip()
            
            # Patterns that indicate raw SQL (not just keywords alone)
            # These must be SQL statement patterns
            sql_statement_patterns = [
                (r'^\s*SELECT\s+.*\s+FROM\s+', 'SELECT ... FROM statement'),
                (r'^\s*SELECT\s+\*\s*$', 'SELECT *'),
                (r'^\s*SELECT\s+[A-Z_]+\s*,', 'SELECT with columns'),
                (r'^\s*INSERT\s+INTO\s+', 'INSERT INTO statement'),
                (r'^\s*UPDATE\s+\w+\s+SET\s+', 'UPDATE ... SET statement'),
                (r'^\s*DELETE\s+FROM\s+', 'DELETE FROM statement'),
                (r'^\s*DROP\s+(?:TABLE|DATABASE)\s+', 'DROP statement'),
                (r'^\s*ALTER\s+TABLE\s+', 'ALTER TABLE statement'),
                (r'^\s*CREATE\s+(?:TABLE|DATABASE)\s+', 'CREATE statement'),
            ]
            
            # Check for SQL statement patterns (at beginning of string)
            for pattern, name in sql_statement_patterns:
                try:
                    if re.match(pattern, query_upper):
                        logger.warning(f"SQL statement pattern detected: {name}")
                        return True
                except re.error as e:
                    logger.warning(f"Regex error in pattern {pattern}: {e}")
                    continue
            
            # Check for SQL patterns anywhere in the string (for mid-string SQL)
            sql_patterns = [
                (r';\s*SELECT\b', 'Semicolon before SELECT'),
                (r';\s*DROP\s+', 'Semicolon before DROP'),
                (r';\s*DELETE\s+', 'Semicolon before DELETE'),
                (r';\s*UPDATE\s+', 'Semicolon before UPDATE'),
                (r';\s*INSERT\s+', 'Semicolon before INSERT'),
                (r'SELECT\s+\*\s+FROM\s+\w+;?\s*--', 'SQL comment injection'),
            ]
            
            for pattern, name in sql_patterns:
                try:
                    if re.search(pattern, user_query, re.IGNORECASE):
                        logger.warning(f"SQL pattern detected: {name}")
                        return True
                except re.error as e:
                    logger.warning(f"Regex error in pattern {pattern}: {e}")
                    continue
            
            # Check for dangerous patterns
            for pattern in SecurityValidator.DANGEROUS_PATTERNS:
                try:
                    if re.search(pattern, user_query, re.IGNORECASE):
                        logger.warning(f"Dangerous SQL pattern detected: {pattern}")
                        return True
                except re.error as e:
                    logger.warning(f"Regex error in pattern {pattern}: {e}")
                    continue
            
            return False
            
        except Exception as e:
            logger.error(f"Error in raw SQL detection: {e}")
            # Fail safe - if there's an error, be conservative and reject
            return True
    
    @staticmethod
    def sanitize_generated_sql(sql_query: str) -> Tuple[bool, str]:
        """
        Sanitize and validate generated SQL query
        
        Args:
            sql_query: Generated SQL query
            
        Returns:
            Tuple[bool, str]: (is_valid, error_message)
        """
        if not sql_query or not sql_query.strip():
            return False, "Empty SQL query"
        
        query_upper = sql_query.strip().upper()
        
        # Must start with SELECT
        if not query_upper.startswith('SELECT'):
            return False, "Only SELECT queries are allowed"
        
        # Check for dangerous keywords
        dangerous_keywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 
                             'CREATE', 'TRUNCATE', 'REPLACE', 'CALL', 'EXEC', 
                             'EXECUTE', 'HANDLER', 'LOAD_FILE', 'LOAD_DATA']
        
        for keyword in dangerous_keywords:
            # Use word boundaries to avoid false positives
            pattern = r'\b' + keyword + r'\b'
            if re.search(pattern, query_upper):
                logger.error(f"Dangerous SQL keyword detected: {keyword}")
                return False, f"Dangerous SQL keyword '{keyword}' not allowed"
        
        # Check for SQL comment injection
        if '--' in sql_query or '/*' in sql_query or '*/' in sql_query:
            logger.error("SQL comment injection detected")
            return False, "SQL comments not allowed"
        
        # Check for semicolons (potential command chaining)
        # Allow semicolon only at the end
        semicolons = sql_query.rstrip().count(';')
        if semicolons > 1:
            logger.error("Multiple semicolons detected - potential command chaining")
            return False, "Multiple SQL statements not allowed"
        
        # Check for UNION-based injection
        union_pattern = r'\bUNION\b.*\bSELECT\b'
        if re.search(union_pattern, query_upper):
            logger.error("UNION-based SQL injection detected")
            return False, "UNION queries not allowed"
        
        # Check for information schema access (schema disclosure)
        info_schema_pattern = r'INFORMATION_SCHEMA|information_schema'
        if re.search(info_schema_pattern, sql_query, re.IGNORECASE):
            logger.warning("Information schema access detected - this is controlled")
            # Allow this for metadata service, but log it
        
        return True, ""
    
    @staticmethod
    def validate_user_input(user_query: str) -> Tuple[bool, str]:
        """
        Comprehensive user input validation
        
        Args:
            user_query: User's input
            
        Returns:
            Tuple[bool, str]: (is_valid, error_message)
        """
        if not user_query or len(user_query.strip()) == 0:
            return False, "Empty query not allowed"
        
        # Check for excessively long queries
        if len(user_query) > 1000:
            return False, "Query too long (max 1000 characters)"
        
        # Check for raw SQL detection
        if SecurityValidator.detect_raw_sql_query(user_query):
            return False, "Please rephrase your query in natural language. Raw SQL queries are not accepted for security reasons."
        
        # Check for suspicious patterns
        suspicious_patterns = [
            r';\s*DROP',
            r';\s*DELETE',
            r';\s*UPDATE',
            r';\s*TRUNCATE',
            r';\s*ALTER',
        ]
        
        for pattern in suspicious_patterns:
            if re.search(pattern, user_query, re.IGNORECASE):
                logger.error(f"Suspicious pattern detected: {pattern}")
                return False, "Suspicious query pattern detected"
        
        return True, ""
    
    @staticmethod
    def get_security_recommendations() -> List[str]:
        """
        Get security recommendations for users
        """
        return [
            "✅ Always use natural language queries",
            "✅ Don't try to inject SQL code",
            "✅ Describe what data you want to see",
            "❌ Don't provide direct SQL statements",
            "❌ Don't try to access system tables",
            "❌ Don't attempt destructive operations"
        ]


def validate_and_sanitize_query(user_query: str, sql_query: str) -> Tuple[bool, str, str]:
    """
    Comprehensive validation wrapper
    
    Args:
        user_query: Original user query
        sql_query: Generated SQL query
        
    Returns:
        Tuple[bool, str, str]: (is_valid, error_message, sanitized_sql)
    """
    # Validate user input
    is_valid, error = SecurityValidator.validate_user_input(user_query)
    if not is_valid:
        return False, error, ""
    
    # Sanitize generated SQL
    is_valid_sql, sql_error = SecurityValidator.sanitize_generated_sql(sql_query)
    if not is_valid_sql:
        return False, sql_error, ""
    
    return True, "", sql_query

