/*******************************************************
 * news.js – Hexacola AI Enhanced News Functionality
 * 
 * NOTE ON CORS:
 * - If NewsAPI blocks your domain, you must use a proxy.
 * - This code tries 'cors' mode, but a server-side approach
 *   or a known CORS proxy is often required.
 *******************************************************/

/*******************************************************
 * CONFIGURATION & GLOBAL VARIABLES
 *******************************************************/

// 1) Direct NewsAPI endpoint (likely to cause CORS error if not allowed)
const NEWS_API_BASE = 'https://newsapi.org/v2/everything';

// 2) Example: using a public or custom proxy. 
//    Replace 'https://YOUR-PROXY-URL' with your actual proxy endpoint 
//    if you have one set up. 
// const CORS_PROXY_URL = 'https://YOUR-PROXY-URL/';

// NewsAPI Key
const NEWS_API_KEY = 'ea37165cf83f4edc9d788fe7ab18cb89';

// Summarization endpoint
const POLLINATIONS_API = 'https://text.pollinations.ai';

// AI-centric default query
let currentQuery = `nvidia OR microsoft OR huggingface OR "3D AI" OR "text generation" OR "generative AI" OR "AI-generated images" OR "image generation"`;

// You can adjust these constants as needed:
const MAX_PAGE_SIZE = 5;
const MAX_RETRIES = 3; 

// Optional category
let currentCategory = ''; 
let currentPage = 1;
let isLoading = false;

/*******************************************************
 * DOM ELEMENTS
 *******************************************************/
const newsContent = document.getElementById('newsContent');
const loadMoreBtn = document.getElementById('loadMoreNews');
const searchInput = document.getElementById('newsSearchInput');
const searchBtn = document.getElementById('searchNewsBtn');
const toggleBtn = document.getElementById('toggleNewsSidebar');
const closeBtn = document.getElementById('closeSidebar');
const sidebar = document.getElementById('newsSidebar');
const categorySelect = document.getElementById('newsCategorySelect');

/*******************************************************
 * EVENT LISTENERS
 *******************************************************/
document.addEventListener('DOMContentLoaded', initializeNews);
loadMoreBtn?.addEventListener('click', loadMoreNews);
searchBtn?.addEventListener('click', handleSearch);
toggleBtn?.addEventListener('click', toggleSidebar);
closeBtn?.addEventListener('click', closeSidebar);

searchInput?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});
categorySelect?.addEventListener('change', handleCategoryChange);

/*******************************************************
 * INITIALIZATION
 *******************************************************/
async function initializeNews() {
  try {
    newsContent.innerHTML = getLoadingHTML();
    await fetchAndDisplayNews();
  } catch (error) {
    handleError('Failed to initialize news feed');
  }
}

/*******************************************************
 * SIDEBAR TOGGLE
 *******************************************************/
function toggleSidebar() {
  sidebar?.classList.toggle('active');
}
function closeSidebar() {
  sidebar?.classList.remove('active');
}

/*******************************************************
 * CATEGORY (OPTIONAL)
 *******************************************************/
async function handleCategoryChange() {
  currentCategory = categorySelect?.value || '';
  currentPage = 1;
  newsContent.innerHTML = getLoadingHTML();
  await fetchAndDisplayNews(false);
}

/*******************************************************
 * DEBOUNCE FOR SEARCH
 *******************************************************/
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const debouncedSearch = debounce(async () => {
  currentPage = 1;
  const searchTerm = searchInput.value.trim();

  currentQuery = searchTerm 
    || `nvidia AI OR microsoft AI OR huggingface OR "3D AI" OR "text generation" OR "generative AI" OR "AI-generated images"`;

  newsContent.innerHTML = getLoadingHTML();
  await fetchAndDisplayNews(false);
}, 500);

async function handleSearch() {
  await debouncedSearch();
}

/*******************************************************
 * LOAD MORE
 *******************************************************/
async function loadMoreNews() {
  if (isLoading) return;
  currentPage++;
  await fetchAndDisplayNews(true);
}

/*******************************************************
 * CORE: FETCH & DISPLAY NEWS
 *******************************************************/
async function fetchAndDisplayNews(append = false) {
  if (isLoading) return;
  isLoading = true;

  try {
    if (append) {
      loadMoreBtn.textContent = 'Loading...';
      loadMoreBtn.disabled = true;
    }

    const articles = await fetchNewsFromNewsAPI();
    if (!articles || articles.length === 0) {
      handleNoResults(append);
      return;
    }

    await displayNewsArticles(articles, append);

    loadMoreBtn.style.display = 'block';
    loadMoreBtn.textContent = 'Load More News';
    loadMoreBtn.disabled = false;
  } catch (error) {
    const errorMessage = error.message.includes('HTTPS')
      ? 'This API requires a secure connection. Please use HTTPS.'
      : `Error loading news: ${error.message}`;
    handleError(errorMessage);
    loadMoreBtn.style.display = 'none';
  } finally {
    isLoading = false;
  }
}

/*******************************************************
 * FETCHING NEWS (ATTEMPTING CORS FIX)
 *******************************************************/
async function fetchNewsFromNewsAPI() {
  // Example A) Direct call (likely blocked by CORS if server disallows)
  const url = new URL(NEWS_API_BASE);
  url.searchParams.set('q', currentQuery);
  if (currentCategory) {
    url.searchParams.set('q', `${currentQuery} ${currentCategory}`);
  }
  url.searchParams.set('apiKey', NEWS_API_KEY);
  url.searchParams.set('pageSize', MAX_PAGE_SIZE);
  url.searchParams.set('page', currentPage);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'publishedAt');

  // Example B) Using a CORS Proxy (comment out A, uncomment B):
  // const urlWithParams = `${CORS_PROXY_URL}${NEWS_API_BASE}?q=${encodeURIComponent(currentQuery)}&apiKey=${NEWS_API_KEY}&pageSize=${MAX_PAGE_SIZE}&page=${currentPage}&language=en&sortBy=publishedAt`;

  let attempts = 0;
  while (attempts < MAX_RETRIES) {
    try {
      // Approach A: direct fetch with mode: 'cors'
      const response = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors', 
        // If needed, also try 'credentials': 'include' or 'omit' 
        headers: {
          'User-Agent': 'Hexacola-AI/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 426) {
          throw new Error('HTTPS required. Use a secure connection.');
        }
        throw new Error(`NewsAPI error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      if (data.status === 'error') {
        throw new Error(data.message || 'News API error');
      }
      return data.articles || [];
    } catch (err) {
      attempts++;
      console.warn(`NewsAPI fetch attempt ${attempts} failed:`, err.message);

      if (attempts >= MAX_RETRIES) throw err;
      await new Promise(resolve => setTimeout(resolve, 500 * attempts));
    }
  }
  return [];
}

/*******************************************************
 * DISPLAY ARTICLES
 *******************************************************/
async function displayNewsArticles(articles, append) {
  try {
    const mappedHTML = await Promise.all(
      articles.map(async (article) => {
        const sanitized = sanitizeArticle(article);
        const combinedText = [
          sanitized.description,
          sanitizeHTML(article.content || '')
        ].join('. ');

        const summaryText = combinedText.trim() || sanitized.description;
        const summary = await summarizeArticle(summaryText);

        return createNewsItemHTML(sanitized, summary);
      })
    );

    if (append) {
      newsContent.innerHTML += mappedHTML.join('');
    } else {
      newsContent.innerHTML = mappedHTML.join('');
    }
  } catch (err) {
    handleError(`Error displaying articles: ${err.message}`);
  }
}

/*******************************************************
 * SUMMARIZATION VIA POLLINATIONS
 *******************************************************/
async function summarizeArticle(text) {
  if (!text) return 'No description available';
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      const response = await fetch(
        `${POLLINATIONS_API}/summarize?text=${encodeURIComponent(text)}&model=searchgpt`,
        { method: 'GET', mode: 'cors' }
      );

      if (!response.ok) {
        throw new Error(`Summarization API status: ${response.status}`);
      }
      const data = await response.json();
      return data.summary || text;
    } catch (error) {
      attempts++;
      console.warn(`Summarization attempt ${attempts} failed:`, error.message);

      if (attempts >= MAX_RETRIES) {
        console.warn('Returning original text after repeated failures.');
        return text;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
  return text; // fallback
}

/*******************************************************
 * HELPER & UI FUNCTIONS
 *******************************************************/
function createNewsItemHTML(article, summary) {
  return `
    <div class="news-item">
      ${
        article.urlToImage
          ? `<img src="${article.urlToImage}" alt="${article.title}" onerror="this.style.display='none'">`
          : ''
      }
      <h4>
        <a href="${article.url}" target="_blank" rel="noopener noreferrer">
          ${article.title}
        </a>
      </h4>
      <p>${summary}</p>
      <small>${new Date(article.publishedAt).toLocaleDateString()}</small>
    </div>
  `;
}

function sanitizeArticle(article) {
  return {
    title: sanitizeHTML(article.title || 'No title available'),
    description: sanitizeHTML(article.description || 'No description available'),
    url: article.url || '#',
    urlToImage: article.urlToImage || '',
    publishedAt: article.publishedAt || new Date().toISOString()
  };
}

function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

function handleNoResults(append) {
  if (!append) {
    newsContent.innerHTML = '<p>No relevant AI news found. Try a different query or category.</p>';
  }
  loadMoreBtn.style.display = 'none';
}

function handleError(message) {
  console.error(message);
  newsContent.innerHTML = `<p>${message}. Please try again later.</p>`;
}

function getLoadingHTML() {
  return `
    <div class="news-loading">
      <i class="fas fa-spinner fa-spin"></i>
      <span>Loading news...</span>
    </div>
  `;
}
