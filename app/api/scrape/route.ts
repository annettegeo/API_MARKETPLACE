import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlToScrape = searchParams.get('url');

  if (!urlToScrape) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Add headers to avoid being blocked
    const { data } = await axios.get(urlToScrape, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000, // 10 second timeout
    });
    
    const $ = cheerio.load(data);

    // Remove script and style tags for cleaner text
    $('script, style, nav, footer, header').remove();

    // 1. Scrape for overview - try multiple selectors
    let overview = '';
    const overviewSelectors = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      '.description',
      '.overview',
      '.intro',
      '.lead',
      'p',
      '.content p'
    ];

    for (const selector of overviewSelectors) {
      if (selector.startsWith('meta')) {
        overview = $(selector).attr('content')?.trim() || '';
      } else {
        const text = $(selector).first().text().trim();
        if (text.length > 50 && text.length < 500) { // Only use substantial but not too long paragraphs
          overview = text;
        }
      }
      if (overview) break;
    }

    // If no overview found, try to get the first meaningful paragraph
    if (!overview) {
      $('p').each((_idx, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && text.length < 500 && !overview) {
          overview = text;
          return false; // break the loop
        }
      });
    }

    // 2. Scrape for code examples - focus on API usage examples
    const examples: string[] = [];
    
    // Look for specific patterns that indicate API usage
    const codeSelectors = [
      'pre code',
      'pre',
      'code',
      '.highlight pre',
      '.code-block',
      '.example',
      '.usage-example',
      '.code-example',
      '.api-example'
    ];
    
    codeSelectors.forEach(selector => {
      $(selector).each((_idx, el) => {
        const example = $(el).text().trim();
        if (example && example.length > 20 && example.length < 2000) {
          // Filter for API-related content but exclude error messages
          const isApiExample = /(GET|POST|PUT|DELETE|PATCH|curl|fetch|axios|http|api|endpoint|request|response|json|xml)/i.test(example);
          const isErrorExample = /(access denied|missing|invalid|improperly formed|error|unauthorized|forbidden)/i.test(example);
          
          if (isApiExample && !isErrorExample && !examples.includes(example)) {
            examples.push(example);
          }
        }
      });
    });


    // If no API examples found, get any code blocks
    if (examples.length === 0) {
      $('pre code, pre, code').each((_idx, el) => {
        const example = $(el).text().trim();
        if (example && example.length > 20 && example.length < 2000 && !examples.includes(example)) {
          examples.push(example);
        }
      });
    }

    // Limit to first 10 mples
    const limitedExamples = examples.slice(0, 10);

    // 3. Scrape for requirements or features
    const requirements: string[] = [];
    
    // Look for specific sections that might contain useful information
    const sectionKeywords = [
      'requirement', 'feature', 'getting started', 'prerequisite', 
      'installation', 'quick start', 'authentication', 'api key',
      'usage', 'example', 'endpoint', 'method', 'rate limit'
    ];
    
    $('h1, h2, h3, h4, h5').each((_idx, el) => {
      const headingText = $(el).text().toLowerCase();
      const hasRelevantKeyword = sectionKeywords.some(keyword => 
        headingText.includes(keyword)
      );
      
      if (hasRelevantKeyword) {
        // Look for content after the heading
        const $nextElements = $(el).nextAll().slice(0, 5);
        
        $nextElements.each((_idx, nextEl) => {
          const $nextEl = $(nextEl);
          
          // Check for lists
          if ($nextEl.is('ul') || $nextEl.is('ol')) {
            $nextEl.find('li').each((_liIdx, liEl) => {
              const text = $(liEl).text().trim();
              if (text && text.length > 10 && text.length < 200 && !requirements.includes(text)) {
                requirements.push(text);
              }
            });
          }
          
          // Check for paragraphs with useful info
          if ($nextEl.is('p')) {
            const text = $nextEl.text().trim();
            if (text && text.length > 20 && text.length < 300 && !requirements.includes(text)) {
              requirements.push(text);
            }
          }
        });
      }
    });



    // 4. Determine if it's a REST API (improved detection)
    const bodyText = $('body').text().toLowerCase();
    const titleText = $('title').text().toLowerCase();
    const headingText = $('h1').text().toLowerCase();
    
    const restKeywords = ['rest api', 'restful', 'http api', 'api endpoint', 'get request', 'post request'];
    const hasRestKeyword = restKeywords.some(keyword => 
      bodyText.includes(keyword) || titleText.includes(keyword) || headingText.includes(keyword)
    );
    
    const hasHttpMethods = /\b(GET|POST|PUT|DELETE|PATCH)\b/.test($('body').text());
    const isRestApi = hasRestKeyword || hasHttpMethods;

    // Clean up and filter the results
    const cleanOverview = overview.replace(/\s+/g, ' ').trim();
    const cleanExamples = limitedExamples.map(ex => ex.replace(/\s+/g, ' ').trim());
    const cleanRequirements = requirements.slice(0, 6).map(req => req.replace(/\s+/g, ' ').trim());

    return NextResponse.json({
      overview: cleanOverview || "No overview found. Please visit the official documentation for details.",
      examples: cleanExamples,
      requirements: cleanRequirements,
      isRestApi
    });

  } catch (error) {
    console.error('Error during scraping:', error);
    
    // More informative error messages
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return NextResponse.json({ 
          error: 'Request timeout - the website took too long to respond',
          overview: 'Unable to fetch documentation. Please visit the official link.',
          examples: [],
          requirements: [],
          isRestApi: false
        }, { status: 200 });
      }
      if (error.response?.status === 403 || error.response?.status === 401) {
        return NextResponse.json({ 
          error: 'Access denied - the website blocked the scraping request',
          overview: 'Unable to fetch documentation. Please visit the official link.',
          examples: [],
          requirements: [],
          isRestApi: false
        }, { status: 200 });
      }
    }
    
    return NextResponse.json({ 
      error: `Failed to scrape URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      overview: 'Unable to fetch documentation. Please visit the official link.',
      examples: [],
      requirements: [],
      isRestApi: false
    }, { status: 200 });
  }
}