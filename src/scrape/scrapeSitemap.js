import { XMLParser } from 'fast-xml-parser';



export async function getSitemap(sitemapUrl) {

    let sitemaps =  await getSitemapsFromRobotsTxt(sitemapUrl)
    let results = await getSitemapUrls(sitemaps)
    return results
}


async function getSitemapsFromRobotsTxt(baseUrl) {
    try {
        // Ensure the base URL is formatted correctly (e.g., https://example.com)
        const urlObj = new URL(baseUrl);
        const robotsUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`;

        console.log(`Fetching robots.txt from: ${robotsUrl}`);
        const response = await fetch(robotsUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch robots.txt (Status: ${response.status})`);
        }

        const robotsText = await response.text();
        const lines = robotsText.split(/\r?\n/);
        const sitemapUrls = [];

        // Scan each line for the "Sitemap:" directive
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.toLowerCase().startsWith('sitemap:')) {
                // Extract everything after "Sitemap:" and trim whitespace
                const sitemapUrl = trimmedLine.substring(8).trim();
                if (sitemapUrl) {
                    sitemapUrls.push(sitemapUrl);
                }
            }
        }

        return sitemapUrls;

    } catch (error) {
        console.error(`Error reading robots.txt: ${error.message}`);
        return [];
    }
}


async function getSitemapUrls(sitemapUrl) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true // Simplifies tags like <xhtml:link> to <link>
    });

    try {
        console.log(`Fetching sitemap: ${sitemapUrl}`);
        const response = await fetch(sitemapUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlText = await response.text();
        const jsonObj = parser.parse(xmlText);

        let allUrls = [];

        // Case 1: It's a Sitemap Index (contains a list of other sitemaps)
        if (jsonObj.sitemapindex && jsonObj.sitemapindex.sitemap) {
            const sitemaps = Array.isArray(jsonObj.sitemapindex.sitemap) 
                ? jsonObj.sitemapindex.sitemap 
                : [jsonObj.sitemapindex.sitemap];

            console.log(`Found sitemap index with ${sitemaps.length} sub-sitemaps. Fetching them...`);

            for (const sm of sitemaps) {
                if (sm.loc) {
                    // Recursively fetch sub-sitemaps
                    const subUrls = await getSitemapUrls(sm.loc);
                    allUrls.push(...subUrls);
                }
            }
        } 
        // Case 2: It's a standard URL set sitemap
        else if (jsonObj.urlset && jsonObj.urlset.url) {
            const urls = Array.isArray(jsonObj.urlset.url) 
                ? jsonObj.urlset.url 
                : [jsonObj.urlset.url];

            for (const entry of urls) {
                if (entry.loc) {
                    allUrls.push({
                        loc: entry.loc,
                        lastmod: entry.lastmod || null,
                        changefreq: entry.changefreq || null,
                        priority: entry.priority || null
                    });
                }
            }
        }

        return allUrls;

    } catch (error) {
        console.error(`Error parsing sitemap (${sitemapUrl}): ${error.message}`);
        return [];
    }
}

