"""
Risk Detector Agent for NyayaAI.
Detects risk levels in contract clauses using LLM for qualitative analysis.
Integrates with risk_engine.py for deterministic scoring.
Updates markdown with risk tags.
"""

import re
import logging
from pathlib import Path
from typing import List
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

from schemas.models import (
    Clause, RiskAssessment, RiskLevel, RiskOutput, 
    ClauseRiskScore, Issue
)
from risk_engine import compute_clause_score
from utils.retry_helper import retry_with_exponential_backoff

logger = logging.getLogger(__name__)


class RiskDetectorAgent:
    """
    Agent responsible for detecting and scoring risk in contract clauses.
    Uses LLM for qualitative analysis and deterministic engine for scoring.
    """
    
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", temperature: float = 0.2):
        """
        Initialize the risk detector agent.
        
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
            ("user", "Analyze this clause:\n\nClause ID: {clause_id}\nType: {clause_type}\nContent: {content}")
        ])
        
        self.chain = self.prompt | self.llm | self.parser
        
        logger.info("RiskDetectorAgent initialized")
    
    @retry_with_exponential_backoff(max_retries=3, initial_delay=2.0, max_delay=60.0)
    def _invoke_llm_with_retry(self, inputs: dict):
        """Invoke LLM chain with retry logic for rate limiting."""
        return self.chain.invoke(inputs)
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for risk detection."""
        return """You are an expert legal risk analyst specializing in Indian contract law.

Your task is to analyze contract clauses and identify potential risks for the party signing the contract.

IMPORTANT: Only flag clauses that have REAL, SIGNIFICANT risks. If a clause is standard, reasonable, or balanced, return an EMPTY issues array and set risk_level to "Low".

Respond with ONLY a valid JSON object in this exact format:
{{
    "clause_id": "the clause identifier",
    "risk_level": "High" or "Medium" or "Low",
    "issues": [
        {{
            "issue_type": "brief issue category",
            "explanation": "detailed explanation of the risk",
            "trigger_terms": ["specific", "problematic", "terms"]
        }}
    ]
}}

Risk Level Guidelines:
- High: Severe financial/legal exposure, unilateral termination, unlimited liability, IP loss WITHOUT safeguards
- Medium: Moderate risk, unclear terms, one-sided provisions, needs attention but not critical
- Low: Minor concerns, slightly imbalanced but acceptable, minor ambiguities

IMPORTANT: If a clause is standard, reasonable, fair, and has NO risks, return EMPTY issues array. Do not assign any risk level to perfectly fine clauses.

Consider Indian legal context:
- Indian Contract Act 1872
- Consumer Protection laws
- IT Act 2000
- Standard business practices in India

Be precise and conservative:
- Only flag clauses that have actual problems
- Standard boilerplate = empty issues array
- Balanced terms = empty issues array
- Normal business provisions = empty issues array

Do NOT include any text outside the JSON object.
"""
    
    def detect_risk(self, clause: Clause, clause_type: str) -> RiskAssessment:
        """
        Detect risks in a single clause using LLM.
        
        Args:
            clause: The clause to analyze
            clause_type: The classified type of the clause
            
        Returns:
            RiskAssessment with risk level and issues
        """
        try:
            result = self._invoke_llm_with_retry({
                "clause_id": clause.clause_id,
                "clause_type": clause_type,
                "content": clause.content[:2000]  # Limit content
            })
            
            # Validate and create RiskAssessment
            risk_assessment = RiskAssessment(**result)
            
            logger.info(
                f"Risk detected for {clause.clause_id}: {risk_assessment.risk_level} "
                f"with {len(risk_assessment.issues)} issues"
            )
            
            return risk_assessment
            
        except Exception as e:
            logger.error(f"Error detecting risk for clause {clause.clause_id}: {e}")
            # Return default assessment
            return RiskAssessment(
                clause_id=clause.clause_id,
                risk_level=RiskLevel.MEDIUM,
                issues=[]
            )
    
    def compute_and_tag_risk(
        self,
        clause: Clause,
        clause_type: str,
        markdown_content: str
    ) -> tuple[RiskOutput, str]:
        """
        Detect risk, compute score, and tag markdown.
        
        Args:
            clause: The clause to analyze
            clause_type: Classified type
            markdown_content: Current markdown content
            
        Returns:
            Tuple of (RiskOutput, updated_markdown_content)
        """
        # Step 1: LLM-based risk detection
        risk_assessment = self.detect_risk(clause, clause_type)
        
        # Step 2: Deterministic scoring
        clause_score = compute_clause_score(
            clause.clause_id,
            clause.content,
            risk_assessment.risk_level
        )
        
        # Check if clause has actual issues
        has_issues = len(risk_assessment.issues) > 0
        
        # Step 3: Tag markdown (only if has issues)
        updated_markdown = self._tag_markdown(
            markdown_content,
            clause.clause_id,
            risk_assessment.risk_level,
            has_issues=has_issues
        )
        
        # Create output
        risk_output = RiskOutput(
            clause_id=clause.clause_id,
            risk_level=risk_assessment.risk_level,
            risk_score=clause_score.final_risk_score,
            scoring_breakdown=clause_score.scoring_breakdown,
            updated_markdown_path=""  # Will be set by caller
        )
        
        return risk_output, updated_markdown
    
    def _tag_markdown(
        self,
        markdown_content: str,
        clause_id: str,
        risk_level: RiskLevel,
        has_issues: bool = True
    ) -> str:
        """
        Add risk tags to markdown content only if clause has actual issues.
        
        Args:
            markdown_content: Current markdown content
            clause_id: ID of clause to tag
            risk_level: Risk level to tag with
            has_issues: Whether the clause has actual issues to tag
            
        Returns:
            Updated markdown content with risk tags (or untagged if no issues)
        """
        # If no issues, remove placeholders but don't tag
        if not has_issues:
            # Just remove placeholders without adding risk tags
            pattern = rf'\{{\{{CLAUSE_{re.escape(clause_id)}\}}\}}(.*?)\{{\{{/CLAUSE_{re.escape(clause_id)}\}}\}}'
            
            def replace_func(match):
                content = match.group(1)
                return content  # Return content without tags
            
            updated_markdown = re.sub(pattern, replace_func, markdown_content, flags=re.DOTALL)
            return updated_markdown
        
        # Define risk tags for all three levels
        risk_tags = {
            RiskLevel.HIGH: ("-hr-", "-hr-"),
            RiskLevel.MEDIUM: ("-mr-", "-mr-"),
            RiskLevel.LOW: ("-lr-", "-lr-")
        }
        
        start_tag, end_tag = risk_tags[risk_level]
        
        # Find clause placeholder in markdown
        pattern = rf'\{{\{{CLAUSE_{re.escape(clause_id)}\}}\}}(.*?)\{{\{{/CLAUSE_{re.escape(clause_id)}\}}\}}'
        
        def replace_func(match):
            content = match.group(1)
            # Replace placeholders with risk-tagged content
            return f"{start_tag}{content}{end_tag}"
        
        updated_markdown = re.sub(pattern, replace_func, markdown_content, flags=re.DOTALL)
        
        return updated_markdown
    
    def process_all_clauses(
        self,
        clauses: List[Clause],
        classified_types: dict,
        markdown_path: str
    ) -> tuple[List[RiskOutput], str]:
        """
        Process all clauses for risk detection and tagging.
        
        Args:
            clauses: List of clauses to process
            classified_types: Dict mapping clause_id to clause_type
            markdown_path: Path to markdown file
            
        Returns:
            Tuple of (list of RiskOutputs, updated_markdown_path)
        """
        # Read markdown content
        with open(markdown_path, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
        
        risk_outputs = []
        
        for clause in clauses:
            clause_type = classified_types.get(clause.clause_id, "Other")
            
            risk_output, markdown_content = self.compute_and_tag_risk(
                clause,
                clause_type,
                markdown_content
            )
            
            risk_outputs.append(risk_output)
        
        # Save updated markdown
        with open(markdown_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        logger.info(f"Processed {len(risk_outputs)} clauses and updated markdown")
        
        # Update paths in outputs
        for output in risk_outputs:
            output.updated_markdown_path = markdown_path
        
        return risk_outputs, markdown_path


def create_risk_detector_agent(api_key: str, model: str = "gemini-2.5-flash") -> RiskDetectorAgent:
    """
    Factory function to create a RiskDetectorAgent.
    
    Args:
        api_key: Google API key
        model: Model name to use
        
    Returns:
        Configured RiskDetectorAgent
    """
    return RiskDetectorAgent(api_key=api_key, model=model)
