"""
Pydantic models for NyayaAI system.
Defines all data schemas used across the application.
"""

from typing import List, Dict, Optional
from pydantic import BaseModel, Field
from enum import Enum


class ClauseType(str, Enum):
    """Enumeration of contract clause types."""
    TERMINATION = "Termination"
    INDEMNITY = "Indemnity"
    ARBITRATION = "Arbitration"
    JURISDICTION = "Jurisdiction"
    IP_ASSIGNMENT = "IP Assignment"
    CONFIDENTIALITY = "Confidentiality"
    PENALTY = "Penalty"
    RENT_ESCALATION = "Rent Escalation"
    NON_COMPETE = "Non-compete"
    DATA_PROTECTION = "Data Protection"
    PAYMENT_TERMS = "Payment Terms"
    LIABILITY = "Liability"
    OTHER = "Other"


class RiskLevel(str, Enum):
    """Enumeration of risk levels."""
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class Clause(BaseModel):
    """Represents a single clause extracted from a contract."""
    clause_id: str = Field(..., description="Unique identifier for the clause")
    heading: str = Field(..., description="Clause heading or title")
    content: str = Field(..., description="Full text content of the clause")
    page: int = Field(..., description="Page number where clause appears")


class ClassifiedClause(BaseModel):
    """Represents a classified clause with type and confidence."""
    clause_id: str
    type: ClauseType
    confidence: float = Field(..., ge=0.0, le=1.0)


class Issue(BaseModel):
    """Represents a specific issue found in a clause."""
    issue_type: str
    explanation: str
    trigger_terms: List[str] = Field(default_factory=list)


class RiskAssessment(BaseModel):
    """LLM-generated risk assessment for a clause."""
    clause_id: str
    risk_level: RiskLevel
    issues: List[Issue]


class ScoreModifier(BaseModel):
    """Represents a single score modification and reason."""
    modifier_type: str
    value: int
    reason: str


class ScoringBreakdown(BaseModel):
    """Detailed breakdown of how a risk score was calculated."""
    base_score: int
    modifiers: List[ScoreModifier] = Field(default_factory=list)


class ClauseRiskScore(BaseModel):
    """Complete risk scoring for a single clause."""
    clause_id: str
    final_risk_score: int = Field(..., ge=0, le=100)
    scoring_breakdown: ScoringBreakdown


class RiskOutput(BaseModel):
    """Complete risk analysis output for a clause."""
    clause_id: str
    risk_level: RiskLevel
    risk_score: int = Field(..., ge=0, le=100)
    scoring_breakdown: ScoringBreakdown
    updated_markdown_path: str


class Citation(BaseModel):
    """Legal citation for a clause."""
    clause_id: str
    section: Optional[str] = None
    law_name: Optional[str] = None
    explanation: Optional[str] = None
    found: bool = True


class Redline(BaseModel):
    """Suggested rewrite for a clause."""
    clause_id: str
    original_text: str
    suggested_text: str
    rationale: str


class RiskDistribution(BaseModel):
    """Distribution of risk levels across a contract."""
    high: float = Field(..., ge=0.0, le=100.0, description="Percentage of high-risk clauses")
    medium: float = Field(..., ge=0.0, le=100.0, description="Percentage of medium-risk clauses")
    low: float = Field(..., ge=0.0, le=100.0, description="Percentage of low-risk clauses")


class ContractRiskSummary(BaseModel):
    """Overall risk summary for the entire contract."""
    overall_risk_score: int = Field(..., ge=0, le=100)
    risk_distribution: RiskDistribution
    most_critical_clause: str
    risk_concentration_index: float = Field(..., ge=0.0, le=1.0)


class TopRisk(BaseModel):
    """Represents a top risk in the contract."""
    clause_id: str
    clause_type: str
    risk_description: str
    priority: int


class ExecutiveSummary(BaseModel):
    """Executive summary for non-lawyers."""
    overall_risk_score: int = Field(..., ge=0, le=100)
    summary: str
    top_risks: List[TopRisk]
    recommendations: List[str]


class NegotiationRound(BaseModel):
    """Single round of negotiation simulation."""
    round_number: int
    party_a_position: str
    party_b_position: str
    compromise: str


class NegotiationResult(BaseModel):
    """Result of negotiation simulation."""
    clause_id: str
    final_clause: str
    negotiation_log: List[NegotiationRound]


class WorkflowState(BaseModel):
    """State object for LangGraph workflow."""
    pdf_path: str = ""
    markdown_path: str = ""
    clauses: List[Clause] = Field(default_factory=list)
    classified: List[ClassifiedClause] = Field(default_factory=list)
    risk_outputs: List[RiskOutput] = Field(default_factory=list)
    risk_scores: List[ClauseRiskScore] = Field(default_factory=list)
    citations: List[Citation] = Field(default_factory=list)
    redlines: List[Redline] = Field(default_factory=list)
    contract_risk_summary: Optional[ContractRiskSummary] = None
    summary: Optional[ExecutiveSummary] = None
    error: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True
