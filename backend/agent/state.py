from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    trip_context: dict        # destination, dates, budget, party size
    tool_results: dict        # accumulated results from all tool calls
    itinerary: dict | None    # structured itinerary JSON once generated
