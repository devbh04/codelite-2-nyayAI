"""
Clause Classifier Agent for NyayaAI.
Classifies contract clauses into predefined categories using LLM.
Uses strict JSON schema and low temperature for deterministic results.
"""

import json
import logging
from typing import List
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import ValidationError

from schemas.models import Clause, ClassifiedClause, ClauseType
from utils.retry_helper import retry_with_exponential_backoff

logger = logging.getLogger(__name__)


class ClauseClassifierAgent:
    """
    Agent responsible for classifying contract clauses.
    Uses LLM with strict JSON output and low temperature.
    """
    
    CLASSIFICATION_CATEGORIES = [
        "Termination",
        "Indemnity",
        "Arbitration",
        "Jurisdiction",
        "IP Assignment",
        "Confidentiality",
        "Penalty",
        "Rent Escalation",
        "Non-compete",
        "Data Protection",
        "Payment Terms",
        "Liability",
        "Other"
    ]
    
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", temperature: float = 0.1):
        """
        Initialize the clause classifier agent.
        
        Args:
            api_key: Google API key
            model: Model to use for classification
            temperature: Temperature for LLM (0-0.2 for deterministic)
        """
        self.llm = ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            google_api_key=api_key
        )
        
        self.parser = JsonOutputParser()
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self._get_system_prompt()),
            ("user", "Classify this clause:\n\nClause ID: {clause_id}\nHeading: {heading}\nContent: {content}")
        ])
        
        self.chain = self.prompt | self.llm | self.parser
        
        logger.info("ClauseClassifierAgent initialized")
    
    @retry_with_exponential_backoff(max_retries=3, initial_delay=2.0, max_delay=60.0)
    def _invoke_llm_with_retry(self, inputs: dict):
        """Invoke LLM chain with retry logic for rate limiting."""
        return self.chain.invoke(inputs)
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for classification."""
        categories_list = "\n".join([f"- {cat}" for cat in self.CLASSIFICATION_CATEGORIES])
        
        return f"""You are an expert legal document analyst specializing in contract clause classification for Indian contracts.

Your task is to classify contract clauses into one of the following categories:

{categories_list}

Respond with ONLY a valid JSON object in this exact format:
{{{{
    "clause_id": "the clause identifier",
    "type": "one of the categories above",
    "confidence": 0.95
}}}}

Rules:
- confidence must be a float between 0.0 and 1.0
- type must exactly match one of the categories listed above
- Be precise and analytical
- Consider Indian legal context
- If unclear, classify as "Other" with lower confidence
- Do NOT include any text outside the JSON object
"""
    
    def classify_clause(self, clause: Clause) -> ClassifiedClause:
        """
        Classify a single clause.
        
        Args:
            clause: The clause to classify
            
        Returns:
            ClassifiedClause with type and confidence
        """
        try:
            result = self._invoke_llm_with_retry({
                "clause_id": clause.clause_id,
                "heading": clause.heading,
                "content": clause.content[:1000]  # Limit content length
            })
            
            # Validate and create ClassifiedClause
            classified = ClassifiedClause(**result)
            
            logger.info(
                f"Classified {clause.clause_id} as {classified.type} "
                f"(confidence: {classified.confidence:.2f})"
            )
            
            return classified
            
        except ValidationError as e:
            logger.error(f"Validation error for clause {clause.clause_id}: {e}")
            # Return default classification
            return ClassifiedClause(
                clause_id=clause.clause_id,
                type=ClauseType.OTHER,
                confidence=0.5
            )
        
        except Exception as e:
            logger.error(f"Error classifying clause {clause.clause_id}: {e}")
            # Return default classification
            return ClassifiedClause(
                clause_id=clause.clause_id,
                type=ClauseType.OTHER,
                confidence=0.3
            )
    
    def classify_clauses(self, clauses: List[Clause]) -> List[ClassifiedClause]:
        """
        Classify multiple clauses.
        
        Args:
            clauses: List of clauses to classify
            
        Returns:
            List of ClassifiedClause objects
        """
        classified_clauses = []
        
        for clause in clauses:
            classified = self.classify_clause(clause)
            classified_clauses.append(classified)
        
        logger.info(f"Successfully classified {len(classified_clauses)} clauses")
        
        return classified_clauses


def create_classifier_agent(api_key: str, model: str = "gemini-2.5-flash") -> ClauseClassifierAgent:
    """
    Factory function to create a ClauseClassifierAgent.
    
    Args:
        api_key: Google API key
        model: Model name to use
        
    Returns:
        Configured ClauseClassifierAgent
    """
    return ClauseClassifierAgent(api_key=api_key, model=model)
