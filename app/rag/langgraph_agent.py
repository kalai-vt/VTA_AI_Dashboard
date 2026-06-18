from typing import TypedDict, List, Optional, Annotated
from langgraph.graph import StateGraph, END
import operator


class AgentState(TypedDict):
    messages: Annotated[List[dict], operator.add]
    intent: str
    confidence: float
    lead_score: int
    capture_lead: bool
    company_id: str
    company_name: str
    session_id: str
    response: str
    lead_data: Optional[dict]


async def classify_node(state: AgentState) -> AgentState:
    from app.rag.intent_classifier import classify_intent
    messages = state["messages"]
    last_message = messages[-1]["content"] if messages else ""
    history = messages[:-1]

    classification = await classify_intent(last_message, history)
    return {
        **state,
        "intent": classification["intent"],
        "confidence": classification["confidence"],
        "lead_score": classification["lead_score"],
        "capture_lead": classification["capture_lead"],
    }


async def route_node(state: AgentState) -> str:
    intent = state.get("intent", "COMPANY_RELATED")
    routing = {
        "GREETING": "greeting",
        "COMPANY_RELATED": "rag",
        "PRODUCT_INFORMATION": "rag",
        "SALES_INQUIRY": "lead",
        "RFQ_REQUEST": "lead",
        "EXPORT_INQUIRY": "lead",
        "CONTACT_REQUEST": "lead",
        "SUPPORT_REQUEST": "support",
        "NON_COMPANY_RELATED": "redirect",
    }
    return routing.get(intent, "rag")


async def greeting_node(state: AgentState) -> AgentState:
    from app.rag.agents.greeting_agent import run
    messages = state["messages"]
    last_message = messages[-1]["content"] if messages else ""
    response = await run(last_message, state.get("company_name", "our company"))
    return {**state, "response": response}


async def rag_node(state: AgentState) -> AgentState:
    from app.rag.agents.rag_agent import run
    messages = state["messages"]
    last_message = messages[-1]["content"] if messages else ""
    history = messages[:-1]
    response = await run(last_message, state["company_id"], history)
    return {**state, "response": response}


async def lead_node(state: AgentState) -> AgentState:
    from app.rag.agents.lead_agent import run
    messages = state["messages"]
    last_message = messages[-1]["content"] if messages else ""
    history = messages[:-1]
    result = await run(last_message, state["company_id"], history)
    return {
        **state,
        "response": result["response"],
        "lead_data": result.get("lead_data"),
        "capture_lead": True,
    }


async def support_node(state: AgentState) -> AgentState:
    from app.rag.agents.support_agent import run
    messages = state["messages"]
    last_message = messages[-1]["content"] if messages else ""
    history = messages[:-1]
    response = await run(last_message, state["company_id"], history)
    return {**state, "response": response}


async def redirect_node(state: AgentState) -> AgentState:
    from app.rag.agents.redirect_agent import run
    messages = state["messages"]
    last_message = messages[-1]["content"] if messages else ""
    response = await run(last_message)
    return {**state, "response": response}


# Build graph
workflow = StateGraph(AgentState)
workflow.add_node("classify", classify_node)
workflow.add_node("greeting", greeting_node)
workflow.add_node("rag", rag_node)
workflow.add_node("lead", lead_node)
workflow.add_node("support", support_node)
workflow.add_node("redirect", redirect_node)

workflow.set_entry_point("classify")
workflow.add_conditional_edges("classify", route_node, {
    "greeting": "greeting",
    "rag": "rag",
    "lead": "lead",
    "support": "support",
    "redirect": "redirect",
})

for node in ["greeting", "rag", "lead", "support", "redirect"]:
    workflow.add_edge(node, END)

app_graph = workflow.compile()


async def run_agent(
    message: str,
    session_token: str,
    company_id: str,
    company_name: str,
    conversation_history: list,
    db=None,
) -> dict:
    initial_state = AgentState(
        messages=[*conversation_history, {"role": "user", "content": message}],
        intent="",
        confidence=0.0,
        lead_score=0,
        capture_lead=False,
        company_id=company_id,
        company_name=company_name,
        session_id=session_token,
        response="",
        lead_data=None,
    )
    result = await app_graph.ainvoke(initial_state)
    return {
        "response": result["response"],
        "intent": result["intent"],
        "lead_score": result["lead_score"],
        "capture_lead": result["capture_lead"],
        "lead_data": result.get("lead_data"),
    }
