import json
import os
from typing import AsyncGenerator, List, Dict
from datetime import datetime, timezone, timedelta
from openai import AsyncOpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize OpenAI client with API key from environment
client = AsyncOpenAI(api_key=os.getenv("OPENAI_KEY"))


class FastQueryTransformer:
    """
    Streamlined transformer for simple search agent.
    
    Goals:
    1. Fast decision on web_search_needed
    2. Single transformed query (not multiple)
    3. Minimal prompt, maximum efficiency
    4. Stream results as soon as ready
    """
    
    @staticmethod
    def _get_date_context() -> Dict[str, str]:
        """Get current date context for query resolution"""
        now = datetime.now(timezone.utc)
        return {
            "today": now.strftime("%Y-%m-%d"),
            "today_formatted": now.strftime("%A, %B %d, %Y"),
            "tomorrow": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
            "yesterday": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
            "current_year": str(now.year),
            "current_month": now.strftime("%B %Y")
        }
    
    @staticmethod
    async def transform_query(
        user_query: str,
        conversation_history: List[Dict[str, str]]
    ) -> Dict[str, any]:
        """
        Fast query transformation with immediate decision.
        
        Returns:
        {
            "web_search_needed": bool,
            "search_query": str,  # Only if web search needed
            "reasoning": str      # Why this decision was made
        }
        """
        
        date_context = FastQueryTransformer._get_date_context()
        
        # Extract recent user queries for context
        past_queries = [
            msg["content"] 
            for msg in conversation_history 
            if msg.get("role") == "user"
        ]
        
        past_context = ""
        if past_queries:
            past_context = "Recent conversation:\n" + "\n".join(
                f"{i+1}. {q}" for i, q in enumerate(past_queries)
            )
        else:
            past_context = "No previous conversation."
        
        # Minimal, focused prompt
        prompt = f"""Current date: {date_context['today_formatted']}

{past_context}

Current query: "{user_query}"

Your task: Determine if this query needs web search, and if so, create a standalone search query.

NEEDS WEB SEARCH if query involves:
✓ Current/real-time data (weather, news, prices, schedules)
✓ Recent events (after January 2025)
✓ Specific facts requiring verification (who is current CEO, what's the exchange rate)
✓ Travel queries (flights, hotels, routes)
✓ Data dashboards or live statistics
✓ "Latest", "current", "today", "recent"

NO WEB SEARCH if query is:
✗ General knowledge (historical facts, concepts, definitions)
✗ Coding help or technical explanations
✗ Creative writing or brainstorming
✗ Opinion or advice requests
✗ Simple calculations or logic

CONTEXT RESOLUTION:
- If query has pronouns (it, that, this), replace with actual entities from conversation
- If query has "today", use: {date_context['today']}
- If query has "tomorrow", use: {date_context['tomorrow']}
- If query has "yesterday", use: {date_context['yesterday']}
- If query references something from conversation, make it explicit

RESPONSE FORMAT (valid JSON only):
{{
  "web_search_needed": true or false,
  "search_query": "standalone searchable query (only if web_search_needed is true)",
  "reasoning": "brief explanation of decision"
}}

Examples:

Query: "What's the weather in London today?"
{{
  "web_search_needed": true,
  "search_query": "London weather {date_context['today']}",
  "reasoning": "Requires current weather data"
}}

Query: "Explain how recursion works in Python"
{{
  "web_search_needed": false,
  "search_query": "",
  "reasoning": "General programming concept, can answer from knowledge"
}}

Query: "How about tomorrow?" (after: "weather in London today")
{{
  "web_search_needed": true,
  "search_query": "London weather {date_context['tomorrow']}",
  "reasoning": "Requires weather forecast, resolved context from conversation"
}}

Query: "Who is the current CEO of Tesla?"
{{
  "web_search_needed": true,
  "search_query": "Tesla CEO current",
  "reasoning": "Requires verification of current position holder"
}}

Query: "Write me a poem about the ocean"
{{
  "web_search_needed": false,
  "search_query": "",
  "reasoning": "Creative writing request, no external data needed"
}}

Respond now with JSON only, no markdown:"""

        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",  # Faster, cheaper for this task
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.1,  # Low temp for consistent decisions
                response_format={"type": "json_object"}  # Force JSON output
            )
            
            response_text = response.choices[0].message.content.strip()
            result = json.loads(response_text)
            
            # Validate and normalize
            web_search_needed = bool(result.get("web_search_needed", False))
            search_query = result.get("search_query", "").strip()
            reasoning = result.get("reasoning", "No reasoning provided")
            
            # Fallback: if web search needed but no query, use original
            if web_search_needed and not search_query:
                search_query = user_query
            
            final_result = {
                "web_search_needed": web_search_needed,
                "search_query": search_query,
                "reasoning": reasoning
            }
            
            # Debug logging
            print(f"[FAST_TRANSFORMER] Query: {user_query}")
            print(f"[FAST_TRANSFORMER] Web search needed: {web_search_needed}")
            if web_search_needed:
                print(f"[FAST_TRANSFORMER] Search query: {search_query}")
            print(f"[FAST_TRANSFORMER] Reasoning: {reasoning}")
            
            return final_result
            
        except json.JSONDecodeError as e:
            print(f"[FAST_TRANSFORMER] JSON decode error: {e}")
            print(f"[FAST_TRANSFORMER] Response: {response_text}")
            
            # Safe fallback: assume web search needed for safety
            return {
                "web_search_needed": True,
                "search_query": user_query,
                "reasoning": "Fallback due to parsing error"
            }
        
        except Exception as e:
            print(f"[FAST_TRANSFORMER] Unexpected error: {e}")
            
            # Safe fallback
            return {
                "web_search_needed": True,
                "search_query": user_query,
                "reasoning": f"Fallback due to error: {str(e)}"
            }


class SimpleTransformerClient:
    """
    Clean client interface for the fast transformer.
    Drop-in replacement for the old transformer.
    """
    
    def __init__(self):
        self.transformer = FastQueryTransformer()
    
    async def analyze_query(
        self,
        user_query: str,
        conversation_history: List[Dict[str, str]]
    ) -> Dict[str, any]:
        """
        Analyze a query and determine if web search is needed.
        
        Args:
            user_query: The current user query
            conversation_history: List of previous messages [{"role": "user/assistant", "content": "..."}]
        
        Returns:
            {
                "web_search_needed": bool,
                "search_query": str,  # Empty if no search needed
                "reasoning": str
            }
        """
        return await self.transformer.transform_query(user_query, conversation_history)
    
    async def should_search_web(
        self,
        user_query: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> bool:
        """
        Quick check: does this query need web search?
        
        Returns:
            True if web search is needed, False otherwise
        """
        if conversation_history is None:
            conversation_history = []
        
        result = await self.analyze_query(user_query, conversation_history)
        return result["web_search_needed"]
    
    async def get_search_query(
        self,
        user_query: str,
        conversation_history: List[Dict[str, str]] = None
    ) -> str:
        """
        Get the transformed search query (with context resolved).
        
        Returns:
            Search query string, or empty string if no search needed
        """
        if conversation_history is None:
            conversation_history = []
        
        result = await self.analyze_query(user_query, conversation_history)
        return result["search_query"] if result["web_search_needed"] else ""


# Example usage
async def example_usage():
    """Example of how to use the new transformer"""
    
    client = SimpleTransformerClient()
    
    # Example 1: Simple query needing web search
    result1 = await client.analyze_query(
        "What's the weather in NYC today?",
        []
    )
    print("\nExample 1:", result1)
    
    # Example 2: Knowledge query (no search needed)
    result2 = await client.analyze_query(
        "Explain binary search algorithm",
        []
    )
    print("\nExample 2:", result2)
    
    # Example 3: Follow-up query with context
    conversation = [
        {"role": "user", "content": "What's the weather in London?"},
        {"role": "assistant", "content": "The weather in London is..."}
    ]
    result3 = await client.analyze_query(
        "How about tomorrow?",
        conversation
    )
    print("\nExample 3:", result3)
    
    # Example 4: Quick boolean check
    needs_search = await client.should_search_web(
        "Who won the 2024 US election?"
    )
    print(f"\nExample 4: Needs search? {needs_search}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(example_usage())