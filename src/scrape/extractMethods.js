

import TurndownService from 'turndown';

export async function extractAll(page, targetUrl){

    const extractedData = await page.evaluate((pageUrl) => {

            let htmlContent = document.documentElement.outerHTML
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
                html: htmlContent,
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

        const turndownService = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
        const markdownContent = turndownService.turndown(extractedData.cleanHtmlForMarkdown);
        extractedData.cleanHtmlForMarkdown = undefined
        extractedData.markdown = markdownContent


        return extractedData
}

