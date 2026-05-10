from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages


# TypedDict gives LangGraph a schema so it can validate and trace every state transition
class AgentState(TypedDict):
    # add_messages is a reducer: instead of replacing the list it appends new messages each step
    messages: Annotated[list, add_messages]
    trip_context: dict        # destination, dates, budget, party size
    tool_results: dict        # accumulated results from all tool calls
    itinerary: dict | None    # structured itinerary JSON once generated
