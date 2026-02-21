"""
PDF to Markdown converter for NyayaAI.
Extracts structured text from machine-readable PDFs and converts to Markdown.
NO OCR SUPPORT - Only processes machine-readable PDFs.
"""

import fitz  # PyMuPDF
import re
import logging
from pathlib import Path
from typing import List, Tuple
from schemas.models import Clause

logger = logging.getLogger(__name__)


class PDFToMarkdownConverter:
    """
    Converts PDF contracts to structured Markdown format.
    Preserves clause numbering and structure.
    """
    
    def __init__(self):
        # Match numbered clauses like "1.", "2.", "10(a)", etc.
        # More flexible pattern that works with inline text
        self.clause_pattern = re.compile(
            r'(?:^|\s)(\d+)\.?\s+',
            re.MULTILINE
        )
        # Pattern for sub-clauses like "(a)", "(b)", etc.
        self.subclause_pattern = re.compile(
            r'\(([a-z])\)\s+',
            re.IGNORECASE
        )
    
    def extract_text_from_pdf(self, pdf_path: str) -> List[Tuple[int, str]]:
        """
        Extract text from PDF page by page.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            List of tuples (page_number, text_content)
        """
        pages_text = []
        
        try:
            doc = fitz.open(pdf_path)
            logger.info(f"Opened PDF: {pdf_path} with {doc.page_count} pages")
            
            for page_num in range(doc.page_count):
                page = doc[page_num]
                text = page.get_text("text")
                
                if not text.strip():
                    logger.warning(f"Page {page_num + 1} is empty or unreadable")
                    continue
                
                pages_text.append((page_num + 1, text))
            
            doc.close()
            logger.info(f"Successfully extracted text from {len(pages_text)} pages")
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise
        
        return pages_text
    
    def identify_clauses(self, pages_text: List[Tuple[int, str]]) -> List[Clause]:
        """
        Identify and structure clauses from extracted text.
        Uses improved pattern matching to find numbered clauses.
        
        Args:
            pages_text: List of (page_number, text) tuples
            
        Returns:
            List of Clause objects
        """
        clauses = []
        
        # Combine all pages into one text block with page markers
        full_text = ""
        page_markers = []
        
        for page_num, text in pages_text:
            # Preserve formatting - only clean excessive whitespace
            # Keep line breaks and paragraph structure
            text = re.sub(r'[ \t]+', ' ', text)  # Normalize only spaces/tabs on same line
            text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 consecutive newlines
            text = text.strip()
            page_markers.append((len(full_text), page_num))
            full_text += text + "\n\n"  # Preserve paragraph separation
        
        # Find preamble (text before first numbered clause)
        first_clause_match = re.search(r'\b1\.\s+', full_text)
        
        if first_clause_match:
            preamble_text = full_text[:first_clause_match.start()].strip()
            if preamble_text and len(preamble_text) > 50:
                # Determine page for preamble
                preamble_page = 1
                for pos, page in page_markers:
                    if pos <= first_clause_match.start():
                        preamble_page = page
                
                clauses.append(
                    Clause(
                        clause_id="clause_preamble",
                        heading="Preamble",
                        content=preamble_text[:2000],  # Limit size
                        page=preamble_page
                    )
                )
            
            # Process numbered clauses
            remainder_text = full_text[first_clause_match.start():]
        else:
            # No numbered clauses found, treat entire document as preamble
            remainder_text = full_text
        
        # Split by numbered clauses (1., 2., 3., etc.)
        clause_splits = re.split(r'\b(\d+)\.\s+', remainder_text)
        
        # Process splits in pairs (number, content)
        for i in range(1, len(clause_splits), 2):
            if i + 1 < len(clause_splits):
                clause_num = clause_splits[i]
                clause_content = clause_splits[i + 1].strip()
                
                if not clause_content:
                    continue
                
                # Limit clause content size (max 1500 chars to avoid token limits)
                if len(clause_content) > 1500:
                    clause_content = clause_content[:1500] + "..."
                
                # Extract heading (first 100 chars or until first period)
                heading_match = re.match(r'^(.{1,100}?)[\.\n]', clause_content)
                if heading_match:
                    heading = heading_match.group(1).strip()
                else:
                    heading = clause_content[:80].strip() + "..."
                
                # Determine page number
                clause_page = 1
                # Find position in original full_text
                clause_pos = full_text.find(f"{clause_num}. {clause_content[:50]}")
                if clause_pos >= 0:
                    for pos, page in page_markers:
                        if pos <= clause_pos:
                            clause_page = page
                
                clauses.append(
                    Clause(
                        clause_id=f"clause_{clause_num}",
                        heading=heading,
                        content=clause_content,
                        page=clause_page
                    )
                )
        
        logger.info(f"Identified {len(clauses)} clauses")
        
        if len(clauses) == 0:
            # Fallback: create one clause from entire document
            logger.warning("No clauses detected, using entire document as single clause")
            clauses.append(
                Clause(
                    clause_id="clause_1",
                    heading="Full Document",
                    content=full_text[:1500],
                    page=1
                )
            )
        
        return clauses
    
    def generate_markdown(
        self, 
        clauses: List[Clause], 
        output_path: str,
        title: str = "Contract Document"
    ) -> str:
        """
        Generate Markdown file from clauses.
        
        Args:
            clauses: List of Clause objects
            output_path: Path where Markdown file should be saved
            title: Title for the document
            
        Returns:
            Path to the generated Markdown file
        """
        markdown_lines = []
        markdown_lines.append(f"# {title}\n\n")
        markdown_lines.append(f"*Generated by NyayaAI*\n\n")
        markdown_lines.append(f"---\n\n")
        
        for clause in clauses:
            # Use numbered format for clauses (except preamble)
            if clause.clause_id == "clause_preamble":
                # Preserve formatting in preamble
                markdown_lines.append(f"{{{{CLAUSE_{clause.clause_id}}}}}{clause.content}{{{{/CLAUSE_{clause.clause_id}}}}}\n\n")
            else:
                # Extract clause number from clause_id and preserve content formatting
                clause_num = clause.clause_id.replace("clause_", "")
                markdown_lines.append(f"{clause_num}. {{{{CLAUSE_{clause.clause_id}}}}}{clause.content}{{{{/CLAUSE_{clause.clause_id}}}}}\n\n")
        
        markdown_content = "".join(markdown_lines)
        
        # Write to file
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        logger.info(f"Markdown file generated: {output_path}")
        return str(output_file)
    
    def convert(self, pdf_path: str, output_dir: str = None) -> Tuple[str, List[Clause]]:
        """
        Main conversion function: PDF -> Markdown.
        
        Args:
            pdf_path: Path to the input PDF file
            output_dir: Directory where Markdown should be saved (optional)
            
        Returns:
            Tuple of (markdown_file_path, list_of_clauses)
        """
        pdf_path = Path(pdf_path)
        
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        logger.info(f"Starting PDF to Markdown conversion: {pdf_path}")
        
        # Extract text
        pages_text = self.extract_text_from_pdf(str(pdf_path))
        
        if not pages_text:
            raise ValueError("No text could be extracted from PDF. Ensure PDF is machine-readable.")
        
        # Identify clauses
        clauses = self.identify_clauses(pages_text)
        
        if not clauses:
            raise ValueError("No clauses could be identified in the document.")
        
        # Generate output path
        if output_dir:
            output_path = Path(output_dir) / f"{pdf_path.stem}.md"
        else:
            output_path = pdf_path.parent / f"{pdf_path.stem}.md"
        
        # Generate Markdown
        markdown_path = self.generate_markdown(
            clauses,
            str(output_path),
            title=pdf_path.stem.replace('_', ' ').title()
        )
        
        logger.info(f"Conversion complete. Generated {len(clauses)} clauses.")
        
        return markdown_path, clauses


def convert_pdf_to_markdown(pdf_path: str, output_dir: str = None) -> Tuple[str, List[Clause]]:
    """
    Convenience function to convert PDF to Markdown.
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Optional output directory
        
    Returns:
        Tuple of (markdown_file_path, list_of_clauses)
    """
    converter = PDFToMarkdownConverter()
    return converter.convert(pdf_path, output_dir)
