import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_chatbot")

def log_info(msg):
    logger.info(msg)

################# USAGE EXAMPLE ########################
"""
from app.utils.logger import log_info
log_info("Server started successfully.")
"""