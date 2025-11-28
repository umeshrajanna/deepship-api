"""
Your EXACT scraper code - integrated into worker
NO changes to scraping logic!
"""

import asyncio
from asyncio import Semaphore
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError, Browser
import trafilatura
import time, random, os, hashlib
from urllib.parse import urlparse
from typing import List, Dict, Optional, Tuple, Any
from bs4 import BeautifulSoup, Tag

# Sentence transformers for semantic search
from sentence_transformers import SentenceTransformer, util
import torch

# ============================================================================
# Browser Pool - Shared browsers with tabs
# ============================================================================

class BrowserPool:
    """Manages a pool of shared browsers with tab-based concurrency"""
    
    def __init__(self, pool_size: int = 2, max_tabs_per_browser: int = 10):
        self.pool_size = 10 # pool_size
        self.max_tabs_per_browser = 10 # max_tabs_per_browser
        self.browsers: List[Browser] = []
        self.browser_semaphores: List[Semaphore] = []
        self.playwright = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize the browser pool"""
        if self.initialized:
            return
        
        print(f"🚀 Initializing browser pool with {self.pool_size} browsers...")
        self.playwright = await async_playwright().start()
        
        for i in range(self.pool_size):
            browser = await self.playwright.chromium.launch(headless=True)
            self.browsers.append(browser)
            self.browser_semaphores.append(Semaphore(self.max_tabs_per_browser))
            print(f"✅ Browser {i+1} initialized (max {self.max_tabs_per_browser} tabs)")
        
        self.initialized = True
        print(f"✅ Browser pool ready")
    
    async def get_browser_and_semaphore(self) -> tuple[Browser, Semaphore]:
        """Get least-loaded browser and its semaphore"""
        if not self.initialized:
            await self.initialize()
        
        idx = random.randint(0, len(self.browsers) - 1)
        return self.browsers[idx], self.browser_semaphores[idx]
    
    async def close(self):
        """Close all browsers in the pool"""
        print("🧹 Closing browser pool...")
        for browser in self.browsers:
            try:
                await browser.close()
            except Exception as e:
                print(f"⚠️ Error closing browser: {e}")
        
        if self.playwright:
            try:
                await self.playwright.stop()
            except Exception as e:
                print(f"⚠️ Error stopping playwright: {e}")
        
        self.browsers = []
        self.browser_semaphores = []
        self.initialized = False
        print("✅ Browser pool closed")


# ============================================================================
# Content Selectors & Stealth Script
# ============================================================================

CONTENT_SELECTORS = [
    "article", "main", "section[role='main']", "div.story",
    "div.article-body", "div.article-content", "div.post-content",
    "div.entry-content", "div#main-content", "div#content",
    "div.content-body", "div[class*='article']", "div[class*='content']",
    "div[class*='container']", "section[class*='body']", "div.post",
    "div[class*='wr-time-slot']", "span", "div[data-component='temperature']"
]
GROUPED_SELECTOR = ", ".join(CONTENT_SELECTORS)

STEALTH_INIT_SCRIPT = """ 
Object.defineProperty(navigator, 'webdriver', { get: () => false });
Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
window.chrome = { runtime: {} };
"""

# ============================================================================
# Helper Functions
# ============================================================================

def _clean_and_join_paragraphs(paragraphs: List[str]) -> str:
    cleaned = []
    seen = set()
    for p in paragraphs:
        if not p:
            continue
        s = " ".join(p.split())
        if not s:
            continue
        if s in seen:
            continue
        seen.add(s)
        cleaned.append(s)
    return "\n\n".join(cleaned).strip()

def _safe_filename_from_url(url: str) -> str:
    parsed = urlparse(url)
    safe = f"{parsed.netloc}{parsed.path}".replace("/", "_").strip("_")
    if not safe:
        safe = parsed.netloc
    return safe[:150]

async def _extract_text_trafilatura(html: str) -> Optional[str]:
    return await asyncio.to_thread(trafilatura.extract, html, include_comments=False)

def _normalize_cell(s: Optional[str]) -> str:
    if s is None:
        return ""
    return " ".join(s.split()).strip()

def html_table_to_md(html: str, title: str = "") -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return None
    
    caption_tag = table.find("caption")
    caption = _normalize_cell(caption_tag.get_text()) if caption_tag else ""
    
    def cell_best_text(cell: Tag) -> str:
        img = cell.find("img")
        if img:
            alt = img.get("alt") or img.get("title")
            if alt:
                return _normalize_cell(alt)
        if cell.has_attr("aria-label"):
            return _normalize_cell(cell["aria-label"])
        if cell.has_attr("title"):
            return _normalize_cell(cell["title"])
        for attr in ("data-value", "data-c", "data-text", "data-unit", "data-mph", "data-kph"):
            if cell.has_attr(attr) and cell[attr]:
                return _normalize_cell(cell[attr])
        for k, v in cell.attrs.items():
            if k.startswith("data-") and isinstance(v, str) and v.strip():
                return _normalize_cell(v)
        if cell.has_attr("aria-describedby"):
            ref = cell["aria-describedby"]
            ref_el = soup.find(id=ref)
            if ref_el:
                return _normalize_cell(ref_el.get_text())
        text = cell.get_text(separator=" ", strip=True)
        return _normalize_cell(text)
    
    rows: List[List[str]] = []
    header_cells: List[str] = []
    
    thead = table.find("thead")
    if thead:
        header_trs = thead.find_all("tr")
        if header_trs:
            header_cells = [cell_best_text(td) for td in header_trs[-1].find_all(["th", "td"])]
    else:
        first_tr = table.find("tr")
        if first_tr:
            ths = first_tr.find_all("th")
            if ths:
                header_cells = [cell_best_text(th) for th in ths]
    
    tr_nodes = table.find_all("tr")
    for tr in tr_nodes:
        cells = []
        for cell in tr.find_all(["th", "td"]):
            cells.append(cell_best_text(cell))
        if any(c for c in cells):
            rows.append(cells)
    
    if not header_cells and rows:
        first_row = rows[0]
        if len(first_row) >= 2 and len(rows) > 1:
            lengths = [len(r) for r in rows[1: min(len(rows), 6)]]
            common_len = max(set(lengths), key=lengths.count) if lengths else None
            if common_len and abs(len(first_row) - common_len) <= 1:
                header_cells = first_row
                rows = rows[1:]
    
    if header_cells:
        header_len = max(1, len(header_cells))
        normalized = []
        for r in rows:
            row = [c for c in r]
            if len(row) < header_len:
                row += [""] * (header_len - len(row))
            elif len(row) > header_len:
                row = row[:header_len]
            normalized.append(row)
        rows = normalized
    else:
        maxcols = max((len(r) for r in rows), default=0)
        header_cells = [f"col{i+1}" for i in range(maxcols)]
        normalized = []
        for r in rows:
            row = r + [""] * (maxcols - len(r))
            normalized.append(row)
        rows = normalized
    
    def row_is_header_like(r):
        non_empty = [c for c in r if c]
        if not non_empty:
            return True
        header_set = set(h.lower() for h in header_cells if h)
        if header_set and all(any(h in c.lower() or c.lower() in h for h in header_set) for c in non_empty):
            return True
        return False
    
    filtered_rows = [r for r in rows if not row_is_header_like(r)]
    rows = filtered_rows
    
    if not any(any(cell.strip() for cell in r) for r in rows):
        return None
    
    def esc(s: str) -> str:
        return s.replace("|", "\\|")
    
    header_line = "| " + " | ".join(esc(h) if h else "" for h in header_cells) + " |"
    sep_line = "| " + " | ".join("---" for _ in header_cells) + " |"
    row_lines = []
    for r in rows:
        row_texts = []
        for i, cell in enumerate(r):
            txt = cell or ""
            row_texts.append(esc(txt))
        row_lines.append("| " + " | ".join(row_texts) + " |")
    
    md_parts = []
    ttl = title or caption
    if ttl:
        md_parts.append(f"**{_normalize_cell(ttl)}**\n")
    md_parts.append("\n".join([header_line, sep_line] + row_lines))
    return "\n".join(md_parts)

async def _extract_tables_from_page(page) -> List[str]:
    js = r"""
    () => {
      const tables = Array.from(document.querySelectorAll('table'));
      function getText(n) { try { return (n && n.innerText || '').trim(); } catch(e) { return ''; } }
      function findPrecedingHeading(el) {
        let prev = el.previousElementSibling;
        let steps = 0;
        while(prev && steps < 6) {
          const tag = prev.tagName ? prev.tagName.toLowerCase() : '';
          if (tag && tag.match(/^h[1-6]$/)) return getText(prev);
          const cls = (prev.className || '').toLowerCase();
          if (cls && (cls.includes('title') || cls.includes('heading') || cls.includes('caption') || cls.includes('table-title'))) return getText(prev);
          prev = prev.previousElementSibling;
          steps++;
        }
        try {
          const p = el.parentElement;
          if (p) {
            let pprev = p.previousElementSibling;
            steps = 0;
            while(pprev && steps < 4) {
              const tag = pprev.tagName ? pprev.tagName.toLowerCase() : '';
              if (tag && tag.match(/^h[1-6]$/)) return getText(pprev);
              const cls = (pprev.className || '').toLowerCase();
              if (cls && (cls.includes('title') || cls.includes('heading') || cls.includes('caption') || cls.includes('table-title'))) return getText(pprev);
              pprev = pprev.previousElementSibling;
              steps++;
            }
          }
        } catch(e){}
        return '';
      }
      return tables.map(t => {
        const caption = getText(t.querySelector('caption') || null) || '';
        const precedingHeading = findPrecedingHeading(t) || '';
        return {html: t.outerHTML, caption: caption, precedingHeading: precedingHeading};
      });
    }
    """
    try:
        tbls = await page.evaluate(js)
    except Exception:
        return []
    
    md_tables = []
    seen = set()
    for t in tbls:
        html = t.get("html") or ""
        title = (t.get("caption") or "").strip() or (t.get("precedingHeading") or "").strip()
        md = html_table_to_md(html, title=title)
        if not md:
            continue
        if md in seen:
            continue
        seen.add(md)
        md_tables.append(md)
    
    return md_tables

# ============================================================================
# Scraping Functions
# ============================================================================

async def scrape_one(page, url: str, debug: bool = False, wait_timeout: int = 8000) -> Tuple[Optional[str], Optional[List[str]]]:
    wait_timeout = 4000
    print(f"🌐 [{asyncio.current_task().get_name()}] Navigating: {url}")
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=wait_timeout)
    except PlaywrightTimeoutError:
        print(f"⚠️ [{url}] Timeout on load — continuing anyway")
    except Exception as e:
        print(f"❌ [{url}] Navigation error: {e}")
        return None, None
    
    try:
        await page.wait_for_selector(GROUPED_SELECTOR, timeout=wait_timeout)
        print(f"✅ [{url}] Found grouped selector.")
    except PlaywrightTimeoutError:
        print(f"⚠️ [{url}] No grouped selector matched within {wait_timeout}ms.")
    except Exception as e:
        print(f"⚠️ [{url}] wait_for_selector error: {e}")
    
    await asyncio.sleep(2)
    
    paragraphs: List[str] = []
    try:
        paragraphs = await page.eval_on_selector_all(
            "div p",
            "els => els.map(e => e.textContent ? e.textContent : '').filter(t => t && t.trim().length > 0)"
        )
        print(f"ℹ️ [{url}] Found {len(paragraphs)} <p> inside <div>.")
    except Exception as e:
        print(f"⚠️ [{url}] 'div p' extraction failed: {e}")
        paragraphs = []
    
    try:
        grouped_selector_p = GROUPED_SELECTOR + " p"
        grouped_p = await page.eval_on_selector_all(
            grouped_selector_p,
            "els => els.map(e => e.textContent ? e.textContent : '').filter(t => t && t.trim().length > 0)"
        )
        if grouped_p:
            print(f"ℹ️ [{url}] Found {len(grouped_p)} <p> inside GROUPED_SELECTOR containers.")
            paragraphs.extend(grouped_p)
    except Exception:
        pass
    
    if not paragraphs:
        try:
            all_p = await page.eval_on_selector_all(
                "p",
                "els => els.map(e => e.textContent ? e.textContent : '').filter(t => t && t.trim().length > 0)"
            )
            if all_p:
                print(f"ℹ️ [{url}] Fallback: found {len(all_p)} <p> tags in document.")
                paragraphs.extend(all_p)
        except Exception:
            pass
    
    dom_text = _clean_and_join_paragraphs(paragraphs)
    
    try:
        md_tables = await _extract_tables_from_page(page)
        if md_tables:
            print(f"ℹ️ [{url}] Extracted {len(md_tables)} valid table(s).")
        else:
            md_tables = []
    except Exception as e:
        print(f"⚠️ [{url}] Table extraction failed: {e}")
        md_tables = []
    
    try:
        html = await page.content()
    except Exception as e:
        print(f"❌ [{url}] Couldn't get page content: {e}")
        html = ""
    
    if debug:
        try:
            os.makedirs("debug", exist_ok=True)
            safe_name = _safe_filename_from_url(url)
            with open(f"debug/{safe_name}.html", "w", encoding="utf-8") as f:
                f.write(html)
            try:
                await page.screenshot(path=f"debug/{safe_name}.png", full_page=True)
            except Exception as e:
                print(f"⚠️ [{url}] Screenshot failed: {e}")
        except Exception as e:
            print(f"⚠️ [{url}] Debug save failed: {e}")
    
    final_text: Optional[str] = None
    if dom_text and len(dom_text) >= 80:
        print(f"✅ [{url}] Returning DOM-extracted text ({len(dom_text)} chars).")
        final_text = dom_text
    else:
        if html:
            print(f"🔁 [{url}] DOM extraction empty/short — falling back to trafilatura on HTML.")
            try:
                text = await _extract_text_trafilatura(html)
                if text and len(text.strip()) >= 80:
                    final_text = text.strip()
                else:
                    print(f"⚠️ [{url}] Trafilatura returned empty/too-short text.")
            except Exception as e:
                print(f"⚠️ [{url}] Trafilatura extraction failed: {e}")
    
    final_tables = md_tables if md_tables else None
    
    if not final_text and not final_tables:
        print(f"⚠️ [{url}] No valid text or tables extracted (discarding page).")
        return None, None
    
    return final_text, final_tables

async def worker_with_tab(
    url: str, 
    browser: Browser,
    semaphore: Semaphore, 
    debug: bool = False, 
    wait_timeout: int = 8000
) -> Tuple[str, Dict[str, Optional[Any]]]:
    """Worker that uses a tab in shared browser instead of new browser"""
    async with semaphore:
        page = await browser.new_page()
        
        ua = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            f"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{random.randint(110,140)}.0.0.0 Safari/537.36"
        )
        
        try:
            await page.set_extra_http_headers({
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": ua
            })
        except Exception:
            pass
        
        try:
            await page.set_viewport_size({"width": 1366, "height": 768})
        except Exception:
            pass
        
        try:
            text, tables = await scrape_one(page, url, debug=debug, wait_timeout=wait_timeout)
            result = {"text": text, "tables": tables}
        finally:
            try:
                await page.close()
            except Exception:
                pass
        
        return url, result

async def run_parallel_with_pool(
    urls: List[str], 
    concurrency: int = 5, 
    debug: bool = False,
    wait_timeout: int = 8000,
    browser_pool = None
) -> Dict[str, Dict[str, Optional[Any]]]:
    """Run parallel scraping using shared browser pool with tabs."""
    
    if not urls:
        return {}
    
    results: Dict[str, Dict[str, Optional[Any]]] = {}
    
    if debug:
        os.makedirs("debug", exist_ok=True)
    
    if not browser_pool or not browser_pool.initialized:
        pool_size = max(1, min(3, (concurrency + 9) // 10))
        browser_pool = BrowserPool(pool_size=pool_size, max_tabs_per_browser=concurrency)
        await browser_pool.initialize()
    
    browser, semaphore = await browser_pool.get_browser_and_semaphore()
    
    tasks = [
        asyncio.create_task(
            worker_with_tab(url, browser, semaphore, debug=debug, wait_timeout=wait_timeout),
            name=f"tab-{i}"
        )
        for i, url in enumerate(urls)
    ]
    
    for coro in asyncio.as_completed(tasks):
        try:
            url, result = await coro
            results[url] = result
            txt_ok = bool(result.get("text"))
            tables_ok = bool(result.get("tables"))
            print(f"✅ Completed: {url} -> text: {txt_ok}, tables: {tables_ok}")
        except Exception as e:
            print(f"❌ Worker error: {e}")
    
    return results

# ============================================================================
# Text Chunker
# ============================================================================

class TextChunker:
    """Smart text chunker that preserves paragraph boundaries"""
    
    def __init__(self, chunk_size: int = 400, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def chunk_text(self, text: str, url: str, title: str = "") -> List[Dict[str, Any]]:
        """Split text into overlapping chunks with metadata"""
        if not text or not text.strip():
            return []
        
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        if not paragraphs:
            paragraphs = [text]
        
        chunks = []
        current_chunk = []
        current_length = 0
        chunk_idx = 0
        
        for para in paragraphs:
            para_words = para.split()
            para_length = len(para_words)
            
            if para_length > self.chunk_size * 1.5:
                if current_chunk:
                    chunk_text = " ".join(current_chunk)
                    chunks.append({
                        'text': chunk_text,
                        'chunk_index': chunk_idx,
                        'word_count': len(chunk_text.split())
                    })
                    chunk_idx += 1
                    current_chunk = []
                    current_length = 0
                
                for i in range(0, para_length, self.chunk_size - self.overlap):
                    sub_chunk = " ".join(para_words[i:i + self.chunk_size])
                    chunks.append({
                        'text': sub_chunk,
                        'chunk_index': chunk_idx,
                        'word_count': len(sub_chunk.split())
                    })
                    chunk_idx += 1
                continue
            
            if current_length + para_length > self.chunk_size and current_chunk:
                chunk_text = " ".join(current_chunk)
                chunks.append({
                    'text': chunk_text,
                    'chunk_index': chunk_idx,
                    'word_count': len(chunk_text.split())
                })
                chunk_idx += 1
                
                overlap_words = para_words[:self.overlap] if para_length > self.overlap else para_words
                current_chunk = [" ".join(overlap_words)]
                current_length = len(overlap_words)
            
            current_chunk.append(para)
            current_length += para_length
        
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append({
                'text': chunk_text,
                'chunk_index': chunk_idx,
                'word_count': len(chunk_text.split())
            })
        
        return chunks

# ============================================================================
# Semantic Search Engine
# ============================================================================

class SemanticSearchEngine:
    """Find most relevant chunk per URL using sentence transformers"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        print(f"🔧 Semantic search engine initialized (model: {model_name})")
    
    def load_model(self):
        """Load sentence transformer model (call once at startup)"""
        if self.model is None:
            print(f"📦 Loading model: {self.model_name}...")
            self.model = SentenceTransformer(self.model_name)
            print(f"✅ Model loaded successfully")
    
    def find_best_chunk(self, chunks: List[Dict[str, Any]], query: str) -> Dict[str, Any]:
        """Find the most relevant chunk for a given query"""
        if not chunks:
            return {
                'text': '',
                'score': 0.0,
                'chunk_index': -1,
                'word_count': 0
            }
        
        if self.model is None:
            self.load_model()
        
        query_embedding = self.model.encode(query, convert_to_tensor=True)
        chunk_texts = [c['text'] for c in chunks]
        chunk_embeddings = self.model.encode(chunk_texts, convert_to_tensor=True)
        
        similarities = util.cos_sim(query_embedding, chunk_embeddings)[0]
        best_idx = torch.argmax(similarities).item()
        best_score = similarities[best_idx].item()
        
        best_chunk = chunks[best_idx].copy()
        best_chunk['score'] = round(best_score, 4)
        
        return best_chunk

# ============================================================================
# Main Entry Point for Workers
# ============================================================================

# Global instances (initialized per worker process)
_browser_pool: Optional[BrowserPool] = None
_semantic_engine: Optional[SemanticSearchEngine] = None
_chunker = TextChunker(chunk_size=400, overlap=50)


async def scrape_and_extract(
    urls: List[str],
    query: str,
    concurrency: int = 10,
    debug: bool = False,
    wait_timeout: int = 8000,
    chunk_size: int = 400,
    chunk_overlap: int = 50
) -> Dict[str, Any]:
    """
    YOUR EXACT scrape_and_extract logic - called from Celery task
    Returns same format as your API
    """
    global _browser_pool, _semantic_engine, _chunker
    
    # Initialize semantic engine
    if not _semantic_engine:
        _semantic_engine = SemanticSearchEngine(model_name="all-MiniLM-L6-v2")
        _semantic_engine.load_model()
    
    # Update chunker settings
    _chunker = TextChunker(chunk_size=chunk_size, overlap=chunk_overlap)
    
    total_start = time.time()
    
    # Step 1: Scrape all URLs in parallel
    print(f"🚀 Starting parallel scrape for {len(urls)} URLs...")
    scrape_start = time.time()
    
    try:
        scrape_results = await run_parallel_with_pool(
            urls,
            concurrency=concurrency,
            debug=debug,
            wait_timeout=wait_timeout,
            browser_pool=_browser_pool
        )
    except Exception as e:
        raise Exception(f"Scraping failed: {e}")
    
    scrape_duration = time.time() - scrape_start
    print(f"✅ Scraping completed in {scrape_duration:.2f}s")
    
    # Step 2: Process each URL - find best chunk
    print(f"🔍 Finding best chunks for query: '{query}'")
    process_start = time.time()
    
    results = []
    
    for url in urls:
        data = scrape_results.get(url)
        
        if not data:
            results.append({
                'url': url,
                'best_chunk': '',
                'score': 0.0,
                'chunk_index': -1,
                'word_count': 0,
                'total_chunks': 0,
                'tables': [],
                'tables_count': 0,
                'error': 'Failed to scrape'
            })
            continue
        
        text = data.get('text')
        tables = data.get('tables') or []
        
        if not text or not text.strip():
            results.append({
                'url': url,
                'best_chunk': '',
                'score': 0.0,
                'chunk_index': -1,
                'word_count': 0,
                'total_chunks': 0,
                'tables': tables,
                'tables_count': len(tables),
                'error': 'No text content found'
            })
            continue
        
        chunks = _chunker.chunk_text(text, url, title=urlparse(url).netloc)
        
        if not chunks:
            results.append({
                'url': url,
                'best_chunk': '',
                'score': 0.0,
                'chunk_index': -1,
                'word_count': 0,
                'total_chunks': 0,
                'tables': tables,
                'tables_count': len(tables),
                'error': 'Failed to chunk text'
            })
            continue
        
        best_chunk = _semantic_engine.find_best_chunk(chunks, query)
        
        results.append({
            'url': url,
            'best_chunk': best_chunk['text'],
            'score': best_chunk['score'],
            'chunk_index': best_chunk['chunk_index'],
            'word_count': best_chunk['word_count'],
            'total_chunks': len(chunks),
            'tables': tables,
            'tables_count': len(tables)
        })
        
        print(f"✅ {url} -> score: {best_chunk['score']:.3f}, chunk: {best_chunk['chunk_index']}/{len(chunks)}")
    
    process_duration = time.time() - process_start
    total_duration = time.time() - total_start
    
    successful_scrapes = sum(1 for r in results if r.get('best_chunk'))
    failed_scrapes = len(urls) - successful_scrapes
    avg_score = sum(r['score'] for r in results) / len(results) if results else 0
    total_tables = sum(r['tables_count'] for r in results)
    
    print(f"✅ Processing completed in {process_duration:.2f}s")
    print(f"📊 Success: {successful_scrapes}/{len(urls)}, Avg score: {avg_score:.3f}")
    
    return {
        "ok": True,
        "query": query,
        "total_duration_seconds": round(total_duration, 2),
        "timing": {
            "scrape_seconds": round(scrape_duration, 2),
            "processing_seconds": round(process_duration, 2)
        },
        "statistics": {
            "urls_requested": len(urls),
            "successful_scrapes": successful_scrapes,
            "failed_scrapes": failed_scrapes,
            "average_relevance_score": round(avg_score, 4),
            "total_tables_found": total_tables
        },
        "results": results
    }


async def cleanup_browser_pool():
    """Cleanup - call when worker shuts down"""
    global _browser_pool
    if _browser_pool:
        await _browser_pool.close()
        _browser_pool = None