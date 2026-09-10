
import { scrapeUrl } from './scrape/scrapeWebpage.js';

import { getSitemap } from './scrape/scrapeSitemap.js';
import { Scraper } from './scrape/scraper.js';

export const scraper = {
    scrapeUrl,
    getSitemap,
    Scraper
}