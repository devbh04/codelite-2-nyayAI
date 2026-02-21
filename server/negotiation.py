"""
LangGraph-based negotiation engine.

Two agents (Party A — defends original contract, Party B — advocates for changes)
debate each risk clause for up to 5 rounds. A Judge then evaluates and produces
a balanced verdict.
"""

import os
import re
from typing import Annotated, Literal
from operator import add

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

load_dotenv()

# ── LLM ──────────────────────────────────────────────────────────────────────

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.7,
)


# ── State ────────────────────────────────────────────────────────────────────

class DebateMessage(BaseModel):
    party: Literal["a", "b"]
    round: int
    text: str


class NegotiationState(BaseModel):
    risk_id: str = ""
    risk_type: str = ""
    original_clause: str = ""
    suggestion: str = ""
    messages: Annotated[list[DebateMessage], add] = Field(default_factory=list)
    current_round: int = 0
    conclusion: str = ""
    judge_reasoning: str = ""
    done: bool = False


# ── Prompts ──────────────────────────────────────────────────────────────────

PARTY_A_SYSTEM = """You are Corporate Counsel (Party A) defending the original contract clause.
Your goal: Preserve the original phrasing, maximize legal protection for the disclosing party,
and minimize liability. Argue concisely why the original clause should remain as-is or with
minimal changes. Reference Indian Contract Act principles where relevant.
Keep your response to 2-3 sentences max."""

PARTY_B_SYSTEM = """You are the Reviewing Party's Legal Advisor (Party B) advocating for fairer terms.
Your goal: Argue why the clause needs modification to be balanced. You have a specific
suggestion to work from. Push for changes that protect the receiving party while remaining
reasonable. Reference Indian Contract Act principles where relevant.
Keep your response to 2-3 sentences max."""

JUDGE_SYSTEM = """You are a neutral Judge evaluating a legal clause negotiation.
You have read the full debate between Party A (defending original) and Party B (advocating changes).

You must output EXACTLY two sections separated by "---":

Section 1 - Your reasoning: 2-3 sentences analyzing both sides' arguments, noting strengths
and weaknesses, and explaining your decision.

---

Section 2 - The balanced clause: ONLY the replacement clause text that both parties should accept.
No preamble, no quotes, just the clause.

Example format:
Party A raises valid concerns about liability exposure under Section 73. However, Party B's
point about unreasonable cure periods is well-taken. A middle ground with tiered timelines
best serves both interests.
---
Either Party may terminate this Agreement upon 21 days written notice for material breach."""


# ── Node functions ───────────────────────────────────────────────────────────

async def party_a_node(state: NegotiationState) -> dict:
    """Party A argues to preserve the original clause."""
    round_num = state.current_round + 1

    history = "\n".join(
        f"{'Party A' if m.party == 'a' else 'Party B'} (Round {m.round}): {m.text}"
        for m in state.messages
    )

    prompt = f"""Original clause: "{state.original_clause}"
Suggested change: "{state.suggestion}"

Debate history:
{history if history else "(Opening argument)"}

This is Round {round_num}. Make your argument for preserving the original clause."""

    response = await llm.ainvoke([
        SystemMessage(content=PARTY_A_SYSTEM),
        HumanMessage(content=prompt),
    ])

    return {
        "messages": [DebateMessage(party="a", round=round_num, text=response.content)],
        "current_round": round_num,
    }


async def party_b_node(state: NegotiationState) -> dict:
    """Party B argues for changes using the suggestion."""
    round_num = state.current_round

    history = "\n".join(
        f"{'Party A' if m.party == 'a' else 'Party B'} (Round {m.round}): {m.text}"
        for m in state.messages
    )

    prompt = f"""Original clause: "{state.original_clause}"
Your suggested change: "{state.suggestion}"

Debate history:
{history}

This is Round {round_num}. Respond to Party A's argument and advocate for the suggested changes."""

    response = await llm.ainvoke([
        SystemMessage(content=PARTY_B_SYSTEM),
        HumanMessage(content=prompt),
    ])

    return {
        "messages": [DebateMessage(party="b", round=round_num, text=response.content)],
    }


async def judge_node(state: NegotiationState) -> dict:
    """Judge evaluates the debate and produces a verdict with reasoning."""
    history = "\n".join(
        f"{'Party A' if m.party == 'a' else 'Party B'} (Round {m.round}): {m.text}"
        for m in state.messages
    )

    prompt = f"""Original clause: "{state.original_clause}"
Suggested change: "{state.suggestion}"

Full debate:
{history}

Evaluate both sides and produce your verdict."""

    response = await llm.ainvoke([
        SystemMessage(content=JUDGE_SYSTEM),
        HumanMessage(content=prompt),
    ])

    raw = response.content.strip()

    # Split on --- separator
    if "---" in raw:
        parts = raw.split("---", 1)
        reasoning = parts[0].strip()
        conclusion = parts[1].strip()
    else:
        reasoning = "The judge has evaluated both arguments."
        conclusion = raw

    return {
        "judge_reasoning": reasoning,
        "conclusion": conclusion,
        "done": True,
    }


def should_continue(state: NegotiationState) -> str:
    """Route: continue debating or go to judge."""
    if state.current_round >= 5:
        return "judge"
    return "continue"


# ── Graph Construction ───────────────────────────────────────────────────────

def build_negotiation_graph():
    """Build and compile the LangGraph negotiation graph."""
    graph = StateGraph(NegotiationState)

    graph.add_node("party_a", party_a_node)
    graph.add_node("party_b", party_b_node)
    graph.add_node("judge", judge_node)

    graph.add_edge(START, "party_a")
    graph.add_edge("party_a", "party_b")
    graph.add_conditional_edges(
        "party_b",
        should_continue,
        {"continue": "party_a", "judge": "judge"},
    )
    graph.add_edge("judge", END)

    return graph.compile()


negotiation_graph = build_negotiation_graph()


# ── Runner (yields events for WebSocket streaming) ──────────────────────────

async def run_negotiation(risk: dict):
    """
    Run negotiation for a single risk.
    Yields JSON-serializable event dicts as the debate progresses.
    """
    risk_id = risk["id"]
    risk_type = risk["type"]
    original_clause = risk["content"]
    suggestion = risk.get("suggestion", "")

    yield {
        "type": "debate_start",
        "risk_id": risk_id,
        "risk_type": risk_type,
        "clause": original_clause,
    }

    initial_state = NegotiationState(
        risk_id=risk_id,
        risk_type=risk_type,
        original_clause=original_clause,
        suggestion=suggestion,
    )

    # Stream graph execution
    prev_messages_count = 0
    concluded = False
    async for state_update in negotiation_graph.astream(initial_state, stream_mode="values"):
        # Check for new messages
        messages = state_update.messages if hasattr(state_update, "messages") else state_update.get("messages", [])
        for msg in messages[prev_messages_count:]:
            if isinstance(msg, DebateMessage):
                m = msg
            elif isinstance(msg, dict):
                m = DebateMessage(**msg)
            else:
                continue
            yield {
                "type": f"party_{m.party}",
                "risk_id": risk_id,
                "round": m.round,
                "message": m.text,
            }
        prev_messages_count = len(messages)

        # Check for judge verdict
        conclusion = state_update.conclusion if hasattr(state_update, "conclusion") else state_update.get("conclusion", "")
        reasoning = state_update.judge_reasoning if hasattr(state_update, "judge_reasoning") else state_update.get("judge_reasoning", "")
        if conclusion and not concluded:
            concluded = True
            yield {
                "type": "judge_verdict",
                "risk_id": risk_id,
                "reasoning": reasoning,
                "balanced_clause": conclusion,
            }


def apply_conclusions_to_markdown(original_md: str, risks: list[dict], conclusions: dict[str, str]) -> str:
    """
    Replace flagged risk clauses in the original markdown with accepted balanced conclusions.
    
    Approach: Use the SAME regex the frontend uses to find all -TYPE-...-TYPE- blocks
    in the raw markdown. Each match gets a sequential ID (risk-0, risk-1, ...) — the
    same IDs the frontend generates. Then replace only the accepted ones.
    """
    # Same regex pattern as frontend parseAnnotations
    pattern = re.compile(
        r"-(hr|mr|lr)-([\s\S]*?)-(hr|mr|lr)-(?:\s*-sg-[\s\S]*?-sg-)?(?:\s*-ipc-[\s\S]*?-ipc-)?"
    )

    # Find all matches with their positions
    matches = list(pattern.finditer(original_md))

    # Process in reverse order so replacing doesn't shift positions
    result = original_md
    for i in reversed(range(len(matches))):
        risk_id = f"risk-{i}"
        if risk_id in conclusions and conclusions[risk_id]:
            match = matches[i]
            balanced = conclusions[risk_id]
            # Wrap accepted clause in green <mark> for highlighting
            replacement = f'<mark data-negotiated="accepted">{balanced}</mark>'
            result = result[:match.start()] + replacement + result[match.end():]

    return result
