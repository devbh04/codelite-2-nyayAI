"""
Retry helper for handling API rate limits with exponential backoff.
"""

import time
import logging
from typing import Callable, TypeVar, Any
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


def retry_with_exponential_backoff(
    max_retries: int = 3,
    initial_delay: float = 2.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0
):
    """
    Decorator to retry a function with exponential backoff on rate limit errors.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds before first retry
        max_delay: Maximum delay in seconds between retries
        exponential_base: Base for exponential backoff calculation
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                    
                except Exception as e:
                    error_msg = str(e)
                    last_exception = e
                    
                    # Check if it's a rate limit error (429)
                    if "429" in error_msg or "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
                        if attempt < max_retries:
                            # Extract wait time from error message if available
                            wait_time = delay
                            if "retry in" in error_msg.lower():
                                try:
                                    # Try to extract the suggested wait time
                                    import re
                                    match = re.search(r'retry in (\d+\.?\d*)', error_msg.lower())
                                    if match:
                                        suggested_wait = float(match.group(1))
                                        wait_time = max(suggested_wait, delay)
                                except:
                                    pass
                            
                            wait_time = min(wait_time, max_delay)
                            logger.warning(
                                f"Rate limit hit in {func.__name__} (attempt {attempt + 1}/{max_retries + 1}). "
                                f"Waiting {wait_time:.1f}s before retry..."
                            )
                            time.sleep(wait_time)
                            delay *= exponential_base
                        else:
                            logger.error(
                                f"Max retries ({max_retries}) reached for {func.__name__}. "
                                f"Rate limit error: {error_msg[:200]}"
                            )
                            raise
                    else:
                        # Not a rate limit error, raise immediately
                        raise
            
            # Should not reach here, but just in case
            raise last_exception
        
        return wrapper
    return decorator


def add_rate_limit_delay(seconds: float = 2.0):
    """
    Simple delay to avoid hitting rate limits.
    Use between sequential API calls.
    
    Args:
        seconds: Number of seconds to wait
    """
    time.sleep(seconds)
