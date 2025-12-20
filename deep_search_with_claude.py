import anthropic
import json
from typing import List, Dict, Optional
from fastapi import UploadFile
import asyncio
from tables_scraper import scrape_tables_parallel, BrowserPool

# ✅ Global browser pool (shared across requests)
_global_browser_pool: Optional[BrowserPool] = None
_pool_lock = asyncio.Lock()

async def get_browser_pool():
    """Get or create global browser pool"""
    global _global_browser_pool
    
    async with _pool_lock:
        if _global_browser_pool is None or not _global_browser_pool.initialized:
            _global_browser_pool = BrowserPool(pool_size=2, max_tabs_per_browser=10)
            await _global_browser_pool.initialize()
    
    return _global_browser_pool


async def classify_message(conversation_messages: List[Dict], user_message: str, client, model: str) -> str:
    """
    Router: Classify message routing
    Returns: "deep_research" | "web_search" | "conversation"
    """
    
    from datetime import datetime
    current_date = datetime.now().strftime("%A, %B %d, %Y")
    
    # Format conversation history
    history_text = ""
    for msg in conversation_messages[-6:]:  # Last 6 messages for context
        role = msg.get("role", "")
        content = msg.get("content", "")
        if isinstance(content, list):
            content = " ".join([c.get("text", "") for c in content if c.get("type") == "text"])
        history_text += f"{role}: {content[:500]}...\n\n"  # More context per message
    
    router_prompt = f"""You are a routing classifier. Analyze this conversation and determine what action to take for the latest user message.

Recent conversation history:
{history_text}

Latest user message: "{user_message}"

Classify as:

1. "deep_research" - User wants comprehensive research on a NEW topic requiring multiple queries, branches, and deep analysis
   - Indicators: New broad topic, "research X", "analyze comprehensively", requires multiple angles
   
2. "web_search" - User needs NEW information that requires web search
   - Indicators: Asking for data NOT in the conversation above, current events, specific facts not yet covered
   
3. "conversation" - User is asking about information ALREADY in the conversation above
   - Indicators: "What did you say about...", asking to clarify/explain existing data, referencing previous findings

CRITICAL: Look carefully at the conversation history. If the user is asking about data that was ALREADY provided above, choose "conversation", NOT "web_search".

Return ONLY valid JSON:
{{"route": "deep_research|web_search|conversation", "reasoning": "..."}}"""

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=200,
            system_message = f"The current date is {current_date}."
            messages=[{"role": "user", "content": router_prompt}]
        )
        
        response_text = response.content[0].text.strip()
        
        # Parse JSON
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()
        
        result = json.loads(response_text)
        route = result.get("route", "conversation")
        
        print(f"🔀 Router decision: {route} - {result.get('reasoning', '')}")
        return route
    
    except Exception as e:
        print(f"⚠️ Router error: {e}, defaulting to 'conversation'")
        return "conversation"
    

class DeepResearch:
    """
    Tree-based research: Input → Level 1 (1-2 queries) → Level 2 (1-2 queries each)
    Calls send_message for each query with table context
    """
    
    def __init__(self, conversation):
        """
        Args:
            conversation: ClaudeConversation instance
        """
        self.conversation = conversation
        self.client = conversation.client
        self.model = conversation.model
        self.browser_pool = None
        self.query_tables = {}  # Store tables per query
        self.query_results = []  # Store all query results
    
    
    async def research(self, query: str, files: Optional[List[UploadFile]] = None):
        """
        Main entry point with automatic routing logic
        
        Args:
            query: User's research question
            files: Optional uploaded files
        
        Yields: {"type": "search_query"/"sources"/"tables"/"reasoning"/"content"/"report"/"research_summary"}
        """
        
        # ✅ Automatically detect if this is a follow-up
        follow_up = len(self.conversation.messages) > 0
        
        # ✅ ROUTING LOGIC
        if follow_up:
            # Call router to decide: deep_research | web_search | conversation
            route = await classify_message(
                self.conversation.messages,
                query,
                self.client,
                self.model
            )
            
            if route == "conversation":
                # Answer from existing context, NO web search
                yield {"type": "reasoning", "text": "💬 Answering from existing context..."}
                async for chunk in self.conversation.send_message(query, files,simple_search = False):
                    yield chunk
                return  # Exit after conversation
            
            elif route == "web_search":
                # Need to search for NEW information
                yield {"type": "reasoning", "text": "🔍 Searching for new information..."}
                
                # Check if web search is needed
                search_info = await self.conversation._generate_search_query(query)
                
                if search_info["search_needed"] and search_info["query"]:
                    yield {"type": "search_query", "text": search_info["query"]}
                    
                    # Perform web search
                    search_results = await self.conversation.google_search(search_info["query"])
                    yield {"type": "sources", "content": search_results}
                    
                    # Extract tables
                    browser_pool = await get_browser_pool()
                    urls = [result["url"] for result in search_results[:5]]
                    
                    if urls:
                        yield {"type": "reasoning", "text": "📊 Extracting tables from sources..."}
                        
                        scrape_results = await scrape_tables_parallel(
                            urls,
                            browser_pool=browser_pool,
                            timeout=60000
                        )
                        
                        # Format tables
                        tables = []
                        for url, url_tables in scrape_results.items():
                            if url_tables:
                                for table in url_tables:
                                    tables.append({
                                        'url': url,
                                        'table': table
                                    })
                        
                        if tables:
                            yield {"type": "tables", "content": tables}
                            yield {"type": "reasoning", "text": f"✅ Extracted {len(tables)} tables"}
                            
                            # Build message with tables
                            tables_text = "\n\n---\n\n".join([
                                f"**Table from {t['url']}:**\n\n{t['table']}"
                                for t in tables[:10]
                            ])
                            
                            enhanced_query = f"""{query}

    ## Reference Tables:

    {tables_text}

    ## Instructions:
    Analyze the tables and data above. If relevant, include tables in your response with your analysis."""
                        else:
                            enhanced_query = query
                    else:
                        enhanced_query = query
                else:
                    enhanced_query = query
                
                # Stream response
                async for chunk in self.conversation.send_message(enhanced_query, files,simple_search = False):
                    yield chunk
                
                return  # Exit after web search
            
            # If route == "deep_research", continue to full deep research below
        
        # ✅ DEEP RESEARCH (either initial query or router decided deep_research)
        yield {"type": "reasoning", "text": "🔍 Starting deep research process..."}
        
        # Use global shared browser pool
        self.browser_pool = await get_browser_pool()
        
        # Reset query results for new deep research
        self.query_results = []
        self.query_tables = {}
        
        # Phase 1: Generate Level 1 queries (1-2 sub-questions)
        yield {"type": "reasoning", "text": "📊 Analyzing research question and generating main branches..."}
        level1_queries = await self._generate_level1_queries(query)
        yield {"type": "reasoning", "text": f"✅ Generated {len(level1_queries)} research branches"}
        
        yield {"type": "reasoning", "text": "🔎 Beginning web searches for Level 1 queries..."}
        
        for i, q in enumerate(level1_queries, 1):
            search_info = await self.conversation._generate_search_query(q)
            if search_info["search_needed"] and search_info["query"]:
                yield {"type": "search_query", "text": search_info["query"]}
                
                search_results = await self.conversation.google_search(search_info["query"])
                yield {"type": "sources", "content": search_results}
                
                yield {"type": "reasoning", "text": f"📄 Extracting tables from Branch {i} sources..."}
                
                urls = [result["url"] for result in search_results[:5]]
                if urls:
                    tables = await self._extract_tables_from_urls(urls)
                    if tables:
                        self.query_tables[q] = tables
                        yield {"type": "tables", "content": tables}
                        yield {"type": "reasoning", "text": f"✅ Extracted {len(tables)} tables from Branch {i}"}
        
        yield {"type": "reasoning", "text": "🌳 Expanding branches into detailed sub-queries..."}
        
        # Phase 2: Generate Level 2 queries (1-2 per Level 1)
        level2_queries = {}
        for i, l1_query in enumerate(level1_queries, 1):
            l2_queries = await self._generate_level2_queries(l1_query, query)
            level2_queries[l1_query] = l2_queries
            
            yield {"type": "reasoning", "text": f"✅ Branch {i} expanded into {len(l2_queries)} sub-queries"}
            
            for j, q in enumerate(l2_queries, 1):
                search_info = await self.conversation._generate_search_query(q)
                if search_info["search_needed"] and search_info["query"]:
                    yield {"type": "search_query", "text": search_info["query"]}
                    
                    search_results = await self.conversation.google_search(search_info["query"])
                    yield {"type": "sources", "content": search_results}
                    
                    urls = [result["url"] for result in search_results[:5]]
                    if urls:
                        tables = await self._extract_tables_from_urls(urls)
                        if tables:
                            self.query_tables[q] = tables
                            yield {"type": "tables", "content": tables}
        
        total_queries = sum(len(queries) for queries in level2_queries.values())
        yield {"type": "reasoning", "text": f"✅ Data collection complete: {total_queries} queries executed"}
        
        yield {"type": "reasoning", "text": "🤖 Analyzing each query with AI..."}
        
        # Phase 3: Execute send_message for each Level 2 query with tables
        query_counter = 0
        for branch_num, (l1_query, l2_queries) in enumerate(level2_queries.items(), 1):
            for query_num, l2_query in enumerate(l2_queries, 1):
                query_counter += 1
                
                yield {"type": "reasoning", "text": f"🔬 Analyzing query {query_counter}/{total_queries}..."}
                
                tables = self.query_tables.get(l2_query, [])
                
                if tables:
                    tables_text = "\n\n---\n\n".join([
                        f"**Table from {t['url']}:**\n\n{t['table']}"
                        for t in tables[:10]
                    ])
                    query_with_tables = f"""{l2_query}

    ## Reference Tables:

    {tables_text}

    ## Instructions:
    **CRITICAL:** You MUST include relevant tables in your response.

    1. Review all the tables above
    2. **Copy the relevant tables directly into your response** (in markdown format)
    3. For each table you include:
    - Add a brief title/context
    - Present the table
    - Provide your analysis of what the data shows
    
    4. Focus your analysis on:
    - Key findings from the numerical data
    - Patterns and trends in the numbers
    - Notable statistics or metrics
    - Comparisons across sources
    - What the data reveals about the question

    5. If a table is not relevant, skip it

    **FORMAT:** 
    For each relevant table, use this structure:
    - Brief context/title
    - The table itself (copy the markdown)
    - Your interpretation (2-3 sentences)

    Be analytical and data-driven. Include ALL relevant numerical data by copying the tables."""
                else:
                    query_with_tables = l2_query
                
                result_content = ""
                async for chunk in self.conversation.send_message(query_with_tables, files,simple_search = False):
                    if chunk["type"] == "content":
                        result_content += chunk["text"]
                        yield {"type": "content", "text": chunk["text"]}
                
                self.query_results.append({
                    "branch": l1_query,
                    "query": l2_query,
                    "result": result_content,
                    "tables_count": len(tables)
                })
        
        yield {"type": "reasoning", "text": f"✅ Completed AI analysis for all {total_queries} queries"}
        
        yield {"type": "reasoning", "text": "📝 Compiling comprehensive research report..."}
        
        # Phase 4: Build final report from all query results
        final_report = f"""# Deep Research Report

    ## Research Question: {query}

    ---

    """
        
        for i, l1_query in enumerate(level1_queries, 1):
            final_report += f"\n## Branch {i}: {l1_query}\n\n"
            
            branch_results = [r for r in self.query_results if r["branch"] == l1_query]
            
            for j, result in enumerate(branch_results, 1):
                final_report += f"### Sub-query {i}.{j}: {result['query']}\n\n"
                final_report += result['result']
                final_report += "\n\n---\n\n"
        
        yield {"type": "reasoning", "text": "🎯 Generating cross-branch synthesis..."}
        
        # Phase 5: Generate final synthesis
        synthesis_prompt = f"""Based on all the research conducted above in this conversation, create a comprehensive synthesis.

    Original question: "{query}"

    Review all the branch analyses above (which already include relevant tables and data) and create:

    ### 1. Executive Summary
    Synthesize the most important findings across all branches (3-4 paragraphs)

    ### 2. Cross-Branch Synthesis Tables

    Create NEW tables that consolidate findings:

    **Key Findings Comparison Table:**
    | Branch | Main Findings | Supporting Data | Implications |
    |--------|---------------|-----------------|--------------|

    **Quantitative Summary Table:**
    | Metric/Data Point | Value | Source | Significance |
    |-------------------|-------|--------|--------------|

    ### 3. Patterns & Insights
    - Cross-cutting themes
    - Contradictions or gaps
    - Emerging trends

    ### 4. Overall Implications
    What do these findings mean for the original question? What are the practical implications?

    ### 5. Future Research Needs
    What gaps exist? What should be investigated further?

    Be comprehensive and analytical. Create synthesis tables that combine data from multiple branches."""

        synthesis_content = ""
        async for chunk in self.conversation.send_message(synthesis_prompt, files, simple_search = False):
            if chunk["type"] == "content":
                synthesis_content += chunk["text"]
        
        final_report += f"\n\n# Final Synthesis\n\n{synthesis_content}"
        
        yield {"type": "report", "content": final_report}
        
        yield {"type": "reasoning", "text": "📋 Generating research methodology documentation..."}
        
        # Phase 6: Research Summary & Methodology
        from simple_search_claude_streaming_with_web_search import ClaudeConversation
        methodology_conversation = ClaudeConversation()
        
        total_searches = sum(len(queries) for queries in level2_queries.values()) + len(level1_queries)
        total_tables = sum(len(tables) for tables in self.query_tables.values())
        
        query_breakdown = ""
        for i, l1_query in enumerate(level1_queries, 1):
            query_breakdown += f"\n**Branch {i}:** {l1_query}\n"
            l2_queries = level2_queries.get(l1_query, [])
            for j, l2_query in enumerate(l2_queries, 1):
                tables_count = len(self.query_tables.get(l2_query, []))
                query_breakdown += f"  - Sub-query {i}.{j}: {l2_query} ({tables_count} tables)\n"
        
        methodology_prompt = f"""Research question: "{query}"

    Research structure:
    - Branches: {len(level1_queries)}
    - Total queries: {total_searches}
    - Tables analyzed: {total_tables}

    Query breakdown:
    {query_breakdown}

    Create a detailed research methodology summary with:

    1. **Methodology Overview Table**
    2. **Research Process Breakdown Table**
    3. **Data Collection Summary**
    4. **Quality Assessment**
    5. **Step-by-step Process**
    6. **Transparency & Limitations**

    Be detailed and academic."""

        methodology_content = ""
        async for chunk in methodology_conversation.send_message(methodology_prompt, files, simple_search = False):
            if chunk["type"] == "content":
                methodology_content += chunk["text"]
        
        yield {"type": "research_summary", "content": methodology_content}
        
        yield {"type": "reasoning", "text": "✅ Deep research complete!"}
        
    async def _extract_tables_from_urls(self, urls: List[str]) -> List[Dict[str, any]]:
        """Extract tables from URLs using the scraper"""
        try:
            scrape_results = await scrape_tables_parallel(
                urls,
                browser_pool=self.browser_pool,
                timeout=60000
            )
            
            all_tables = []
            for url, tables in scrape_results.items():
                if tables:
                    for table in tables:
                        all_tables.append({
                            'url': url,
                            'table': table
                        })
            
            return all_tables
        
        except Exception as e:
            print(f"❌ Table extraction error: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def _generate_level1_queries(self, query: str) -> List[str]:
        """Generate 1-2 broad sub-questions"""
        
        prompt = f"""Given this research question: "{query}"

Break it down into 1-2 distinct, broad sub-questions that would comprehensively cover different aspects of the topic.

Rules:
- Each sub-question should explore a different angle or dimension
- Questions should be broad enough to warrant multiple detailed searches
- Cover: definitions, current state, applications, challenges, future directions, comparisons, etc.
- Questions should be independently answerable

Format your response ONLY as a JSON array of strings:
["question 1", "question 2"]"""

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        response_text = response.content[0].text.strip()
        
        try:
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            queries = json.loads(response_text)
            return queries[:1]
        except:
            lines = [line.strip() for line in response_text.split('\n') if line.strip()]
            queries = [line.lstrip('0123456789.-) ') for line in lines if len(line) > 10]
            return queries[:1]
    
    async def _generate_level2_queries(self, l1_query: str, original_query: str) -> List[str]:
        """Generate 1-2 specific questions for each L1 query"""
        
        prompt = f"""Original research question: "{original_query}"

Sub-question to expand: "{l1_query}"

Generate 1-2 specific, searchable queries that would help answer this sub-question in detail.

Rules:
- Each query should be specific and directly searchable on Google
- Queries should dig deeper into the sub-question
- Include current year (2025) if time-sensitive
- Make queries independently understandable (include context)

Format your response ONLY as a JSON array of strings:
["specific query 1", "specific query 2"]"""

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}]
        )
        
        response_text = response.content[0].text.strip()
        
        try:
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            queries = json.loads(response_text)
            return queries[:1]
        except:
            lines = [line.strip() for line in response_text.split('\n') if line.strip()]
            queries = [line.lstrip('0123456789.-) ') for line in lines if len(line) > 10]
            return queries[:1]


































# import anthropic
# import json
# from typing import List, Dict, Optional
# from fastapi import UploadFile
# import asyncio
# from tables_scraper import scrape_tables_parallel, BrowserPool

# # ✅ Global browser pool (shared across requests)
# _global_browser_pool: Optional[BrowserPool] = None
# _pool_lock = asyncio.Lock()

# async def get_browser_pool():
#     """Get or create global browser pool"""
#     global _global_browser_pool
    
#     async with _pool_lock:
#         if _global_browser_pool is None or not _global_browser_pool.initialized:
#             _global_browser_pool = BrowserPool(pool_size=2, max_tabs_per_browser=10)
#             await _global_browser_pool.initialize()
    
#     return _global_browser_pool

# class DeepResearch:
#     """
#     Tree-based research: Input → Level 1 (1-2 queries) → Level 2 (1-2 queries each)
#     Calls send_message for each query with table context
#     """
    
#     def __init__(self, conversation):
#         """
#         Args:
#             conversation: ClaudeConversation instance
#         """
#         self.conversation = conversation
#         self.client = conversation.client
#         self.model = conversation.model
#         self.browser_pool = None
#         self.query_tables = {}  # Store tables per query
#         self.query_results = []  # Store all query results
    
#     async def research(self, query: str, files: Optional[List[UploadFile]] = None):
#         """
#         Main entry point - same signature as send_message()
#         Yields: {"type": "search_query"/"sources"/"tables"/"reasoning"/"content"/"report"/"research_summary"}
#         """
        
#         # ✅ Use global shared browser pool
#         self.browser_pool = await get_browser_pool()
        
#         # Milestone 1
#         yield {"type": "reasoning", "text": "🔍 Starting deep research process..."}
        
#         # Phase 1: Generate Level 1 queries (1-2 sub-questions)
#         yield {"type": "reasoning", "text": "📊 Analyzing research question and generating main branches..."}
#         level1_queries = await self._generate_level1_queries(query)
#         yield {"type": "reasoning", "text": f"✅ Generated {len(level1_queries)} research branches"}
        
#         # Milestone 2
#         yield {"type": "reasoning", "text": "🔎 Beginning web searches for Level 1 queries..."}
        
#         for i, q in enumerate(level1_queries, 1):
#             search_info = await self.conversation._generate_search_query(q)
#             if search_info["search_needed"] and search_info["query"]:
#                 yield {"type": "search_query", "text": search_info["query"]}
                
#                 search_results = await self.conversation.google_search(search_info["query"])
#                 yield {"type": "sources", "content": search_results}
                
#                 # Milestone 3
#                 yield {"type": "reasoning", "text": f"📄 Extracting tables from Branch {i} sources..."}
                
#                 urls = [result["url"] for result in search_results[:5]]
#                 if urls:
#                     tables = await self._extract_tables_from_urls(urls)
#                     if tables:
#                         self.query_tables[q] = tables
#                         yield {"type": "tables", "content": tables}
#                         yield {"type": "reasoning", "text": f"✅ Extracted {len(tables)} tables from Branch {i}"}
        
#         # Milestone 4
#         yield {"type": "reasoning", "text": "🌳 Expanding branches into detailed sub-queries..."}
        
#         # Phase 2: Generate Level 2 queries (1-2 per Level 1)
#         level2_queries = {}
#         for i, l1_query in enumerate(level1_queries, 1):
#             l2_queries = await self._generate_level2_queries(l1_query, query)
#             level2_queries[l1_query] = l2_queries
            
#             # Milestone 5
#             yield {"type": "reasoning", "text": f"✅ Branch {i} expanded into {len(l2_queries)} sub-queries"}
            
#             for j, q in enumerate(l2_queries, 1):
#                 search_info = await self.conversation._generate_search_query(q)
#                 if search_info["search_needed"] and search_info["query"]:
#                     yield {"type": "search_query", "text": search_info["query"]}
                    
#                     search_results = await self.conversation.google_search(search_info["query"])
#                     yield {"type": "sources", "content": search_results}
                    
#                     urls = [result["url"] for result in search_results[:5]]
#                     if urls:
#                         tables = await self._extract_tables_from_urls(urls)
#                         if tables:
#                             self.query_tables[q] = tables
#                             yield {"type": "tables", "content": tables}
        
#         # Milestone 6
#         total_queries = sum(len(queries) for queries in level2_queries.values())
#         yield {"type": "reasoning", "text": f"✅ Data collection complete: {total_queries} queries executed"}
        
#         # Milestone 7
#         yield {"type": "reasoning", "text": "🤖 Analyzing each query with AI..."}
        
#         # Phase 3: Execute send_message for each Level 2 query with tables
#         query_counter = 0
#         for branch_num, (l1_query, l2_queries) in enumerate(level2_queries.items(), 1):
#             for query_num, l2_query in enumerate(l2_queries, 1):
#                 query_counter += 1
                
#                 # Milestone 8
#                 yield {"type": "reasoning", "text": f"🔬 Analyzing query {query_counter}/{total_queries}..."}
                
#                 tables = self.query_tables.get(l2_query, [])
                
#                 if tables:
#                     tables_text = "\n\n---\n\n".join([
#                         f"**Table from {t['url']}:**\n\n{t['table']}"
#                         for t in tables[:10]
#                     ])
#                     query_with_tables = f"""{l2_query}

# ## Reference Tables:

# {tables_text}

# ## Instructions:
# **CRITICAL:** You MUST include relevant tables in your response.

# 1. Review all the tables above
# 2. **Copy the relevant tables directly into your response** (in markdown format)
# 3. For each table you include:
#    - Add a brief title/context
#    - Present the table
#    - Provide your analysis of what the data shows
   
# 4. Focus your analysis on:
#    - Key findings from the numerical data
#    - Patterns and trends in the numbers
#    - Notable statistics or metrics
#    - Comparisons across sources
#    - What the data reveals about the question

# 5. If a table is not relevant, skip it

# **FORMAT:** 
# For each relevant table, use this structure:
# - Brief context/title
# - The table itself (copy the markdown)
# - Your interpretation (2-3 sentences)

# Be analytical and data-driven. Include ALL relevant numerical data by copying the tables."""
#                 else:
#                     query_with_tables = l2_query
                
#                 result_content = ""
#                 async for chunk in self.conversation.send_message(query_with_tables, files):
#                     if chunk["type"] == "content":
#                         result_content += chunk["text"]
#                         # ✅ Yield each chunk as it streams
#                         # yield {"type": "content", "text": chunk["text"]}
                
#                 self.query_results.append({
#                     "branch": l1_query,
#                     "query": l2_query,
#                     "result": result_content,
#                     "tables_count": len(tables)
#                 })
        
#         # Milestone 9
#         yield {"type": "reasoning", "text": f"✅ Completed AI analysis for all {total_queries} queries"}
        
#         # Milestone 10
#         yield {"type": "reasoning", "text": "📝 Compiling comprehensive research report..."}
        
#         # Phase 4: Build final report from all query results (LLM already included tables)
#         final_report = f"""# Deep Research Report

# ## Research Question: {query}

# ---

# """
        
#         for i, l1_query in enumerate(level1_queries, 1):
#             final_report += f"\n## Branch {i}: {l1_query}\n\n"
            
#             branch_results = [r for r in self.query_results if r["branch"] == l1_query]
            
#             for j, result in enumerate(branch_results, 1):
#                 final_report += f"### Sub-query {i}.{j}: {result['query']}\n\n"
                
#                 # LLM already included relevant tables in its response
#                 final_report += result['result']
#                 final_report += "\n\n---\n\n"
        
#         # Milestone 11
#         yield {"type": "reasoning", "text": "🎯 Generating cross-branch synthesis..."}
        
#         # Phase 5: Generate final synthesis
#         synthesis_prompt = f"""Based on all the research conducted above in this conversation, create a comprehensive synthesis.

# Original question: "{query}"

# Review all the branch analyses above (which already include relevant tables and data) and create:

# ### 1. Executive Summary
# Synthesize the most important findings across all branches (3-4 paragraphs)

# ### 2. Cross-Branch Synthesis Tables

# Create NEW tables that consolidate findings:

# **Key Findings Comparison Table:**
# | Branch | Main Findings | Supporting Data | Implications |
# |--------|---------------|-----------------|--------------|

# **Quantitative Summary Table:**
# | Metric/Data Point | Value | Source | Significance |
# |-------------------|-------|--------|--------------|

# ### 3. Patterns & Insights
# - Cross-cutting themes
# - Contradictions or gaps
# - Emerging trends

# ### 4. Overall Implications
# What do these findings mean for the original question? What are the practical implications?

# ### 5. Future Research Needs
# What gaps exist? What should be investigated further?

# Be comprehensive and analytical. Create synthesis tables that combine data from multiple branches."""

#         synthesis_content = ""
#         async for chunk in self.conversation.send_message(synthesis_prompt, files):
#             if chunk["type"] == "content":
#                 synthesis_content += chunk["text"]
        
#         final_report += f"\n\n# Final Synthesis\n\n{synthesis_content}"
        
#         yield {"type": "report", "content": final_report}
        
#         # Milestone 12
#         yield {"type": "reasoning", "text": "📋 Generating research methodology documentation..."}
        
#         # Phase 6: Research Summary & Methodology
#         from simple_search_claude_streaming_with_web_search import ClaudeConversation
#         methodology_conversation = ClaudeConversation()
        
#         total_searches = sum(len(queries) for queries in level2_queries.values()) + len(level1_queries)
#         total_tables = sum(len(tables) for tables in self.query_tables.values())
        
#         query_breakdown = ""
#         for i, l1_query in enumerate(level1_queries, 1):
#             query_breakdown += f"\n**Branch {i}:** {l1_query}\n"
#             l2_queries = level2_queries.get(l1_query, [])
#             for j, l2_query in enumerate(l2_queries, 1):
#                 tables_count = len(self.query_tables.get(l2_query, []))
#                 query_breakdown += f"  - Sub-query {i}.{j}: {l2_query} ({tables_count} tables)\n"
        
#         methodology_prompt = f"""Research question: "{query}"

# Research structure:
# - Branches: {len(level1_queries)}
# - Total queries: {total_searches}
# - Tables analyzed: {total_tables}

# Query breakdown:
# {query_breakdown}

# Create a detailed research methodology summary with:

# 1. **Methodology Overview Table**
# 2. **Research Process Breakdown Table**
# 3. **Data Collection Summary**
# 4. **Quality Assessment**
# 5. **Step-by-step Process**
# 6. **Transparency & Limitations**

# Be detailed and academic."""

#         methodology_content = ""
#         async for chunk in methodology_conversation.send_message(methodology_prompt, files):
#             if chunk["type"] == "content":
#                 methodology_content += chunk["text"]
        
#         yield {"type": "research_summary", "content": methodology_content}
        
#         # Final milestone
#         yield {"type": "reasoning", "text": "✅ Deep research complete!"}
    
#     async def _extract_tables_from_urls(self, urls: List[str]) -> List[Dict[str, any]]:
#         """Extract tables from URLs using the scraper"""
#         try:
#             scrape_results = await scrape_tables_parallel(
#                 urls,
#                 browser_pool=self.browser_pool,
#                 timeout=60000
#             )
            
#             all_tables = []
#             for url, tables in scrape_results.items():
#                 if tables:
#                     for table in tables:
#                         all_tables.append({
#                             'url': url,
#                             'table': table
#                         })
            
#             return all_tables
        
#         except Exception as e:
#             print(f"❌ Table extraction error: {e}")
#             import traceback
#             traceback.print_exc()
#             return []
    
#     async def _generate_level1_queries(self, query: str) -> List[str]:
#         """Generate 1-2 broad sub-questions"""
        
#         prompt = f"""Given this research question: "{query}"

# Break it down into 5-6 distinct, broad sub-questions that would comprehensively cover different aspects of the topic.

# Rules:
# - Each sub-question should explore a different angle or dimension
# - Questions should be broad enough to warrant multiple detailed searches
# - Cover: definitions, current state, applications, challenges, future directions, comparisons, etc.
# - Questions should be independently answerable

# Format your response ONLY as a JSON array of strings:
# ["question 1", "question 2"]"""

#         response = await self.client.messages.create(
#             model=self.model,
#             max_tokens=1000,
#             messages=[{"role": "user", "content": prompt}]
#         )
        
#         response_text = response.content[0].text.strip()
        
#         try:
#             if "```json" in response_text:
#                 response_text = response_text.split("```json")[1].split("```")[0].strip()
#             elif "```" in response_text:
#                 response_text = response_text.split("```")[1].split("```")[0].strip()
            
#             queries = json.loads(response_text)
#             return queries[:2]
#         except:
#             lines = [line.strip() for line in response_text.split('\n') if line.strip()]
#             queries = [line.lstrip('0123456789.-) ') for line in lines if len(line) > 10]
#             return queries[:2]
    
#     async def _generate_level2_queries(self, l1_query: str, original_query: str) -> List[str]:
#         """Generate 1-2 specific questions for each L1 query"""
        
#         prompt = f"""Original research question: "{original_query}"

# Sub-question to expand: "{l1_query}"

# Generate 2-3 specific, searchable queries that would help answer this sub-question in detail.

# Rules:
# - Each query should be specific and directly searchable on Google
# - Queries should dig deeper into the sub-question
# - Include current year (2025) if time-sensitive
# - Make queries independently understandable (include context)

# Format your response ONLY as a JSON array of strings:
# ["specific query 1", "specific query 2"]"""

#         response = await self.client.messages.create(
#             model=self.model,
#             max_tokens=500,
#             messages=[{"role": "user", "content": prompt}]
#         )
        
#         response_text = response.content[0].text.strip()
        
#         try:
#             if "```json" in response_text:
#                 response_text = response_text.split("```json")[1].split("```")[0].strip()
#             elif "```" in response_text:
#                 response_text = response_text.split("```")[1].split("```")[0].strip()
            
#             queries = json.loads(response_text)
#             return queries[:1]
#         except:
#             lines = [line.strip() for line in response_text.split('\n') if line.strip()]
#             queries = [line.lstrip('0123456789.-) ') for line in lines if len(line) > 10]
#             return queries[0:1]