"""
Summary Agent for NyayaAI.
Generates executive summaries for non-lawyers.
Provides top risks and actionable recommendations.
"""

import logging
from typing import List, Dict
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

from schemas.models import (
    ExecutiveSummary, TopRisk, RiskLevel, 
    ContractRiskSummary, ClauseRiskScore
)
from risk_engine import compute_contract_score
from utils.retry_helper import retry_with_exponential_backoff

logger = logging.getLogger(__name__)


class SummaryAgent:
    """
    Agent responsible for generating executive summaries.
    Uses contract-level risk scoring and creates non-lawyer friendly summaries.
    """
    
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", temperature: float = 0.3):
        """
        Initialize the summary agent.
        
        Args:
            api_key: Google API key
            model: Model to use
            temperature: Temperature for LLM
        """
        self.llm = ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            google_api_key=api_key
        )
        
        self.parser = JsonOutputParser()
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self._get_system_prompt()),
            ("user", self._get_user_prompt())
        ])
        
        self.chain = self.prompt | self.llm | self.parser
        
        logger.info("SummaryAgent initialized")
    
    @retry_with_exponential_backoff(max_retries=3, initial_delay=2.0, max_delay=60.0)
    def _invoke_llm_with_retry(self, inputs: dict):
        """Invoke LLM chain with retry logic for rate limiting."""
        return self.chain.invoke(inputs)
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for summary generation."""
        return """You are an expert at explaining complex legal contracts to non-lawyers in simple, clear language.

Your task is to create an executive summary that helps business stakeholders understand contract risks without legal jargon.

Guidelines:
- Use plain English, avoid legal terminology where possible
- Focus on business impact and practical implications
- Be specific about risks and their consequences
- Provide actionable recommendations
- Be honest but balanced - highlight both risks and standard practices
- Use analogies or examples if helpful

Respond with ONLY a valid JSON object in this exact format:
{{
    "overall_risk_score": 75,
    "summary": "2-3 paragraph executive summary in plain language",
    "top_risks": [
        {{
            "clause_id": "clause_X",
            "clause_type": "Termination",
            "risk_description": "Plain language description of the risk",
            "priority": 1
        }}
    ],
    "recommendations": [
        "Actionable recommendation 1",
        "Actionable recommendation 2"
    ]
}}

Summary should cover:
- Overall assessment (Safe/Moderate Risk/High Risk)
- Key concerns in simple terms
- Standard vs unusual clauses
- Business impact

Top risks (max 5) should:
- Explain what could go wrong in business terms
- Avoid legal jargon
- Prioritize by severity

Recommendations should:
- Be specific and actionable
- Focus on negotiation points
- Suggest talking points for discussions

Do NOT include any text outside the JSON object.
"""
    
    def _get_user_prompt(self) -> str:
        """Get the user prompt template."""
        return """Generate executive summary for this contract:

Overall Risk Score: {overall_risk_score}/100
Risk Distribution: High: {high_pct}%, Medium: {medium_pct}%, Low: {low_pct}%
Total Clauses: {total_clauses}
Most Critical Clause: {critical_clause}

High Risk Clauses:
{high_risk_details}

Medium Risk Clauses:
{medium_risk_details}

Create a clear, non-technical summary for business stakeholders.
"""
    
    def generate_summary(
        self,
        clauses: List,
        risk_levels: Dict[str, RiskLevel],
        clause_scores: List[ClauseRiskScore],
        classified_types: Dict[str, str],
        contract_risk: ContractRiskSummary
    ) -> ExecutiveSummary:
        """
        Generate executive summary of the contract analysis.
        
        Args:
            clauses: List of all clauses
            risk_levels: Dict mapping clause_id to RiskLevel
            clause_scores: List of clause risk scores
            classified_types: Dict mapping clause_id to clause type
            contract_risk: Contract-level risk summary
            
        Returns:
            ExecutiveSummary object
        """
        # Prepare high risk details
        high_risk_clauses = [
            c for c in clauses 
            if risk_levels.get(c.clause_id) == RiskLevel.HIGH
        ]
        
        high_risk_details = "\n".join([
            f"- {c.clause_id} ({classified_types.get(c.clause_id, 'Unknown')}): {c.heading} - {c.content[:150]}..."
            for c in high_risk_clauses[:5]
        ]) or "None"
        
        # Prepare medium risk details
        medium_risk_clauses = [
            c for c in clauses 
            if risk_levels.get(c.clause_id) == RiskLevel.MEDIUM
        ]
        
        medium_risk_details = "\n".join([
            f"- {c.clause_id} ({classified_types.get(c.clause_id, 'Unknown')}): {c.heading}"
            for c in medium_risk_clauses[:5]
        ]) or "None"
        
        try:
            result = self._invoke_llm_with_retry({
                "overall_risk_score": contract_risk.overall_risk_score,
                "high_pct": contract_risk.risk_distribution.high,
                "medium_pct": contract_risk.risk_distribution.medium,
                "low_pct": contract_risk.risk_distribution.low,
                "total_clauses": len(clauses),
                "critical_clause": contract_risk.most_critical_clause,
                "high_risk_details": high_risk_details,
                "medium_risk_details": medium_risk_details
            })
            
            # Validate and create ExecutiveSummary
            summary = ExecutiveSummary(**result)
            
            logger.info(
                f"Generated executive summary with {len(summary.top_risks)} top risks "
                f"and {len(summary.recommendations)} recommendations"
            )
            
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            # Return default summary
            return ExecutiveSummary(
                overall_risk_score=contract_risk.overall_risk_score,
                summary=f"This contract has an overall risk score of {contract_risk.overall_risk_score}/100. "
                       f"{int(contract_risk.risk_distribution.high)}% of clauses are high risk. "
                       f"Manual review recommended.",
                top_risks=[
                    TopRisk(
                        clause_id=contract_risk.most_critical_clause,
                        clause_type="Unknown",
                        risk_description="Highest risk clause in the contract",
                        priority=1
                    )
                ],
                recommendations=[
                    "Review all high-risk clauses with legal counsel",
                    "Consider negotiating more balanced terms",
                    "Ensure liability caps are in place"
                ]
            )
    
    def create_executive_summary_text(self, summary: ExecutiveSummary) -> str:
        """
        Create a formatted text version of the executive summary.
        
        Args:
            summary: ExecutiveSummary object
            
        Returns:
            Formatted text string
        """
        lines = [
            "=" * 80,
            "EXECUTIVE SUMMARY - CONTRACT RISK ANALYSIS",
            "Generated by NyayaAI",
            "=" * 80,
            "",
            f"OVERALL RISK SCORE: {summary.overall_risk_score}/100",
            "",
            self._risk_score_indicator(summary.overall_risk_score),
            "",
            "SUMMARY",
            "-" * 80,
            summary.summary,
            "",
            "",
            "TOP RISKS TO CONSIDER",
            "-" * 80,
        ]
        
        for i, risk in enumerate(summary.top_risks, 1):
            lines.append(f"\n{i}. {risk.clause_type} (Clause: {risk.clause_id})")
            lines.append(f"   {risk.risk_description}")
        
        lines.extend([
            "",
            "",
            "RECOMMENDED ACTIONS",
            "-" * 80,
        ])
        
        for i, rec in enumerate(summary.recommendations, 1):
            lines.append(f"{i}. {rec}")
        
        lines.extend([
            "",
            "=" * 80,
            "This is an automated analysis. Always consult with legal counsel",
            "before making final decisions on contract execution.",
            "=" * 80
        ])
        
        return "\n".join(lines)
    
    def _risk_score_indicator(self, score: int) -> str:
        """Get a visual indicator of risk score."""
        if score >= 70:
            return "⚠️  HIGH RISK - Significant concerns identified. Careful review recommended."
        elif score >= 40:
            return "⚡ MODERATE RISK - Some concerns present. Review key clauses."
        else:
            return "✓ LOW RISK - Generally balanced contract with minor concerns."


def create_summary_agent(api_key: str, model: str = "gemini-2.5-flash") -> SummaryAgent:
    """
    Factory function to create a SummaryAgent.
    
    Args:
        api_key: Google API key
        model: Model name to use
        
    Returns:
        Configured SummaryAgent
    """
    return SummaryAgent(api_key=api_key, model=model)
