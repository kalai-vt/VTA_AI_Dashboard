# app/tools/sql_tool.py

import pymysql
from app.config.settings import settings
from typing import List, Dict, Any, Union
import logging

logger = logging.getLogger(__name__)

class SQLTool:
    """
    A reusable MySQL query tool optimized for LangGraph integration.
    Handles connection management and provides robust error handling.
    """

    def __init__(self):
        self.connection = None
        self._connect()

    def _connect(self):
        """Establish database connection"""
        try:
            self.connection = pymysql.connect(
                host=settings.MYSQL_HOST,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                database=settings.MYSQL_DB,
                cursorclass=pymysql.cursors.DictCursor,
                autocommit=True,
                connect_timeout=10,
                read_timeout=30,
                write_timeout=30
            )
            logger.info("Successfully connected to MySQL database")
        except Exception as e:
            logger.error(f"Failed to connect to MySQL database: {str(e)}")
            raise

    def _ensure_connection(self):
        """Ensure database connection is active"""
        if self.connection is None:
            self._connect()
        try:
            # Test connection
            self.connection.ping(reconnect=True)
        except Exception as e:
            logger.warning(f"Connection lost, reconnecting: {str(e)}")
            self._connect()

    def run_query(self, query: str) -> Union[List[Dict[str, Any]], Dict[str, str]]:
        """
        Run a read-only SQL query and return results as list of dicts.
        
        Args:
            query (str): SQL SELECT query to execute
            
        Returns:
            Union[List[Dict[str, Any]], Dict[str, str]]: Query results or error dict
        """
        if not query.strip():
            return {"error": "Empty query provided"}
        
        # Ensure we have a valid connection
        self._ensure_connection()
        
        try:
            # Validate that it's a SELECT query for safety
            query_upper = query.strip().upper()
            if not query_upper.startswith('SELECT'):
                return {"error": "Only SELECT queries are allowed for security reasons"}
            
            with self.connection.cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
                
                # Log successful query execution
                logger.info(f"Successfully executed query: {query[:100]}...")
                
                return results
                
        except pymysql.Error as e:
            error_msg = f"MySQL Error ({e.args[0]}): {e.args[1]}"
            logger.error(f"SQL execution error: {error_msg}")
            return {"error": error_msg}
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"Unexpected SQL error: {error_msg}")
            return {"error": error_msg}

    def get_table_schema(self, table_name: str) -> Union[List[Dict[str, Any]], Dict[str, str]]:
        """
        Get schema information for a specific table.
        
        Args:
            table_name (str): Name of the table
            
        Returns:
            Union[List[Dict[str, Any]], Dict[str, str]]: Schema info or error dict
        """
        query = f"""
        SELECT 
            COLUMN_NAME,
            DATA_TYPE,
            IS_NULLABLE,
            COLUMN_DEFAULT,
            COLUMN_KEY,
            EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = '{settings.MYSQL_DB}' 
        AND TABLE_NAME = '{table_name}'
        ORDER BY ORDINAL_POSITION
        """
        return self.run_query(query)

    def get_all_tables(self) -> Union[List[Dict[str, Any]], Dict[str, str]]:
        """
        Get list of all tables in the database.
        
        Returns:
            Union[List[Dict[str, Any]], Dict[str, str]]: List of tables or error dict
        """
        query = f"""
        SELECT TABLE_NAME, TABLE_COMMENT
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = '{settings.MYSQL_DB}'
        ORDER BY TABLE_NAME
        """
        return self.run_query(query)

    def close(self):
        """Close database connection"""
        if self.connection:
            try:
                self.connection.close()
                logger.info("Database connection closed")
            except Exception as e:
                logger.error(f"Error closing database connection: {str(e)}")
            finally:
                self.connection = None

    def __del__(self):
        """Destructor to ensure connection is closed"""
        self.close()

#################### USAGE EXAMPLE ########################
"""
from app.tools.sql_tool import SQLTool

sql_tool = SQLTool()
rows = sql_tool.run_query("SELECT * FROM customers LIMIT 3;")
print(rows)
sql_tool.close()

"""