"""
Redline Suggestion Agent for NyayaAI.
Generates balanced clause rewrites for risky clauses.
Suggests modifications to make clauses more fair and balanced.
"""

import re
import json
import logging
import time
from typing import List
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

from schemas.models import Redline, RiskLevel
from utils.retry_helper import retry_with_exponential_backoff

logger = logging.getLogger(__name__)


class RedlineGeneratorAgent:
    """
    Agent responsible for generating balanced clause rewrites.
    Converts unilateral clauses to bilateral, adds safeguards.
    """
    
    def __init__(self, api_key: str, model: str = "gemini-2.5-flash", temperature: float = 0.3):
        """
        Initialize the redline generator agent.
        
        Args:
            api_key: Google API key
            model: Model to use
            temperature: Temperature for LLM (slightly higher for creativity)
        """
        self.llm = ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            google_api_key=api_key
        )
        
        self.parser = JsonOutputParser()
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self._get_system_prompt()),
            ("user", "Generate redline:\n\nClause ID: {clause_id}\nRisk Level: {risk_level}\nOriginal: {content}\nLegal Context: {legal_context}")
        ])
        
        self.chain = self.prompt | self.llm | self.parser
        
        logger.info("RedlineGeneratorAgent initialized")
    
    @retry_with_exponential_backoff(max_retries=3, initial_delay=2.0, max_delay=60.0)
    def _invoke_llm_with_retry(self, inputs: dict):
        """Invoke LLM chain with retry logic for rate limiting."""
        return self.chain.invoke(inputs)
    
    def _extract_json_from_response(self, response) -> dict:
        """Extract JSON from LLM response, handling various formats."""
        if isinstance(response, dict):
            return response
        response_str = str(response)
        json_match = re.search(r'```(?:json)?\s*(.+?)\s*```', response_str, re.DOTALL)
        if json_match:
            response_str = json_match.group(1)
        try:
            return json.loads(response_str)
        except json.JSONDecodeError:
            json_obj_match = re.search(r'\{.+\}', response_str, re.DOTALL)
            if json_obj_match:
                return json.loads(json_obj_match.group(0))
            raise ValueError(f"Invalid JSON: {response_str[:200]}")
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for redline generation."""
        return """You are an expert contract negotiation advisor specializing in Indian commercial law.

Your task is to provide SHORT, ACTIONABLE advice (NOT full rewrites) on how to improve risky clauses.

IMPORTANT OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON object. Do not include ANY text before or after the JSON.

JSON Format (EXACT):
{{
    "clause_id": "the clause identifier from input",
    "original_text": "first 80-100 chars of original clause",
    "suggested_text": "2-3 short sentences of concise advice",
    "rationale": "1 short sentence why this helps"
}}

RULES:
- suggested_text: Maximum 3-4 lines of advice (NOT a rewrite)
- Focus on KEY improvements only
- Be specific and actionable
- Keep it brief and clear

Example suggested_text:
"Add 30-day written notice before termination. Cap liability at 12 months of fees. Make indemnification mutual. Include cure period for breaches."

Key Improvements:
- Unilateral → mutual/bilateral
- Add notice periods (30-60 days)
- Add liability caps
- Clarify vague terms
- Add safeguards

Return ONLY the JSON object, nothing else.
"""
    
    def generate_redline(
        self,
        clause_id: str,
        clause_content: str,
        risk_level: RiskLevel,
        legal_context: str = ""
    ) -> Redline:
        """
        Generate a balanced rewrite for a risky clause.
        
        Args:
            clause_id: ID of the clause
            clause_content: Original clause content
            risk_level: Risk level of the clause
            legal_context: Optional legal citation context
            
        Returns:
            Redline object with suggested rewrite
        """
        try:
            # Add delay to avoid rate limiting
            time.sleep(2)
            
            # Limit content length
            limited_content = clause_content[:1000]  # Shorter for better processing
            
            raw_response = self._invoke_llm_with_retry({
                "clause_id": clause_id,
                "risk_level": risk_level.value,
                "content": limited_content,
                "legal_context": legal_context or "No specific legal reference"
            })
            
            # Extract and validate JSON (handles various response formats)
            result = self._extract_json_from_response(raw_response) if not isinstance(raw_response, dict) else raw_response
            
            # Ensure original_text is limited
            if 'original_text' in result:
                result['original_text'] = result['original_text'][:100]
            else:
                result['original_text'] = clause_content[:100]
            
            # Ensure suggested_text is concise
            if 'suggested_text' in result and len(result['suggested_text']) > 500:
                # Truncate if too long
                result['suggested_text'] = result['suggested_text'][:500] + "..."
            
            # Validate and create Redline
            redline = Redline(**result)
            
            logger.info(f"Generated redline for {clause_id}")
            
            return redline
            
        except Exception as e:
            logger.error(f"Error generating redline for {clause_id}: {e}")
            if 'raw_response' in locals():
                logger.error(f"Raw response preview: {str(raw_response)[:300]}")
            # Return concise default redline with helpful suggestion
            return Redline(
                clause_id=clause_id,
                original_text=clause_content[:100],
                suggested_text="Add balanced terms with mutual rights. Include notice periods (30-60 days) and liability caps. Clarify vague language.",
                rationale="Standard improvements for risky clauses under Indian Contract Act"
            )
    
    def _insert_suggestion_in_markdown(
        self,
        markdown_content: str,
        clause_id: str,
        redline: Redline
    ) -> str:
        """
        Insert suggestion tag below citation in markdown.
        
        Args:
            markdown_content: Current markdown content
            clause_id: ID of clause to add suggestion to
            redline: Redline suggestion to insert
            
        Returns:
            Updated markdown content
        """
        # Find the clause and its citation end (inline format)
        # Extract clause number from clause_id
        clause_num = clause_id.replace("clause_", "")
        
        if clause_num == "preamble":
            pattern = rf'(---\n\n.*?-[hlm]r--ipc-.*?-ipc-)(\n\n1\. )'
            
            def replace_func(match):
                clause_section = match.group(1)
                suffix = match.group(2)
                suggestion_text = f"-sg-{redline.suggested_text}-sg-"
                return clause_section + suggestion_text + suffix
        else:
            pattern = rf'({clause_num}\. -[hlm]r-.*?-[hlm]r--ipc-.*?-ipc-)'
            
            def replace_func(match):
                clause_section = match.group(1)
                suggestion_text = f"-sg-{redline.suggested_text}-sg-"
                return clause_section + suggestion_text
        
        updated_markdown = re.sub(
            pattern,
            replace_func,
            markdown_content,
            count=1,
            flags=re.DOTALL
        )
        
        return updated_markdown
    
    def process_cited_markdown(
        self,
        markdown_path: str,
        clauses: List,
        risk_levels: dict,
        citations: dict
    ) -> tuple[List[Redline], str]:
        """
        Process markdown file to add suggestions for risk-tagged clauses.
        
        Args:
            markdown_path: Path to the markdown file
            clauses: List of Clause objects
            risk_levels: Dict mapping clause_id to RiskLevel
            citations: Dict mapping clause_id to Citation
            
        Returns:
            Tuple of (list of Redlines, updated_markdown_path)
        """
        # Read markdown
        with open(markdown_path, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
        
        redlines = []
        
        # Process all risk-tagged clauses (high, medium, and low)
        for clause in clauses:
            risk_level = risk_levels.get(clause.clause_id)
            
            if risk_level in [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
                # Get legal context if available
                citation = citations.get(clause.clause_id)
                legal_context = ""
                if citation and citation.found:
                    legal_context = f"{citation.section}, {citation.law_name}: {citation.explanation}"
                
                # Generate redline
                redline = self.generate_redline(
                    clause.clause_id,
                    clause.content,
                    risk_level,
                    legal_context
                )
                
                redlines.append(redline)
                
                # Insert into markdown
                markdown_content = self._insert_suggestion_in_markdown(
                    markdown_content,
                    clause.clause_id,
                    redline
                )
        
        # Save updated markdown
        with open(markdown_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        logger.info(f"Generated {len(redlines)} redline suggestions")
        
        return redlines, markdown_path


def create_redline_generator_agent(
    api_key: str,
    model: str = "gemini-2.5-flash"
) -> RedlineGeneratorAgent:
    """
    Factory function to create a RedlineGeneratorAgent.
    
    Args:
        api_key: Google API key
        model: Model name to use
        
    Returns:
        Configured RedlineGeneratorAgent
    """
    return RedlineGeneratorAgent(api_key=api_key, model=model)
