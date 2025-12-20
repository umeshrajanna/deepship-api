import anthropic
import json
from typing import List, Dict, Optional
from fastapi import UploadFile
import asyncio
from datetime import datetime
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
    
    # ✅ DATE FIX
    current_date = datetime.now().strftime("%A, %B %d, %Y")
    
    # Format conversation history
    history_text = ""
    for msg in conversation_messages[-6:]:  # Last 6 messages for context
        role = msg.get("role", "")
        content = msg.get("content", "")
        if isinstance(content, list):
            content = " ".join([c.get("text", "") for c in content if c.get("type") == "text"])
        history_text += f"{role}: {content[:500]}...\n\n"
    
    router_prompt = f"""The current date is {current_date}.

You are a routing classifier. Analyze this conversation and determine what action to take for the latest user message.

Recent conversation history:
{history_text}

Latest user message: "{user_message}"

Classify as:

1. "deep_research" - User wants comprehensive NEW research on a different topic requiring multiple queries, branches, and deep analysis
   - Indicators: New broad topic, "research X", "analyze comprehensively", completely different subject
   
2. "web_search" - User wants to ADD information, modify existing research, or change styling
   - Indicators: "Add data about...", "Include information on...", "Make it dark mode", "Change the design", "Add charts", "Update with...", extensions of current topic
   
3. "conversation" - User is asking CLARIFYING questions about existing research, NO new data or changes needed
   - Indicators: "What does that mean?", "Can you explain?", "What's the source?", "Tell me more about what you found", asking about existing findings

CRITICAL RULES:
- If user wants to ADD data, modify styling, or extend the research → "web_search" (will regenerate HTML)
- If user is asking to understand/clarify existing content → "conversation" (no HTML regeneration)
- If user wants completely NEW research on different topic → "deep_research"
- Styling changes like "make it prettier", "dark mode", "add animations" → "web_search"

Return ONLY valid JSON:
{{"route": "deep_research|web_search|conversation", "reasoning": "..."}}"""

    try:
        response = await client.messages.create(
            model=model,
            max_tokens=200,
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
    Always generates interactive HTML website (except for clarifying questions)
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
        self.last_research_data = None  # Store last research data for modifications
    
    async def research(self, query: str, files: Optional[List[UploadFile]] = None):
        """
        Main entry point with automatic routing logic
        Generates interactive HTML website for all routes except clarifications
        
        Args:
            query: User's research question
            files: Optional uploaded files
        
        Yields: {"type": "search_query"/"sources"/"tables"/"reasoning"/"content"/"html_app"/"research_summary"}
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
                # Answer clarifying questions, NO HTML generation
                yield {"type": "reasoning", "text": "💬 Answering your question..."}
                async for chunk in self.conversation.send_message(query, files, simple_search=False):
                    yield chunk
                return  # Exit - no HTML app
            
            elif route == "web_search":
                # Extension/modification - search + regenerate HTML
                yield {"type": "reasoning", "text": "🔍 Gathering additional information..."}
                
                # Check if web search is needed
                search_info = await self.conversation._generate_search_query(query)
                
                tables = []
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
                
                # Build research data for HTML generation
                yield {"type": "reasoning", "text": "📦 Organizing research data..."}
                
                # Use previous research data if available, add new data
                if self.last_research_data:
                    research_data = self.last_research_data.copy()
                    # Add new tables to existing structure
                    if tables:
                        if "additional_data" not in research_data:
                            research_data["additional_data"] = []
                        research_data["additional_data"].append({
                            "query": query,
                            "tables": tables
                        })
                else:
                    # No previous research, create new structure
                    research_data = {
                        "query": query,
                        "branches": [{
                            "title": query,
                            "sub_queries": [{
                                "question": query,
                                "tables": tables,
                                "tables_count": len(tables)
                            }]
                        }]
                    }
                
                # Generate new HTML app with updated/modified data
                yield {"type": "reasoning", "text": "🎨 Generating updated HTML website..."}
                html_app = await self._generate_html_app(research_data, modification_request=query)
                
                yield {"type": "html_app", "content": html_app}
                yield {"type": "reasoning", "text": "✅ Updated research website ready!"}
                
                return  # Exit after generating HTML
            
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
        
        # Phase 3: Build research data structure
        yield {"type": "reasoning", "text": "📦 Organizing collected research data..."}
        
        research_data = {
            "query": query,
            "branches": []
        }
        
        for i, l1_query in enumerate(level1_queries, 1):
            branch_data = {
                "title": l1_query,
                "sub_queries": []
            }
            
            l2_queries = level2_queries.get(l1_query, [])
            for j, l2_query in enumerate(l2_queries, 1):
                tables = self.query_tables.get(l2_query, [])
                
                sub_query_data = {
                    "question": l2_query,
                    "tables": tables,
                    "tables_count": len(tables)
                }
                branch_data["sub_queries"].append(sub_query_data)
            
            research_data["branches"].append(branch_data)
        
        # Store for future modifications
        self.last_research_data = research_data
        
        yield {"type": "reasoning", "text": "✅ Research data organized"}
        
        # Phase 4: Generate interactive HTML app with all data
        yield {"type": "reasoning", "text": "🎨 Generating interactive HTML research website..."}
        
        html_app = await self._generate_html_app(research_data)
        
        yield {"type": "html_app", "content": html_app}
        
        yield {"type": "reasoning", "text": "📋 Generating research methodology documentation..."}
        
        # Phase 5: Research Summary & Methodology
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
        async for chunk in methodology_conversation.send_message(methodology_prompt, files, simple_search=False):
            if chunk["type"] == "content":
                methodology_content += chunk["text"]
        
        yield {"type": "research_summary", "content": methodology_content}
        
        yield {"type": "reasoning", "text": "✅ Deep research complete!"}
    
    async def _generate_html_app(self, research_data: Dict, modification_request: str = None) -> str:
        """
        Generate self-contained interactive HTML website from research data
        
        Args:
            research_data: Structured research data with branches and tables
            modification_request: Optional modification request (e.g., "make it dark mode", "add charts")
        """
        
        # ✅ DATE FIX
        current_date = datetime.now().strftime("%A, %B %d, %Y")
        
        # Build comprehensive prompt with all research data
        tables_by_branch = []
        for i, branch in enumerate(research_data["branches"], 1):
            branch_info = f"Branch {i}: {branch['title']}\n"
            for j, sub_query in enumerate(branch["sub_queries"], 1):
                branch_info += f"\n  Sub-query {i}.{j}: {sub_query['question']}\n"
                branch_info += f"  Tables: {sub_query['tables_count']}\n"
                
                if sub_query["tables"]:
                    for idx, table in enumerate(sub_query["tables"][:10], 1):
                        branch_info += f"\n  Table {i}.{j}.{idx} from {table['url']}:\n"
                        branch_info += f"  {table['table']}\n"
            
            tables_by_branch.append(branch_info)
        
        # Add additional data if present (from modifications)
        if "additional_data" in research_data:
            for add_data in research_data["additional_data"]:
                branch_info = f"\nAdditional Data: {add_data['query']}\n"
                for idx, table in enumerate(add_data["tables"][:10], 1):
                    branch_info += f"\n  Table {idx} from {table['url']}:\n"
                    branch_info += f"  {table['table']}\n"
                tables_by_branch.append(branch_info)
        
        research_context = "\n\n".join(tables_by_branch)
        
        modification_instruction = ""
        if modification_request:
            modification_instruction = f"""

## MODIFICATION REQUEST:
The user has requested: "{modification_request}"

Please incorporate this modification into the HTML design. This could be:
- Styling changes (dark mode, colors, fonts, layout)
- Adding new visualizations or charts
- Including additional data sections
- UI/UX improvements
"""
        
        html_prompt = f"""The current date is {current_date}.

Create a self-contained, interactive HTML website for this research analysis.

Research Question: {research_data["query"]}

Research Data:
{research_context}
{modification_instruction}

Create a SINGLE HTML FILE with:

## Design Requirements:
- Modern, professional design with gradient backgrounds
- Responsive layout (works on mobile and desktop)
- Interactive navigation (tabs, accordions, or sections)
- Data visualizations where appropriate (use Chart.js from CDN)
- All CSS and JavaScript inline (no external files)
- Beautiful typography and spacing
- Smooth animations and transitions

## Content Structure:

1. **Hero Section**
   - Research question as title
   - Brief overview
   - Key statistics (branches, queries, tables analyzed)

2. **Executive Summary**
   - Main findings across all branches
   - Key insights in card/grid layout

3. **Research Branches** (Tabbed or Accordion Interface)
   - Tab/section for each branch
   - Show sub-queries within each branch
   - Display all relevant tables with styling
   - Add insights and analysis for each section

4. **Data Visualizations**
   - Create charts from the numerical data in tables
   - Comparison charts across branches
   - Use Chart.js from CDN

5. **Cross-Branch Analysis**
   - Synthesis table comparing all branches
   - Pattern identification
   - Contradictions and gaps

6. **Methodology Section**
   - How the research was conducted
   - Data sources
   - Quality assessment

## Technical Requirements:
- Use Tailwind CSS from CDN for styling
- Use Chart.js from CDN for visualizations
- All tables should be styled and responsive
- Add smooth scrolling and transitions
- Include a table of contents / navigation
- Make it visually impressive and easy to navigate

## CRITICAL:
- Include ALL tables from the research data
- Add your analysis and insights throughout
- Make it visually impressive and easy to navigate
- Ensure it's a SINGLE, self-contained HTML file
- All CDN links should use: https://cdn.jsdelivr.net/ or https://cdnjs.cloudflare.com/
- If modification request provided, implement it fully

Return ONLY the complete HTML code, no explanations."""

        response = await self.client.messages.create(
            model=self.model,
            max_tokens=16000,
            messages=[{"role": "user", "content": html_prompt}]
        )
        
        html_content = response.content[0].text.strip()
        
        # Extract HTML if wrapped in code blocks
        if "```html" in html_content:
            html_content = html_content.split("```html")[1].split("```")[0].strip()
        elif "```" in html_content:
            html_content = html_content.split("```")[1].split("```")[0].strip()
        
        return html_content
    
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
        
        # ✅ DATE FIX
        current_date = datetime.now().strftime("%A, %B %d, %Y")
        
        prompt = f"""The current date is {current_date}.

Given this research question: "{query}"

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
            return queries[:2]
        except:
            lines = [line.strip() for line in response_text.split('\n') if line.strip()]
            queries = [line.lstrip('0123456789.-) ') for line in lines if len(line) > 10]
            return queries[:2]
    
    async def _generate_level2_queries(self, l1_query: str, original_query: str) -> List[str]:
        """Generate 1-2 specific questions for each L1 query"""
        
        # ✅ DATE FIX
        current_date = datetime.now().strftime("%A, %B %d, %Y")
        
        prompt = f"""The current date is {current_date}.

Original research question: "{original_query}"

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
            return queries[:2]
        except:
            lines = [line.strip() for line in response_text.split('\n') if line.strip()]
            queries = [line.lstrip('0123456789.-) ') for line in lines if len(line) > 10]
            return queries[:2]