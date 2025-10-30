import json
import logging
from typing import Dict, List, Any
from app.config.settings import settings
import pymysql

logger = logging.getLogger(__name__)

class DatabaseMetadataService:
    """
    Service to provide database schema metadata to the LLM for better SQL generation.
    """

    def __init__(self):
        self.connection = None
        self._connect()
        self.schema_info = self._load_schema_info()

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
            logger.info("Database metadata service connected successfully")
        except Exception as e:
            logger.error(f"Failed to connect to database for metadata: {str(e)}")
            raise

    def _load_schema_info(self) -> Dict[str, Any]:
        """Load database schema information"""
        try:
            schema_info = {
                "tables": {},
                "relationships": [],
                "sample_queries": []
            }

            # Get all tables
            with self.connection.cursor() as cursor:
                cursor.execute("""
                    SELECT TABLE_NAME, TABLE_COMMENT
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = %s
                    ORDER BY TABLE_NAME
                """, (settings.MYSQL_DB,))
                
                tables = cursor.fetchall()
                
                for table in tables:
                    table_name = table['TABLE_NAME']
                    
                    # Get columns for each table
                    cursor.execute("""
                        SELECT 
                            COLUMN_NAME,
                            DATA_TYPE,
                            IS_NULLABLE,
                            COLUMN_DEFAULT,
                            COLUMN_KEY,
                            EXTRA,
                            COLUMN_COMMENT
                        FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                        ORDER BY ORDINAL_POSITION
                    """, (settings.MYSQL_DB, table_name))
                    
                    columns = cursor.fetchall()
                    
                    schema_info["tables"][table_name] = {
                        "comment": table['TABLE_COMMENT'],
                        "columns": columns
                    }

            # Add specific business context for better SQL generation
            schema_info["business_context"] = {
                "candidate_management": {
                    "main_table": "Candidate_Profile",
                    "key_fields": ["candidate_id", "first_name", "last_name", "email", "phone", "current_designation", "experience_years"],
                    "related_tables": ["Candidate_Skills", "Candidate_Experience", "Candidate_Education", "Candidate_Application"]
                },
                "job_management": {
                    "main_table": "Job_Requirements",
                    "key_fields": ["requirement_id", "job_title", "job_description", "minimum_experience", "maximum_experience"],
                    "related_tables": ["Job_Posting", "Requisition", "Requirement_Skills"]
                },
                "interview_management": {
                    "main_table": "Interview_Schedule",
                    "key_fields": ["interview_id", "candidate_id", "interviewer_id", "interview_date", "status"],
                    "related_tables": ["Interview_Feedback", "Interviewer_Profile"]
                }
            }

            # Add sample queries for common use cases
            schema_info["sample_queries"] = [
                {
                    "description": "Get all candidates",
                    "query": "SELECT candidate_id, first_name, last_name, email, phone, current_designation FROM Candidate_Profile WHERE isDelete = 0"
                },
                {
                    "description": "Get candidates by experience",
                    "query": "SELECT candidate_id, first_name, last_name, experience_years FROM Candidate_Profile WHERE experience_years >= 5 AND isDelete = 0"
                },
                {
                    "description": "Get active job postings",
                    "query": "SELECT posting_id, posting_title, posting_description FROM Job_Posting WHERE posting_status = 'Published' AND isDelete = 0"
                },
                {
                    "description": "Get interview schedules",
                    "query": "SELECT interview_id, candidate_id, interview_date, status FROM Interview_Schedule WHERE status IN ('Scheduled', 'Completed')"
                }
            ]

            logger.info("Database schema information loaded successfully")
            return schema_info

        except Exception as e:
            logger.error(f"Error loading schema info: {str(e)}")
            return {"tables": {}, "relationships": [], "sample_queries": []}

    def get_schema_context(self) -> str:
        """Get formatted schema context for LLM"""
        try:
            context = "DATABASE SCHEMA INFORMATION:\n\n"
            
            # Add business context
            context += "BUSINESS CONTEXT:\n"
            context += "- This is a recruitment/HR management system\n"
            context += "- Main entities: Candidates, Jobs, Interviews, Offers, Employees\n"
            context += "- Key tables: Candidate_Profile, Job_Requirements, Interview_Schedule, Offer_Details\n\n"
            
            # Add table information
            context += "AVAILABLE TABLES:\n"
            for table_name, table_info in self.schema_info["tables"].items():
                context += f"\n{table_name}:\n"
                if table_info["comment"]:
                    context += f"  Description: {table_info['comment']}\n"
                
                context += "  Columns:\n"
                for column in table_info["columns"]:
                    key_info = f" ({column['COLUMN_KEY']})" if column['COLUMN_KEY'] else ""
                    nullable = " NULL" if column['IS_NULLABLE'] == 'YES' else " NOT NULL"
                    context += f"    - {column['COLUMN_NAME']}: {column['DATA_TYPE']}{key_info}{nullable}\n"
                    if column['COLUMN_COMMENT']:
                        context += f"      Comment: {column['COLUMN_COMMENT']}\n"

            # Add sample queries
            context += "\nSAMPLE QUERIES:\n"
            for sample in self.schema_info["sample_queries"]:
                context += f"- {sample['description']}: {sample['query']}\n"

            return context

        except Exception as e:
            logger.error(f"Error generating schema context: {str(e)}")
            return "Database schema information not available."

    def get_table_info(self, table_name: str) -> Dict[str, Any]:
        """Get specific table information"""
        return self.schema_info["tables"].get(table_name, {})

    def get_related_tables(self, entity_type: str) -> List[str]:
        """Get related tables for a specific entity type"""
        if entity_type in self.schema_info["business_context"]:
            return self.schema_info["business_context"][entity_type]["related_tables"]
        return []

    def close(self):
        """Close database connection"""
        if self.connection:
            try:
                self.connection.close()
                logger.info("Database metadata service connection closed")
            except Exception as e:
                logger.error(f"Error closing metadata service connection: {str(e)}")
            finally:
                self.connection = None


# Global instance
metadata_service = None

def get_metadata_service():
    """Get or create the metadata service instance"""
    global metadata_service
    if metadata_service is None:
        metadata_service = DatabaseMetadataService()
    return metadata_service

