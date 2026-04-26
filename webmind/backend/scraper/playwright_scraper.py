import asyncio
import json
import logging
import re
import sys
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright, TimeoutError as SyncPlaywrightTimeoutError
from trafilatura import extract

WINDOWS = sys.platform == "win32"

logger = logging.getLogger(__name__)

SEARCH_INPUT_SELECTORS = [
    'input[type=search]',
    'input[name*=search]',
    'input[id*=search]',
    'input[placeholder*=search]',
    'input[aria-label*=search]',
    'input[class*=search]',
]

PAGINATION_SELECTORS = [
    'a[rel=next]',
    'a.next',
    'a[aria-label*=next]',
    'a:has-text("Next")',
    'a:has-text(">")',
    'a:has-text("»")',
    'a:has-text("›")',
]


def _extract_metadata(html: str) -> Dict[str, str]:
    soup = BeautifulSoup(html, 'html.parser')
    metadata: Dict[str, str] = {}

    if soup.title and soup.title.string:
        metadata['title'] = soup.title.string.strip()

    description = soup.find('meta', attrs={'name': 'description'})
    if description and description.get('content'):
        metadata['description'] = description['content'].strip()

    og_title = soup.find('meta', attrs={'property': 'og:title'})
    if og_title and og_title.get('content'):
        metadata['og_title'] = og_title['content'].strip()

    return metadata


def _extract_images(html: str, base_url: str) -> List[Dict[str, str]]:
    soup = BeautifulSoup(html, 'html.parser')
    images: List[Dict[str, str]] = []

    for img in soup.find_all('img', src=True):
        src = img['src'].strip()
        absolute_src = urljoin(base_url, src)
        caption = img.get('alt') or img.get('title') or ''
        images.append({'src': absolute_src, 'caption': caption})

    return images


def _extract_structured_data(html: str) -> Dict[str, Any]:
    soup = BeautifulSoup(html, 'html.parser')
    data: Dict[str, Any] = {}

    for script in soup.find_all('script', type='application/ld+json'):
        if not script.string:
            continue
        try:
            payload = json.loads(script.string)
        except json.JSONDecodeError:
            continue

        if isinstance(payload, list):
            for item in payload:
                if isinstance(item, dict):
                    data.update(item)
        elif isinstance(payload, dict):
            data.update(payload)

    if not data:
        price_el = soup.select_one('.price, [itemprop=price]')
        if price_el:
            price_text = price_el.get_text(separator=' ', strip=True)
            price_match = re.search(r'\d+[\d,.]*', price_text)
            if price_match:
                data['price'] = price_match.group(0)

    return data


def _extract_text_bs4(html: str) -> str:
    soup = BeautifulSoup(html, 'html.parser')
    for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'form', 'noscript']):
        element.decompose()

    main = soup.find('main') or soup.find('article') or soup
    text = ' '.join(part.strip() for part in main.stripped_strings)
    if text:
        return re.sub(r'\s+', ' ', text).strip()

    fallback = extract(html)
    return re.sub(r'\s+', ' ', fallback or '').strip()


def _normalize_url(base: str, href: str) -> str:
    if href.startswith('http://') or href.startswith('https://'):
        return href
    return urljoin(base, href)


def _scroll_page_sync(page) -> None:
    previous_height = page.evaluate('() => document.body.scrollHeight')
    for _ in range(10):
        page.evaluate('() => window.scrollTo(0, document.body.scrollHeight)')
        page.wait_for_timeout(1000)
        next_height = page.evaluate('() => document.body.scrollHeight')
        if next_height == previous_height:
            return
        previous_height = next_height


async def _scroll_page(page) -> None:
    previous_height = await page.evaluate('() => document.body.scrollHeight')
    for _ in range(10):
        await page.evaluate('() => window.scrollTo(0, document.body.scrollHeight)')
        await page.wait_for_timeout(1000)
        next_height = await page.evaluate('() => document.body.scrollHeight')
        if next_height == previous_height:
            return
        previous_height = next_height


def _perform_search_sync(page, query: str) -> bool:
    for selector in SEARCH_INPUT_SELECTORS:
        try:
            element = page.query_selector(selector)
        except NotImplementedError:
            logger.debug(f"[scraper] search selector not supported: {selector}")
            continue

        if not element:
            continue

        try:
            element.fill(query, timeout=3000)
            element.press('Enter', timeout=3000)
        except Exception as exc:
            logger.debug(f"[scraper] search input failed or hidden for {selector}: {exc}")
            continue

        try:
            page.wait_for_load_state('networkidle', timeout=30000)
        except Exception:
            pass
            
        _scroll_page_sync(page)
        return True

    return False


async def _perform_search(page, query: str) -> bool:
    for selector in SEARCH_INPUT_SELECTORS:
        try:
            element = await page.query_selector(selector)
        except NotImplementedError:
            logger.debug(f"[scraper] search selector not supported: {selector}")
            continue

        if not element:
            continue

        try:
            await element.fill(query, timeout=3000)
            await element.press('Enter', timeout=3000)
        except Exception as exc:
            logger.debug(f"[scraper] search input failed or hidden for {selector}: {exc}")
            continue

        try:
            await page.wait_for_load_state('networkidle', timeout=30000)
        except Exception:
            pass
            
        await _scroll_page(page)
        return True

    return False


def _find_next_page_sync(page) -> Optional[str]:
    for selector in PAGINATION_SELECTORS:
        try:
            element = page.query_selector(selector)
        except NotImplementedError:
            logger.debug(f"[scraper] pagination selector not supported: {selector}")
            continue

        if not element:
            continue

        try:
            href = element.get_attribute('href')
        except NotImplementedError:
            logger.debug(f"[scraper] get_attribute not supported for pagination selector: {selector}")
            continue

        if href:
            return _normalize_url(page.url, href)
    return None


async def _find_next_page(page) -> Optional[str]:
    for selector in PAGINATION_SELECTORS:
        try:
            element = await page.query_selector(selector)
        except NotImplementedError:
            logger.debug(f"[scraper] pagination selector not supported: {selector}")
            continue

        if not element:
            continue

        try:
            href = await element.get_attribute('href')
        except NotImplementedError:
            logger.debug(f"[scraper] get_attribute not supported for pagination selector: {selector}")
            continue

        if href:
            return _normalize_url(page.url, href)
    return None


def _extract_detail_links_sync(page, detail_selector: str, base_url: str, max_links: int) -> List[str]:
    links: List[str] = []
    try:
        handles = page.query_selector_all(detail_selector)
    except NotImplementedError:
        logger.debug(f"[scraper] detail selector not supported: {detail_selector}")
        return links

    for handle in handles:
        try:
            href = handle.get_attribute('href')
        except NotImplementedError:
            logger.debug(f"[scraper] get_attribute not supported for detail selector: {detail_selector}")
            continue

        if href and not href.startswith(('mailto:', 'tel:', 'javascript:')):
            url = _normalize_url(base_url, href)
            if url not in links:
                links.append(url)
        if len(links) >= max_links:
            break
    return links


async def _extract_detail_links(page, detail_selector: str, base_url: str, max_links: int) -> List[str]:
    links: List[str] = []
    try:
        handles = await page.query_selector_all(detail_selector)
    except NotImplementedError:
        logger.debug(f"[scraper] detail selector not supported: {detail_selector}")
        return links

    for handle in handles:
        try:
            href = await handle.get_attribute('href')
        except NotImplementedError:
            logger.debug(f"[scraper] get_attribute not supported for detail selector: {detail_selector}")
            continue

        if href and not href.startswith(('mailto:', 'tel:', 'javascript:')):
            url = _normalize_url(base_url, href)
            if url not in links:
                links.append(url)
        if len(links) >= max_links:
            break
    return links


def _filter_target_fields(page: Dict[str, Any], target_fields: Optional[List[str]]) -> Dict[str, Any]:
    if not target_fields:
        return page

    target_keys: Set[str] = set(field.strip().lower() for field in target_fields if field)
    filtered = {
        'url': page['url'],
        'title': page['title'],
        'page_number': page['page_number'],
    }

    if 'text' in target_keys:
        filtered['text'] = page['text']
    if 'metadata' in target_keys or {'title', 'description', 'og_title'} & target_keys:
        filtered['metadata'] = page['metadata']
    if 'images' in target_keys:
        filtered['images'] = page['images']
    if 'structured_data' in target_keys or {'price', 'rating', 'availability'} & target_keys:
        filtered['structured_data'] = page['structured_data']

    return filtered


def _build_page_result(url: str, html: str, page_number: float, target_fields: Optional[List[str]] = None) -> Dict[str, Any]:
    metadata = _extract_metadata(html)
    page = {
        'url': url,
        'title': metadata.get('title', url),
        'text': _extract_text_bs4(html),
        'metadata': metadata,
        'images': _extract_images(html, url),
        'structured_data': _extract_structured_data(html),
        'page_number': page_number,
    }
    return _filter_target_fields(page, target_fields)


def _navigate_and_prepare_sync(page, url: str, click_selector: Optional[str] = None) -> str:
    logger.info(f"[scraper] navigating to {url}")
    try:
        page.goto(url, wait_until='domcontentloaded', timeout=45000)
    except Exception as exc:
        logger.error(f"[scraper] Failed to navigate to {url}: {exc}")
        return page.url
    page.wait_for_timeout(1500)
    _scroll_page_sync(page)

    if click_selector:
        try:
            element = page.query_selector(click_selector)
        except NotImplementedError:
            logger.debug(f"[scraper] click selector not supported: {click_selector}")
            return page.url

        if element:
            try:
                element.click(timeout=5000)
                page.wait_for_load_state('networkidle', timeout=30000)
                page.wait_for_timeout(1000)
            except NotImplementedError:
                logger.debug(f"[scraper] click action not supported for: {click_selector}")
            except Exception:
                logger.debug(f"[scraper] click selector not available: {click_selector}")

    return page.url


async def _navigate_and_prepare(page, url: str, click_selector: Optional[str] = None) -> str:
    logger.info(f"[scraper] navigating to {url}")
    try:
        await page.goto(url, wait_until='domcontentloaded', timeout=45000)
    except Exception as exc:
        logger.error(f"[scraper] Failed to navigate to {url}: {exc}")
        return page.url
    await page.wait_for_timeout(1500)
    await _scroll_page(page)

    if click_selector:
        try:
            element = await page.query_selector(click_selector)
        except NotImplementedError:
            logger.debug(f"[scraper] click selector not supported: {click_selector}")
            return page.url

        if element:
            try:
                await element.click(timeout=5000)
                await page.wait_for_load_state('networkidle', timeout=30000)
                await page.wait_for_timeout(1000)
            except NotImplementedError:
                logger.debug(f"[scraper] click action not supported for: {click_selector}")
            except Exception:
                logger.debug(f"[scraper] click selector not available: {click_selector}")

    return page.url


async def _scrape_page(
    page,
    url: str,
    click_selector: Optional[str] = None,
    page_number: float = 1.0,
    target_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    logger.info(f"[scraper] scraping {url}")
    await _navigate_and_prepare(page, url, click_selector)
    html = await page.content()
    return _build_page_result(url, html, page_number, target_fields)


def _scrape_page_sync(
    page,
    url: str,
    click_selector: Optional[str] = None,
    page_number: float = 1.0,
    target_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    logger.info(f"[scraper] scraping {url}")
    _navigate_and_prepare_sync(page, url, click_selector)
    html = page.content()
    return _build_page_result(url, html, page_number, target_fields)


def _scrape_website_sync(
    start_url: str,
    max_pages: int = 1,
    scrape_detail_pages: bool = False,
    detail_selector: Optional[str] = None,
    click_selector: Optional[str] = None,
    max_details_per_page: int = 5,
    use_search: bool = False,
    search_query: Optional[str] = None,
    target_fields: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    if not start_url:
        return []

    results: List[Dict[str, Any]] = []
    visited: Set[str] = set()

    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(headless=False)
        except Exception as exc:
            raise RuntimeError(
                "Playwright failed to launch Chromium. "
                "Run `python -m playwright install chromium` and make sure the browser is installed. "
                f"Underlying error: {exc}"
            ) from exc

        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()

        try:
            current_url = start_url
            for page_index in range(max_pages):
                if current_url in visited:
                    break
                visited.add(current_url)

                if page_index == 0 and use_search and search_query:
                    _navigate_and_prepare_sync(page, current_url, click_selector)
                    if _perform_search_sync(page, search_query):
                        current_url = page.url
                    html = page.content()
                    results.append(_build_page_result(current_url, html, page_number=page_index + 1, target_fields=target_fields))
                else:
                    results.append(_scrape_page_sync(page, current_url, click_selector, page_number=page_index + 1, target_fields=target_fields))

                if scrape_detail_pages and detail_selector:
                    # Dynamically enhance detail selector to look for the search query in links
                    enhanced_selector = detail_selector
                    if use_search and search_query:
                        words = [w.replace("'", "").replace('"', '') for w in search_query.split() if len(w) > 3]
                        if words:
                            first_word = words[0]
                            enhanced_selector += f", a:has-text('{first_word}'), a[title*='{first_word}' i]"
                            
                    detail_urls = _extract_detail_links_sync(page, enhanced_selector, page.url, max_details_per_page)
                    for idx, detail_url in enumerate(detail_urls, start=len(results) + 1):
                        if len(results) >= max_pages + max_details_per_page:
                            break
                        if detail_url not in visited:
                            visited.add(detail_url)
                            results.append(_scrape_page_sync(page, detail_url, click_selector, page_number=float(idx), target_fields=target_fields))

                if page_index + 1 >= max_pages:
                    break

                next_url = _find_next_page_sync(page)
                if not next_url or next_url in visited:
                    break
                current_url = next_url

        except SyncPlaywrightTimeoutError as exc:
            logger.error(f"[scraper] timeout scraping {start_url}: {exc}")
            raise RuntimeError(f"Page navigation timed out: {exc}") from exc
        except Exception as exc:
            logger.exception(f"[scraper] unexpected failure scraping {start_url}: {exc}")
            message = str(exc).strip() or repr(exc)
            raise RuntimeError(f"Scraper failed ({type(exc).__name__}): {message}") from exc
        finally:
            context.close()
            browser.close()

    return results


async def scrape_website(
    start_url: str,
    max_pages: int = 1,
    scrape_detail_pages: bool = False,
    detail_selector: Optional[str] = None,
    click_selector: Optional[str] = None,
    max_details_per_page: int = 5,
    use_search: bool = False,
    search_query: Optional[str] = None,
    target_fields: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    if not start_url:
        return []

    if WINDOWS:
        return await asyncio.to_thread(
            _scrape_website_sync,
            start_url,
            max_pages,
            scrape_detail_pages,
            detail_selector,
            click_selector,
            max_details_per_page,
            use_search,
            search_query,
            target_fields,
        )

    results: List[Dict[str, Any]] = []
    visited: Set[str] = set()

    async with async_playwright() as playwright:
        try:
            browser = await playwright.chromium.launch(headless=False)
        except Exception as exc:
            raise RuntimeError(
                "Playwright failed to launch Chromium. "
                "Run `python -m playwright install chromium` and make sure the browser is installed. "
                f"Underlying error: {exc}"
            ) from exc

        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = await context.new_page()

        try:
            current_url = start_url
            for page_index in range(max_pages):
                if current_url in visited:
                    break
                visited.add(current_url)

                if page_index == 0 and use_search and search_query:
                    await _navigate_and_prepare(page, current_url, click_selector)
                    if await _perform_search(page, search_query):
                        current_url = page.url
                    html = await page.content()
                    results.append(_build_page_result(current_url, html, page_number=page_index + 1, target_fields=target_fields))
                else:
                    results.append(await _scrape_page(page, current_url, click_selector, page_number=page_index + 1, target_fields=target_fields))

                if scrape_detail_pages and detail_selector:
                    # Dynamically enhance detail selector to look for the search query in links
                    enhanced_selector = detail_selector
                    if use_search and search_query:
                        words = [w.replace("'", "").replace('"', '') for w in search_query.split() if len(w) > 3]
                        if words:
                            first_word = words[0]
                            enhanced_selector += f", a:has-text('{first_word}'), a[title*='{first_word}' i]"
                            
                    detail_urls = await _extract_detail_links(page, enhanced_selector, page.url, max_details_per_page)
                    for idx, detail_url in enumerate(detail_urls, start=len(results) + 1):
                        if len(results) >= max_pages + max_details_per_page:
                            break
                        if detail_url not in visited:
                            visited.add(detail_url)
                            results.append(await _scrape_page(page, detail_url, click_selector, page_number=float(idx), target_fields=target_fields))

                if page_index + 1 >= max_pages:
                    break

                next_url = await _find_next_page(page)
                if not next_url or next_url in visited:
                    break
                current_url = next_url

        except PlaywrightTimeoutError as exc:
            logger.error(f"[scraper] timeout scraping {start_url}: {exc}")
            raise RuntimeError(f"Page navigation timed out: {exc}") from exc
        except Exception as exc:
            logger.exception(f"[scraper] unexpected failure scraping {start_url}: {exc}")
            message = str(exc).strip() or repr(exc)
            raise RuntimeError(f"Scraper failed ({type(exc).__name__}): {message}") from exc
        finally:
            await context.close()
            await browser.close()

    return results
