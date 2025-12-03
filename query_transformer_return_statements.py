"""
Enhanced Query Transformer with Multi-Search Support and Context Resolution

This transformer:
1. Resolves conversational references using chat history
2. Detects when web search is needed with high accuracy
3. Generates MULTIPLE targeted search queries for complex requests
4. Identifies data extraction needs
5. Plans comprehensive research strategies
"""

import json
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key="")
 
class EnhancedQueryTransformer:
    """Advanced query transformation with multi-search support"""
    
    @staticmethod
    async def get_transformed_query(
        user_query: str, 
        past_user_queries: List[str]
    ) -> dict:
        """
        Enhanced query transformation that returns multiple search queries
        
        Returns: {
            "resolved_query": str,  # NEW: Standalone query with context resolved
            "web_search_needed": bool,
            "search_queries": List[str],  # Can be multiple queries!
            "data_extraction_needed": bool,
            "data_types": List[str]
        }
        """
        
        # Get current date context
        now = datetime.now(timezone.utc)
        date_context = {
            "today": now.strftime("%Y-%m-%d"),
            "today_formatted": now.strftime("%A, %B %d, %Y"),
            "tomorrow": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
            "tomorrow_formatted": (now + timedelta(days=1)).strftime("%A, %B %d, %Y"),
            "current_year": now.year,
            "current_month": now.strftime("%B %Y")
        }
        
        response_format = {
            "resolved_query": "standalone query with all context resolved",
            "web_search_needed": "true or false",
            "search_queries": ["array of search queries if needed, empty array otherwise"],
            "data_extraction_needed": "true or false",
            "data_types": ["types of data to extract"]
        }
        
        # Build prompt with context
        past_queries_str = "\n".join([f"{i+1}. {q}" for i, q in enumerate(past_user_queries[-10:])]) if past_user_queries else "(none)"
        
        prompt = f"""CURRENT DATE: {date_context['today_formatted']}
CURRENT YEAR: {date_context['current_year']}

Previous user queries (most recent last):
{past_queries_str}

Current query: {user_query}

You MUST return the response in this JSON format: {str(response_format)}

=== STEP 1: RESOLVE CONVERSATIONAL CONTEXT ===

CRITICAL: First create a "resolved_query" that is a STANDALONE version of the current query.

If the current query contains references like:
- Pronouns: "it", "that", "this", "them", "those"
- Temporal references: "today", "tomorrow", "yesterday", "now"
- Comparisons: "how about", "what about", "instead"
- Ambiguous terms: "there", "same place"

Then resolve these by:
1. Look at the most recent relevant past query
2. Extract entities (locations, topics, items, dates)
3. Replace references with actual entities
4. Make the query understandable WITHOUT conversation history

Examples:

Past: "flights from hyd to mysuru tomorrow"
Current: "how about today?"
Resolved: "flights from hyd to mysuru today"

Past: "what is london's weather today?"
Current: "how about tomorrow?"
Resolved: "what is london's weather tomorrow"

Past: "tell me about Python"
Current: "show me code examples"
Resolved: "show me Python code examples"

Past: "restaurants in bangalore"
Current: "how about mumbai?"
Resolved: "restaurants in mumbai"

IMPORTANT RULES FOR RESOLUTION:
- If query is already standalone (no references), resolved_query = current query
- Replace "today" with actual date: {date_context['today']}
- Replace "tomorrow" with actual date: {date_context['tomorrow']}
- Preserve the user's modification (today vs tomorrow, this vs that)
- Keep the query natural and searchable
- Don't add unnecessary context, just resolve ambiguity

=== STEP 2: WEB SEARCH DECISION RULES ===

ALWAYS SET web_search_needed=true IF REQUEST INCLUDES:

1. REAL-TIME/CURRENT DATA:
   - "current", "latest", "recent", "today", "this year"
   - "real-time", "live", "up-to-date"
   - Economic indicators, stock prices, weather, news
   
2. DASHBOARDS/TRACKERS/MONITORS:
   - Any request for "dashboard", "tracker", "monitor", "indicator"
   - "Display data", "show statistics", "visualize trends"
   
3. HISTORICAL DATA WITH SPECIFICS:
   - Specific dates, years, time periods
   - Historical events, battles, timelines
   - "from X to Y", "between X and Y", "during X"
   
4. FACTUAL ACCURACY REQUIREMENTS:
   - "accurate", "precise", "detailed", "comprehensive"
   - "based on", "according to", "sourced from"
   - "academic sources", "primary sources", "research"
   
5. SPECIFIC NUMBERS/STATISTICS:
   - GDP, inflation, unemployment, interest rates
   - Prices, rates, percentages, measurements
   - Scores, rankings, comparisons
   
6. MULTIPLE DATA POINTS:
   - Comparisons across countries/regions/entities
   - Multiple indicators or metrics
   - Correlation analysis, relationships
   
7. NEWS/EVENTS/ANNOUNCEMENTS:
   - Recent news, policy changes, announcements
   - Company earnings, economic reports
   - Political events, decisions, outcomes

8. GEOGRAPHIC/MAP DATA:
   - Maps with real locations, boundaries
   - Territory changes over time
   - Regional statistics or data

9. TRAVEL QUERIES:
   - Flights, trains, buses, transportation
   - Hotels, accommodations
   - Routes, schedules, prices

10. WEATHER QUERIES:
   - Current weather, forecasts
   - Temperature, conditions
   - Any location-based weather

ONLY SET web_search_needed=false FOR:
- Pure UI requests ("make it dark mode", "add animation")
- Generic tools (calculator, timer, notepad) WITHOUT real data
- Simple games or utilities
- Style/layout changes to existing apps
- General knowledge questions Claude can answer

=== STEP 3: MULTI-QUERY GENERATION ===

For COMPLEX requests needing multiple data types, generate 3-8 targeted queries:

Example 1 - Economic Dashboard:
search_queries: [
  "G20 GDP growth rates {date_context['current_year']}",
  "global inflation rates by country {date_context['current_month']}",
  "unemployment statistics {date_context['current_year']}",
  "central bank interest rates current",
  "stock market indices today"
]

Example 2 - Historical Map:
search_queries: [
  "Pacific Theater battles World War 2 timeline",
  "WW2 Pacific battles December 1941 to September 1945",
  "Pearl Harbor Midway Guadalcanal Iwo Jima battle details",
  "Pacific War territory changes 1941-1945",
  "primary sources WW2 Pacific Theater academic"
]

Example 3 - Flight Search:
search_queries: [
  "flights hyderabad to mysuru {date_context['today']}"
]

=== QUERY OPTIMIZATION RULES ===

1. Use the RESOLVED query as basis for search queries
2. Make queries SPECIFIC and TARGETED
3. Include time context when relevant: "{date_context['current_year']}", "current", "latest"
4. For comparisons, query each entity separately
5. Keep each query focused (3-7 words optimal)
6. Remove filler words but keep key terms
7. Use authoritative source names when relevant (IMF, WHO, NASA)

=== DATA EXTRACTION RULES ===

Set data_extraction_needed=true when you need to:
- Extract numbers from text (GDP: 1.8%, unemployment: 4.2%)
- Parse dates and time periods
- Structure unstructured data (snippets → JSON)
- Identify entities (countries, companies, people)
- Extract relationships (correlations, causations)

data_types examples:
- "economic_indicators": GDP, inflation, rates
- "historical_events": dates, locations, participants
- "statistics": numbers, percentages, measurements  
- "news_items": headlines, dates, sources
- "geographic_data": coordinates, boundaries, regions
- "company_data": financials, metrics, performance
- "scientific_data": measurements, findings, publications
- "travel_data": flights, schedules, prices
- "weather_data": temperature, conditions, forecasts

=== DATE HANDLING ===

CRITICAL: NEVER include years 2020-2024 in queries (old training data)
- If user says "today": use {date_context['today']}
- If user says "current": use "{date_context['current_year']}" or "current"
- If user says "latest": use "latest" or "{date_context['current_month']}"
- For historical dates: use exact years mentioned
- Remove any 2020-2024 dates that appear in generated queries

=== JSON OUTPUT FORMAT ===

{{
  "resolved_query": "standalone understandable query",
  "web_search_needed": true,
  "search_queries": [
    "specific query 1",
    "specific query 2"
  ],
  "data_extraction_needed": true,
  "data_types": ["economic_indicators", "statistics"]
}}

Rules for JSON output:
- Use double quotes
- Booleans as true/false (not strings)
- search_queries is ARRAY even if single query
- Empty array [] if no search needed
- No comments in JSON
- Must be valid parseable JSON
- resolved_query is ALWAYS required

IMPORTANT: Generate your response now:"""
        
        messages = [{"role": "user", "content": prompt}]
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=600,
            temperature=0.3
        )
        
        response_text = response.choices[0].message.content.strip()
        
        # Clean up response
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()
        
        try:
            response_json = json.loads(response_text)
            
            # Ensure resolved_query exists (fallback to original)
            if 'resolved_query' not in response_json:
                response_json['resolved_query'] = user_query
            
            # Normalize boolean values
            web_search_needed = response_json.get('web_search_needed')
            if isinstance(web_search_needed, str):
                web_search_needed = web_search_needed.lower() == 'true'
            response_json['web_search_needed'] = bool(web_search_needed)
            
            data_extraction_needed = response_json.get('data_extraction_needed', False)
            if isinstance(data_extraction_needed, str):
                data_extraction_needed = data_extraction_needed.lower() == 'true'
            response_json['data_extraction_needed'] = bool(data_extraction_needed)
            
            # Ensure search_queries is a list
            search_queries = response_json.get('search_queries', [])
            if isinstance(search_queries, str):
                search_queries = [search_queries]
            response_json['search_queries'] = search_queries if search_queries else []
            
            # Ensure data_types is a list
            data_types = response_json.get('data_types', [])
            if isinstance(data_types, str):
                data_types = [data_types]
            response_json['data_types'] = data_types if data_types else []
            
            # Clean up any old dates from queries
            cleaned_queries = []
            for query in response_json['search_queries']:
                cleaned = EnhancedQueryTransformer._clean_query_dates(query, date_context)
                cleaned_queries.append(cleaned)
            response_json['search_queries'] = cleaned_queries
            
            print(f"[TRANSFORMER] Original query: {user_query}")
            print(f"[TRANSFORMER] Resolved query: {response_json['resolved_query']}")
            print(f"[TRANSFORMER] Web search needed: {response_json['web_search_needed']}")
            if response_json['web_search_needed']:
                print(f"[TRANSFORMER] Generated {len(response_json['search_queries'])} search queries:")
                for i, q in enumerate(response_json['search_queries'], 1):
                    print(f"  {i}. {q}")
            
            return response_json
            
        except json.JSONDecodeError as e:
            print(f"[TRANSFORMER] JSON parsing error: {e}")
            print(f"[TRANSFORMER] Response: {response_text}")
            
            # Fallback: detect if search is probably needed
            search_keywords = [
                'dashboard', 'tracker', 'monitor', 'current', 'latest', 'real-time',
                'data', 'statistics', 'show', 'display', 'accurate', 'based on',
                'historical', 'map', 'timeline', 'news', 'recent', 'flights', 'weather'
            ]
            
            probably_needs_search = any(kw in user_query.lower() for kw in search_keywords)
            
            return {
                "resolved_query": user_query,
                "web_search_needed": probably_needs_search,
                "search_queries": [user_query] if probably_needs_search else [],
                "data_extraction_needed": probably_needs_search,
                "data_types": ["general"]
            }
    
    @staticmethod
    def _clean_query_dates(query: str, date_context: Dict) -> str:
        """Remove old dates from training data and replace temporal keywords"""
        
        original_query = query
        cleaned_query = query
        
        # Replace temporal keywords with actual dates/terms
        cleaned_query = cleaned_query.replace('today', date_context['today'])
        cleaned_query = cleaned_query.replace('Today', date_context['today'])
        cleaned_query = cleaned_query.replace('this year', str(date_context['current_year']))
        cleaned_query = cleaned_query.replace('current year', str(date_context['current_year']))
        
        # Remove old years from training data (2020-2024)
        cleaned_query = re.sub(
            r'\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}[,\s]+202[0-4]\b',
            '',
            cleaned_query,
            flags=re.IGNORECASE
        )
        
        cleaned_query = re.sub(r'\b202[0-4][-/]\d{2}[-/]\d{2}\b', '', cleaned_query)
        cleaned_query = re.sub(r'\b202[0-4](?!\s*[-–]\s*\d{4})\b', '', cleaned_query)
        cleaned_query = re.sub(
            r'\b\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+202[0-4]\b',
            '',
            cleaned_query,
            flags=re.IGNORECASE
        )
        
        # Clean up extra spaces and trim
        cleaned_query = ' '.join(cleaned_query.split())
        cleaned_query = cleaned_query.strip()
        
        if original_query != cleaned_query:
            print(f"[TRANSFORMER] Cleaned dates: '{original_query}' → '{cleaned_query}'")
        
        return cleaned_query


# Backward compatibility wrapper
class QueryTransformer:
    """Wrapper for backward compatibility with old single-query interface"""
    
    @staticmethod
    async def get_transformed_query(
        user_query: str, 
        past_user_queries: List[str]
    ) -> dict:
        """
        Returns format compatible with old code (single search_query)
        Use EnhancedQueryTransformer directly for multi-query support
        """
        result = await EnhancedQueryTransformer.get_transformed_query(
            user_query, 
            past_user_queries
        )
        
        # Convert to old format (take first query only)
        return {
            "resolved_query": result.get("resolved_query", user_query),
            "web_search_needed": result["web_search_needed"],
            "search_query": result["search_queries"][0] if result["search_queries"] else result.get("resolved_query", user_query)
        }