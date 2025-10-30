RUN INSTRUCTIONS 
========================= STARTS HERE =======================================================
# Create virtual environment
python -m venv venv
source venv/bin/activate        # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run FastAPI app
uvicorn main:app --reload
========================= ENDS HERE ==========================

EXAMPLE IMPORTING COMPONENTS
========================= STARTS HERE =========================
1.settings (anywhere)	
    from app.config.settings import settings
2.database (tools or service)	
    from app.database.connection import get_db
3.RAG chain (service layer)	
    from app.rag.graph_chain import get_rag_chain
4.chat_service (routes)	
    from app.services.chat_service import process_chat_query
========================= ENDS HERE ============================
🔍 Memory Types in LangChain
==============================================================================
Type	                        Description	                    Use Case
==============================================================================
ConversationBufferMemory	    Stores all messages verbatim	Small sessions
ConversationSummaryMemory	    Summarizes old chats	        Long chats
ConversationBufferWindowMemory	Keeps only last N messages	    Context limit control
VectorStoreRetrieverMemory	    Embeds & retrieves past chats	Scalable, long-term memory

========================================================================================
🧠 Summary
=========================================================================================
Feature	        Implementation	                                        Benefit
=========================================================================================
RAG	            Uses retriever to get relevant chunks from documents	Augments LLM with external knowledge
Agentic RAG	    Adds decision-making (tools, reasoning)	                LLM chooses best source dynamically
SQL Tool	    Queries MySQL database	                                Integrates structured data
Memory	        Stores conversation history	                            Maintains context & coherence
LangGraph /     Unifies tools + LLM + memory	                        Modular and extensible backend
LangChain Agents	

==========================================================================================
🧩 Example Real Interaction
==========================================================================================
User: What’s the total sales in Q3?
→ Agent uses MySQL_Query tool

User: And what about Q4?
→ Agent remembers Q3 context, forms next SQL automatically

User: Can you explain how quarterly sales are defined in company policy?
→ Agent switches to RAG retriever from document base

User: Great. Summarize both in one paragraph.
→ Agent fuses both outputs (SQL + docs) contextually
=====================================================================================