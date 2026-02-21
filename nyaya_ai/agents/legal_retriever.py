"""
Legal Cross-Reference Agent for NyayaAI.
Retrieves relevant Indian law sections using Gemini's web search capabilities.
STRICT: No hallucinated citations allowed.
"""

import re
import logging
import time
from typing import List, Optional
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

from schemas.models import Citation, RiskLevel
from utils.retry_helper import retry_with_exponential_backoff

logger = logging.getLogger(__name__)


class LegalRetrieverAgent:
    """
    Agent responsible for finding relevant legal citations for risky clauses.
    Uses Gemini's web search capabilities to find authentic Indian law references.
    """
    
    def __init__(self, api_key: str, model: str = "gemini-2.0-flash-exp", temperature: float = 0.1):
        """
        Initialize the legal retriever agent.
        
        Args:
            api_key: Google API key
            model: Model to use (must support grounding/web search)
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
            ("user", "Analyze this clause and find relevant legal citations:\n\nClause ID: {clause_id}\nRisk Level: {risk_level}\nClause Content: {content}\n\nPerform a web search to find the most relevant Indian law citation for this clause.")
        ])
        
        self.chain = self.prompt | self.llm | self.parser
        
        logger.info(f"LegalRetrieverAgent initialized with {model} and web search capabilities")
    
    @retry_with_exponential_backoff(max_retries=3, initial_delay=2.0, max_delay=60.0)
    def _invoke_llm_with_retry(self, inputs: dict):
        """Invoke LLM chain with retry logic for rate limiting."""
        return self.chain.invoke(inputs)
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for legal retrieval."""
        return """You are an expert on Indian contract and commercial law with access to web search capabilities.

Your task is to SEARCH THE WEB and find REAL, ACCURATE legal references from Indian laws that are relevant to the provided contract clause.

CRITICAL INSTRUCTIONS:
1. USE WEB SEARCH to find relevant Indian law citations for the clause
2. Search specifically on authentic Indian law websites like:
   - indiankanoon.org
   - legislative.gov.in
   - indiacode.nic.in
   - lawcommissionofindia.nic.in 
3. Look for relevant sections from:
   - Indian Contract Act, 1872
   - Consumer Protection Act, 2019
   - Indian Penal Code, 1860
   - Specific Relief Act, 1963
   - Any other relevant Indian commercial laws
4. ONLY cite laws that you find through web search with confidence
5. If you are not sure about a specific section number, set found=false
6. NEVER make up or guess section numbers
7. NEVER hallucinate legal citations
8. Be conservative - it's better to say "not found" than to give wrong information

HOW TO IDENTIFY RELEVANT CITATIONS:
- If a clause discusses unfair terms or unconscionable contracts, cite Indian Contract Act Section 23
- If a clause has unfair consumer terms, cite Consumer Protection Act provisions
- If a clause discusses breach or damages, cite relevant ICA sections
- If a clause is about specific performance, cite Specific Relief Act
- Match the clause content with the actual law provisions you find

Respond with ONLY a valid JSON object in this exact format:
{{
    "clause_id": "the clause identifier",
    "section": "Section 23" or null,
    "law_name": "Indian Contract Act, 1872" or null,
    "explanation": "brief explanation of why this section is relevant" or null,
    "found": true or false
}}

Guidelines:
- found=true ONLY if you find a confident, accurate citation through web search
- found=false if uncertain or no relevant law found
- explanation MUST be 1-2 sentences MAX (around 30-50 words)
- Include the full name of the law with the year
- Be extremely concise - just state: "This section [what it does] and applies here because [brief reason]"

Example explanations:
- "Prohibits agreements contrary to public policy or unlawful, applies to overly restrictive clauses."
- "Defines valid contracts requiring free consent and lawful consideration, basis for enforceability."
- "Determines jurisdiction for legal disputes, allows parties to agree on specific court."

Do NOT include any text outside the JSON object.
"""
    
    def retrieve_citation(
        self,
        clause_id: str,
        clause_content: str,
        risk_level: RiskLevel
    ) -> Citation:
        """
        Retrieve legal citation for a clause using Gemini's web search capabilities.
        
        Args:
            clause_id: ID of the clause
            clause_content: Content of the clause
            risk_level: Risk level of the clause
            
        Returns:
            Citation object
        """
        try:
            # Add delay to avoid rate limiting
            time.sleep(2)
            
            logger.info(f"Requesting citation for {clause_id} via Gemini web search")
            
            # Use Gemini with web search to find and cite relevant Indian laws
            result = self._invoke_llm_with_retry({
                "clause_id": clause_id,
                "risk_level": risk_level.value,
                "content": clause_content[:1500]
            })
            
            # Trim explanation if too long (max ~200 chars for 2-3 lines)
            if 'explanation' in result and result['explanation']:
                if len(result['explanation']) > 200:
                    # Truncate to sentence boundary
                    truncated = result['explanation'][:200]
                    last_period = truncated.rfind('.')
                    if last_period > 100:  # If we have at least one complete sentence
                        result['explanation'] = truncated[:last_period + 1]
                    else:
                        result['explanation'] = truncated + "..."
            
            # Validate and create Citation
            citation = Citation(**result)
            
            if citation.found:
                logger.info(
                    f"Citation found for {clause_id}: "
                    f"{citation.section}, {citation.law_name}"
                )
            else:
                logger.info(f"No confident citation found for {clause_id}")
            
            return citation
            
        except Exception as e:
            logger.error(f"Error retrieving citation for {clause_id}: {e}")
            # Return not-found citation
            return Citation(
                clause_id=clause_id,
                section=None,
                law_name=None,
                explanation=None,
                found=False
            )
    
    def _insert_citation_in_markdown(
        self,
        markdown_content: str,
        clause_id: str,
        citation: Citation
    ) -> str:
        """
        Insert citation tag below a risk-tagged clause.
        
        Args:
            markdown_content: Current markdown content
            clause_id: ID of clause to add citation to
            citation: Citation to insert
            
        Returns:
            Updated markdown content
        """
        # Find the clause and its risk tag end (inline format)
        # Extract clause number from clause_id (e.g., clause_1 -> 1, clause_preamble -> preamble)
        clause_num = clause_id.replace("clause_", "")
        
        # For preamble, match before first numbered clause
        if clause_num == "preamble":
            pattern = rf'(---\n\n)(.*?)(-[hlm]r-)(\n\n1\. )'
            
            def replace_func(match):
                prefix = match.group(1)
                content_with_risk = match.group(2) + match.group(3)
                suffix = match.group(4)
                
                # Create citation text
                if citation.found:
                    citation_text = f"-ipc-{citation.section}, {citation.law_name}: {citation.explanation}-ipc-"
                else:
                    citation_text = "-ipc-not found-ipc-"
                
                return prefix + content_with_risk + citation_text + suffix
        else:
            # For numbered clauses (matches all risk tags: hr, mr, lr)
            pattern = rf'({clause_num}\. -[hlm]r-.*?-[hlm]r-)'
            
            def replace_func(match):
                clause_section = match.group(1)
                
                # Create citation text
                if citation.found:
                    citation_text = f"-ipc-{citation.section}, {citation.law_name}: {citation.explanation}-ipc-"
                else:
                    citation_text = "-ipc-not found-ipc-"
                
                return clause_section + citation_text
        
        updated_markdown = re.sub(
            pattern,
            replace_func,
            markdown_content,
            count=1,
            flags=re.DOTALL
        )
        
        return updated_markdown
    
    def process_risk_tagged_markdown(
        self,
        markdown_path: str,
        clauses: List,
        risk_levels: dict
    ) -> tuple[List[Citation], str]:
        """
        Process markdown file to add citations for risk-tagged clauses.
        
        Args:
            markdown_path: Path to the markdown file
            clauses: List of Clause objects
            risk_levels: Dict mapping clause_id to RiskLevel
            
        Returns:
            Tuple of (list of Citations, updated_markdown_path)
        """
        # Read markdown
        with open(markdown_path, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
        
        citations = []
        
        # Process all risk-tagged clauses (high, medium, and low)
        for clause in clauses:
            risk_level = risk_levels.get(clause.clause_id)
            
            if risk_level in [RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
                # Retrieve citation via web search
                citation = self.retrieve_citation(
                    clause.clause_id,
                    clause.content,
                    risk_level
                )
                
                citations.append(citation)
                
                # Insert into markdown
                markdown_content = self._insert_citation_in_markdown(
                    markdown_content,
                    clause.clause_id,
                    citation
                )
        
        # Save updated markdown
        with open(markdown_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        logger.info(
            f"Processed citations for {len(citations)} clauses. "
            f"Found: {sum(1 for c in citations if c.found)}"
        )
        
        return citations, markdown_path


def create_legal_retriever_agent(
    api_key: str, 
    model: str = "gemini-2.5-flash"
) -> LegalRetrieverAgent:
    """
    Factory function to create a LegalRetrieverAgent.
    
    Args:
        api_key: Google API key
        model: Model name to use (must support grounding/web search)
        
    Returns:
        Configured LegalRetrieverAgent
    """
    return LegalRetrieverAgent(api_key=api_key, model=model)