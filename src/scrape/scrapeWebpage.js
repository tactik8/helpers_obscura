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
    let browser;

    try {
        let u = new URL(url);
        let domain = u.hostname;
        domain = domain.replace('www.', '');
        domain = encodeURIComponent(domain);

        let safeUrl = encodeURIComponent(url);
        let date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        let directoryDEV = `./file_library/data/${domain}/${safeUrl}/${date}`;
        await ensureDirectoryExists(directoryDEV);

        browser = await puppeteer.connect({
            browserWSEndpoint: 'ws://192.168.2.243:9222',
        });

        console.log('Navigating to URL:', targetUrl);
        const page = await browser.newPage();

        // Optional optimization: skip loading heavy media/stylesheets to speed up navigation
        if (1 == 0) {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
        }

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

        // Grab basic raw outputs
        const htmlContent = await page.content();
        const title = await page.title();

        // Save raw HTML and screenshot
        const htmlFilePath = path.join(directoryDEV, 'page.html');
        await saveTextFile(htmlFilePath, htmlContent);

        await page.screenshot({
            path: `${directoryDEV}/screenshot.png`,
            fullPage: true,
        });

        // ==========================================
        // SINGLE UNIFIED PAGE EVALUATE (ALL-IN-ONE)
        // ==========================================
        console.log('Extracting all page data in a single pass...');
        const extractedData = await page.evaluate((pageUrl) => {
            const bodyText = document.body ? document.body.innerText : '';

            // 1. Page Data & Metadata
            const getMetaContent = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.getAttribute('content') : null;
            };

            const ogData = {};
            document.querySelectorAll('meta[property^="og:"]').forEach(tag => {
                const property = tag.getAttribute('property').replace('og:', '');
                ogData[property] = tag.getAttribute('content');
            });

            const jsonLdData = [];
            document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
                try {
                    jsonLdData.push(JSON.parse(script.textContent));
                } catch (e) { }
            });

            const headings = {
                h1: Array.from(document.querySelectorAll('h1')).map(el => el.innerText.trim()),
                h2: Array.from(document.querySelectorAll('h2')).map(el => el.innerText.trim()),
                h3: Array.from(document.querySelectorAll('h3')).map(el => el.innerText.trim())
            };

            const pageData = {
                url: window.location.href,
                title: document.title || null,
                description: getMetaContent('meta[name="description"]') || getMetaContent('meta[property="og:description"]'),
                canonicalUrl: document.querySelector('link[rel="canonical"]')?.href || null,
                language: document.documentElement.lang || null,
                author: getMetaContent('meta[name="author"]') || null,
                openGraph: ogData,
                schemaJsonLd: jsonLdData,
                headings: headings,
                textSample: bodyText.substring(0, 500).replace(/\s+/g, ' ').trim()
            };

            // 2. Links (Internal & External)
            const currentHost = new URL(pageUrl).hostname;
            const anchors = document.querySelectorAll('a[href]');
            const internalSet = new Set();
            const externalSet = new Set();

            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                try {
                    const absoluteUrl = new URL(href, pageUrl);
                    if (['http:', 'https:'].includes(absoluteUrl.protocol)) {
                        absoluteUrl.hash = '';
                        if (absoluteUrl.hostname === currentHost) {
                            internalSet.add(absoluteUrl.href);
                        } else {
                            externalSet.add(absoluteUrl.href);
                        }
                    }
                } catch (e) { }
            });

            // 3. Social & Contact Info
            const socialPlatforms = {
                'facebook.com': 'facebook', 'twitter.com': 'twitter', 'x.com': 'twitter',
                'linkedin.com': 'linkedin', 'instagram.com': 'instagram', 'github.com': 'github',
                'youtube.com': 'youtube', 'tiktok.com': 'tiktok'
            };
            const socials = {};
            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                try {
                    const absoluteUrl = new URL(href, pageUrl);
                    for (const [domain, platform] of Object.entries(socialPlatforms)) {
                        if (absoluteUrl.hostname.includes(domain) && !socials[platform]) {
                            socials[platform] = absoluteUrl.href;
                        }
                    }
                } catch (e) { }
            });

            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const foundEmails = bodyText.match(emailRegex) || [];
            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                if (href && href.startsWith('mailto:')) {
                    const email = href.replace('mailto:', '').split('?')[0].trim();
                    if (email) foundEmails.push(email);
                }
            });

            const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
            const foundPhones = bodyText.match(phoneRegex) || [];
            anchors.forEach(anchor => {
                const href = anchor.getAttribute('href');
                if (href && href.startsWith('tel:')) {
                    const phone = href.replace('tel:', '').trim();
                    if (phone) foundPhones.push(phone);
                }
            });

            const socialInfo = {
                emails: Array.from(new Set(foundEmails)),
                phones: Array.from(new Set(foundPhones)).filter(p => p.replace(/\D/g, '').length >= 7),
                socialProfiles: socials
            };

            // 4. Media Assets
            const images = [];
            document.querySelectorAll('img').forEach(img => {
                try {
                    images.push({
                        src: new URL(img.src, pageUrl).href,
                        alt: img.alt ? img.alt.trim() : null,
                        width: img.naturalWidth || img.width || null,
                        height: img.naturalHeight || img.height || null
                    });
                } catch (e) { }
            });

            const videos = [];
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

            document.querySelectorAll('iframe').forEach(iframe => {
                const src = iframe.src;
                if (src && (src.includes('youtube.com') || src.includes('youtu.be') || src.includes('vimeo.com'))) {
                    try {
                        videos.push({ type: 'embed', sources: [new URL(src, pageUrl).href] });
                    } catch (e) { }
                }
            });

            const mediaData = {
                images: Array.from(new Set(images.map(i => JSON.stringify(i)))).map(i => JSON.parse(i)),
                videos: videos
            };

            // 5. Tables
            const tablesData = [];
            document.querySelectorAll('table').forEach((table, tableIndex) => {
                const rows = table.querySelectorAll('tr');
                const tableObj = { tableIndex: tableIndex + 1, headers: [], rows: [] };
                rows.forEach(row => {
                    const headers = row.querySelectorAll('th');
                    const cells = row.querySelectorAll('td');
                    if (headers.length > 0 && tableObj.headers.length === 0) {
                        headers.forEach(th => tableObj.headers.push(th.innerText.trim()));
                    } else if (cells.length > 0) {
                        const rowData = [];
                        cells.forEach(td => rowData.push(td.innerText.trim()));
                        tableObj.rows.push(rowData);
                    }
                });
                tablesData.push(tableObj);
            });

            // 6. Forms
            const formsData = [];
            document.querySelectorAll('form').forEach((form, index) => {
                const formData = {
                    formIndex: index + 1,
                    id: form.id || null,
                    name: form.name || null,
                    action: form.action ? new URL(form.action, pageUrl).href : null,
                    method: form.method ? form.method.toUpperCase() : 'GET',
                    inputs: []
                };
                form.querySelectorAll('input, textarea, select').forEach(field => {
                    const fieldData = {
                        tag: field.tagName.toLowerCase(),
                        type: field.type || null,
                        name: field.name || null,
                        id: field.id || null,
                        placeholder: field.placeholder || null,
                        required: field.required || false,
                        value: field.value || null
                    };
                    if (field.tagName.toLowerCase() === 'select') {
                        fieldData.options = Array.from(field.options).map(opt => ({
                            text: opt.text.trim(),
                            value: opt.value,
                            selected: opt.selected
                        }));
                    }
                    formData.inputs.push(fieldData);
                });
                formsData.push(formData);
            });

            // 7. Markdown HTML Cleanup
            const clone = document.body.cloneNode(true);
            ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript'].forEach(selector => {
                clone.querySelectorAll(selector).forEach(el => el.remove());
            });

            return {
                pageData,
                internalLinks: Array.from(internalSet),
                externalLinks: Array.from(externalSet),
                socialInfo,
                mediaData,
                tableData: tablesData,
                formsData,
                cleanHtmlForMarkdown: clone.innerHTML
            };
        }, targetUrl);

        // ==========================================
        // SAVE ALL DATA TO FILES
        // ==========================================
        console.log('Saving extracted data files...');

        // Markdown conversion
        const turndownService = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
        const markdownContent = turndownService.turndown(extractedData.cleanHtmlForMarkdown);
        await saveTextFile(path.join(directoryDEV, 'page.md'), markdownContent);

        // JSON-LD & OG files
        await saveTextFile(path.join(directoryDEV, 'jsonld.json'), JSON.stringify(extractedData.pageData.schemaJsonLd, null, 2));
        await saveTextFile(path.join(directoryDEV, 'og.json'), JSON.stringify(extractedData.pageData.openGraph, null, 2));

        // General page data
        await saveTextFile(path.join(directoryDEV, 'page_data.json'), JSON.stringify(extractedData.pageData, null, 2));

        // Links
        await saveTextFile(path.join(directoryDEV, 'internal_links.json'), JSON.stringify(extractedData.internalLinks, null, 2));
        await saveTextFile(path.join(directoryDEV, 'external_links.json'), JSON.stringify(extractedData.externalLinks, null, 2));

        // Social Info
        await saveTextFile(path.join(directoryDEV, 'social_info.json'), JSON.stringify(extractedData.socialInfo, null, 2));

        // Media & Tables & Forms
        await saveTextFile(path.join(directoryDEV, 'media_data.json'), JSON.stringify(extractedData.mediaData, null, 2));
        await saveTextFile(path.join(directoryDEV, 'table_data.json'), JSON.stringify(extractedData.tableData, null, 2));
        await saveTextFile(path.join(directoryDEV, 'table_data.csv'), convertDataTableToCSV(extractedData.tableData));
        await saveTextFile(path.join(directoryDEV, 'forms_data.json'), JSON.stringify(extractedData.formsData, null, 2));

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

function convertDataTableToCSV(dataTable) {
    if (!dataTable || !dataTable.length) {
        return '';
    }

    const headers = Object.keys(dataTable[0]);
    const csvRows = dataTable.map(row => {
        return headers.map(header => {
            const value = row[header];
            let stringValue = value === null || value === undefined ? '' : String(value);
            stringValue = stringValue.replace(/"/g, '""');
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
                stringValue = `"${stringValue}"`;
            }
            return stringValue;
        }).join(',');
    });

    return [headers.join(','), ...csvRows].join('\n');
}