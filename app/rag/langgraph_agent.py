import operator
from typing import TypedDict, List, Optional, Annotated
from langgraph.graph import StateGraph, END
from app.rag.intent_classifier import classify_intent
from app.rag import agents


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
    last_msg = state["messages"][-1]["content"] if state["messages"] else ""
    history = state["messages"][:-1]
    result = await classify_intent(last_msg, history)
    return {**state, **result}


def route_node(state: AgentState) -> str:
    intent_map = {
        "GREETING": "greeting",
        "COMPANY_RELATED": "rag",
        "PRODUCT_INFORMATION": "rag",
        "EXPORT_INQUIRY": "lead",
        "RFQ_REQUEST": "lead",
        "SALES_INQUIRY": "lead",
        "SUPPORT_REQUEST": "support",
        "CONTACT_REQUEST": "support",
        "NON_COMPANY_RELATED": "redirect",
    }
    return intent_map.get(state.get("intent", ""), "rag")


async def greeting_node(state: AgentState) -> AgentState:
    msg = state["messages"][-1]["content"]
    response = await agents.greeting_agent.run(msg, state.get("company_name", "our company"))
    return {**state, "response": response}


async def rag_node(state: AgentState) -> AgentState:
    msg = state["messages"][-1]["content"]
    history = state["messages"][:-1]
    response = await agents.rag_agent.run(msg, state["company_id"], history)
    return {**state, "response": response}


async def lead_node(state: AgentState) -> AgentState:
    msg = state["messages"][-1]["content"]
    history = state["messages"][:-1]
    result = await agents.lead_agent.run(msg, state["company_id"], history)
    return {**state, "response": result["response"], "lead_data": result.get("lead_data"), "capture_lead": True}


async def support_node(state: AgentState) -> AgentState:
    msg = state["messages"][-1]["content"]
    history = state["messages"][:-1]
    response = await agents.support_agent.run(msg, state["company_id"], history)
    return {**state, "response": response}


async def redirect_node(state: AgentState) -> AgentState:
    response = await agents.redirect_agent.run(state["messages"][-1]["content"])
    return {**state, "response": response}


workflow = StateGraph(AgentState)
workflow.add_node("classify", classify_node)
workflow.add_node("greeting", greeting_node)
workflow.add_node("rag", rag_node)
workflow.add_node("lead", lead_node)
workflow.add_node("support", support_node)
workflow.add_node("redirect", redirect_node)
workflow.set_entry_point("classify")
workflow.add_conditional_edges("classify", route_node, {
    "greeting": "greeting", "rag": "rag", "lead": "lead",
    "support": "support", "redirect": "redirect",
})
for node in ["greeting", "rag", "lead", "support", "redirect"]:
    workflow.add_edge(node, END)
app_graph = workflow.compile()


async def run_agent(message: str, session_token: str, company_id: str, company_name: str,
                    conversation_history: list, db=None) -> dict:
    state = AgentState(
        messages=[*conversation_history, {"role": "user", "content": message}],
        intent="", confidence=0.0, lead_score=0, capture_lead=False,
        company_id=company_id, company_name=company_name,
        session_id=session_token, response="", lead_data=None,
    )
    result = await app_graph.ainvoke(state)
    return {
        "response": result["response"],
        "intent": result["intent"],
        "lead_score": result["lead_score"],
        "capture_lead": result["capture_lead"],
        "lead_data": result.get("lead_data"),
    }
