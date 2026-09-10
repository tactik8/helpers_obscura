import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import TurndownService from 'turndown';

async function ensureDirectoryExists(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Directory is ready: ${dirPath}`);
    } catch (error) {
        console.error(`Error creating directory: ${error.message}`);
        throw error;
    }
}

async function saveTextFile(filePath, content) {
    try {
        await fs.writeFile(filePath, content, 'utf8');
        console.log(`File successfully saved to: ${filePath}`);
    } catch (error) {
        console.error(`Error saving file: ${error.message}`);
        throw error;
    }
}


export async function scrapeUrl(url) {
    const targetUrl = url;

    let browser

    try {


        let u = new URL(url)
        let domain = u.hostname
        domain = domain.replace('www.', '')
        domain = encodeURIComponent(domain)

        let safeUrl = encodeURIComponent(url)
        let date = new Date().toISOString().split('T')[0] // YYYY-MM-DD

        let directoryPROD = `/file_library/data/${domain}/${safeUrl}/${date}`
        let directoryDEV = `./file_library/data/${domain}/${safeUrl}/${date}`
        await ensureDirectoryExists(directoryDEV);

        browser = await puppeteer.connect({
            browserWSEndpoint: 'ws://192.168.2.243:9222',
        });



        // Retrieve the page content and title
        console.log('Navigating to URL:', targetUrl);
        const page = await browser.newPage();
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        const htmlContent = await page.content();
        const title = await page.title();


        // Save the HTML content to a file
        console.log
        const htmlFilePath = path.join(directoryDEV, 'page.html');
        await saveTextFile(htmlFilePath, htmlContent);


        // Save screenshot of the page
        console.log
        await page.screenshot({
            path: `${directoryDEV}/screenshot.png`,
            fullPage: true,
        });


        // Get markdown content
        console.log('Getting markdown content...');
        const markdownContent = await getMarkdown(page, targetUrl);
        await saveTextFile(path.join(directoryDEV, 'page.md'), markdownContent);


        // Get jsonld data
        console.log('Getting JSON-LD data...');
        const jsonLdData = await getJsonLdData(page);
        await saveTextFile(path.join(directoryDEV, 'jsonld.json'), JSON.stringify(jsonLdData, null, 2));

        // Get og data
        console.log('Getting Open Graph data...');
        const ogData = await getOgData(page);
        await saveTextFile(path.join(directoryDEV, 'og.json'), JSON.stringify(ogData, null, 2));

        // Get page data
        console.log('Getting page data...');
        const pageData = await getPageData(page);
        await saveTextFile(path.join(directoryDEV, 'page_data.json'), JSON.stringify(pageData, null, 2));

        // Get internal links
        console.log('Getting internal links...');
        const internalLinks = await getInternalLinks(page, targetUrl);
        await saveTextFile(path.join(directoryDEV, 'internal_links.json'), JSON.stringify(internalLinks, null, 2));

        // Get external links
        console.log('Getting external links...');
        const externalLinks = await getExternalLinks(page, targetUrl);
        await saveTextFile(path.join(directoryDEV, 'external_links.json'), JSON.stringify(externalLinks, null, 2));

        // Get social info
        console.log('Getting social info...');
        const socialInfo = await getSocialInfo(page, targetUrl);
        await saveTextFile(path.join(directoryDEV, 'social_info.json'), JSON.stringify(socialInfo, null, 2));


        // Get media data
        console.log('Getting media data...');
        const mediaData = await getMedia(page, url);
        await saveTextFile(path.join(directoryDEV, 'media_data.json'), JSON.stringify(mediaData, null, 2));

        // Get table data
        console.log('Getting table data...');
        const tableData = await getTableData(page);
        await saveTextFile(path.join(directoryDEV, 'table_data.json'), JSON.stringify(tableData, null, 2));
        await saveTextFile(path.join(directoryDEV, 'table_data.csv'), convertDataTableToCSV(tableData));


        // Get forms data
        console.log('Getting forms data...');
        const formsData = await getForms(page, url);
        await saveTextFile(path.join(directoryDEV, 'forms_data.json'), JSON.stringify(formsData, null, 2));

        // Always close the page when done to prevent memory leaks in the remote browser
        console.log('Closing the page...');
        await page.close();

        return {
            url: targetUrl,
            title: title,
            html: htmlContent
        };
    } catch (err) {
        return {
            url: targetUrl,
            error: err.message
        };
    } finally {
        if (browser) {
            await browser.disconnect();
        }
    }
}



async function getPageData(page) {

    try {
        // Extract all main information inside the browser context
        const pageData = await page.evaluate(() => {
            // 1. Helper to safely get meta tag content
            const getMetaContent = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.getAttribute('content') : null;
            };

            // 2. Extract Open Graph (OG) tags
            const ogData = {};
            document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
                const property = tag.getAttribute('property').replace('og:', '');
                ogData[property] = tag.getAttribute('content');
            });

            // 3. Extract Schema.org JSON-LD structured data
            const jsonLdData = [];
            document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                try {
                    jsonLdData.push(JSON.parse(script.textContent));
                } catch (e) {
                    // Ignore malformed JSON-LD tags
                }
            });

            // 4. Extract Headings (H1, H2, H3)
            const headings = {
                h1: Array.from(document.querySelectorAll('h1')).map(el => el.innerText.trim()),
                h2: Array.from(document.querySelectorAll('h2')).map(el => el.innerText.trim()),
                h3: Array.from(document.querySelectorAll('h3')).map(el => el.innerText.trim())
            };

            // 5. Compile all primary information
            return {
                url: window.location.href,
                title: document.title || null,
                description: getMetaContent('meta[name="description"]') || getMetaContent('meta[property="og:description"]'),
                canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || null,
                language: document.documentElement.lang || null,
                author: getMetaContent('meta[name="author"]') || null,
                openGraph: ogData,
                schemaJsonLd: jsonLdData,
                headings: headings,
                textSample: document.body ? document.body.innerText.substring(0, 500).replace(/\s+/g, ' ').trim() : null
            };
        });

        return pageData;

    } catch (err) {
        console.error('Error extracting page data:', err.message);
        return { error: err.message };
    }
}

async function getJsonLdData(page) {

    try {

        // Extract JSON-LD scripts from the page
        const jsonLdData = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            const data = [];
            scripts.forEach(script => {
                try {
                    // Parse the inner text of each schema script tag
                    const parsed = JSON.parse(script.textContent);
                    data.push(parsed);
                } catch (e) {
                    console.error('Failed to parse JSON-LD script:', e.message);
                }
            });

            return data;
        });


        return jsonLdData;

    } catch (err) {
        console.error('Error extracting JSON-LD data:', err.message);
        return { error: err.message };

    }
}

async function getOgData(page) {

    try {

        // Extract Open Graph meta tags inside the browser context
        const ogData = await page.evaluate(() => {
            const metaTags = document.querySelectorAll('meta[property^="og:"]');
            const data = {};

            metaTags.forEach(tag => {
                const property = tag.getAttribute('property'); // e.g., "og:title"
                const content = tag.getAttribute('content');   // e.g., "My Awesome Page"

                // Clean up the property name by removing "og:" for a cleaner object key
                const key = property.replace('og:', '');
                data[key] = content;
            });

            return data;
        });


        return ogData;

    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}




async function getInternalLinks(page, pageUrl) {

    try {

        const internalLinks = await page.evaluate((pageUrl) => {
            const currentHost = new URL(pageUrl).hostname;
            const anchors = document.querySelectorAll('a[href]');
            const linksSet = new Set();

            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');

                try {
                    // Resolve relative links (e.g., "/about") into absolute URLs (e.g., "https://example.com/about")
                    const absoluteUrl = new URL(href, pageUrl);

                    // Check if the link belongs to the same domain (internal link)
                    // and ignore fragments (#), mailto:, javascript:, etc.
                    if (
                        absoluteUrl.hostname === currentHost &&
                        ['http:', 'https:'].includes(absoluteUrl.protocol)
                    ) {
                        // Strip out hash fragments to avoid duplicates (e.g., /page#section)
                        absoluteUrl.hash = '';
                        linksSet.add(absoluteUrl.href);
                    }
                } catch (e) {
                    // Ignore invalid URLs
                }
            });

            return Array.from(linksSet);
        }, pageUrl);

        return internalLinks;


    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}





async function getExternalLinks(page, pageUrl) {

    try {

        // Extract and filter external links inside the browser context
        const externalLinks = await page.evaluate((pageUrl) => {
            const currentHost = new URL(pageUrl).hostname;
            const anchors = document.querySelectorAll('a[href]');
            const linksSet = new Set();

            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');

                try {
                    // Resolve relative links into absolute URLs
                    const absoluteUrl = new URL(href, pageUrl);

                    // Check if the link has a different hostname (external link)
                    // and uses http/https protocols (ignoring mailto:, tel:, javascript:, etc.)
                    if (
                        absoluteUrl.hostname !== currentHost &&
                        ['http:', 'https:'].includes(absoluteUrl.protocol)
                    ) {
                        // Strip out hash fragments to avoid duplicates
                        absoluteUrl.hash = '';
                        linksSet.add(absoluteUrl.href);
                    }
                } catch (e) {
                    // Ignore invalid URLs
                }
            });

            return Array.from(linksSet);
        }, pageUrl);

        return externalLinks;


    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}





async function getSocialInfo(page, pageUrl) {

    try {

        // Extract contacts and social profiles inside the browser context
        const data = await page.evaluate(() => {
            const bodyText = document.body ? document.body.innerText : '';

            // 1. Extract Social Media Links
            const socialPlatforms = {
                'facebook.com': 'facebook',
                'twitter.com': 'twitter',
                'x.com': 'twitter',
                'linkedin.com': 'linkedin',
                'instagram.com': 'instagram',
                'github.com': 'github',
                'youtube.com': 'youtube',
                'tiktok.com': 'tiktok'
            };

            const socials = {};
            const anchors = document.querySelectorAll('a[href]');

            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                try {
                    const absoluteUrl = new URL(href, window.location.href);
                    for (const [domain, platform] of Object.entries(socialPlatforms)) {
                        if (absoluteUrl.hostname.includes(domain)) {
                            // Keep the main profile/page link (avoiding generic share links)
                            if (!socials[platform]) {
                                socials[platform] = absoluteUrl.href;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore invalid URLs
                }
            });

            // 2. Extract Emails using Regex
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const foundEmails = bodyText.match(emailRegex) || [];

            // Also check mailto: links which are often hidden from plain text
            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                if (href && href.startsWith('mailto:')) {
                    const email = href.replace('mailto:', '').split('?')[0].trim();
                    if (email) foundEmails.push(email);
                }
            });

            // Deduplicate emails
            const uniqueEmails = Array.from(new Set(foundEmails));

            // 3. Extract Phone Numbers using Regex (handles common international/local formats)
            const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
            const foundPhones = bodyText.match(phoneRegex) || [];

            // Also check tel: links
            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                if (href && href.startsWith('tel:')) {
                    const phone = href.replace('tel:', '').trim();
                    if (phone) foundPhones.push(phone);
                }
            });

            // Deduplicate phone numbers and filter out weird short matches
            const uniquePhones = Array.from(new Set(foundPhones)).filter(p => p.replace(/\D/g, '').length >= 7);

            return {
                emails: uniqueEmails,
                phones: uniquePhones,
                socialProfiles: socials
            };
        });

        return data;


    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}





async function getMedia(page, pageUrl) {

    try {

        // Extract images and videos inside the browser context
        const mediaData = await page.evaluate((pageUrl) => {
            // 1. Extract Images
            const images = [];
            document.querySelectorAll('img').forEach(img => {
                try {
                    const absoluteUrl = new URL(img.src, pageUrl).href;
                    images.push({
                        src: absoluteUrl,
                        alt: img.alt ? img.alt.trim() : null,
                        width: img.naturalWidth || img.width || null,
                        height: img.naturalHeight || img.height || null
                    });
                } catch (e) {
                    // Ignore invalid image sources
                }
            });

            // 2. Extract Videos (<video> tags and embedded iframes)
            const videos = [];

            // Capture native HTML5 <video> tags
            document.querySelectorAll('video').forEach(video => {
                try {
                    const sources = [];
                    if (video.src) sources.push(new URL(video.src, pageUrl).href);
                    video.querySelectorAll('source').forEach(source => {
                        if (source.src) sources.push(new URL(source.src, pageUrl).href);
                    });

                    videos.push({
                        type: 'html5',
                        poster: video.poster ? new URL(video.poster, pageUrl).href : null,
                        sources: sources
                    });
                } catch (e) { }
            });

            // Capture embedded video iframes (YouTube, Vimeo, etc.)
            document.querySelectorAll('iframe').forEach(iframe => {
                const src = iframe.src;
                if (src && (src.includes('youtube.com') || src.includes('youtu.be') || src.includes('vimeo.com'))) {
                    try {
                        videos.push({
                            type: 'embed',
                            sources: [new URL(src, pageUrl).href]
                        });
                    } catch (e) { }
                }
            });

            return {
                images: Array.from(new Set(images.map(i => JSON.stringify(i)))).map(i => JSON.parse(i)), // Deduplicate identical image records
                videos: videos
            };
        }, pageUrl);

        return mediaData;


    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}





async function getMarkdown(page, pageUrl) {

    try {

       // Extract body HTML while cleaning out non-content elements
        const htmlContent = await page.evaluate(() => {
            // Clone the body to avoid mutating the live page DOM
            const clone = document.body.cloneNode(true);

            // Remove clutter elements that you usually don't want in markdown
            const clutterSelectors = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript'];
            clutterSelectors.forEach(selector => {
                clone.querySelectorAll(selector).forEach(el => el.remove());
            });

            return clone.innerHTML;
        });

        // Initialize Turndown service for HTML-to-Markdown conversion
        const turndownService = new TurndownService({
            headingStyle: 'atx', // Use # for headings instead of underlines
            bulletListMarker: '-'
        });

        const markdown = turndownService.turndown(htmlContent);
        return markdown;


    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}



async function getForms(page, pageUrl) {

    try {

       // Extract form details inside the browser context
        const formsData = await page.evaluate((pageUrl) => {
            const forms = document.querySelectorAll('form');
            const allForms = [];

            forms.forEach((form, index) => {
                const formData = {
                    formIndex: index + 1,
                    id: form.id || null,
                    name: form.name || null,
                    action: form.action ? new URL(form.action, pageUrl).href : null,
                    method: form.method ? form.method.toUpperCase() : 'GET',
                    inputs: []
                };

                // Query all interactive fields inside the form
                const fields = form.querySelectorAll('input, textarea, select');

                fields.forEach(field => {
                    const fieldData = {
                        tag: field.tagName.toLowerCase(),
                        type: field.type || null,
                        name: field.name || null,
                        id: field.id || null,
                        placeholder: field.placeholder || null,
                        required: field.required || false,
                        value: field.value || null
                    };

                    // If the field is a <select> dropdown, extract its options
                    if (field.tagName.toLowerCase() === 'select') {
                        fieldData.options = Array.from(field.options).map(opt => ({
                            text: opt.text.trim(),
                            value: opt.value,
                            selected: opt.selected
                        }));
                    }

                    formData.inputs.push(fieldData);
                });

                allForms.push(formData);
            });

            return allForms;
        }, pageUrl);

        return formsData;

    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}







async function getTableData(page) {

    try {

        // Extract tables inside the browser context
        const tablesData = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            const allTables = [];

            tables.forEach((table, tableIndex) => {
                const rows = table.querySelectorAll('tr');
                const tableData = {
                    tableIndex: tableIndex + 1,
                    headers: [],
                    rows: []
                };

                rows.forEach((row, rowIndex) => {
                    const headers = row.querySelectorAll('th');
                    const cells = row.querySelectorAll('td');

                    // If the row contains header elements, capture them
                    if (headers.length > 0 && tableData.headers.length === 0) {
                        headers.forEach(th => tableData.headers.push(th.innerText.trim()));
                    }
                    // Otherwise, capture normal row cells
                    else if (cells.length > 0) {
                        const rowData = [];
                        cells.forEach(td => rowData.push(td.innerText.trim()));
                        tableData.rows.push(rowData);
                    }
                });

                // If no <th> was found, try mapping the first <tr> cells as headers if it looks like a header row
                if (tableData.headers.length === 0 && tableData.rows.length > 0) {
                    // Optional fallback: treat the first row as headers if needed
                    // tableData.headers = tableData.rows.shift(); 
                }

                allTables.push(tableData);
            });

            return allTables;
        });

        return tablesData;


    } catch (err) {
        console.error('Error extracting Open Graph data:', err.message);
        return { error: err.message };

    }
}




function convertDataTableToCSV(dataTable) {
    if (!dataTable || !dataTable.length) {
        return '';
    }

    // 1. Extract the column headers (from keys of the first object)
    const headers = Object.keys(dataTable[0]);

    // 2. Map through each row and escape values
    const csvRows = dataTable.map(row => {
        return headers.map(header => {
            const value = row[header];
            // Convert value to a string string and handle null/undefined
            let stringValue = value === null || value === undefined ? '' : String(value);

            // Escape internal double quotes by doubling them up
            stringValue = stringValue.replace(/"/g, '""');

            // If the value contains commas, quotes, or newlines, wrap it in double quotes
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
                stringValue = `"${stringValue}"`;
            }

            return stringValue;
        }).join(','); // Join fields with a comma
    });

    // 3. Combine headers and rows, separated by a newline character
    return [headers.join(','), ...csvRows].join('\n');
}